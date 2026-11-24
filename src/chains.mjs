export const MULTISEND = "0x9641d764fc13c8B624c04430C7356C1C7C8102e2"; // Safe MultiSendCallOnly v1.4.1 (auditado por Ackee dentro de Safe 1.4.x), igual en todas las redes
export const DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
export const CHAINS = {
  sepolia: {
    id: 11155111,
    name: "Ethereum Sepolia (pruebas)",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
    router: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    explorer: "https://sepolia.etherscan.io",
    uniswap: "sepolia",
    gasLimit: "65000000",
    testnet: true,
  },
  base: {
    id: 8453,
    name: "Base",
    rpc: "https://mainnet.base.org",
    npm: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
    router: "0x2626664c2603336E57B271c5C0b26F421741e481",
    weth: "0x4200000000000000000000000000000000000006",
    explorer: "https://basescan.org",
    uniswap: "base",
    gasLimit: "10000000",
    testnet: false,
  },
};
