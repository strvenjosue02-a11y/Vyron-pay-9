// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @dev Interfaz mínima del NonfungiblePositionManager de Uniswap v3 (auditado).
interface IPositionManager {
    struct MintParams {
        address token0; address token1; uint24 fee; int24 tickLower; int24 tickUpper;
        uint256 amount0Desired; uint256 amount1Desired; uint256 amount0Min; uint256 amount1Min;
        address recipient; uint256 deadline;
    }
    function factory() external view returns (address);
    function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool);
    function mint(MintParams calldata params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    function transferFrom(address from, address to, uint256 tokenId) external;
}
interface IUniswapV3PoolState { function slot0() external view returns (uint160 sqrtPriceX96, int24, uint16, uint16, uint16, uint8, bool); }

/// @title Alcancia - venta de un proyecto con dinero bloqueado y entregas por etapas.
/// @notice Este contrato es a la vez el token del proyecto y la alcancía que guarda el USDC.
///         - SIN dueño, SIN pausa, SIN upgrade: nadie puede cambiar las reglas.
///         - El USDC solo sale por 3 puertas: reembolso al comprador, comisión de la plataforma,
///           y entregas por etapas al creador aprobadas por los compradores.
///         - Se despliega "perezosamente" con CREATE2 por el primer comprador: todas las reglas
///           están en los argumentos del constructor, que forman parte de la dirección.
contract Alcancia is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ----------------------------------------------------------------- reglas fijas
    uint256 public constant FEE_USDC_BPS = 100; // 1% del USDC juntado -> plataforma
    uint256 public constant FEE_TOKEN_BPS = 150; // 1,5% del supply final -> plataforma
    uint256 public constant BPS = 10_000;
    uint64 public constant VOTE_DURATION = 7 days;
    uint64 public constant LP_LOCK = 365 days; // bloqueo de la liquidez
    uint24 public constant POOL_FEE = 3000; // pool de 0,3% (tickSpacing 60)
    int24 internal constant MIN_TICK = -887220;
    int24 internal constant MAX_TICK = 887220;

    struct Params {
        IERC20 usdc; // stablecoin aceptada
        address platform; // wallet de comisiones
        address creator; // wallet que recibe las entregas
        string name;
        string symbol;
        uint256 softcap; // mínimo para que el proyecto siga (USDC)
        uint256 hardcap; // máximo (USDC)
        uint256 saleTokens; // tokens para compradores si se llega al hardcap
        uint256 creatorTokens; // tokens del creador, liberados por etapas
        uint64 saleEnd; // fin de la venta (timestamp)
        uint16 initialBps; // % entregado al creador al cerrar con éxito
        uint8 milestones; // cantidad de etapas que requieren voto
        uint64 milestonePeriod; // tiempo máximo para pedir cada etapa
        uint16 liquidityBps; // % de lo recaudado (tras comisión) que va al pool de Uniswap (0 o 500..2500)
        address positionManager; // NonfungiblePositionManager de Uniswap v3 (0 = sin pool)
    }

    enum State {
        Sale, // juntando dinero
        Active, // meta lograda, entregas por etapas
        Refunding // venta fallida o proyecto cancelado: devolver lo que queda
    }

    // ----------------------------------------------------------------- inmutables
    IERC20 public immutable usdc;
    address public immutable platform;
    address public immutable creator;
    uint256 public immutable softcap;
    uint256 public immutable hardcap;
    uint256 public immutable saleTokens;
    uint256 public immutable creatorTokens;
    uint64 public immutable saleEnd;
    uint16 public immutable initialBps;
    uint8 public immutable milestones;
    uint64 public immutable milestonePeriod;
    uint16 public immutable liquidityBps;
    IPositionManager public immutable positionManager;

    // ----------------------------------------------------------------- estado
    State public state;
    uint256 public totalRaised;
    mapping(address => uint256) public contributed;
    mapping(address => bool) public settled; // ya pidió reembolso
    mapping(address => bool) public claimedTokens; // ya reclamó sus tokens
    bool public succeeded; // la venta llegó al softcap

    uint256 public poolAfterFees; // USDC para el creador tras comisión
    uint256 public usdcReleased; // USDC ya entregado al creador
    uint256 public creatorTokensReleased;
    uint8 public milestonesDone;
    uint64 public deadline; // límite para pedir la siguiente etapa

    uint256 public refundPool; // USDC a repartir al pasar a Refunding

    // liquidez en Uniswap (el NFT de la posición queda en este contrato hasta lpUnlock)
    address public pool;
    uint256 public lpTokenId;
    uint64 public lpUnlock;
    uint256 public liquidityUsdc;

    // votación actual (peso = USDC aportado, no tokens: inmune a préstamos flash)
    uint64 public voteEnd;
    uint256 public votesYes;
    uint256 public votesNo;
    uint256 public voteRound;
    mapping(uint256 => mapping(address => bool)) public voted;

    // ----------------------------------------------------------------- eventos
    event Bought(address indexed buyer, uint256 usdcAmount);
    event Finalized(bool success, uint256 raised);
    event Claimed(address indexed buyer, uint256 tokens);
    event Refunded(address indexed buyer, uint256 usdcAmount);
    event VoteOpened(uint256 indexed round, uint64 voteEnd);
    event Voted(address indexed voter, uint256 indexed round, bool yes, uint256 weight);
    event Released(uint256 usdcAmount, uint256 tokenAmount, uint8 milestonesDone);
    event Cancelled(uint256 refundPool);
    event LiquidityAdded(address pool, uint256 tokenId, uint256 usdcAmount, uint256 tokenAmount, uint64 unlock);
    event LiquiditySkipped(address pool);
    event LiquidityWithdrawn(uint256 tokenId, address to);

    error BadParams();
    error WrongState();
    error SaleClosed();
    error SaleOpen();
    error ZeroAmount();
    error NotCreator();
    error VoteActive();
    error NoVote();
    error AlreadyVoted();
    error NothingToClaim();
    error TooEarly();

    constructor(Params memory p) ERC20(p.name, p.symbol) {
        if (
            address(p.usdc) == address(0) || p.platform == address(0) || p.creator == address(0)
                || p.softcap == 0 || p.softcap > p.hardcap || p.saleTokens == 0 || p.initialBps > BPS
                || p.saleEnd <= block.timestamp || p.milestonePeriod == 0 || (p.milestones == 0 && p.initialBps != BPS)
                || p.liquidityBps > 2500 || (p.liquidityBps > 0 && (p.liquidityBps < 500 || p.positionManager == address(0)))
        ) revert BadParams();

        usdc = p.usdc;
        platform = p.platform;
        creator = p.creator;
        softcap = p.softcap;
        hardcap = p.hardcap;
        saleTokens = p.saleTokens;
        creatorTokens = p.creatorTokens;
        saleEnd = p.saleEnd;
        initialBps = p.initialBps;
        milestones = p.milestones;
        milestonePeriod = p.milestonePeriod;
        liquidityBps = p.liquidityBps;
        positionManager = IPositionManager(p.positionManager);
    }

    // ================================================================= 1. VENTA

    /// @notice Pone USDC en la alcancía. Si supera el hardcap, solo se toma lo que falta.
    /// @param beneficiary quien queda como comprador (permite comprar en la misma tx del despliegue).
    function buy(uint256 amount, address beneficiary) external nonReentrant {
        if (state != State.Sale) revert WrongState();
        if (block.timestamp >= saleEnd || totalRaised >= hardcap) revert SaleClosed();
        uint256 room = hardcap - totalRaised;
        if (amount > room) amount = room;
        if (amount == 0 || beneficiary == address(0)) revert ZeroAmount();

        totalRaised += amount;
        contributed[beneficiary] += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Bought(beneficiary, amount);
    }

    /// @notice Cierra la venta. Cualquiera puede llamarlo cuando termina el tiempo o se llena.
    function finalize() external nonReentrant {
        if (state != State.Sale) revert WrongState();
        if (block.timestamp < saleEnd && totalRaised < hardcap) revert SaleOpen();

        if (totalRaised < softcap) {
            state = State.Refunding;
            refundPool = totalRaised; // sin comisión: se devuelve el 100%
            emit Finalized(false, totalRaised);
            return;
        }

        state = State.Active;
        succeeded = true;
        uint256 fee = totalRaised * FEE_USDC_BPS / BPS;
        uint256 afterFee = totalRaised - fee;
        uint256 liqUsdc = afterFee * liquidityBps / BPS;
        uint256 liqTokens = liqUsdc * saleTokens / hardcap; // mismo precio que la ronda
        poolAfterFees = afterFee - liqUsdc;

        // 1,5% del supply final para la plataforma.
        uint256 base = soldTokens() + creatorTokens + liqTokens;
        uint256 platformTokens = base * FEE_TOKEN_BPS / (BPS - FEE_TOKEN_BPS);
        _mint(platform, platformTokens);

        deadline = uint64(block.timestamp) + milestonePeriod;
        emit Finalized(true, totalRaised);

        usdc.safeTransfer(platform, fee);
        if (liqUsdc > 0) _addLiquidity(liqUsdc, liqTokens);
        _release(initialBps, milestones == 0);
    }

    /// @notice Tokens vendidos en total (proporcional a lo juntado vs hardcap).
    function soldTokens() public view returns (uint256) {
        return totalRaised * saleTokens / hardcap;
    }

    /// @notice El comprador recibe sus tokens después de un cierre exitoso.
    function claimTokens() external nonReentrant {
        if (!succeeded) revert WrongState();
        uint256 c = contributed[msg.sender];
        if (c == 0 || claimedTokens[msg.sender]) revert NothingToClaim();
        claimedTokens[msg.sender] = true;
        uint256 t = c * saleTokens / hardcap;
        _mint(msg.sender, t);
        emit Claimed(msg.sender, t);
    }

    /// @notice Reembolso proporcional de lo que queda en la alcancía (venta fallida o cancelada).
    function refund() external nonReentrant {
        if (state != State.Refunding) revert WrongState();
        uint256 c = contributed[msg.sender];
        if (c == 0 || settled[msg.sender]) revert NothingToClaim();
        settled[msg.sender] = true;
        uint256 amount = refundPool * c / totalRaised;
        usdc.safeTransfer(msg.sender, amount);
        emit Refunded(msg.sender, amount);
    }

    // ================================================================= 2. ETAPAS

    /// @notice El creador pide la siguiente etapa: se abre una votación de 7 días.
    function requestRelease() external {
        if (msg.sender != creator) revert NotCreator();
        if (state != State.Active || milestonesDone >= milestones) revert WrongState();
        if (voteEnd != 0) revert VoteActive();
        if (block.timestamp > deadline) revert TooEarly(); // se le pasó el plazo: ver abandon()
        voteRound++;
        voteEnd = uint64(block.timestamp) + VOTE_DURATION;
        votesYes = 0;
        votesNo = 0;
        emit VoteOpened(voteRound, voteEnd);
    }

    /// @notice Votan los compradores. Peso = USDC que aportaron.
    function vote(bool yes) external {
        if (voteEnd == 0 || block.timestamp >= voteEnd) revert NoVote();
        uint256 w = contributed[msg.sender];
        if (w == 0) revert NothingToClaim();
        if (voted[voteRound][msg.sender]) revert AlreadyVoted();
        voted[voteRound][msg.sender] = true;
        if (yes) votesYes += w;
        else votesNo += w;
        emit Voted(msg.sender, voteRound, yes, w);
    }

    /// @notice Cierra la votación. Si gana "no", el proyecto se cancela y se devuelve lo que queda.
    function closeVote() external nonReentrant {
        if (voteEnd == 0 || block.timestamp < voteEnd) revert NoVote();
        voteEnd = 0;
        if (votesNo > votesYes) {
            _cancel();
            return;
        }
        milestonesDone++;
        deadline = uint64(block.timestamp) + milestonePeriod;
        uint256 bps = (BPS - initialBps) / milestones;
        bool last = milestonesDone == milestones;
        _release(bps, last);
    }

    /// @notice Si el creador no pide la etapa a tiempo, cualquiera puede cancelar el proyecto.
    function abandon() external nonReentrant {
        if (state != State.Active || milestonesDone >= milestones) revert WrongState();
        if (voteEnd != 0) revert VoteActive();
        if (block.timestamp <= deadline) revert TooEarly();
        _cancel();
    }

    /// @notice Pasado el bloqueo de 12 meses, la posición de liquidez pasa al creador.
    function withdrawLiquidity() external nonReentrant {
        if (lpTokenId == 0 || block.timestamp < lpUnlock) revert TooEarly();
        uint256 id = lpTokenId;
        lpTokenId = 0;
        emit LiquidityWithdrawn(id, creator);
        positionManager.transferFrom(address(this), creator, id);
    }

    // ================================================================= internos

    /// @dev Crea el pool USDC/token al precio de la ronda y agrega liquidez de rango completo.
    ///      Si alguien inicializó antes el pool a otro precio, no se agrega nada (anti-manipulación)
    ///      y ese USDC vuelve a las entregas del equipo.
    function _addLiquidity(uint256 liqUsdc, uint256 liqTokens) internal {
        (address t0, address t1) = address(usdc) < address(this) ? (address(usdc), address(this)) : (address(this), address(usdc));
        (uint256 a0, uint256 a1) = t0 == address(usdc) ? (liqUsdc, liqTokens) : (liqTokens, liqUsdc);
        uint160 target = uint160(Math.sqrt(Math.mulDiv(a1, 1 << 96, a0)) << 48);
        address p = positionManager.createAndInitializePoolIfNecessary(t0, t1, POOL_FEE, target);
        pool = p;
        (uint160 current,,,,,,) = IUniswapV3PoolState(p).slot0();
        uint256 diff = current > target ? current - target : target - current;
        if (diff * 1000 > uint256(target)) { // más de 0,1% de diferencia en sqrtPrice: pool manipulado
            poolAfterFees += liqUsdc;
            emit LiquiditySkipped(p);
            return;
        }
        _mint(address(this), liqTokens);
        usdc.forceApprove(address(positionManager), liqUsdc);
        _approve(address(this), address(positionManager), liqTokens);
        (uint256 id,, uint256 u0, uint256 u1) = positionManager.mint(IPositionManager.MintParams({
            token0: t0, token1: t1, fee: POOL_FEE, tickLower: MIN_TICK, tickUpper: MAX_TICK,
            amount0Desired: a0, amount1Desired: a1, amount0Min: a0 * 99 / 100, amount1Min: a1 * 99 / 100,
            recipient: address(this), deadline: block.timestamp
        }));
        (uint256 usedUsdc, uint256 usedTok) = t0 == address(usdc) ? (u0, u1) : (u1, u0);
        lpTokenId = id;
        lpUnlock = uint64(block.timestamp) + LP_LOCK;
        liquidityUsdc = usedUsdc;
        usdc.forceApprove(address(positionManager), 0);
        _approve(address(this), address(positionManager), 0);
        if (liqUsdc > usedUsdc) poolAfterFees += liqUsdc - usedUsdc; // sobrante vuelve al equipo
        if (liqTokens > usedTok) _burn(address(this), liqTokens - usedTok); // sobrante se quema
        emit LiquidityAdded(p, id, usedUsdc, usedTok, lpUnlock);
    }

    function _release(uint256 bps, bool last) internal {
        uint256 u = last ? poolAfterFees - usdcReleased : poolAfterFees * bps / BPS;
        uint256 t = last ? creatorTokens - creatorTokensReleased : creatorTokens * bps / BPS;
        usdcReleased += u;
        creatorTokensReleased += t;
        if (t > 0) _mint(creator, t);
        emit Released(u, t, milestonesDone);
        if (u > 0) usdc.safeTransfer(creator, u);
    }

    function _cancel() internal {
        state = State.Refunding;
        refundPool = poolAfterFees - usdcReleased; // tokens del creador no liberados nunca se crean
        emit Cancelled(refundPool);
    }
}
