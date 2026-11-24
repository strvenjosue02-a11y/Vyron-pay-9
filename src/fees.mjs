import { createPublicClient, http, parseAbi } from "viem";

const NPM = parseAbi([
  "function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256, uint256)",
  "function factory() view returns (address)",
]);
const FACTORY = parseAbi(["function getPool(address,address,uint24) view returns (address)"]);
const POOL = parseAbi([
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
]);
const MAX = 2n ** 128n - 1n;

/** @returns {Promise<{ positions: object[], totalEth: number }>} montos en wei (bigint) y valor aproximado en ETH */
export async function pendingFees(plan, res, rpc) {
  const chain = plan.chain,
    pub = createPublicClient({ transport: http(rpc || chain.rpc) });
  const pool = res.pool;
  const [sqrtP] = await pub.readContract({ address: pool, abi: POOL, functionName: "slot0" });
  const p = (Number(sqrtP) / 2 ** 96) ** 2; // token1 por token0
  const wethPerToken = plan.tokenIsToken0 ? p : 1 / p;
  const positions = [];
  for (const q of res.positions) {
    const { result } = await pub.simulateContract({
      account: q.lock,
      address: chain.npm,
      abi: NPM,
      functionName: "collect",
      args: [{ tokenId: BigInt(q.id), recipient: q.recipient, amount0Max: MAX, amount1Max: MAX }],
    });
    const [a0, a1] = result,
      weth = plan.tokenIsToken0 ? a1 : a0,
      token = plan.tokenIsToken0 ? a0 : a1;
    positions.push({
      ...q,
      weth,
      token,
      ethValue: Number(weth) / 1e18 + (Number(token) / 1e18) * wethPerToken,
    });
  }
  return { positions, totalEth: positions.reduce((s, x) => s + x.ethValue, 0) };
}

const eth = (v) => (v === 0 ? "0" : v < 0.00001 ? "<0.00001" : v.toFixed(v < 1 ? 5 : 3));
const n = (b) => (Number(b) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 2 });
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

export function feesText(plan, f) {
  const rows = f.positions.map(
    (x) =>
      `• ${x.role === "protocolo" ? "Autor" : "Creador"} (${short(x.recipient)}): ${(Number(x.weth) / 1e18).toFixed(6)} WETH + ${n(x.token)} ${plan.cfg.symbol}  ≈ ${eth(x.ethValue)} ETH`,
  );
  return [
    `Comisiones por cobrar de ${plan.cfg.name} (${plan.cfg.symbol}) en ${plan.chain.name}, ahora mismo:`,
    ...rows,
    `Total ≈ ${eth(f.totalEth)} ETH. Es lo que cada billetera recibiría si alguien cobra ahora; cobrar solo mueve estas comisiones, nunca la liquidez.`,
    "El valor en ETH es aproximado (la parte en token se valora al precio actual del pool).",
  ].join("\n");
}
