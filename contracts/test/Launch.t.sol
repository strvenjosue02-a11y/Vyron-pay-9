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

    function setUp() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) vm.skip(true);
        vm.createSelectFork(url);
        _fund(alice, 5_000e6); _fund(bob, 5_000e6); _fund(trader, 5_000e6);
    }

    function _fund(address who, uint256 amt) internal {
        vm.store(address(USDC), keccak256(abi.encode(who, uint256(9))), bytes32(amt));
        assertEq(USDC.balanceOf(who), amt);
    }
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
        vm.startPrank(alice); USDC.approve(address(l), 200e6); l.deposit(200e6, alice);
        assertEq(l.raised(), 200e6);
        l.withdraw(); vm.stopPrank();
        assertEq(USDC.balanceOf(alice), 5_000e6); assertEq(l.raised(), 0);
    }

    // --- llenar: pool, comisión 1%, tokens, mismo precio
    function test_fill_opensMarket_sameRoundPrice() public {
        Launch l = _deploy(_params(500e6, "BR2"));
        vm.startPrank(alice); USDC.approve(address(l), 300e6); l.deposit(300e6, alice); vm.stopPrank();
        vm.startPrank(bob); USDC.approve(address(l), 200e6); l.deposit(200e6, bob); vm.stopPrank();
        assertEq(uint8(l.state()), uint8(Launch.State.Live));
        assertEq(USDC.balanceOf(platform), 5e6, "1% de comision");
        assertTrue(l.lpTokenId() != 0);
        assertEq(INFT(NPM).ownerOf(l.lpTokenId()), address(l), "el recibo queda en el contrato");
        // mismo precio para todos: 300 USDC -> 60% de 500M ; 200 USDC -> 40%
        vm.prank(alice); l.claim(); vm.prank(bob); l.claim();
        assertEq(l.balanceOf(alice), 300_000_000 ether);
        assertEq(l.balanceOf(bob), 200_000_000 ether);
        assertEq(l.balanceOf(platform), 15_000_000 ether);
        // ya no se puede retirar ni depositar
        vm.prank(alice); vm.expectRevert(); l.withdraw();
        vm.prank(alice); vm.expectRevert(); l.deposit(1, alice);
        // nadie puede reclamar dos veces
        vm.prank(alice); vm.expectRevert(); l.claim();
    }

    // --- el dinero de la ronda no se puede sacar: solo comisiones por operar
    function test_poolIsPermanent_onlyFeesCollectable() public {
        Launch l = _deploy(_params(100e6, "BR3"));
        vm.startPrank(alice); USDC.approve(address(l), 100e6); l.deposit(100e6, alice); l.claim(); vm.stopPrank();
        // alguien opera en el pool real
        vm.startPrank(trader); USDC.approve(ROUTER, 500e6);
        IRouter(ROUTER).exactInputSingle(IRouter.P(address(USDC), address(l), 3000, trader, 50e6, 0, 0));
        vm.stopPrank();
        uint256 platBefore = USDC.balanceOf(platform); uint256 crBefore = USDC.balanceOf(creator);
        l.collectFees();
        uint256 gotP = USDC.balanceOf(platform) - platBefore; uint256 gotC = USDC.balanceOf(creator) - crBefore;
        assertGt(gotP, 0); assertApproxEqAbs(gotP, gotC, 1, "mitad y mitad");
        assertEq(INFT(NPM).ownerOf(l.lpTokenId()), address(l), "el pool sigue ahi");
        // el contrato no tiene ninguna otra puerta de salida: el USDC del pool sigue dentro del pool
        assertEq(USDC.balanceOf(address(l)), 0);
    }

    // --- el creador cobra poco a poco
    function test_creatorTokensDrip() public {
        Launch l = _deploy(_params(100e6, "BR4"));
        vm.startPrank(alice); USDC.approve(address(l), 100e6); l.deposit(100e6, alice); vm.stopPrank();
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
        vm.startPrank(alice); USDC.approve(address(l), 100e6); l.deposit(100e6, alice); vm.stopPrank();
        assertEq(l.vesting(), address(0), "sin parte del creador no hay goteo");
        Launch.Params memory q = _params(100e6, "BR8"); q.creatorPct = 10; q.vestingWeeks = 12;
        Launch m = _deploy(q);
        vm.startPrank(bob); USDC.approve(address(m), 100e6); m.deposit(100e6, bob); vm.stopPrank();
        assertEq(m.balanceOf(m.vesting()), 100_000_000 ether);
        Launch.Params memory bad = _params(100e6, "BR9"); bad.creatorPct = 7;
        vm.expectRevert(); new Launch(bad);
        Launch.Params memory bad2 = _params(100e6, "BR10"); bad2.vestingWeeks = 5;
        vm.expectRevert(); new Launch(bad2);
    }

    // --- si en 48 h no se llena: expira y cualquiera devuelve el dinero A CADA APORTANTE
    function test_expiry_anyoneRefundsToTheDepositor() public {
        Launch l = _deploy(_params(500e6, "BR11"));
        vm.startPrank(alice); USDC.approve(address(l), 120e6); l.deposit(120e6, alice); vm.stopPrank();
        vm.startPrank(bob); USDC.approve(address(l), 80e6); l.deposit(80e6, bob); vm.stopPrank();
        vm.prank(trader); vm.expectRevert(); l.refundFor(alice); // antes de tiempo: no
        vm.warp(block.timestamp + 48 hours + 1);
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

    // --- no se puede pasar de la meta ni mintear a voluntad
    function test_cannotExceedGoal() public {
        Launch l = _deploy(_params(100e6, "BR5"));
        vm.startPrank(alice); USDC.approve(address(l), 200e6);
        vm.expectRevert(); l.deposit(101e6, alice);
        vm.stopPrank();
    }

    // --- pool manipulado antes: todos recuperan su dinero
    function test_manipulatedPool_refundsEveryone() public {
        Launch.Params memory p = _params(100e6, "BR6");
        address pred = _predict(p);
        (address t0, address t1) = address(USDC) < pred ? (address(USDC), pred) : (pred, address(USDC));
        INPM(NPM).createAndInitializePoolIfNecessary(t0, t1, 3000, uint160(1 << 96)); // precio 1:1 distinto al de la ronda
        Launch l = _deploy(p);
        vm.startPrank(alice); USDC.approve(address(l), 100e6); l.deposit(100e6, alice);
        assertEq(uint8(l.state()), uint8(Launch.State.Refund));
        l.withdraw(); vm.stopPrank();
        assertEq(USDC.balanceOf(alice), 5_000e6);
    }
}
