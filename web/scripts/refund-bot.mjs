// Bot de devoluciones: si una ronda expiró (24 h sin llenarse) o quedó en reembolso, le devuelve el dinero a cada aportante.
// El dinero va SIEMPRE al aportante (refundFor), nunca al bot. El bot solo paga el gas.
// Uso:  RPC_URL=... BOT_KEY=0x... node scripts/refund-bot.mjs   (BOT_KEY es un secreto de GitHub: nadie lo escribe en el chat)
import { createPublicClient, createWalletClient, http, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { LAUNCH_ABI } from "../launch-abi.js";

const RPC = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const KEY = process.env.BOT_KEY;
const registry = JSON.parse(readFileSync(new URL("../launches.json", import.meta.url), "utf8"));
if (process.env.LAUNCHES_URL) { try { const r = await (await fetch(process.env.LAUNCHES_URL)).json(); for (const x of r.launches || []) if (!registry.launches.some((y) => y.address.toLowerCase() === x.address.toLowerCase())) registry.launches.push({ address: x.address, fromBlock: x.fromBlock || 0 }); } catch (e) { console.log("No pude leer la API:", e.message); } }
if (!KEY) { console.log("Falta BOT_KEY: no hago nada."); process.exit(0); }
const account = privateKeyToAccount(KEY);
const pub = createPublicClient({ transport: http(RPC) });
const wallet = createWalletClient({ account, transport: http(RPC) });
const deposited = parseAbiItem("event Deposited(address indexed from, address indexed to, uint256 amount, uint256 raised)");

let sent = 0;
for (const { address, fromBlock = 0 } of registry.launches) {
  try {
    const [state, expired] = await Promise.all([pub.readContract({ address, abi: LAUNCH_ABI, functionName: "state" }), pub.readContract({ address, abi: LAUNCH_ABI, functionName: "expired" })]);
    if (!(expired || Number(state) === 2)) { console.log(address, "sigue activa o ya se llenó: nada que devolver"); continue; }
    const logs = await pub.getLogs({ address, event: deposited, fromBlock: BigInt(fromBlock), toBlock: "latest" });
    for (const who of new Set(logs.map((l) => l.args.to))) {
      const owed = await pub.readContract({ address, abi: LAUNCH_ABI, functionName: "contributed", args: [who] });
      if (owed === 0n) continue;
      const hash = await wallet.writeContract({ chain: null, address, abi: LAUNCH_ABI, functionName: "refundFor", args: [who] });
      await pub.waitForTransactionReceipt({ hash });
      console.log("devuelto", Number(owed) / 1e6, "USDC a", who, "en", address); sent++;
    }
  } catch (e) { console.log("error con", address, e.shortMessage || e.message); }
}
console.log(`Listo: ${sent} devoluciones.`);
