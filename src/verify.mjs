import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { SUPPLY } from "./builder.mjs";
import { isOfficial } from "./rules.mjs";
const NPM = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
  "function factory() view returns (address)",
  "function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)",
]);
const ERC = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function owner() view returns (address)",
]);
const FACTORY = parseAbi(["function getPool(address,address,uint24) view returns (address)"]);
const RUG = {
  "40c10f19": "mint",
  "8456cb59": "pause",
  f2fde38b: "transferOwnership",
  "715018a6": "renounceOwnership",
  f9f92be4: "blacklist",
  "44337ea1": "blacklist",
  "153b0d1e": "blacklist",
  "2e5bb6ff": "setTax",
  "69fe0e2d": "setFee",
  b515566a: "setBots",
};
const BAD = {
  "23b872dd": "transferFrom",
  "42842e0e": "safeTransferFrom",
  b88d4fde: "safeTransferFrom(data)",
  "095ea7b3": "approve",
  "42966c68": "burn",
  "0c49ccbe": "decreaseLiquidity",
  a22cb465: "setApprovalForAll",
};
const found = (code, list) =>
  Object.entries(list)
    .filter(([s]) => (code || "").toLowerCase().includes(s))
    .map(([, n]) => n);

export async function verify(plan, rpc) {
  const c = plan.cfg,
    chain = plan.chain,
    pub = createPublicClient({ transport: http(rpc || chain.rpc) }),
    checks = [];
  const ok = (cond, label, detail = "") => checks.push({ ok: !!cond, label, detail });
  const read = (address, abi, functionName, args) =>
    pub.readContract({ address, abi, functionName, args });
  ok(
    isOfficial(plan),
    "Reglas oficiales: el autor de la habilidad cobra el 20 % de la comisión (0.20 % del volumen), fijo desde el lanzamiento",
    isOfficial(plan) ? "OFICIAL" : "NO OFICIAL: este token no sigue las reglas de la habilidad",
  );
  const [supply, nm, sym] = await Promise.all([
    read(plan.token, ERC, "totalSupply"),
    read(plan.token, ERC, "name"),
    read(plan.token, ERC, "symbol"),
  ]);
  ok(supply === SUPPLY, "Suministro fijo de 1,000 millones", formatUnits(supply, 18));
  ok(nm === c.name && sym === c.symbol, "Nombre y símbolo", `${nm} (${sym})`);
  ok(
    await read(plan.token, ERC, "owner").then(
      () => false,
      () => true,
    ),
    "El token no tiene dueño",
  );
  const rug = found(await pub.getCode({ address: plan.token }), RUG);
  ok(
    rug.length === 0,
    "Anti-estafa: el token no puede crear más, pausar, vetar wallets, cobrar impuestos ni cambiar de dueño",
    rug.join(", "),
  );
  const [t0, t1] = plan.tokenIsToken0 ? [plan.token, chain.weth] : [chain.weth, plan.token];
  const pool = await read(await read(chain.npm, NPM, "factory"), FACTORY, "getPool", [
    t0,
    t1,
    10000,
  ]);
  ok(
    pool !== "0x0000000000000000000000000000000000000000",
    "Pool de Uniswap v3 de 1 % creado",
    pool,
  );
  const mine = [];
  let sumLiq = 0n;
  for (const p of plan.positions) {
    const bad = found(await pub.getCode({ address: p.lock }), BAD);
    ok(
      bad.length === 0,
      `Candado de ${p.role}: sin funciones para mover, aprobar, quemar ni reducir la liquidez`,
      `${p.lock} ${bad.join(", ")}`,
    );
    let pos = null;
    const n = await read(chain.npm, NPM, "balanceOf", [p.lock]);
    for (let i = 0n; i < n && !pos; i++) {
      const id = await read(chain.npm, NPM, "tokenOfOwnerByIndex", [p.lock, i]),
        d = await read(chain.npm, NPM, "positions", [id]);
      if (
        d[2].toLowerCase() === t0.toLowerCase() &&
        d[3].toLowerCase() === t1.toLowerCase() &&
        d[4] === 10000
      )
        pos = { ...p, id, liq: d[7] };
    }
    ok(!!pos, `El candado de ${p.role} es dueño de la posición de liquidez de este pool`);
    if (pos) {
      mine.push(pos);
      sumLiq += pos.liq;
    }
  }
  for (const p of mine) {
    const share = Number((p.liq * 1000000n) / sumLiq) / 10000;
    ok(
      Math.abs(share - p.bps / 100) < 0.01,
      `Reparto de ${p.role}: ${p.bps / 100} % de la liquidez`,
      `medido ${share.toFixed(4)} % (posición ${p.id})`,
    );
  }
  return {
    checks,
    pool,
    positions: mine.map((p) => ({
      role: p.role,
      id: p.id.toString(),
      lock: p.lock,
      recipient: p.recipient,
      bps: p.bps,
    })),
  };
}
export function toMarkdown(plan, res) {
  const L = [
    `# Informe de confianza: ${plan.cfg.name} (${plan.cfg.symbol})`,
    "",
    `Red: ${plan.chain.name}`,
    `Token: ${plan.chain.explorer}/address/${plan.token}`,
    `Pool: ${res.pool}`,
    "",
  ];
  for (const k of res.checks)
    L.push(`- ${k.ok ? "✔" : "✘"} ${k.label}${k.detail ? ` — ${k.detail}` : ""}`);
  L.push(
    "",
    "Quién cobra qué: cada candado manda las comisiones de su posición, y solo a su receptor fijo, a quien la pida (cualquiera puede ejecutar el cobro).",
  );
  for (const p of plan.positions)
    L.push(`- ${p.role}: ${p.bps / 100} % de las comisiones → ${p.recipient}`);
  return [
    ...L,
    "",
    `Resultado: ${res.checks.every((k) => k.ok) ? "TODO CORRECTO" : "HAY FALLAS: no lo promociones hasta revisarlas"}`,
  ].join("\n");
}
