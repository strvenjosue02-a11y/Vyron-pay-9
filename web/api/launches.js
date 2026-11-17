// GET /api/launches -> lanzamientos registrados. POST -> registra uno.
// No se confía en nadie: la dirección se RECALCULA con los parámetros (CREATE2) y se comprueba que existe en la cadena.
import { createPublicClient, http, getAddress } from "viem";
import { body, send, save, readAll } from "./_lib.js";
import { CONFIG } from "../config.js";
import { launchParams, predictAddress, isDeployed } from "../lcchain.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") { const all = await readAll("launches/"); return send(res, 200, { launches: all.map((x) => x.data) }); }
    if (req.method !== "POST") return send(res, 405, { error: "Use GET or POST." });
    const b = await body(req);
    if (!/^0x[0-9a-fA-F]{40}$/.test(b.creator || "") || !/^0x[0-9a-fA-F]{40}$/.test(b.address || "")) return send(res, 400, { error: "Invalid address." });
    const p = launchParams(CONFIG, { name: String(b.name || ""), symbol: String(b.symbol || ""), creator: getAddress(b.creator), goal: Number(b.goal), creatorPct: Number(b.creatorPct), vestingWeeks: Number(b.vestingWeeks) });
    const addr = predictAddress(CONFIG, p);
    if (addr.toLowerCase() !== b.address.toLowerCase()) return send(res, 400, { error: "That address doesn't match the launch rules." });
    const pub = createPublicClient({ transport: http(process.env.RPC_URL || CONFIG.rpc) });
    if (!(await isDeployed(pub, addr))) return send(res, 400, { error: "That launch doesn't exist on the network yet." });
    const img = typeof b.img === "string" && /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(b.img) && b.img.length <= 120000 ? b.img : "";
    const rec = { img, address: addr, name: b.name, symbol: b.symbol, creator: getAddress(b.creator), goal: Number(b.goal), creatorPct: Number(b.creatorPct), vestingWeeks: Number(b.vestingWeeks), fromBlock: Number(b.fromBlock) || 0, chainId: CONFIG.chainId, at: Math.floor(Date.now() / 1000) };
    try { await save(`launches/${addr.toLowerCase()}.json`, rec); } catch (e) { if (e.message !== "Ya existe") throw e; }
    send(res, 200, { ok: true, address: addr });
  } catch (e) { send(res, 400, { error: String(e.shortMessage || e.message || "Could not register").slice(0, 200) }); }
}
