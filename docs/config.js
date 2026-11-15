// Configuración de la red. Hoy: Base Sepolia (testnet, dinero de prueba).
// Para pasar a Base real se cambian estos valores (chainId 8453, USDC real, RPC real).
export const CONFIG = {
  chainId: 84532,
  chainName: "Base Sepolia (prueba)",
  rpc: "https://sepolia.base.org",
  explorer: "https://sepolia.basescan.org",
  // USDC de prueba de Circle en Base Sepolia (se pide gratis en faucet.circle.com)
  usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  // Deployer CREATE2 público que ya existe en Base y Base Sepolia
  deployer: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  // Wallet que recibe 1% USDC + 1,5% tokens
  platform: "0xCE461A95e9D07ed2D64B4187DC152F771f73E06D",
};
