// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {V4MTest, IFullNPM} from "./V4M.t.sol";
import {LaunchCalldata as LC} from "./LaunchCalldata.sol";
import {Lock} from "../src/Lock.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AttackTest is V4MTest {
    address attacker = makeAddr("attacker");
    address[6] actors;

    function _actors() internal { actors = [attacker, creator, protocol, partners, operator, rando]; }

    function test_atk_1_frontrunDeploy_thenStealSupply_victimLosesNothing() public {
        LC.Cfg memory c = _cfg(true, 0, 1 ether, 0);
        LC.Out memory o = LC.build(c);
        (bool ok,) = LC.DEPLOYER.call(abi.encodePacked(c.salt, LC.tokenInit(c))); // el atacante crea ANTES el mismo token (mismo salt y codigo)
        assertTrue(ok);
        bytes memory t = abi.encodeCall(IERC20.transfer, (attacker, 1_000_000_000 ether));
        bytes memory packed = abi.encodePacked(uint8(0), o.token, uint256(0), t.length, t);
        (ok,) = MC.call(abi.encodeWithSignature("multiSend(bytes)", packed)); // ...y se lleva todo el suministro usando MultiSend (es publico)
        assertTrue(ok); assertEq(_bal(o.token, attacker), 1_000_000_000 ether);
        uint256 before = rando.balance;
        vm.prank(rando); (ok,) = MC.call{value: o.value}(o.data); // la victima lanza: debe revertir TODO
        assertFalse(ok, "colision: el lanzamiento revierte");
        assertEq(rando.balance, before, "la victima no pierde ni 1 wei (solo gas)");
        assertEq(o.vest.code.length, 0, "no quedo nada a medias");
        assertGt(bytes(verifier.check(o.token)).length, 0, "el token robado sin pool ni candados NO pasa el informe");
        c.salt = LC.mine(c, true, 9_000); // recuperacion: otro numero de lanzamiento
        _send(c, rando);
    }

    R internal rr;
    uint128[4] internal liq0;
    function _prepare() internal { rr = _launch(true, 500); for (uint256 i; i < 4; i++) liq0[i] = _liq(rr.ids[i]); _actors(); }
    function _assertSafe() internal view {
        for (uint256 i; i < 4; i++) {
            assertEq(IFullNPM(NPM).ownerOf(rr.ids[i]), rr.locks[i], "NFT sigue en su candado");
            assertGe(_liq(rr.ids[i]), liq0[i], "la liquidez no baja");
            assertEq(IFullNPM(NPM).getApproved(rr.ids[i]), address(0), "nadie tiene permiso sobre el NFT");
            for (uint256 j; j < 6; j++) assertFalse(_isAll(rr.locks[i], actors[j]), "nadie es operador del candado");
        }
        assertEq(IERC20(rr.token).totalSupply(), 1_000_000_000 ether, "suministro fijo");
        assertGt(_bal(rr.token, _pool(rr.token)), 0);
    }
    function _isAll(address o, address op) internal view returns (bool b) { (, bytes memory d) = NPM.staticcall(abi.encodeWithSignature("isApprovedForAll(address,address)", o, op)); b = abi.decode(d, (bool)); }

    function testFuzz_atk_2_hostileCalls_cannotMoveOrReduceLiquidity(uint8 who, uint8 kind, uint256 a, uint256 b, uint256 c, bytes calldata junk) public {
        _prepare();
        address from = actors[who % 6]; uint256 id = rr.ids[a % 4]; address lock = rr.locks[a % 4];
        address x = address(uint160(b)); address y = address(uint160(c));
        bytes memory data; address target = NPM; kind %= 14;
        if (kind == 0) data = abi.encodeWithSignature("transferFrom(address,address,uint256)", lock, x, id);
        else if (kind == 1) data = abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", lock, x, id);
        else if (kind == 2) data = abi.encodeWithSignature("approve(address,uint256)", x, id);
        else if (kind == 3) data = abi.encodeWithSignature("setApprovalForAll(address,bool)", x, true);
        else if (kind == 4) data = abi.encodeWithSignature("burn(uint256)", id);
        else if (kind == 5) data = abi.encodeWithSignature("decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))", id, uint128(liq0[a % 4]), 0, 0, block.timestamp + 1);
        else if (kind == 6) data = abi.encodeWithSignature("collect((uint256,address,uint128,uint128))", id, x, type(uint128).max, type(uint128).max); // cobrar a otro receptor
        else if (kind == 7) data = abi.encodeWithSignature("permit(address,uint256,uint256,uint8,bytes32,bytes32)", x, id, block.timestamp + 1, uint8(27), bytes32(b), bytes32(c));
        else if (kind == 8) data = abi.encodeWithSignature("safeTransferFrom(address,address,uint256,bytes)", lock, y, id, junk);
        else if (kind == 9) { target = lock; data = junk; }                                    // bytes al azar al candado
        else if (kind == 10) { target = lock; data = abi.encodeWithSignature("collect(uint256)", id); } // cobrar: legitimo, paga al receptor fijo
        else if (kind == 11) { target = rr.token; data = junk; }                               // bytes al azar al token
        else if (kind == 12) { target = rr.vest; data = junk; }                                // bytes al azar al vesting
        else data = junk;
        uint256 poolTok = _bal(rr.token, _pool(rr.token)); uint256 vestTok = _bal(rr.token, rr.vest);
        uint256 atkTok = _bal(rr.token, attacker);
        vm.prank(from); target.call(data);
        _assertSafe();
        assertEq(_bal(rr.token, _pool(rr.token)), poolTok, "el pool no pierde tokens"); assertEq(_bal(rr.token, rr.vest), vestTok, "el vesting no pierde tokens");
        if (from != attacker) assertEq(_bal(rr.token, attacker), atkTok);
    }

    function testFuzz_atk_3_noHoneypot_everyBuyerCanSellBack(uint96 raw) public {
        R memory r = _launch(true, 0);
        uint256 amt = bound(raw, 0.001 ether, 200 ether);
        uint256 w0 = _bal(WETH, trader);
        uint256 got = _swap(trader, WETH, r.token, amt);
        uint256 spent = w0 - _bal(WETH, trader); // si el pool se agota, solo se gasta lo que cabe
        assertGt(got, 0);
        uint256 back = _swap(trader, r.token, WETH, got);
        assertGe(back, spent * 95 / 100, "vende todo y recupera ~98 % de lo gastado (2 comisiones de 1 %)");
    }
}
