import { createPublicClient, http, parseAbi, getAddress } from "viem";
import { CHAINS, MULTISEND } from "./chains.mjs";
import { OFFICIAL } from "./rules.mjs";
import { lockAddress } from "./builder.mjs";
import { auditPlan, decodeCalls, decodeCall } from "./audit-plan.mjs";
import { transferLogs } from "./logs.mjs";
import { verify } from "./verify.mjs";

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const LOCK = parseAbi([
  "function NPM() view returns (address)",
  "function RECIPIENT() view returns (address)",
]);
const ERC = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
]);

/** @returns {{ ok: boolean, why?: string, plan?: object, problems?: string[], res?: object }} */
export async function verifyToken(chainName, tokenAddress, { rpc, fromBlock } = {}) {
  const ch = CHAINS[chainName];
  if (!ch) throw new Error("red desconocida: " + chainName);
  const token = getAddress(tokenAddress);
  const pub = createPublicClient({ transport: http(rpc || ch.rpc) });
  const read = (address, abi, functionName) => pub.readContract({ address, abi, functionName });

  const { mint } = await transferLogs(pub, token, fromBlock);
  const tx = await pub.getTransaction({ hash: mint.transactionHash });
  if (!same(tx.to, MULTISEND))
    return {
      ok: false,
      why: "El token NO se creó con una transacción de esta habilidad (no va directo a Safe MultiSend): no se puede verificar.",
    };
  const calls = decodeCalls(tx.input);
  const mints = calls
    .filter((k) => same(k.to, ch.npm))
    .map((k) => decodeCall(k.data))
    .filter((d) => d?.functionName === "mint")
    .map((d) => d.args[0]);
  if (mints.length === 0 || mints.length > 2)
    return {
      ok: false,
      why: "La transacción de creación no tiene las 1 o 2 posiciones de liquidez esperadas.",
    };

  const is0 = BigInt(token) < BigInt(ch.weth);
  const amount = (m) => (is0 ? m.amount0Desired : m.amount1Desired);
  const total = mints.reduce((s, m) => s + amount(m), 0n);
  const positions = [];
  for (const m of mints) {
    const [npm, recipient] = await Promise.all([
      read(m.recipient, LOCK, "NPM"),
      read(m.recipient, LOCK, "RECIPIENT"),
    ]).catch(() => []);
    if (!recipient || !same(lockAddress(npm, recipient), m.recipient))
      return {
        ok: false,
        why: `La posición va a ${m.recipient}, que NO es un Lock oficial (sus bytes no coinciden con su dirección).`,
      };
    positions.push({
      role: "creador",
      recipient,
      bps: Number((amount(m) * 10000n) / total),
      lock: m.recipient,
    });
  }
  let author = positions.find((p) => same(p.recipient, OFFICIAL.protocol));
  if (!author && positions.length === 2)
    author = positions.reduce((a, b) => (a.bps <= b.bps ? a : b));
  if (author) author.role = "protocolo";
  const creator = positions.find((p) => p.role === "creador");
  if (!creator) return { ok: false, why: "No hay una posición del creador." };
  const buy = calls
    .filter((k) => same(k.to, ch.router))
    .map((k) => decodeCall(k.data)?.args?.[0])
    .find(Boolean);

  const cfg = {
    chain: ch,
    name: await read(token, ERC, "name"),
    symbol: await read(token, ERC, "symbol"),
    creator: creator.recipient,
    protocol: author ? author.recipient : null,
    protocolBps: author ? author.bps : 0,
    buyEth: tx.value,
    buyer: buy ? buy.recipient : creator.recipient,
    startTick: is0 ? mints[0].tickLower : -mints[0].tickUpper,
  };
  const plan = {
    chain: ch,
    to: tx.to,
    value: tx.value,
    data: tx.input,
    token,
    tokenIsToken0: is0,
    startTick: cfg.startTick,
    positions,
    cfg,
  };
  return { ok: true, plan, problems: auditPlan(plan), res: await verify(plan, rpc) };
}

export function verifyTokenText(r, toMarkdown) {
  if (!r.ok) return `✘ ${r.why}`;
  const audit =
    r.problems.length === 0
      ? "✔ La transacción que creó el token hizo exactamente lo prometido y nada más (todo el suministro al pool, sin tokens regalados)."
      : "✘ La transacción de creación NO cumple lo prometido: " + r.problems.join("; ");
  return `${toMarkdown(r.plan, r.res)}\n\n${audit}`;
}
