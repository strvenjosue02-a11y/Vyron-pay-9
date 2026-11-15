// Configuración de la red. Hoy: Ethereum Sepolia (testnet, dinero de prueba).
// Para el lanzamiento real se usa Base: chainId 8453, rpc https://mainnet.base.org,
// explorer https://basescan.org, USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.
export const CONFIG = {
  chainId: 11155111,
  chainName: "Sepolia testnet",
  rpc: "https://ethereum-sepolia-rpc.publicnode.com",
  explorer: "https://sepolia.etherscan.io",
  // USDC de prueba de Circle en Sepolia (se pide gratis en faucet.circle.com)
  usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  // Deployer CREATE2 público (existe en Sepolia, Base y casi todas las redes)
  deployer: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  // Wallet que recibe 1% USDC + 1,5% tokens
  platform: "0xCE461A95e9D07ed2D64B4187DC152F771f73E06D",
};
