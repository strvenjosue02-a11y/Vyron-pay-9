// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {TickMath} from "../lib/v3-core/contracts/libraries/TickMath.sol";
import {SqrtPriceMath} from "../lib/v3-core/contracts/libraries/SqrtPriceMath.sol";
import {LaunchCalldata as LC} from "./LaunchCalldata.sol";

interface INPMv {
    function balanceOf(address) external view returns (uint256);
    function tokenOfOwnerByIndex(address, uint256) external view returns (uint256);
    function positions(uint256 id) external view returns (uint96, address, address token0, address token1, uint24 fee, int24 lo, int24 hi, uint128 liq, uint256, uint256, uint128, uint128);
}
interface IFac { function getPool(address, address, uint24) external view returns (address); }
interface IPoolT { function ticks(int24) external view returns (uint128 gross, int128 net, uint256, uint256, int56, uint160, uint32, bool); }
interface IERC20B { function balanceOf(address) external view returns (uint256); function totalSupply() external view returns (uint256); }

contract PlatformVerifier {
    address constant FACTORY = 0x0227628f3F023bb0B980b67D528571c95c6DaC1c;
    address public immutable PROTOCOL_LOCK; // = CREATE2(canonical deployer, 0, Lock initcode(NPM, protocol treasury))
    bytes32 public immutable TOKEN_CODEHASH; // keccak(runtime code of OZ ERC20PresetFixedSupply 4.9.6: no immutables, name/symbol are storage)

    constructor(address protocolTreasury, bytes32 tokenCodehash) {
        PROTOCOL_LOCK = LC.lockAddr(protocolTreasury);
        TOKEN_CODEHASH = tokenCodehash;
    }

    function check(address token) external view returns (string memory why) {
        if (token.code.length == 0) return "no token code";
        if (token.codehash != TOKEN_CODEHASH) return "token bytecode is not the canonical Token";
        if (IERC20B(token).totalSupply() != 1_000_000_000 ether) return "supply";
        if (PROTOCOL_LOCK.code.length == 0) return "protocol Lock not deployed";
        address pool = IFac(FACTORY).getPool(token, LC.WETH, 10_000);
        if (pool == address(0)) return "no 1% pool";
        (address a, address b) = token < LC.WETH ? (token, LC.WETH) : (LC.WETH, token);
        uint256 n = INPMv(LC.NPM).balanceOf(PROTOCOL_LOCK);
        uint128 lp; int24 lo; int24 hi;
        for (uint256 i; i < n; i++) {
            (,, address t0, address t1, uint24 fee, int24 l, int24 h, uint128 liq,,,,) = INPMv(LC.NPM).positions(INPMv(LC.NPM).tokenOfOwnerByIndex(PROTOCOL_LOCK, i));
            if (t0 == a && t1 == b && fee == 10_000) { lp = liq; lo = l; hi = h; break; }
        }
        if (lp == 0) return "protocol Lock holds no position in this pool";
        if (hi - lo != LC.WIDTH) return "protocol position range is not the standard range";
        (uint128 gLo,,,,,,,) = IPoolT(pool).ticks(lo);
        (uint128 gHi,,,,,,,) = IPoolT(pool).ticks(hi);
        if (gLo != gHi) return "liquidity at the range ends differs: foreign/narrow positions exist";
        uint256 x = uint256(lp) * 10_000; uint256 y = uint256(gLo) * 1800;
        if ((x > y ? x - y : y - x) > gLo) return "protocol liquidity share is not 18%";
        uint256 sa = TickMath.getSqrtRatioAtTick(lo); uint256 sb = TickMath.getSqrtRatioAtTick(hi);
        uint256 full = token == a ? SqrtPriceMath.getAmount0Delta(uint160(sa), uint160(sb), gLo, false) : SqrtPriceMath.getAmount1Delta(uint160(sa), uint160(sb), gLo, false);
        uint256 want = 900_000_000 ether;
        if ((full > want ? full - want : want - full) > want / 1_000_000) return "range liquidity does not account for the 90% pool supply";
        return "";
    }
}
