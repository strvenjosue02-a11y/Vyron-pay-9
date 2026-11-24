// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Script, console} from "forge-std/Script.sol";
import {TickMath} from "../lib/v3-core/contracts/libraries/TickMath.sol";
contract TickHash is Script {
    function run() external view {
        bytes32 h;
        for (int24 t = TickMath.MIN_TICK; t <= TickMath.MAX_TICK; t++) {
            uint160 v = TickMath.getSqrtRatioAtTick(t);
            assembly { mstore(0x00, h) mstore(0x20, shl(96, v)) h := keccak256(0x00, 52) } // = keccak256(abi.encodePacked(h, v)) sin gastar memoria
        }
        console.logBytes32(h);
    }
}
