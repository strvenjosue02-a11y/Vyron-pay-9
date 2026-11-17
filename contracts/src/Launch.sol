// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @dev Interfaz mínima del NonfungiblePositionManager de Uniswap v3 (auditado).
interface INPM {
    struct MintParams {
        address token0; address token1; uint24 fee; int24 tickLower; int24 tickUpper;
        uint256 amount0Desired; uint256 amount1Desired; uint256 amount0Min; uint256 amount1Min;
        address recipient; uint256 deadline;
    }
    struct CollectParams { uint256 tokenId; address recipient; uint128 amount0Max; uint128 amount1Max; }
    function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool);
    function mint(MintParams calldata params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);
}
interface IPoolSlot0 { function slot0() external view returns (uint160 sqrtPriceX96, int24, uint16, uint16, uint16, uint8, bool); }

/// @title Launch - lanzamiento rápido, todo o nada, con pool bloqueado para siempre.
/// @notice Este contrato es a la vez el token y la caja de la ronda.
///  - SIN dueño, SIN pausa, SIN upgrade, SIN función para mintear a voluntad.
///  - Meta fija: solo 100, 500 o 2.000 USDC. Sin plazo: la ronda se cierra en el instante en que se llena.
///  - Mientras NO esté llena, cada quien puede sacar su dinero cuando quiera (withdraw).
///  - Al llenarse: el USDC (menos 1% de comisión) va a un pool de Uniswap v3 al MISMO precio que pagaron todos.
///    El recibo (NFT) de esa liquidez queda dentro de este contrato y NO existe ninguna función para sacarlo:
///    el pool es permanente. Solo se pueden cobrar las comisiones de trading (collectFees), mitad plataforma, mitad creador.
///  - El creador elige su parte (0, 5 o 10%) y su goteo (4, 8 o 12 semanas) con el VestingWallet de OpenZeppelin. La plataforma, 1,5% (inmediato).
///  - Despliegue perezoso: la dirección existe desde ya (CREATE2) y el primero que deposita lo despliega.
contract Launch is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State { Open, Live, Refund }

    struct Params {
        IERC20 usdc;
        address platform;        // recibe 1% del USDC, 1,5% de los tokens y la mitad de las comisiones del pool
        address creator;         // recibe 5% de los tokens (con goteo) y la otra mitad de las comisiones
        string name;
        string symbol;
        uint256 goal;            // 100e6, 500e6 o 2000e6
        address positionManager; // NonfungiblePositionManager de Uniswap v3
        uint8 creatorPct;        // lo elige el creador: 0, 5 o 10 (% de referencia de los tokens)
        uint8 vestingWeeks;      // lo elige el creador: 4, 8 o 12 semanas de goteo
    }

    uint256 public constant BACKER_TOKENS = 500_000_000 ether;   // lo que reparte la ronda entre quienes aportan
    uint256 public constant TOKENS_PER_PCT = 10_000_000 ether;   // 1% de referencia = 10M tokens
    uint256 public constant PLATFORM_TOKENS = 15_000_000 ether;  // 1,5% de referencia
    uint256 public constant FEE_BPS = 100;                       // 1% del USDC
    uint24 public constant POOL_FEE = 3000;
    int24 internal constant MIN_TICK = -887220;
    int24 internal constant MAX_TICK = 887220;

    IERC20 public immutable usdc;
    address public immutable platform;
    address public immutable creator;
    uint256 public immutable goal;
    INPM public immutable positionManager;
    uint256 public immutable creatorTokens;
    uint64 public immutable vestingSeconds;

    State public state;
    uint256 public raised;
    mapping(address => uint256) public contributed;
    address public pool;
    uint256 public lpTokenId;
    address public vesting;

    event Deposited(address indexed from, address indexed to, uint256 amount, uint256 raised);
    event Withdrawn(address indexed who, uint256 amount, uint256 raised);
    event Filled(address pool, uint256 lpTokenId, uint256 usdcInPool, address vesting);
    event Refunding(address pool);
    event Claimed(address indexed who, uint256 tokens);
    event FeesCollected(uint256 usdcFees, uint256 tokenFees);

    error WrongState();
    error BadParams();
    error ZeroAmount();
    error TooMuch();

    constructor(Params memory p) ERC20(p.name, p.symbol) {
        if (
            address(p.usdc) == address(0) || p.platform == address(0) || p.creator == address(0) || p.positionManager == address(0)
                || (p.goal != 100e6 && p.goal != 500e6 && p.goal != 2000e6) || bytes(p.name).length == 0 || bytes(p.symbol).length == 0
                || bytes(p.name).length > 32 || bytes(p.symbol).length > 10
                || (p.creatorPct != 0 && p.creatorPct != 5 && p.creatorPct != 10) || (p.vestingWeeks != 4 && p.vestingWeeks != 8 && p.vestingWeeks != 12)
        ) revert BadParams();
        usdc = p.usdc;
        platform = p.platform;
        creator = p.creator;
        goal = p.goal;
        positionManager = INPM(p.positionManager);
        creatorTokens = uint256(p.creatorPct) * TOKENS_PER_PCT;
        vestingSeconds = uint64(p.vestingWeeks) * 7 days;
    }

    /// @notice Mete USDC en la ronda. Si con esto se llega a la meta, la ronda se cierra y abre el mercado.
    function deposit(uint256 amount, address to) external nonReentrant {
        if (state != State.Open) revert WrongState();
        if (amount == 0 || to == address(0)) revert ZeroAmount();
        if (raised + amount > goal) revert TooMuch();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        contributed[to] += amount;
        raised += amount;
        emit Deposited(msg.sender, to, amount, raised);
        if (raised == goal) _fill();
    }

    /// @notice Saca tu dinero mientras la ronda no esté llena (o si quedó en reembolso).
    function withdraw() external nonReentrant {
        if (state == State.Live) revert WrongState();
        uint256 amt = contributed[msg.sender];
        if (amt == 0) revert ZeroAmount();
        contributed[msg.sender] = 0;
        if (state == State.Open) raised -= amt;
        emit Withdrawn(msg.sender, amt, raised);
        usdc.safeTransfer(msg.sender, amt);
    }

    /// @notice Cuando la ronda se llenó, cada aportante reclama sus tokens. Mismo precio para todos.
    function claim() external nonReentrant {
        if (state != State.Live) revert WrongState();
        uint256 amt = contributed[msg.sender];
        if (amt == 0) revert ZeroAmount();
        contributed[msg.sender] = 0;
        uint256 tokens = amt * BACKER_TOKENS / goal;
        emit Claimed(msg.sender, tokens);
        _mint(msg.sender, tokens);
    }

    /// @notice Cobra las comisiones del pool y las reparte mitad plataforma, mitad creador. Es lo ÚNICO que sale del pool.
    function collectFees() external nonReentrant {
        if (state != State.Live) revert WrongState();
        (uint256 a0, uint256 a1) = positionManager.collect(INPM.CollectParams({
            tokenId: lpTokenId, recipient: address(this), amount0Max: type(uint128).max, amount1Max: type(uint128).max
        }));
        (uint256 fu, uint256 ft) = address(usdc) < address(this) ? (a0, a1) : (a1, a0);
        emit FeesCollected(fu, ft);
        if (fu > 0) { usdc.safeTransfer(platform, fu / 2); usdc.safeTransfer(creator, fu - fu / 2); }
        if (ft > 0) { _transfer(address(this), platform, ft / 2); _transfer(address(this), creator, ft - ft / 2); }
    }

    // ================================================================= internos

    function _fill() internal {
        uint256 fee = goal * FEE_BPS / 10_000;
        uint256 liqUsdc = goal - fee;
        uint256 liqTokens = liqUsdc * BACKER_TOKENS / goal; // mismo precio que pagaron los aportantes
        (address t0, address t1) = address(usdc) < address(this) ? (address(usdc), address(this)) : (address(this), address(usdc));
        (uint256 a0, uint256 a1) = t0 == address(usdc) ? (liqUsdc, liqTokens) : (liqTokens, liqUsdc);
        uint160 target = uint160(Math.sqrt(Math.mulDiv(a1, 1 << 96, a0)) << 48);
        address p = positionManager.createAndInitializePoolIfNecessary(t0, t1, POOL_FEE, target);
        pool = p;
        (uint160 current,,,,,,) = IPoolSlot0(p).slot0();
        uint256 diff = current > target ? current - target : target - current;
        if (diff * 1000 > uint256(target)) { // alguien inicializó el pool a otro precio: todos recuperan su dinero
            state = State.Refund;
            emit Refunding(p);
            return;
        }
        _mint(address(this), liqTokens);
        usdc.forceApprove(address(positionManager), liqUsdc);
        _approve(address(this), address(positionManager), liqTokens);
        (uint256 id,, uint256 u0, uint256 u1) = positionManager.mint(INPM.MintParams({
            token0: t0, token1: t1, fee: POOL_FEE, tickLower: MIN_TICK, tickUpper: MAX_TICK,
            amount0Desired: a0, amount1Desired: a1, amount0Min: a0 * 99 / 100, amount1Min: a1 * 99 / 100,
            recipient: address(this), deadline: block.timestamp
        }));
        (uint256 usedUsdc, uint256 usedTok) = t0 == address(usdc) ? (u0, u1) : (u1, u0);
        usdc.forceApprove(address(positionManager), 0);
        _approve(address(this), address(positionManager), 0);
        if (liqTokens > usedTok) _burn(address(this), liqTokens - usedTok);
        lpTokenId = id;
        state = State.Live;
        // el recibo (NFT) queda en este contrato y no hay ninguna función para moverlo: el pool es permanente
        usdc.safeTransfer(platform, goal - usedUsdc); // 1% + redondeo
        address vwAddr;
        if (creatorTokens > 0) {
            VestingWallet vw = new VestingWallet(creator, uint64(block.timestamp), vestingSeconds);
            vwAddr = address(vw);
            vesting = vwAddr;
            _mint(vwAddr, creatorTokens);
        }
        _mint(platform, PLATFORM_TOKENS);
        emit Filled(p, id, usedUsdc, vwAddr);
    }
}
