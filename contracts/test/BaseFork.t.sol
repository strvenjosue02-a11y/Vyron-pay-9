// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Alcancia} from "../src/Alcancia.sol";

interface IGasPriceOracle {
    function getL1Fee(bytes memory data) external view returns (uint256);
}

/// Ensayo sobre una copia real de Base mainnet (no gasta nada).
/// Correr con: FORK_URL=https://mainnet.base.org forge test --match-contract BaseFork -vv
contract BaseForkTest is Test {
    address constant DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    IERC20 constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    IGasPriceOracle constant ORACLE = IGasPriceOracle(0x420000000000000000000000000000000000000F);
    address constant PLATFORM = 0xCE461A95e9D07ed2D64B4187DC152F771f73E06D;

    function setUp() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) vm.skip(true);
        vm.createSelectFork(url);
    }

    function test_realBase_lazyDeployAndBuy() public {
        address creator = makeAddr("creador");
        address buyer = makeAddr("comprador");
        Alcancia.Params memory p = Alcancia.Params({
            usdc: USDC,
            platform: PLATFORM,
            creator: creator,
            name: "Proyecto Demo",
            symbol: "DEMO",
            softcap: 50e6,
            hardcap: 100e6,
            saleTokens: 1_000_000 ether,
            creatorTokens: 500_000 ether,
            saleEnd: uint64(block.timestamp + 14 days),
            initialBps: 1_000,
            milestones: 3,
            milestonePeriod: 60 days,
            liquidityBps: 0,
            positionManager: address(0)
        });
        bytes memory initCode = abi.encodePacked(type(Alcancia).creationCode, abi.encode(p));
        bytes memory txData = abi.encodePacked(bytes32(0), initCode);
        address predicted = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), DEPLOYER, bytes32(0), keccak256(initCode)))))
        );
        assertEq(predicted.code.length, 0);

        // 1) El comprador aprueba USDC a la dirección futura (todavía no existe, y no importa).
        deal(address(USDC), buyer, 100e6);
        vm.prank(buyer);
        USDC.approve(predicted, 100e6);

        // 2) Crea la alcancía con el deployer público real de Base.
        vm.prank(buyer);
        uint256 g = gasleft();
        (bool ok,) = DEPLOYER.call(txData);
        uint256 deployGas = g - gasleft();
        assertTrue(ok);
        assertEq(predicted.code.length > 0, true);

        // 3) Compra.
        vm.prank(buyer);
        g = gasleft();
        Alcancia(predicted).buy(100e6, buyer);
        uint256 buyGas = g - gasleft();

        // 4) Cierra (lleno) -> comisión real en USDC a tu wallet.
        Alcancia(predicted).finalize();
        assertEq(USDC.balanceOf(PLATFORM) >= 1e6, true);

        // Costos con el precio actual de Base.
        uint256 l2Price = tx.gasprice > 0 ? tx.gasprice : 6_000_000;
        uint256 l1Fee = ORACLE.getL1Fee(txData);
        emit log_named_uint("gas despliegue", deployGas);
        emit log_named_uint("gas compra", buyGas);
        emit log_named_uint("wei despliegue L2", deployGas * l2Price);
        emit log_named_uint("wei despliegue L1 (datos)", l1Fee);
        emit log_named_uint("wei compra L2", buyGas * l2Price);
    }
}
