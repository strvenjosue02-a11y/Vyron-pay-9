// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {TickMath} from "../lib/v3-core/contracts/libraries/TickMath.sol"; // audited; used OFF-CHAIN here
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol"; // OZ 5.1.0, audited, linear
import {ERC20PresetFixedSupply} from "../src/vendor/oz-4.9.6/token/ERC20/presets/ERC20PresetFixedSupply.sol"; // OZ 4.9.6
import {Lock} from "../src/Lock.sol";
import {INPM} from "../src/interfaces/IUniV3.sol";

interface IMulticall3 { // solo la forma de cada llamada; el envio real es Safe MultiSend
    struct Call3Value { address target; bool allowFailure; uint256 value; bytes callData; }
}
interface IRouter02 {
    struct P { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }
    function exactInputSingle(P calldata p) external payable returns (uint256);
}
interface IWETH9 { function deposit() external payable; function approve(address, uint256) external returns (bool); }
interface IERC20X { function approve(address, uint256) external returns (bool); function transfer(address, uint256) external returns (bool); }

library LaunchCalldata {
    address internal constant MULTISEND = 0x9641d764fc13c8B624c04430C7356C1C7C8102e2;
    address internal constant DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C; // canonical CREATE2 deployer
    address internal constant NPM = 0x1238536071E1c677A632429e3655c799b22cDA52;
    address internal constant ROUTER = 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E; // SwapRouter02
    address internal constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    int24 internal constant WIDTH = 69_200;
    uint256 internal constant SUPPLY = 1_000_000_000 ether;
    uint256 internal constant LP = 900_000_000 ether;

    struct Cfg {
        string name;
        string symbol;
        address creator;
        address operator;      // = creator if none
        uint16 operatorBps;    // 0 = no operator position; max 8020
        int24 startTick;       // quote per token, multiple of 200
        bytes32 salt;          // vanity / address choice (also decides token0/token1 order)
        address protocol;      // recipient of the 18 % Lock
        address partners;      // recipient of the 1.8 % Lock
        uint256 buyEth;        // optional creator bundled buy (0 = none)
        uint256 deadline;
        uint64 vestStart;      // vesting start (12 weeks linear)
        uint256 breakMode;     // TEST ONLY: 0 = honest, others build malicious / broken bundles
    }
    struct Out { bytes data; uint256 value; address token; address vest; address[4] locks; uint256 nCalls; }

    function tokenInit(Cfg memory c) internal pure returns (bytes memory) {
        return abi.encodePacked(type(ERC20PresetFixedSupply).creationCode, abi.encode(c.name, c.symbol, SUPPLY, MULTISEND));
    }
    function vestInit(Cfg memory c) internal pure returns (bytes memory) {
        return abi.encodePacked(type(VestingWallet).creationCode, abi.encode(c.creator, c.vestStart, uint64(12 weeks)));
    }
    function create2(bytes32 salt, bytes memory init) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), DEPLOYER, salt, keccak256(init))))));
    }
    function lockInit(address recipient) internal pure returns (bytes memory) {
        return abi.encodePacked(type(Lock).creationCode, abi.encode(NPM, recipient));
    }
    function lockAddr(address recipient) internal pure returns (address) { return create2(bytes32(0), lockInit(recipient)); }
    function tokenAddr(Cfg memory c) internal pure returns (address) { return create2(c.salt, tokenInit(c)); }
    function vestAddr(Cfg memory c) internal pure returns (address) { return create2(c.salt, vestInit(c)); }

    function _dep(bytes32 salt, bytes memory init) private pure returns (IMulticall3.Call3Value memory) {
        return IMulticall3.Call3Value(DEPLOYER, false, 0, abi.encodePacked(salt, init));
    }
    function _call(address to, bytes memory data) private pure returns (IMulticall3.Call3Value memory) {
        return IMulticall3.Call3Value(to, false, 0, data);
    }

    function _amounts(Cfg memory c) private pure returns (uint256[4] memory amt) {
        amt[0] = LP * (c.breakMode == 2 ? 500 : 1800) / 10_000; // mode 2: protocol gets 5 % instead of 18 %
        amt[1] = LP * 180 / 10_000;
        amt[2] = LP * c.operatorBps / 10_000;
        if (c.breakMode == 1) amt[0] = 0; // malicious: omit the protocol position
        amt[3] = LP - amt[0] - amt[1] - amt[2]; // creator position takes the rest (off-chain arithmetic)
        if (c.breakMode == 5) amt[3] += 1 ether; // more than Multicall3 holds: this step fails
    }

    function _mint(Cfg memory c, address token, uint256 j, uint256 a, address lock) private pure returns (IMulticall3.Call3Value memory) {
        bool is0 = token < WETH;
        int24 t = is0 ? c.startTick : -c.startTick;
        int24 w = (c.breakMode == 4 && j == 3) ? int24(200) : WIDTH; // mode 4: narrow creator range dilutes protocol fees
        uint256 min = a * 999 / 1000; // single-sided: anything less means the pool price was not what we initialised
        INPM.MintParams memory m = INPM.MintParams(
            is0 ? token : WETH, is0 ? WETH : token, 10_000, is0 ? t : t - w, is0 ? t + w : t,
            is0 ? a : 0, is0 ? 0 : a, is0 ? min : 0, is0 ? 0 : min, lock, c.deadline);
        return _call(NPM, abi.encodeCall(INPM.mint, (m)));
    }

    function build(Cfg memory c) internal view returns (Out memory o) {
        o.token = tokenAddr(c); o.vest = vestAddr(c);
        address[4] memory rec = [c.protocol, c.partners, c.operator, c.creator];
        IMulticall3.Call3Value[] memory k = new IMulticall3.Call3Value[](20);
        uint256 i;
        k[i++] = _dep(c.salt, tokenInit(c));            // 1B tokens minted to Multicall3 by OZ ERC20PresetFixedSupply
        k[i++] = _dep(c.salt, vestInit(c));             // OZ VestingWallet, beneficiary = creator
        for (uint256 j; j < 4; j++) {
            if (j == 2 && c.operatorBps == 0) continue; // no operator position
            o.locks[j] = (c.breakMode == 3 && j == 0) ? lockAddr(c.creator) : lockAddr(rec[j]); // mode 3: "protocol" position -> creator Lock
            bool dup; for (uint256 q; q < j; q++) if (o.locks[q] == o.locks[j]) dup = true;
            if (!dup && o.locks[j].code.length == 0) k[i++] = _dep(bytes32(0), lockInit(rec[j])); // eth_getCode in a real frontend
        }
        k[i++] = _call(o.token, abi.encodeCall(IERC20X.transfer, (c.creator, 25_000_000 ether)));
        k[i++] = _call(o.token, abi.encodeCall(IERC20X.transfer, (o.vest, 75_000_000 ether)));
        k[i++] = _call(o.token, abi.encodeCall(IERC20X.approve, (NPM, type(uint256).max)));
        bool is0 = o.token < WETH;
        k[i++] = _call(NPM, abi.encodeCall(INPM.createAndInitializePoolIfNecessary, (is0 ? o.token : WETH, is0 ? WETH : o.token, 10_000, TickMath.getSqrtRatioAtTick(is0 ? c.startTick : -c.startTick))));
        uint256[4] memory amt = _amounts(c);
        for (uint256 j; j < 4; j++) {
            if (o.locks[j] == address(0) || amt[j] == 0) continue;
            k[i++] = _mint(c, o.token, j, amt[j], o.locks[j]);
        }
        if (c.buyEth > 0) {
            k[i++] = IMulticall3.Call3Value(WETH, false, c.buyEth, abi.encodeCall(IWETH9.deposit, ()));
            k[i++] = _call(WETH, abi.encodeCall(IWETH9.approve, (ROUTER, c.buyEth)));
            k[i++] = _call(ROUTER, abi.encodeCall(IRouter02.exactInputSingle, (IRouter02.P(WETH, o.token, 10_000, c.creator, c.buyEth, 1, 0))));
            o.value = c.buyEth;
        }
        assembly { mstore(k, i) } // shrink
        o.nCalls = i;
        bytes memory packed; // Safe MultiSend format: operation(1) + target(20) + value(32) + length(32) + data
        for (uint256 j; j < i; j++) packed = abi.encodePacked(packed, uint8(0), k[j].target, k[j].value, k[j].callData.length, k[j].callData);
        o.data = abi.encodeWithSignature("multiSend(bytes)", packed);
    }

    function mine(Cfg memory c, bool want0, uint256 from) internal pure returns (bytes32) {
        for (uint256 s = from; s < from + 200_000; s++) {
            uint256 fmp; assembly { fmp := mload(0x40) }
            c.salt = bytes32(s);
            bool hit = (tokenAddr(c) < WETH) == want0;
            assembly { mstore(0x40, fmp) } // reuse memory between attempts
            if (hit) return c.salt;
        }
        revert("no salt");
    }
}
