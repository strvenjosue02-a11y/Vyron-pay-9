// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IManager {
    struct CollectParams { uint256 tokenId; address recipient; uint128 amount0Max; uint128 amount1Max; }
    function collect(CollectParams calldata) external returns (uint256, uint256);
}

contract Lock {
    IManager public immutable NPM;
    address public immutable RECIPIENT;

    constructor(address npm, address recipient) { (NPM, RECIPIENT) = (IManager(npm), recipient); }

    function collect(uint256 id) external {
        NPM.collect(IManager.CollectParams(id, RECIPIENT, type(uint128).max, type(uint128).max));
    }
}
