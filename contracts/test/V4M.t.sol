// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TickMath} from "../lib/v3-core/contracts/libraries/TickMath.sol";
import {Lock} from "../src/Lock.sol";
import {ERC20PresetFixedSupply} from "../src/vendor/oz-4.9.6/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {INPM} from "../src/interfaces/IUniV3.sol";
import {LaunchCalldata as LC, IRouter02, IWETH9} from "./LaunchCalldata.sol";
import {PlatformVerifier} from "./PlatformVerifier.sol";

interface IFullNPM {
    function ownerOf(uint256 id) external view returns (address);
    function positions(uint256 id) external view returns (uint96, address, address, address, uint24, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256, uint256, uint128, uint128);
    function transferFrom(address, address, uint256) external;
    function safeTransferFrom(address, address, uint256) external;
    function approve(address, uint256) external;
    function setApprovalForAll(address, bool) external;
    function burn(uint256) external;
    function getApproved(uint256) external view returns (address);
}
interface IFactory { function getPool(address, address, uint24) external view returns (address); }
interface IPool { function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool); }

contract EvilToken is ERC20PresetFixedSupply {
    constructor(address h) ERC20PresetFixedSupply("Evil", "EVIL", 1_000_000_000 ether, h) {}
    function mint(address to) external { _mint(to, 1e30); }
}

contract V4MTest is Test {
    address constant MC = LC.MULTISEND;
    address constant NPM = LC.NPM;
    address constant ROUTER = LC.ROUTER;
    address constant FACTORY = 0x0227628f3F023bb0B980b67D528571c95c6DaC1c;
    address constant WETH = LC.WETH;
    int24 constant START = -193_400; // ~4 ETH FDV

    struct R { address token; address vest; address[4] locks; uint256[4] ids; bool is0; bool ok; uint256 gas; uint256 cdLen; }

    address protocol = makeAddr("protocol");
    address partners = makeAddr("partners");
    address creator = makeAddr("creator");
    address operator = makeAddr("operator");
    address rando = makeAddr("rando"); // the relayer / anyone: pays gas only
    address trader = makeAddr("trader");
    address sniper = makeAddr("sniper");
    PlatformVerifier verifier;
    uint256 mcEth0; // MultiSend on Sepolia already holds some stray ETH: compare against it

    function setUp() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) vm.skip(true);
        vm.createSelectFork(url);
        vm.deal(trader, 5_000 ether); vm.deal(sniper, 5_000 ether); vm.deal(rando, 100 ether); vm.deal(creator, 100 ether);
        vm.prank(trader); IWETH9(WETH).deposit{value: 2_000 ether}();
        vm.prank(sniper); IWETH9(WETH).deposit{value: 2_000 ether}();
        mcEth0 = MC.balance;
        verifier = new PlatformVerifier(protocol, keccak256(vm.getDeployedCode("ERC20PresetFixedSupply.sol:ERC20PresetFixedSupply")));
    }

    function _cfg(bool want0, uint16 opBps, uint256 buyEth, uint256 from) internal view returns (LC.Cfg memory c) {
        c.name = "Moon Bread"; c.symbol = "BREAD"; c.creator = creator; c.operator = opBps == 0 ? creator : operator;
        c.operatorBps = opBps; c.startTick = START; c.protocol = protocol; c.partners = partners;
        c.buyEth = buyEth; c.deadline = block.timestamp + 1 hours; c.vestStart = uint64(block.timestamp);
        c.salt = LC.mine(c, want0, from);
    }
    function _send(LC.Cfg memory c, address who) internal returns (R memory r) {
        LC.Out memory o = LC.build(c);
        r.token = o.token; r.vest = o.vest; r.locks = o.locks; r.is0 = o.token < WETH; r.cdLen = o.data.length;
        vm.recordLogs();
        uint256 g = gasleft();
        vm.prank(who);
        (r.ok,) = MC.call{value: o.value}(o.data);
        r.gas = g - gasleft();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        if (!r.ok) return r;
        uint256 n;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == NPM && logs[i].topics.length == 4 && logs[i].topics[0] == keccak256("Transfer(address,address,uint256)") && logs[i].topics[1] == bytes32(0)) {
                address lk = address(uint160(uint256(logs[i].topics[2])));
                for (uint256 j; j < 4; j++) if (r.locks[j] == lk && r.ids[j] == 0) { r.ids[j] = uint256(logs[i].topics[3]); break; }
                n++;
            }
        }
        assertEq(n, (c.operatorBps == 0 ? 3 : 4) - (c.breakMode == 1 ? 1 : 0), "number of positions");
    }
    function _launch(bool want0, uint16 opBps) internal returns (R memory r) {
        r = _send(_cfg(want0, opBps, 0, 0), rando);
        assertTrue(r.ok, "launch failed");
    }
    function _swap(address who, address tin, address tout, uint256 amt) internal returns (uint256 out) {
        vm.startPrank(who);
        IERC20(tin).approve(ROUTER, amt);
        out = IRouter02(ROUTER).exactInputSingle(IRouter02.P(tin, tout, 10_000, who, amt, 0, 0));
        vm.stopPrank();
    }
    function _liq(uint256 id) internal view returns (uint128 l) { (,,,,,,, l,,,,) = IFullNPM(NPM).positions(id); }
    function _pool(address token) internal view returns (address) {
        (address a, address b) = token < WETH ? (token, WETH) : (WETH, token);
        return IFactory(FACTORY).getPool(a, b, 10_000);
    }
    function _bal(address tk, address who) internal view returns (uint256) { return IERC20(tk).balanceOf(who); }
    function _who() internal view returns (address[4] memory) { return [protocol, partners, operator, creator]; }
    function _collectAll(R memory r, address caller) internal {
        for (uint256 i; i < 4; i++) if (r.locks[i] != address(0)) { vm.prank(caller); Lock(r.locks[i]).collect(r.ids[i]); }
    }

    function test_prereqs_existOnFork() public view {
        assertGt(MC.code.length, 100, "Safe MultiSend");
        assertEq(LC.DEPLOYER.code.length, 69, "canonical CREATE2 deployer"); // 0x4e59.. runtime is 69 bytes
        assertGt(NPM.code.length, 0); assertGt(ROUTER.code.length, 0);
    }

    function test_lazy_allocations_liquiditySplit_token0() public { _lazy(true); }
    function test_lazy_allocations_liquiditySplit_token1_mirrored() public { _lazy(false); }
    function _lazy(bool want0) internal {
        LC.Cfg memory c = _cfg(want0, 500, 0, 0);
        address predicted = LC.tokenAddr(c);
        assertEq(predicted.code.length, 0, "nothing deployed yet");
        R memory r = _send(c, rando); // the creator sends nothing: a relayer / anyone triggers the bundle
        assertTrue(r.ok);
        assertEq(r.is0, want0);
        assertEq(r.token, predicted, "address known in advance");
        IERC20 t = IERC20(r.token);
        assertEq(t.totalSupply(), 1_000_000_000 ether);
        assertEq(t.balanceOf(creator), 25_000_000 ether, "2.5% immediate");
        assertEq(t.balanceOf(r.vest), 75_000_000 ether, "7.5% vesting");
        uint256 dust = t.balanceOf(MC);
        emit log_named_uint("dust left in MultiSend (wei of token)", dust);
        assertLt(dust, 1e14);
        assertApproxEqAbs(t.balanceOf(_pool(r.token)), 900_000_000 ether, 1e14);
        uint128 total; for (uint256 i; i < 4; i++) total += _liq(r.ids[i]);
        uint256[4] memory want = [uint256(1800), 180, 500, 10_000 - 2480];
        for (uint256 i; i < 4; i++) {
            assertEq(IFullNPM(NPM).ownerOf(r.ids[i]), r.locks[i]);
            assertApproxEqAbs(uint256(_liq(r.ids[i])) * 10_000 / total, want[i], 1, "liquidity share bps");
            (,,,,, int24 lo, int24 hi,,,,,) = IFullNPM(NPM).positions(r.ids[i]);
            assertEq(hi - lo, LC.WIDTH, "same range");
            assertEq(Lock(r.locks[i]).RECIPIENT(), _who()[i]);
            assertEq(address(Lock(r.locks[i]).NPM()), NPM);
        }
        (, int24 tick,,,,,) = IPool(_pool(r.token)).slot0();
        (,,,,, int24 lo0, int24 hi0,,,,,) = IFullNPM(NPM).positions(r.ids[3]);
        if (r.is0) { assertEq(tick, START); assertEq(lo0, START); } else { assertEq(tick, -START); assertEq(hi0, -START); }
        assertEq(address(MC).balance, mcEth0, "no ETH left behind in MultiSend");
    }
    function test_noOperator_threePositions() public {
        R memory r = _launch(true, 0);
        assertEq(r.locks[2], address(0));
        uint128 tot = _liq(r.ids[0]) + _liq(r.ids[1]) + _liq(r.ids[3]);
        assertApproxEqAbs(uint256(_liq(r.ids[0])) * 10_000 / tot, 1800, 1);
        assertApproxEqAbs(uint256(_liq(r.ids[3])) * 10_000 / tot, 8020, 1);
    }

    function test_buyAndSell_token0() public { _buySell(_launch(true, 0)); }
    function test_buyAndSell_token1() public { _buySell(_launch(false, 0)); }
    function _buySell(R memory r) internal {
        uint256 sq = TickMath.getSqrtRatioAtTick(START);
        uint256 small = 1 ether / 1000;
        uint256 expect = Math.mulDiv(small * 99 / 100, 1 << 192, sq * sq);
        uint256 got = _swap(trader, WETH, r.token, small);
        assertApproxEqRel(got, expect, 0.01e18, "starting price");
        uint256 big = _swap(trader, WETH, r.token, 1 ether);
        emit log_named_uint("tokens (M) bought by 1 ETH at 4 ETH FDV", big / 1e24);
        assertGt(big, 150_000_000 ether); assertLt(big, 300_000_000 ether);
        uint256 back = _swap(trader, r.token, WETH, (got + big) / 2);
        assertGt(back, 0);
    }

    function test_feeShares_exact_token0() public { _fees(_launch(true, 500)); }
    function test_feeShares_exact_token1() public { _fees(_launch(false, 500)); }
    function _fees(R memory r) internal {
        uint256 vol = 3 ether;
        uint256 sold = _swap(trader, WETH, r.token, vol) / 3;
        _swap(trader, r.token, WETH, sold);
        uint256 liqTot; for (uint256 i; i < 4; i++) liqTot += _liq(r.ids[i]);
        _collectAll(r, rando); // permissionless
        uint256 qTot; uint256[4] memory q; uint256[4] memory tk;
        for (uint256 i; i < 4; i++) { q[i] = _bal(WETH, _who()[i]); tk[i] = _bal(r.token, _who()[i]); qTot += q[i]; }
        tk[3] -= 25_000_000 ether;
        emit log_named_uint("protocol quote fee (WETH wei)", q[0]);
        emit log_named_uint("expected 0.18% of volume", vol * 18 / 10_000);
        assertApproxEqAbs(qTot, vol / 100, 4 + vol / 1e9, "total ~1% of volume");
        assertApproxEqAbs(q[0], vol * 18 / 10_000, 4 + vol / 1e9, "protocol = 0.18% of volume");
        assertApproxEqAbs(q[1], vol * 18 / 100_000, 4 + vol / 1e9, "partners = 0.018%");
        assertApproxEqAbs(q[2], vol * 5 / 10_000, 4 + vol / 1e9, "operator = 0.05%");
        assertApproxEqAbs(tk[0], sold * 18 / 10_000, 4 + sold / 1e9, "protocol = 0.18% (token side)");
        for (uint256 i; i < 4; i++) {
            assertApproxEqAbs(q[i] * liqTot, qTot * uint256(_liq(r.ids[i])), qTot * liqTot / 1e9 + 4 * liqTot, "cut == liquidity share");
            assertEq(_bal(WETH, r.locks[i]) + _bal(r.token, r.locks[i]), 0, "nothing stuck");
        }
        _collectAll(r, rando);
        assertEq(_bal(WETH, protocol), q[0], "second collect is a no-op");
    }

    function test_permanence_everyWithdrawalFails_token0() public { _perm(_launch(true, 500)); }
    function test_permanence_everyWithdrawalFails_token1() public { _perm(_launch(false, 500)); }
    function _perm(R memory r) internal {
        _swap(trader, WETH, r.token, 1 ether);
        for (uint256 k; k < 4; k++) _permOne(r, k);
    }
    function _permOne(R memory r, uint256 k) internal {
        address[8] memory actors = [creator, protocol, partners, operator, rando, MC, LC.DEPLOYER, trader];
        address lk = r.locks[k]; uint256 id = r.ids[k]; uint128 liq = _liq(id);
        assertGt(liq, 0);
        for (uint256 i; i < actors.length; i++) _cannotWithdraw(actors[i], lk, id, liq);
        _noOtherSurface(lk, id);
        bytes memory code = lk.code;
        bytes4[8] memory banned = [bytes4(0x23b872dd), 0x42842e0e, 0xb88d4fde, 0x095ea7b3, 0xa22cb465, 0x0c49ccbe, 0x219f5d17, 0x42966c68];
        for (uint256 b; b < banned.length; b++) assertFalse(_has(code, banned[b]), "banned selector in Lock code");
        assertTrue(_has(code, INPM.collect.selector));
        assertEq(IFullNPM(NPM).getApproved(id), address(0));
        assertEq(_liq(id), liq, "liquidity untouched");
        assertEq(IFullNPM(NPM).ownerOf(id), lk);
        vm.expectRevert(); Lock(lk).collect(r.ids[(k + 1) % 4]); // foreign id
        Lock(lk).collect(id);
    }
    function _cannotWithdraw(address c, address lk, uint256 id, uint128 liq) internal {
        vm.startPrank(c);
        vm.expectRevert(); IFullNPM(NPM).transferFrom(lk, c, id);
        vm.expectRevert(); IFullNPM(NPM).safeTransferFrom(lk, c, id);
        vm.expectRevert(); IFullNPM(NPM).burn(id);
        vm.expectRevert(); IFullNPM(NPM).approve(c, id);
        (bool ok,) = NPM.call(abi.encodeWithSignature("decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))", id, liq, 0, 0, block.timestamp));
        assertFalse(ok, "decreaseLiquidity");
        (ok,) = NPM.call(abi.encodeWithSelector(INPM.collect.selector, INPM.CollectParams(id, c, type(uint128).max, type(uint128).max)));
        assertFalse(ok, "direct collect to self");
        IFullNPM(NPM).setApprovalForAll(address(0xBEEF), true);
        vm.expectRevert(); IFullNPM(NPM).transferFrom(lk, c, id);
        vm.stopPrank();
    }
    function _noOtherSurface(address lk, uint256 id) internal {
        string[8] memory sigs = ["transferOwnership(address)", "withdraw()", "rescue(address)", "execute(address,bytes)", "sweep(address)", "onERC721Received(address,address,uint256,bytes)", "decreaseLiquidity(uint256)", "approve(address,uint256)"];
        for (uint256 k; k < sigs.length; k++) { (bool ok,) = lk.call(abi.encodeWithSignature(sigs[k], rando)); assertFalse(ok, sigs[k]); }
        (bool ok2,) = lk.call{value: 1}(""); assertFalse(ok2, "plain ETH");
        (ok2,) = lk.call{value: 1}(abi.encodeWithSelector(Lock.collect.selector, id)); assertFalse(ok2, "payable collect");
        (ok2,) = lk.call(hex"deadbeef"); assertFalse(ok2, "unknown selector");
    }
    function _has(bytes memory code, bytes4 sel) internal pure returns (bool) {
        for (uint256 i; i + 4 <= code.length; i++)
            if (code[i] == sel[0] && code[i + 1] == sel[1] && code[i + 2] == sel[2] && code[i + 3] == sel[3]) return true;
        return false;
    }

    function test_vestingRelease() public {
        R memory r = _launch(true, 0);
        IERC20 t = IERC20(r.token);
        VestingWallet vw = VestingWallet(payable(r.vest));
        assertEq(vw.duration(), 12 weeks);
        assertEq(vw.owner(), creator);
        uint256 base = t.balanceOf(creator);
        vm.prank(rando); vw.release(r.token);
        assertEq(t.balanceOf(creator), base, "nothing before week 1");
        skip(6 weeks);
        vm.prank(rando); vw.release(r.token);
        assertEq(t.balanceOf(creator) - base, 37_500_000 ether, "linear: 6/12 after 6 weeks");
        skip(6 weeks);
        vm.prank(rando); vw.release(r.token);
        assertEq(t.balanceOf(creator) - base, 75_000_000 ether);
        assertEq(t.balanceOf(rando), 0);
    }

    function test_atomic_lastStepFails_nothingDeployed() public {
        LC.Cfg memory c = _cfg(true, 500, 0, 0);
        c.breakMode = 5; // creator position asks for 1 token more than MultiSend holds
        LC.Out memory o = LC.build(c);
        R memory r = _send(c, rando);
        assertFalse(r.ok, "must revert");
        assertEq(o.token.code.length, 0, "token not deployed");
        for (uint256 i; i < 4; i++) assertEq(o.locks[i].code.length, 0, "no Lock deployed");
        assertEq(IFactory(FACTORY).getPool(o.token, WETH, 10_000), address(0), "no pool");
        assertEq(IFactory(FACTORY).getPool(WETH, o.token, 10_000), address(0), "no pool");
        c.breakMode = 0;
        assertTrue(_send(c, rando).ok);
    }
    function test_atomic_expiredDeadline_firstNpmCallFails() public {
        LC.Cfg memory c = _cfg(true, 500, 0, 0);
        c.deadline = block.timestamp - 1;
        LC.Out memory o = LC.build(c);
        assertFalse(_send(c, rando).ok);
        assertEq(o.token.code.length, 0);
        assertEq(o.locks[0].code.length, 0);
    }
    function test_atomic_secondLaunchSameSalt_reverts() public {
        LC.Cfg memory c = _cfg(true, 0, 0, 0);
        assertTrue(_send(c, rando).ok);
        assertFalse(_send(c, rando).ok, "CREATE2 address already used");
    }
    function test_atomic_wrongEthValue_reverts() public {
        LC.Cfg memory c = _cfg(true, 0, 1 ether, 0);
        LC.Out memory o = LC.build(c);
        vm.prank(rando); (bool ok,) = MC.call{value: 0.5 ether}(o.data);
        assertFalse(ok); assertEq(o.token.code.length, 0);
        vm.prank(rando); (ok,) = MC.call{value: 2 ether}(o.data);
        assertTrue(ok); assertEq(address(MC).balance, mcEth0 + 1 ether, "el sobrante queda en MultiSend");
    }
    function test_atomic_buyFailsAfterLiquidity_wholeTxReverts() public {
        LC.Cfg memory c = _cfg(true, 0, 1 ether, 0);
        LC.Out memory o = LC.build(c);
        vm.prank(rando); (bool ok,) = MC.call{value: 1 ether}(o.data); // honest: ok
        assertTrue(ok);
        c.salt = LC.mine(c, true, 5_000);
        _preinit(c, c.startTick + LC.WIDTH + 200);
        o = LC.build(c);
        vm.prank(rando); (ok,) = MC.call{value: 1 ether}(o.data);
        assertFalse(ok); assertEq(o.token.code.length, 0);
        assertEq(rando.balance, 100 ether - 1 ether - 0, "ETH of the failed attempt came back"); // only the 1 ETH of the first (successful) bundle left
    }

    function _preinit(LC.Cfg memory c, int24 poolTick) internal {
        address tok = LC.tokenAddr(c);
        (address a, address b) = tok < WETH ? (tok, WETH) : (WETH, tok);
        (bool ok,) = NPM.call(abi.encodeWithSignature("createAndInitializePoolIfNecessary(address,address,uint24,uint160)", a, b, uint24(10_000), TickMath.getSqrtRatioAtTick(poolTick)));
        assertTrue(ok, "preinit");
    }
    function test_preinit_insideOrAboveRange_revertsSafely_saltBumpRecovers() public {
        LC.Cfg memory c = _cfg(true, 0, 0, 0);
        int24[2] memory bad = [START + 400, START + LC.WIDTH + 200];
        for (uint256 k; k < 2; k++) {
            uint256 snap = vm.snapshotState();
            _preinit(c, bad[k]);
            R memory r = _send(c, rando);
            assertFalse(r.ok, "whole bundle reverts");
            assertEq(r.token.code.length, 0);
            assertEq(creator.balance, 100 ether, "creator lost nothing");
            LC.Cfg memory c2 = _cfg(true, 0, 0, 1000); // new salt => new token address => fresh, un-poisoned pool
            assertTrue(_send(c2, rando).ok);
            vm.revertToState(snap);
        }
    }
    function test_preinit_priceBelowStart_isHarmless() public {
        LC.Cfg memory c = _cfg(true, 0, 0, 0);
        _preinit(c, START - 1000);
        R memory r = _send(c, rando);
        assertTrue(r.ok, "still launches");
        assertApproxEqAbs(_bal(r.token, _pool(r.token)), 900_000_000 ether, 1e14, "all tokens in pool");
        uint256 got = _swap(trader, WETH, r.token, 1 ether);
        assertGt(got, 150_000_000 ether); assertLt(got, 300_000_000 ether);
    }
    function test_preinit_mirrored_aboveStart_isHarmless_belowRevert() public {
        LC.Cfg memory c = _cfg(false, 0, 0, 0);
        int24 st = -START;
        uint256 snap = vm.snapshotState();
        _preinit(c, st + 1000); // above the (mirrored) range
        R memory r = _send(c, rando);
        assertTrue(r.ok);
        vm.revertToState(snap);
        _preinit(c, st - 400); // inside
        assertFalse(_send(c, rando).ok);
    }

    function test_secondLaunch_reusesProtocolPartnersCreatorLocks() public {
        R memory a = _launch(true, 0);
        LC.Cfg memory c = _cfg(true, 0, 0, 10_000);
        R memory b = _send(c, rando);
        assertTrue(b.ok);
        for (uint256 i; i < 4; i++) assertEq(a.locks[i], b.locks[i], "same Lock addresses (CREATE2, immutable recipients)");
        assertEq(IFullNPM(NPM).ownerOf(b.ids[0]), a.locks[0]);
        assertTrue(a.token != b.token);
        Lock(a.locks[0]).collect(a.ids[0]); Lock(b.locks[0]).collect(b.ids[0]);
    }

    function _snipeRow(uint256 X, uint256 Y) internal returns (uint256 creatorGot, uint256 sniperGot) {
        uint256 snap = vm.snapshotState();
        LC.Cfg memory c = _cfg(true, 0, X, 0);
        R memory r = _send(c, rando);
        assertTrue(r.ok);
        creatorGot = _bal(r.token, creator) - 25_000_000 ether;
        sniperGot = _swap(sniper, WETH, r.token, Y); // same block, right behind the launch tx
        vm.revertToState(snap);
    }
    function test_snipe_bundledBuy_doesNotStopSnipers_onlyOrdersThem() public {
        emit log_string("start FDV ~4 ETH | pool holds 900M of 1000M supply | tokens in millions");
        uint256[3] memory Ys = [uint256(1 ether), 10 ether, 100 ether];
        uint256[3] memory Xs = [uint256(0), 0.1 ether, 1 ether];
        uint256[3][3] memory sn;
        for (uint256 y; y < 3; y++) {
            for (uint256 x; x < 3; x++) {
                (uint256 cg, uint256 sg) = _snipeRow(Xs[x], Ys[y]);
                sn[y][x] = sg;
                emit log_named_uint(string.concat("creatorBuy(milliETH)=", vm.toString(Xs[x] / 1e15), " sniper(ETH)=", vm.toString(Ys[y] / 1e18), " -> creator M*100"), cg / 1e22);
                emit log_named_uint("                                         sniper M*100", sg / 1e22);
            }
        }
        assertGt(sn[2][2], 400_000_000 ether, "100 ETH sniper still takes >400M after a 1 ETH creator buy");
        for (uint256 y; y < 3; y++) { assertLt(sn[y][1], sn[y][0]); assertLt(sn[y][2], sn[y][1]); assertGt(sn[y][2], 0); }
        (, uint256 one) = _snipeRow(0, 101 ether);
        (uint256 cg2, uint256 sg2) = _snipeRow(1 ether, 100 ether);
        assertApproxEqRel(cg2 + sg2, one, 0.002e18, "total taken is the same");
        assertGt(cg2, 150_000_000 ether);
        emit log_named_uint("block-0 sniper 100 ETH WITHOUT creator buy: M tokens", sn[2][0] / 1e24);
        emit log_named_uint("block-0 sniper 100 ETH AFTER 1 ETH creator buy: M tokens", sn[2][2] / 1e24);
    }

    function test_bundledBuy_creatorGetsTokensDirectly_rawEthIsPaidBySender() public {
        LC.Cfg memory c = _cfg(true, 500, 2 ether, 0);
        uint256 senderBefore = rando.balance;
        R memory r = _send(c, rando);
        assertTrue(r.ok);
        assertEq(senderBefore - rando.balance, 2 ether, "sender pays exactly the buy, gas is free on fork");
        uint256 got = _bal(r.token, creator) - 25_000_000 ether;
        emit log_named_uint("creator bought (M tokens) with 2 ETH", got / 1e24);
        assertGt(got, 250_000_000 ether);
        assertEq(MC.balance, mcEth0); assertEq(_bal(WETH, MC), 0);
        assertEq(_bal(WETH, ROUTER), 0);
        assertEq(IERC20(r.token).allowance(MC, ROUTER), 0);
    }

    function test_verifier_genuineBundle_passes_bothOrientations_withBuy() public {
        assertEq(verifier.check(_launch(true, 500).token), "");
        assertEq(verifier.check(_launch(false, 0).token), "");
        LC.Cfg memory c = _cfg(true, 500, 1 ether, 7_000);
        R memory r = _send(c, rando);
        assertTrue(r.ok);
        _swap(trader, WETH, r.token, 50 ether); // trading does not change the verdict
        assertEq(verifier.check(r.token), "", "genuine after trades + bundled buy");
    }
    function test_verifier_maliciousFrontend_variants_areRejected() public {
        uint256[4] memory modes = [uint256(1), 2, 3, 4];
        string[4] memory names = ["omit protocol position", "protocol position 5% not 18%", "protocol position redirected to creator Lock", "narrow creator range dilutes protocol fees"];
        for (uint256 i; i < 4; i++) {
            LC.Cfg memory c = _cfg(true, 500, 0, 20_000 + i * 1000);
            c.breakMode = modes[i];
            R memory r = _send(c, rando);
            assertTrue(r.ok, names[i]); // the chain happily executes it (no launcher to refuse) ...
            string memory why = verifier.check(r.token);
            emit log_named_string(names[i], why);
            assertGt(bytes(why).length, 0, names[i]); // ... but the verifier rejects it
        }
    }
    function test_verifier_rejectsNonCanonicalToken() public {
        EvilToken e = new EvilToken(MC);
        assertEq(verifier.check(address(e)), "token bytecode is not the canonical Token");
    }
    function test_verifier_rejectsFakeProtocolLock_withAttackerRecipient() public {
        LC.Cfg memory c = _cfg(true, 0, 0, 30_000);
        c.protocol = makeAddr("attacker");
        R memory r = _send(c, rando);
        assertTrue(r.ok);
        assertGt(bytes(verifier.check(r.token)).length, 0);
        assertTrue(r.locks[0] != verifier.PROTOCOL_LOCK());
    }

    function test_report_gasAndCalldata() public {
        R memory a = _send(_cfg(true, 500, 0, 0), rando);
        R memory b = _send(_cfg(true, 500, 1 ether, 100), rando);
        R memory d = _send(_cfg(true, 500, 0, 200), rando); // Locks already exist
        emit log_named_uint("gas: first launch (4 Locks deployed)", a.gas);
        emit log_named_uint("gas: launch + bundled buy (Locks reused)", b.gas);
        emit log_named_uint("gas: launch, Locks reused", d.gas);
        emit log_named_uint("calldata bytes: first launch", a.cdLen);
        emit log_named_uint("calldata bytes: reused Locks", d.cdLen);
        emit log_named_uint("ERC20PresetFixedSupply initcode bytes", LC.tokenInit(_cfg(true, 0, 0, 0)).length);
    }

    function testFuzz_conservation(uint96 buyRaw, uint8 sellPct, uint16 opBps, uint8 orient) public {
        opBps = uint16(bound(opBps, 0, 8_000));
        uint256 buy = bound(buyRaw, 0.01 ether, 10 ether);
        sellPct = uint8(bound(sellPct, 0, 100));
        R memory r = _send(_cfg(orient % 2 == 0, opBps, 0, 0), rando);
        assertTrue(r.ok);
        uint256 got = _swap(trader, WETH, r.token, buy);
        uint256 sold = got * sellPct / 100;
        if (sold > 0) _swap(trader, r.token, WETH, sold);
        uint256 supply = IERC20(r.token).totalSupply();
        uint256 q0 = _bal(WETH, protocol);
        _collectAll(r, rando);
        assertApproxEqAbs(_bal(WETH, protocol) - q0, buy * 18 / 10_000, 4 + buy / 1e9, "protocol 0.18%");
        assertEq(IERC20(r.token).totalSupply(), supply);
        assertEq(verifier.check(r.token), "");
    }

}
