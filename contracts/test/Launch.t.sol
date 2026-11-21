// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {Launch, INPM} from "../src/Launch.sol";

interface IRouter {
    struct P { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }
    function exactInputSingle(P calldata p) external payable returns (uint256);
}
interface INFT { function ownerOf(uint256 id) external view returns (address); }
interface IPoolSlot0 { function slot0() external view returns (uint160 sqrtPriceX96, int24, uint16, uint16, uint16, uint8, bool); }
interface IPoolSwap { function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes calldata data) external returns (int256, int256); }
/// Atacante: mueve el precio de un pool vacío con un swap que no paga nada.
contract Mover {
    function go(address pool, bool zeroForOne, uint160 limit) external { IPoolSwap(pool).swap(address(this), zeroForOne, 1, limit, ""); }
    function uniswapV3SwapCallback(int256, int256, bytes calldata) external {}
}

/// Pruebas del lanzamiento contra Uniswap v3 REAL (copia de Sepolia).
/// Correr con: FORK_URL=https://ethereum-sepolia-rpc.publicnode.com forge test --match-contract LaunchTest -vv
contract LaunchTest is Test {
    address constant DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    IERC20 constant USDC = IERC20(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238);
    address constant NPM = 0x1238536071E1c677A632429e3655c799b22cDA52;
    address constant ROUTER = 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E;
    address platform = makeAddr("plataforma");
    address creator = makeAddr("creador");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address trader = makeAddr("trader");
    address carol = makeAddr("carol");

    function setUp() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) vm.skip(true);
        vm.createSelectFork(url);
        _fund(alice, 5_000e6); _fund(bob, 5_000e6); _fund(trader, 5_000e6); _fund(carol, 5_000e6);
    }

    function _fund(address who, uint256 amt) internal {
        vm.store(address(USDC), keccak256(abi.encode(who, uint256(9))), bytes32(amt));
        assertEq(USDC.balanceOf(who), amt);
    }
    /// completa la ronda con bob, trader y carol (tope por billetera = 25% de la meta): `already` ya puso alice
    function _rest(Launch l, uint256 goal, uint256 already) internal {
        address[3] memory w = [bob, trader, carol]; uint256 left = goal - already; uint256 cap = goal / 4;
        for (uint256 i = 0; i < 3 && left > 0; i++) { uint256 a = left < cap ? left : cap; vm.startPrank(w[i]); USDC.approve(address(l), a); l.deposit(a, w[i]); vm.stopPrank(); left -= a; }
    }
    function _fill100(Launch l) internal { vm.startPrank(alice); USDC.approve(address(l), 25e6); l.deposit(25e6, alice); vm.stopPrank(); _rest(l, 100e6, 25e6); }
    function _params(uint256 goal, string memory sym) internal view returns (Launch.Params memory) {
        return Launch.Params({usdc: USDC, platform: platform, creator: creator, name: "Moon Bread", symbol: sym, goal: goal, positionManager: NPM, creatorPct: 5, vestingWeeks: 8});
    }
    function _init(Launch.Params memory p) internal pure returns (bytes memory) { return abi.encodePacked(type(Launch).creationCode, abi.encode(p)); }
    function _predict(Launch.Params memory p) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), DEPLOYER, bytes32(0), keccak256(_init(p)))))));
    }
    function _deploy(Launch.Params memory p) internal returns (Launch l) {
        (bool ok, bytes memory ret) = DEPLOYER.call(abi.encodePacked(bytes32(0), _init(p)));
        require(ok, "deploy");
        l = Launch(address(bytes20(ret)));
    }

    // --- la dirección existe desde ya y el primero la despliega
    function test_lazyDeploy_addressKnownBeforehand() public {
        Launch.Params memory p = _params(100e6, "BREAD");
        address predicted = _predict(p);
        assertEq(predicted.code.length, 0);
        Launch l = _deploy(p);
        assertEq(address(l), predicted);
    }

    // --- solo 3 metas permitidas
    function test_onlyThreeGoals() public {
        Launch.Params memory p = _params(123e6, "BAD");
        vm.expectRevert(); new Launch(p);
    }

    // --- retirar antes de llenar
    function test_withdrawAnytimeBeforeFull() public {
        Launch l = _deploy(_params(500e6, "BR1"));
        vm.startPrank(alice); USDC.approve(address(l), 100e6); l.deposit(100e6, alice);
        assertEq(l.raised(), 100e6);
        l.withdraw(); vm.stopPrank();
        assertEq(USDC.balanceOf(alice), 5_000e6); assertEq(l.raised(), 0);
    }

    // --- llenar: pool, comisión 1%, tokens, mismo precio
    function test_fill_opensMarket_sameRoundPrice() public {
        Launch l = _deploy(_params(500e6, "BR2"));
        vm.startPrank(alice); USDC.approve(address(l), 125e6); l.deposit(125e6, alice); vm.stopPrank();
        _rest(l, 500e6, 125e6);
        assertEq(uint8(l.state()), uint8(Launch.State.Live));
        assertEq(USDC.balanceOf(platform), 5e6, "1% de comision");
        assertTrue(l.lpTokenId() != 0);
        assertEq(INFT(NPM).ownerOf(l.lpTokenId()), address(l), "el recibo queda en el contrato");
        vm.prank(alice); l.claim(); vm.prank(bob); l.claim();
        assertEq(l.balanceOf(alice), 125_000_000 ether);
        assertEq(l.balanceOf(bob), 125_000_000 ether);
        assertEq(l.balanceOf(platform), 15_000_000 ether);
        vm.prank(alice); vm.expectRevert(); l.withdraw();
        vm.prank(alice); vm.expectRevert(); l.deposit(1, alice);
        vm.prank(alice); vm.expectRevert(); l.claim();
    }

    // --- el dinero de la ronda no se puede sacar: solo comisiones por operar
    function test_poolIsPermanent_onlyFeesCollectable() public {
        Launch l = _deploy(_params(100e6, "BR3"));
        _fill100(l); vm.prank(alice); l.claim();
        // alguien opera en el pool real
        vm.startPrank(trader); USDC.approve(ROUTER, 500e6);
        IRouter(ROUTER).exactInputSingle(IRouter.P(address(USDC), address(l), 3000, trader, 50e6, 0, 0));
        vm.stopPrank();
        uint256 platBefore = USDC.balanceOf(platform); uint256 crBefore = USDC.balanceOf(creator);
        l.collectFees();
        uint256 gotP = USDC.balanceOf(platform) - platBefore; uint256 gotC = USDC.balanceOf(creator) - crBefore;
        assertGt(gotP, 0); assertApproxEqAbs(gotP, gotC * 2, 2, "2/3 plataforma, 1/3 creador (0,20% y 0,10%)");
        assertEq(INFT(NPM).ownerOf(l.lpTokenId()), address(l), "el pool sigue ahi");
        // el contrato no tiene ninguna otra puerta de salida: el USDC del pool sigue dentro del pool
        assertEq(USDC.balanceOf(address(l)), 0);
    }

    // --- el creador cobra poco a poco
    function test_creatorTokensDrip() public {
        Launch l = _deploy(_params(100e6, "BR4"));
        _fill100(l);
        VestingWallet vw = VestingWallet(payable(l.vesting()));
        assertEq(l.balanceOf(address(vw)), 50_000_000 ether);
        assertEq(l.balanceOf(creator), 0);
        vw.release(address(l));
        assertEq(l.balanceOf(creator), 0, "el dia 0 no se libera nada");
        vm.warp(block.timestamp + 28 days);
        vw.release(address(l));
        assertApproxEqRel(l.balanceOf(creator), 25_000_000 ether, 1e15, "mitad a mitad del plazo");
        vm.warp(block.timestamp + 40 days);
        vw.release(address(l));
        assertEq(l.balanceOf(creator), 50_000_000 ether, "todo al final");
    }

    // --- el creador elige: 0% (sin goteo) y 10% a 12 semanas; no se aceptan otros valores
    function test_creatorChoices() public {
        Launch.Params memory p = _params(100e6, "BR7"); p.creatorPct = 0;
        Launch l = _deploy(p);
        _fill100(l);
        assertEq(l.vesting(), address(0), "sin parte del creador no hay goteo");
        Launch.Params memory q = _params(100e6, "BR8"); q.creatorPct = 10; q.vestingWeeks = 12;
        Launch m = _deploy(q);
        _fill100(m);
        assertEq(m.balanceOf(m.vesting()), 100_000_000 ether);
        Launch.Params memory bad = _params(100e6, "BR9"); bad.creatorPct = 7;
        vm.expectRevert(); new Launch(bad);
        Launch.Params memory bad2 = _params(100e6, "BR10"); bad2.vestingWeeks = 5;
        vm.expectRevert(); new Launch(bad2);
    }

    // --- si en 24 h no se llena: expira y cualquiera devuelve el dinero A CADA APORTANTE
    function test_expiry_anyoneRefundsToTheDepositor() public {
        Launch l = _deploy(_params(500e6, "BR11"));
        vm.startPrank(alice); USDC.approve(address(l), 120e6); l.deposit(120e6, alice); vm.stopPrank();
        vm.startPrank(bob); USDC.approve(address(l), 80e6); l.deposit(80e6, bob); vm.stopPrank();
        vm.prank(trader); vm.expectRevert(); l.refundFor(alice); // antes de tiempo: no
        vm.warp(block.timestamp + 24 hours + 1);
        assertTrue(l.expired());
        vm.prank(bob); vm.expectRevert(); l.deposit(1e6, bob); // ya no se aceptan depositos
        uint256 trBefore = USDC.balanceOf(trader);
        vm.prank(trader); l.refundFor(alice);                   // un tercero llama
        assertEq(USDC.balanceOf(alice), 5_000e6, "alice recupera todo");
        assertEq(USDC.balanceOf(trader), trBefore, "el que llama no recibe nada");
        vm.prank(trader); l.refundFor(bob);
        assertEq(USDC.balanceOf(bob), 5_000e6);
        assertEq(l.raised(), 0);
        vm.prank(trader); vm.expectRevert(); l.refundFor(alice); // no se devuelve dos veces
    }


    // ================= REVISIÓN COMO ATACANTE =================

    // ATAQUE 1: iniciar el pool ANTES al precio CORRECTO no rompe nada (el contrato sigue su camino)
    function test_attack_preinitPoolAtCorrectPrice_stillFills() public {
        Launch.Params memory p = _params(100e6, "AT1");
        address pred = _predict(p);
        (address t0, address t1) = address(USDC) < pred ? (address(USDC), pred) : (pred, address(USDC));
        // precio correcto: 99 USDC por 495M tokens
        uint256 a0 = t0 == address(USDC) ? 99e6 : 495_000_000 ether; uint256 a1 = t0 == address(USDC) ? 495_000_000 ether : 99e6;
        uint160 target = uint160(_sqrt(a1 * (1 << 96) / a0) << 48);
        INPM(NPM).createAndInitializePoolIfNecessary(t0, t1, 3000, target);
        Launch l = _deploy(p);
        _fill100(l);
        assertEq(uint8(l.state()), uint8(Launch.State.Live), "con el precio correcto la ronda se llena igual");
    }
    function _sqrt(uint256 x) internal pure returns (uint256 y) { if (x == 0) return 0; uint256 z = (x + 1) / 2; y = x; while (z < y) { y = z; z = (x / z + z) / 2; } }

    // ATAQUE 2: donar USDC directo al contrato no cambia las cuentas ni da ventaja
    function test_attack_donationDoesNotBreakAccounting() public {
        Launch l = _deploy(_params(100e6, "AT2"));
        vm.prank(trader); USDC.transfer(address(l), 50e6); // donación
        _fill100(l);
        assertEq(uint8(l.state()), uint8(Launch.State.Live));
        assertEq(USDC.balanceOf(platform), 1e6, "la plataforma sigue cobrando solo 1%");
        vm.prank(alice); l.claim(); assertEq(l.balanceOf(alice), 125_000_000 ether);
    }

    // ATAQUE 3: nadie puede sacar ni reclamar lo de otro
    function test_attack_cannotTouchOthersFunds() public {
        Launch l = _deploy(_params(500e6, "AT3"));
        vm.startPrank(alice); USDC.approve(address(l), 100e6); l.deposit(100e6, alice); vm.stopPrank();
        vm.prank(trader); vm.expectRevert(); l.withdraw();     // el atacante no tiene saldo en la ronda
        vm.prank(trader); vm.expectRevert(); l.claim();        // y antes de llenarse nadie reclama
        vm.prank(trader); vm.expectRevert(); l.collectFees();  // ni cobra comisiones sin pool
        vm.prank(trader); vm.expectRevert(); l.refundFor(alice); // ni "devuelve" antes de tiempo
    }

    // ATAQUE 4: depositar "a nombre de otro" solo le regala una posición; él puede sacarla
    function test_attack_depositOnBehalfIsAGift() public {
        Launch l = _deploy(_params(500e6, "AT4"));
        vm.startPrank(trader); USDC.approve(address(l), 10e6); l.deposit(10e6, bob); vm.stopPrank();
        assertEq(l.contributed(bob), 10e6); assertEq(l.contributed(trader), 0);
        vm.prank(bob); l.withdraw(); assertEq(USDC.balanceOf(bob), 5_010e6);
    }

    // ATAQUE 5: una sola billetera no puede acaparar la ronda (tope 25% de la meta)
    function test_attack_walletCap() public {
        Launch l = _deploy(_params(100e6, "AT5"));
        vm.startPrank(alice); USDC.approve(address(l), 100e6);
        vm.expectRevert(Launch.WalletCap.selector); l.deposit(26e6, alice);
        l.deposit(25e6, alice);
        vm.expectRevert(Launch.WalletCap.selector); l.deposit(1e6, alice);
        vm.stopPrank();
        vm.startPrank(bob); USDC.approve(address(l), 10e6); vm.expectRevert(Launch.WalletCap.selector); l.deposit(1e6, alice); vm.stopPrank();
    }

    // el dinero del creador no se puede sacar mientras la ronda esta abierta; si expira, se le devuelve
    function test_creatorDepositLockedUntilFillOrExpiry() public {
        Launch l = _deploy(_params(100e6, "CL1"));
        _fund(creator, 100e6);
        vm.startPrank(creator); USDC.approve(address(l), 25e6); l.deposit(25e6, creator);
        vm.expectRevert(Launch.CreatorLocked.selector); l.withdraw();
        vm.stopPrank();
        vm.warp(block.timestamp + 24 hours + 1);
        vm.prank(trader); l.refundFor(creator);
        assertEq(USDC.balanceOf(creator), 100e6, "el creador recupera todo si no se llena");
    }

    // ATAQUE 6: tras llenarse no hay forma de sacar el NFT del pool: el contrato no tiene ninguna función que lo mueva
    function test_attack_nftCannotLeave() public {
        Launch l = _deploy(_params(100e6, "AT6"));
        _fill100(l);
        uint256 id = l.lpTokenId();
        vm.prank(creator); (bool ok,) = NPM.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", address(l), creator, id));
        assertTrue(!ok, "ni el creador puede mover el NFT");
        vm.prank(platform); (ok,) = NPM.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", address(l), platform, id));
        assertTrue(!ok, "ni la plataforma");
    }

    // ATAQUE 7: mover el precio del pool vacío en CUALQUIER dirección ya no mata la ronda
    function test_attack_freeSwapPriceMove_bothDirections_stillFills() public {
        for (uint256 k = 0; k < 2; k++) {
            Launch.Params memory p = _params(100e6, k == 0 ? "AT7" : "AT8");
            address pred = _predict(p);
            (address t0, address t1) = address(USDC) < pred ? (address(USDC), pred) : (pred, address(USDC));
            address pl = INPM(NPM).createAndInitializePoolIfNecessary(t0, t1, 3000, uint160(1) << 96);
            Launch l = _deploy(p);
            Mover m = new Mover(); // el atacante mueve el precio con un swap sin liquidez (gratis)
            (uint160 cur,,,,,,) = IPoolSlot0(pl).slot0();
            m.go(pl, k == 1, k == 1 ? cur / 4 : cur * 4);
            _fill100(l);
            assertEq(uint8(l.state()), uint8(Launch.State.Live), "la ronda se llena aunque el pool haya sido movido");
        }
    }
    // el callback del contrato nunca paga
    function test_callbackNeverPays() public {
        Launch l = _deploy(_params(100e6, "AT9"));
        vm.expectRevert(); l.uniswapV3SwapCallback(1, 0, "");
        vm.expectRevert(); l.uniswapV3SwapCallback(-1, 5, "");
    }

    // --- no se puede pasar de la meta ni mintear a voluntad
    function test_cannotExceedGoal() public {
        Launch l = _deploy(_params(100e6, "BR5"));
        vm.startPrank(alice); USDC.approve(address(l), 200e6);
        vm.expectRevert(); l.deposit(101e6, alice);
        vm.stopPrank();
    }

    // --- pool inicializado a otro precio ANTES: el contrato lo corrige gratis y la ronda se llena igual, a su precio
    function test_manipulatedPool_isCorrectedAndFills() public {
        Launch.Params memory p = _params(100e6, "BR6");
        address pred = _predict(p);
        (address t0, address t1) = address(USDC) < pred ? (address(USDC), pred) : (pred, address(USDC));
        address pl = INPM(NPM).createAndInitializePoolIfNecessary(t0, t1, 3000, uint160(1) << 96); // precio 1:1, muy distinto
        Launch l = _deploy(p);
        _fill100(l);
        assertEq(uint8(l.state()), uint8(Launch.State.Live), "se llena igual");
        assertEq(l.pool(), pl);
        (uint160 cur,,,,,,) = IPoolSlot0(pl).slot0();
        (uint256 a0, uint256 a1) = t0 == address(USDC) ? (uint256(99e6), uint256(495_000_000 ether)) : (uint256(495_000_000 ether), uint256(99e6));
        uint160 target = uint160(_sqrt(a1 * (1 << 96) / a0) << 48);
        uint256 diff = cur > target ? cur - target : target - cur;
        assertLt(diff * 1000, uint256(target), "el precio quedo en el de la ronda");
    }
}
