// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import {Lock, IManager} from "../src/Lock.sol";

contract MockNPM { IManager.CollectParams public last; function collect(IManager.CollectParams calldata p) external returns (uint256, uint256) { last = p; return (0, 0); } }
contract LockSymbolic is Test {
    function check_collectAlwaysPaysRecipientAndSameId(address recipient, uint256 id, address caller) public {
        MockNPM n = new MockNPM(); Lock l = new Lock(address(n), recipient);
        vm.prank(caller); l.collect(id);
        (uint256 tid, address rcp,,) = n.last();
        (,, uint128 m0, uint128 m1) = n.last();
        assert(rcp == recipient && tid == id && m0 == type(uint128).max && m1 == type(uint128).max);
    }
}
