// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Alcancia} from "../src/Alcancia.sol";

contract FakeUSDC is ERC20 {
    constructor() ERC20("Fake USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

contract AlcanciaTest is Test {
    // Deployer CREATE2 público que ya existe en Base, Ethereum, Arbitrum, etc.
    address constant DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    bytes constant DEPLOYER_CODE =
        hex"7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3";

    FakeUSDC usdc;
    address platform = makeAddr("plataforma");
    address creator = makeAddr("creador");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant U = 1e6; // 1 USDC

    function setUp() public {
        if (DEPLOYER.code.length == 0) vm.etch(DEPLOYER, DEPLOYER_CODE);
        usdc = new FakeUSDC();
        address[3] memory people = [alice, bob, carol];
        for (uint256 i; i < 3; i++) {
            usdc.mint(people[i], 1_000_000 * U);
        }
    }

    function _params() internal view returns (Alcancia.Params memory p) {
        p = Alcancia.Params({
            usdc: IERC20(address(usdc)),
            platform: platform,
            creator: creator,
            name: "Proyecto Demo",
            symbol: "DEMO",
            softcap: 5_000 * U,
            hardcap: 10_000 * U,
            saleTokens: 1_000_000 ether,
            creatorTokens: 500_000 ether,
            saleEnd: uint64(block.timestamp + 14 days),
            initialBps: 1_000, // 10% al cerrar
            milestones: 3, // luego 3 etapas de 30%
            milestonePeriod: 60 days,
            liquidityBps: 0,
            positionManager: address(0)
        });
    }

    function _initCode(Alcancia.Params memory p) internal pure returns (bytes memory) {
        return abi.encodePacked(type(Alcancia).creationCode, abi.encode(p));
    }

    /// Dirección calculada ANTES de que el contrato exista (lo que muestra la web).
    function _predict(Alcancia.Params memory p) internal pure returns (address) {
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), DEPLOYER, bytes32(0), keccak256(_initCode(p))))))
        );
    }

    /// El primer comprador despliega a través del deployer público (paga solo el gas).
    function _lazyDeploy(Alcancia.Params memory p, address payer) internal returns (Alcancia a) {
        vm.prank(payer);
        (bool ok, bytes memory ret) = DEPLOYER.call(abi.encodePacked(bytes32(0), _initCode(p)));
        require(ok, "deploy failed");
        a = Alcancia(address(bytes20(ret)));
    }

    function _buy(Alcancia a, address who, uint256 amount) internal {
        vm.startPrank(who);
        usdc.approve(address(a), amount);
        a.buy(amount, who);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ perezoso

    function test_lazyDeploy_addressKnownBeforehand() public {
        Alcancia.Params memory p = _params();
        address predicted = _predict(p);
        assertEq(predicted.code.length, 0, "no existe todavia");

        uint256 g = gasleft();
        Alcancia a = _lazyDeploy(p, alice);
        emit log_named_uint("gas del despliegue", g - gasleft());

        assertEq(address(a), predicted, "nace en la direccion prometida");
        assertGt(predicted.code.length, 0);
        assertEq(a.creator(), creator);
    }

    function test_lazyDeploy_attackerCannotChangeRules() public {
        Alcancia.Params memory p = _params();
        address real = _predict(p);
        // Un atacante cambia la wallet de comisiones -> otra dirección, la web no la reconoce.
        p.platform = makeAddr("atacante");
        assertTrue(_predict(p) != real);
        // Y si el atacante despliega el original, nace con las reglas correctas.
        Alcancia a = _lazyDeploy(_params(), makeAddr("atacante"));
        assertEq(address(a), real);
        assertEq(a.platform(), platform);
    }

    // ------------------------------------------------------------------ venta

    function test_failedSale_everyoneGets100Percent() public {
        Alcancia a = _lazyDeploy(_params(), alice);
        _buy(a, alice, 1_000 * U);
        _buy(a, bob, 2_000 * U);
        vm.warp(vm.getBlockTimestamp() + 15 days);
        a.finalize();

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        a.refund();
        assertEq(usdc.balanceOf(alice) - before, 1_000 * U);
        vm.prank(bob);
        a.refund();
        assertEq(usdc.balanceOf(platform), 0, "sin comision si falla");
        assertEq(usdc.balanceOf(address(a)), 0);

        vm.prank(alice);
        vm.expectRevert(Alcancia.NothingToClaim.selector);
        a.refund(); // no puede cobrar dos veces

        vm.prank(alice);
        vm.expectRevert(Alcancia.WrongState.selector);
        a.claimTokens(); // no hay tokens si fallo
    }

    function test_success_feesAndInitialRelease() public {
        Alcancia a = _lazyDeploy(_params(), alice);
        _buy(a, alice, 6_000 * U);
        _buy(a, bob, 6_000 * U); // solo entran 4.000 (hardcap)
        assertEq(a.totalRaised(), 10_000 * U);
        assertEq(usdc.balanceOf(bob), 1_000_000 * U - 4_000 * U);

        a.finalize(); // lleno: se puede cerrar antes
        assertEq(usdc.balanceOf(platform), 100 * U, "1% USDC");
        assertEq(usdc.balanceOf(creator), 990 * U, "10% de lo que queda");

        vm.prank(alice);
        a.claimTokens();
        vm.prank(bob);
        a.claimTokens();
        assertEq(a.balanceOf(alice), 600_000 ether);
        assertEq(a.balanceOf(bob), 400_000 ether);

        // 1,5% del supply final, cuando todo esté emitido
        _passAllMilestones(a);
        uint256 supply = a.totalSupply();
        assertApproxEqAbs(a.balanceOf(platform) * 10_000 / supply, 150, 1);
        assertEq(a.balanceOf(creator), 500_000 ether);
        assertEq(usdc.balanceOf(creator), 9_900 * U, "creador recibio todo al final");
        assertEq(usdc.balanceOf(address(a)), 0);
    }

    function _passAllMilestones(Alcancia a) internal {
        for (uint256 i; i < 3; i++) {
            vm.prank(creator);
            a.requestRelease();
            vm.prank(alice);
            a.vote(true);
            vm.warp(vm.getBlockTimestamp() + 7 days);
            a.closeVote();
        }
    }

    // ------------------------------------------------------------------ protecciones

    function test_voteNo_cancelsAndRefundsRemaining() public {
        Alcancia a = _lazyDeploy(_params(), alice);
        _buy(a, alice, 3_000 * U);
        _buy(a, bob, 7_000 * U);
        a.finalize();

        // etapa 1 aprobada
        vm.prank(creator);
        a.requestRelease();
        vm.prank(bob);
        a.vote(true);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        a.closeVote();
        assertEq(usdc.balanceOf(creator), 990 * U + 2_970 * U); // 10% + 30%

        // etapa 2: el creador no cumplió, gana el NO
        vm.prank(creator);
        a.requestRelease();
        vm.prank(bob);
        a.vote(false);
        vm.prank(alice);
        a.vote(true);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        a.closeVote();
        // primera derrota: segunda oportunidad, nada se libera
        assertEq(uint256(a.state()), uint256(Alcancia.State.Active));
        assertTrue(a.retrying());
        assertEq(usdc.balanceOf(creator), 990 * U + 2_970 * U);
        assertEq(a.deadline(), uint64(vm.getBlockTimestamp()) + 14 days);

        // se presenta de nuevo y vuelve a perder: ahora sí se cancela
        vm.prank(creator);
        a.requestRelease();
        vm.prank(bob);
        a.vote(false);
        vm.prank(alice);
        a.vote(true);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        a.closeVote();
        assertEq(uint256(a.state()), uint256(Alcancia.State.Refunding));

        // queda el 60% de 9.900 = 5.940, repartido 30/70
        uint256 b0 = usdc.balanceOf(alice);
        vm.prank(alice);
        a.refund();
        assertEq(usdc.balanceOf(alice) - b0, 1_782 * U);
        uint256 b1 = usdc.balanceOf(bob);
        vm.prank(bob);
        a.refund();
        assertEq(usdc.balanceOf(bob) - b1, 4_158 * U);

        vm.prank(creator);
        vm.expectRevert(Alcancia.WrongState.selector);
        a.requestRelease(); // no puede pedir más
    }

    function test_secondChance_approvedOnRetry_and_missedRetryWindow() public {
        Alcancia a = _lazyDeploy(_params(), alice);
        _buy(a, alice, 4_000 * U);
        _buy(a, bob, 6_000 * U);
        a.finalize();
        uint256 c0 = usdc.balanceOf(creator);
        // pierde el primer voto
        vm.prank(creator);
        a.requestRelease();
        vm.prank(bob);
        a.vote(false);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        a.closeVote();
        assertTrue(a.retrying());
        assertEq(usdc.balanceOf(creator), c0);
        // se presenta otra vez con avances y gana: se libera la etapa y se reinicia la segunda oportunidad
        vm.prank(creator);
        a.requestRelease();
        vm.prank(bob);
        a.vote(true);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        a.closeVote();
        assertFalse(a.retrying());
        assertEq(a.milestonesDone(), 1);
        assertEq(usdc.balanceOf(creator) - c0, 2_970 * U);
        // pierde la etapa 2 y no vuelve en 14 días: cualquiera cancela
        vm.prank(creator);
        a.requestRelease();
        vm.prank(bob);
        a.vote(false);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        a.closeVote();
        assertTrue(a.retrying());
        vm.warp(vm.getBlockTimestamp() + 15 days);
        vm.prank(creator);
        vm.expectRevert(Alcancia.TooEarly.selector);
        a.requestRelease();
        a.abandon();
        assertEq(uint256(a.state()), uint256(Alcancia.State.Refunding));
    }

    function test_creatorDisappears_anyoneCanCancel() public {
        Alcancia a = _lazyDeploy(_params(), alice);
        _buy(a, alice, 10_000 * U);
        a.finalize();
        vm.expectRevert(Alcancia.TooEarly.selector);
        a.abandon();
        vm.warp(vm.getBlockTimestamp() + 61 days);
        vm.prank(carol); // cualquiera, aunque no haya comprado
        a.abandon();
        vm.prank(alice);
        a.refund();
        assertEq(usdc.balanceOf(address(a)), 0);
        assertEq(usdc.balanceOf(alice), 1_000_000 * U - 10_000 * U + 8_910 * U); // recupera el 90% de lo que quedaba
    }

    function test_onlyCreatorCanRequest_noDoubleVote_outsidersCantVote() public {
        Alcancia a = _lazyDeploy(_params(), alice);
        _buy(a, alice, 10_000 * U);
        a.finalize();

        vm.prank(alice);
        vm.expectRevert(Alcancia.NotCreator.selector);
        a.requestRelease();

        vm.prank(creator);
        a.requestRelease();
        vm.prank(alice);
        a.vote(true);
        vm.prank(alice);
        vm.expectRevert(Alcancia.AlreadyVoted.selector);
        a.vote(true);
        vm.prank(carol); // compró tokens en el mercado pero no aportó: no vota
        vm.expectRevert(Alcancia.NothingToClaim.selector);
        a.vote(false);
        vm.expectRevert(Alcancia.NoVote.selector);
        a.closeVote(); // todavía no terminó
    }

    function test_noBuyAfterSaleEnd_noFinalizeBefore() public {
        Alcancia a = _lazyDeploy(_params(), alice);
        _buy(a, alice, 100 * U);
        vm.expectRevert(Alcancia.SaleOpen.selector);
        a.finalize();
        vm.warp(vm.getBlockTimestamp() + 14 days);
        vm.startPrank(bob);
        usdc.approve(address(a), 100 * U);
        vm.expectRevert(Alcancia.SaleClosed.selector);
        a.buy(100 * U, bob);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ fuzz: nunca sale más de lo que entra

    function testFuzz_moneyConservation(uint256 a1, uint256 a2, uint256 a3, uint8 noAt, bool late) public {
        a1 = bound(a1, 1, 6_000 * U);
        a2 = bound(a2, 1, 6_000 * U);
        a3 = bound(a3, 1, 6_000 * U);
        Alcancia a = _lazyDeploy(_params(), alice);
        _buy(a, alice, a1);
        _buy(a, bob, a2);
        if (a.totalRaised() < a.hardcap()) _buy(a, carol, a3);
        uint256 raised = a.totalRaised();

        vm.warp(vm.getBlockTimestamp() + 15 days);
        a.finalize();

        if (a.state() == Alcancia.State.Active) {
            noAt = uint8(bound(noAt, 0, 3));
            for (uint8 i; i < 3; i++) {
                if (late && i == noAt) {
                    vm.warp(vm.getBlockTimestamp() + 61 days);
                    a.abandon();
                    break;
                }
                vm.prank(creator);
                a.requestRelease();
                vm.prank(alice);
                a.vote(i != noAt);
                vm.prank(bob);
                a.vote(i != noAt);
                vm.warp(vm.getBlockTimestamp() + 7 days);
                a.closeVote();
                if (a.retrying()) { // segunda oportunidad: se vuelve a votar NO
                    vm.prank(creator);
                    a.requestRelease();
                    vm.prank(alice);
                    a.vote(false);
                    vm.prank(bob);
                    a.vote(false);
                    vm.warp(vm.getBlockTimestamp() + 7 days);
                    a.closeVote();
                }
                if (a.state() == Alcancia.State.Refunding) break;
            }
        }

        if (a.state() == Alcancia.State.Refunding) {
            address[3] memory ppl = [alice, bob, carol];
            for (uint256 i; i < 3; i++) {
                if (a.contributed(ppl[i]) > 0) {
                    vm.prank(ppl[i]);
                    a.refund();
                }
            }
        }

        // 1) Nadie salió ganando USDC: cada comprador recupera como máximo lo que puso.
        assertLe(usdc.balanceOf(alice), 1_000_000 * U);
        assertLe(usdc.balanceOf(bob), 1_000_000 * U);
        assertLe(usdc.balanceOf(carol), 1_000_000 * U);
        // 2) La plataforma cobra exactamente 1% si hubo éxito, 0 si no.
        uint256 expectedFee = a.succeeded() ? raised * 100 / 10_000 : 0;
        assertEq(usdc.balanceOf(platform), expectedFee);
        // 3) El creador nunca recibe más que lo juntado menos la comisión.
        assertLe(usdc.balanceOf(creator), raised - expectedFee);
        // 4) Al final la alcancía quedó vacía (solo polvo de redondeo).
        assertLe(usdc.balanceOf(address(a)), 2);
        // 5) Conservación total: no se creó ni se perdió ni un centavo.
        assertEq(usdc.balanceOf(address(a)) + usdc.balanceOf(platform) + usdc.balanceOf(creator) + _peopleBalance(), 3_000_000 * U);
    }

    function _peopleBalance() internal view returns (uint256) {
        return usdc.balanceOf(alice) + usdc.balanceOf(bob) + usdc.balanceOf(carol);
    }
}
