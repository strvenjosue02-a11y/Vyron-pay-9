// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Alcancia, IPositionManager, IUniswapV3PoolState} from "../src/Alcancia.sol";

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}
interface IERC721Owner { function ownerOf(uint256 id) external view returns (address); }

/// Pool de Uniswap v3 real en una copia de Sepolia.
/// Correr con: FORK_URL=https://ethereum-sepolia-rpc.publicnode.com forge test --match-contract UniswapFork -vv
contract UniswapForkTest is Test {
    address constant DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    IERC20 constant USDC = IERC20(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238);
    address constant NPM = 0x1238536071E1c677A632429e3655c799b22cDA52;
    address constant ROUTER = 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E;
    address platform = makeAddr("plataforma");
    address creator = makeAddr("creador");
    address alice = makeAddr("alice");
    address trader = makeAddr("trader");

    function setUp() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) vm.skip(true);
        vm.createSelectFork(url);
        _fund(alice, 10_000e6);
        _fund(trader, 1_000e6);
    }

    function _fund(address who, uint256 amt) internal {
        vm.store(address(USDC), keccak256(abi.encode(who, uint256(9))), bytes32(amt)); // FiatToken: balances en slot 9
        assertEq(USDC.balanceOf(who), amt);
    }

    function _params() internal view returns (Alcancia.Params memory p) {
        p = Alcancia.Params({
            usdc: USDC, platform: platform, creator: creator, name: "Atlas Oracle", symbol: "ATLS",
            softcap: 300e6, hardcap: 1_000e6, saleTokens: 10_000_000 ether, creatorTokens: 4_000_000 ether,
            saleEnd: uint64(block.timestamp + 30 days), initialBps: 1_000, milestones: 3, milestonePeriod: 60 days,
            liquidityBps: 1_000, positionManager: NPM
        });
    }
    function _predict(Alcancia.Params memory p) internal pure returns (address) {
        bytes memory init = abi.encodePacked(type(Alcancia).creationCode, abi.encode(p));
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), DEPLOYER, bytes32(0), keccak256(init))))));
    }
    function _deploy(Alcancia.Params memory p) internal returns (Alcancia a) {
        (bool ok, bytes memory ret) = DEPLOYER.call(abi.encodePacked(bytes32(0), abi.encodePacked(type(Alcancia).creationCode, abi.encode(p))));
        require(ok, "deploy");
        a = Alcancia(address(bytes20(ret)));
    }
    function _fill(Alcancia a) internal {
        vm.startPrank(alice); USDC.approve(address(a), 1_000e6); a.buy(1_000e6, alice); vm.stopPrank();
        a.finalize();
    }

    function test_pool_created_at_round_price_and_locked() public {
        Alcancia a = _deploy(_params());
        _fill(a);
        // 1% comisión (10) · 10% de los 990 al pool (99) · 10% del resto al equipo (89,1)
        assertTrue(a.pool() != address(0), "pool");
        assertGt(a.lpTokenId(), 0, "posicion");
        assertEq(IERC721Owner(NPM).ownerOf(a.lpTokenId()), address(a), "NFT en el contrato");
        assertApproxEqAbs(a.liquidityUsdc(), 99e6, 1e6, "USDC en el pool");
        assertEq(a.poolAfterFees() + a.liquidityUsdc(), 990e6 - (99e6 - a.liquidityUsdc()) + (99e6 - a.liquidityUsdc()));
        assertApproxEqAbs(USDC.balanceOf(creator), 891e5, 2e6, "10% inicial del resto");
        assertEq(a.lpUnlock(), uint64(block.timestamp) + 365 days);
        emit log_named_address("pool", a.pool());

        // el precio del pool = precio de la ronda (10.000 ATLS por USDC): un trader compra
        vm.startPrank(trader);
        USDC.approve(ROUTER, 10e6);
        uint256 out = ISwapRouter02(ROUTER).exactInputSingle(ISwapRouter02.ExactInputSingleParams({
            tokenIn: address(USDC), tokenOut: address(a), fee: 3000, recipient: trader, amountIn: 10e6, amountOutMinimum: 0, sqrtPriceLimitX96: 0 }));
        vm.stopPrank();
        emit log_named_uint("ATLS por 10 USDC", out / 1e18);
        assertGt(out, 85_000 ether, "precio cercano a la ronda (comision 0,3% + impacto)");
        assertLt(out, 100_000 ether);

        // nadie retira la liquidez antes de 12 meses; despues pasa al creador
        vm.expectRevert(Alcancia.TooEarly.selector);
        a.withdrawLiquidity();
        vm.warp(block.timestamp + 365 days);
        uint256 id = a.lpTokenId();
        a.withdrawLiquidity();
        assertEq(IERC721Owner(NPM).ownerOf(id), creator);
        vm.expectRevert(Alcancia.TooEarly.selector);
        a.withdrawLiquidity();
    }

    function test_attacker_preinitialized_pool_is_skipped() public {
        Alcancia.Params memory p = _params();
        address tok = _predict(p);
        (address t0, address t1) = address(USDC) < tok ? (address(USDC), tok) : (tok, address(USDC));
        // el atacante crea el pool antes, a un precio absurdo (sin necesitar tokens)
        vm.prank(makeAddr("atacante"));
        IPositionManager(NPM).createAndInitializePoolIfNecessary(t0, t1, 3000, uint160(1 << 96));
        Alcancia a = _deploy(p);
        _fill(a);
        assertEq(a.lpTokenId(), 0, "no se agrega liquidez");
        assertEq(a.poolAfterFees(), 990e6, "el USDC vuelve a las entregas del equipo");
        assertEq(USDC.balanceOf(address(a)), 990e6 - 99e6, "todo sigue en la alcancia salvo el 10% inicial");
    }

    function test_money_conservation_with_pool() public {
        Alcancia a = _deploy(_params());
        _fill(a);
        // todo lo que entro (1000) = plataforma + creador + alcancia + pool
        uint256 total = USDC.balanceOf(platform) + USDC.balanceOf(creator) + USDC.balanceOf(address(a)) + a.liquidityUsdc();
        assertApproxEqAbs(total, 1_000e6, 2, "no se crea ni se pierde dinero");
    }
}
