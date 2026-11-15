import {
  createPublicClient, createWalletClient, custom, http, encodeDeployData, getContractAddress, concat, parseUnits,
  formatUnits, erc20Abi, defineChain, keccak256, toBytes, verifyMessage,
} from "https://cdn.jsdelivr.net/npm/viem@2.21.54/+esm";
import { CONFIG } from "./config.js";
import { ALCANCIA_ABI as ABI, ALCANCIA_BYTECODE } from "./alcancia.js";
import { canonical, msgSubmit, msgDecision, msgUpdate, msgPanel, validate, CATEGORIES, COLORS } from "./shared.js";

const RPC = new URLSearchParams(location.search).get("rpc") || CONFIG.rpc; // ?rpc= solo para pruebas
const SALT = "0x" + "00".repeat(32);
const OWNER = CONFIG.platform.toLowerCase();
const chain = defineChain({
  id: CONFIG.chainId, name: CONFIG.chainName, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } }, contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});
const pub = createPublicClient({ chain, transport: http(RPC) });

const S = { me: null, wallet: null, usdc: 0n, list: [], mine: [], reviews: null, now: Math.floor(Date.now() / 1000) };
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = (v, d, max = 2) => Number(formatUnits(v, d)).toLocaleString("es", { maximumFractionDigits: max });
const usd = (v) => n(v, 6);
const tok = (v) => n(v, 18, 0);
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const day = (t) => new Date(Number(t) * 1000).toLocaleDateString("es", { day: "numeric", month: "long" });
const pct = (a, b) => (b > 0n ? Number((a * 10000n) / b) / 100 : 0);
const initials = (s) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const hashOf = (p) => keccak256(toBytes(canonical(p)));
const isMe = (a) => S.me && a && S.me.toLowerCase() === a.toLowerCase();

function toast(msg, bad = false) {
  const t = $("#toast"); t.textContent = msg; t.className = `toast on${bad ? " bad" : ""}`;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast"), 4200);
}

// ================================================================= catálogo
function prepare(raw) {
  const p = raw.params;
  const q = { usdc: CONFIG.usdc, platform: CONFIG.platform, creator: p.creator, name: p.name, symbol: p.symbol,
    softcap: BigInt(p.softcap), hardcap: BigInt(p.hardcap), saleTokens: BigInt(p.saleTokens), creatorTokens: BigInt(p.creatorTokens),
    saleEnd: BigInt(p.saleEnd), initialBps: Number(p.initialBps), milestones: Number(p.milestones), milestonePeriod: BigInt(p.milestonePeriod) };
  const initCode = encodeDeployData({ abi: ABI, bytecode: ALCANCIA_BYTECODE, args: [q] });
  return { ...raw, q, initCode, address: getContractAddress({ opcode: "CREATE2", from: CONFIG.deployer, salt: SALT, bytecode: initCode }),
    exists: false, s: blankS(), u: blankU(), updates: raw.updates || [] };
}
const blankS = () => ({ state: 0, totalRaised: 0n, poolAfterFees: 0n, usdcReleased: 0n, milestonesDone: 0, voteEnd: 0n, votesYes: 0n,
  votesNo: 0n, deadline: 0n, succeeded: false, refundPool: 0n, voteRound: 0n, platformTokens: 0n });
const blankU = () => ({ contributed: 0n, claimed: false, settled: false, voted: false, balance: 0n });

async function loadCatalog() {
  const seeds = await (await fetch("./projects.json", { cache: "no-store" })).json();
  let api = [];
  try { const r = await fetch("./api/projects", { cache: "no-store" }); if (r.ok) api = (await r.json()).projects || []; } catch {}
  // Todo lo que llega del servidor se verifica aquí con firmas: el servidor no es de confianza.
  const checked = await Promise.all(api.map(async (x) => {
    const p = x.project, h = hashOf(p);
    const okCreator = await verifyMessage({ address: p.params.creator, message: msgSubmit(p.id, h), signature: x.signature }).catch(() => false);
    if (!okCreator) return null;
    let status = "review";
    if (x.decision && x.decision.hash === h) {
      const ok = await verifyMessage({ address: CONFIG.platform, message: msgDecision(x.decision.approve, p.id, h), signature: x.decision.signature }).catch(() => false);
      if (ok) status = x.decision.approve ? "approved" : "rejected";
    }
    const updates = [];
    for (const u of x.updates || []) {
      const ok = await verifyMessage({ address: p.params.creator, message: msgUpdate(p.id, u.ts, keccak256(toBytes(u.text))), signature: u.signature }).catch(() => false);
      if (ok) updates.push(u);
    }
    return { ...p, status, updates, sentAt: x.at };
  }));
  const all = [...seeds.map((p) => ({ ...p, status: "approved", seed: true })), ...checked.filter(Boolean)].map(prepare);
  S.all = all;
  S.list = all.filter((p) => p.status === "approved");
}

const READS = ["state", "totalRaised", "poolAfterFees", "usdcReleased", "milestonesDone", "voteEnd", "votesYes", "votesNo", "deadline", "succeeded", "refundPool", "voteRound"];
async function loadChain(p) {
  const code = await pub.getCode({ address: p.address });
  p.exists = !!code && code !== "0x"; p.s = blankS(); p.u = blankU();
  if (!p.exists) return;
  const c = (functionName, args) => ({ address: p.address, abi: ABI, functionName, args });
  const r = await pub.multicall({ contracts: [...READS.map((f) => c(f)), c("balanceOf", [CONFIG.platform])] });
  READS.forEach((f, i) => (p.s[f] = r[i].result));
  p.s.platformTokens = r[READS.length].result;
  if (!S.me) return;
  const u = await pub.multicall({ contracts: [c("contributed", [S.me]), c("claimedTokens", [S.me]), c("settled", [S.me]), c("voted", [p.s.voteRound, S.me]), c("balanceOf", [S.me])] });
  [p.u.contributed, p.u.claimed, p.u.settled, p.u.voted, p.u.balance] = u.map((x) => x.result);
}

async function refresh() {
  S.now = Number((await pub.getBlock()).timestamp);
  await Promise.all(S.all.filter((p) => p.status === "approved").map(loadChain));
  if (S.me) S.usdc = await pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "balanceOf", args: [S.me] });
  route();
}

// ================================================================= estados legibles
function phase(p) {
  const { s, q } = p;
  if (s.state === 2) return { t: "Devolviendo fondos", c: "refund" };
  if (s.state === 1) return s.milestonesDone >= q.milestones ? { t: "Completado", c: "funded" } : { t: "Financiado", c: "funded" };
  if (S.now >= Number(q.saleEnd) || s.totalRaised >= q.hardcap) return { t: "Venta terminada", c: "closed" };
  return { t: "Abierto a inversión", c: "open" };
}
function left(p) {
  const d = Number(p.q.saleEnd) - S.now;
  if (d <= 0) return "Cerró el " + day(p.q.saleEnd);
  const days = Math.floor(d / 86400);
  return days >= 1 ? `Quedan ${days} día${days === 1 ? "" : "s"}` : `Quedan ${Math.ceil(d / 3600)} horas`;
}
const mark = (p, big = "") => `<div class="mark ${big}" style="background:${esc(p.meta.color)}" aria-hidden="true">${esc(initials(p.q.name))}</div>`;
const meter = (p) => `<div class="meter" role="img" aria-label="${pct(p.s.totalRaised, p.q.hardcap).toFixed(0)}% recaudado"><b style="width:${pct(p.s.totalRaised, p.q.hardcap)}%"></b><s style="left:${pct(p.q.softcap, p.q.hardcap)}%"></s></div>`;

// ================================================================= vistas: inversor
function vHome() {
  return `
  <section class="hero">
    <div>
      <h1>Gente que financia a gente.</h1>
      <p>Pones USDC en el proyecto que te convence. El dinero queda guardado en un contrato que no tiene dueño, y el equipo lo recibe por partes, solo cuando los inversores votan que cumplió.</p>
      <div class="cta"><button class="btn btn-main" type="button" data-scroll="lista">Ver proyectos</button><a class="btn btn-line" href="#/crear">Subir mi proyecto</a></div>
    </div>
    <div class="ribbon-demo" aria-label="Ejemplo de reparto del dinero de un proyecto">
      <h2>Dónde está cada dólar</h2>
      <p>Ejemplo: un proyecto juntó $10.000 y ya pasó su primera etapa.</p>
      <div class="ribbon"><i class="g" style="width:59%"></i><i class="d" style="width:40%"></i><i class="f" style="width:1%"></i></div>
      <div class="ribbon-legend">
        <div><b>$5.940</b><span style="--c:var(--sprout)">Guardado</span></div>
        <div><b>$3.960</b><span style="--c:#7fb59f">Entregado</span></div>
        <div><b>$100</b><span style="--c:#e9efea">Comisión</span></div>
      </div>
    </div>
  </section>
  <div class="section-h" id="lista"><h2>Proyectos</h2><span class="dim">${S.list.length} publicados</span></div>
  <div class="list">${S.list.length ? S.list.map(row).join("") : `<div class="empty">Todavía no hay proyectos publicados.</div>`}</div>`;
}
function row(p) {
  const ph = phase(p);
  return `<a class="row" href="#/p/${p.id}" data-testid="row-${p.id}">
    ${mark(p)}
    <div><h3>${esc(p.q.name)}</h3><div class="tl">${esc(p.meta.tagline)}</div></div>
    <div class="fund">${meter(p)}<div class="fund-t num"><span><b>$${usd(p.s.totalRaised)}</b> de $${usd(p.q.hardcap)}</span><span>mínimo $${usd(p.q.softcap)}</span></div></div>
    <div class="side"><div class="state ${ph.c}">${ph.t}</div><div class="when">${left(p)}</div></div>
  </a>`;
}

const IC = {
  back: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--pine)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>`,
  steps: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--pine)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4v-5h4v-5h4V5h4"/></svg>`,
  lock: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--pine)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  ok: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`,
};

function vProject(p) {
  const { q } = p, ph = phase(p), step = (10000 - q.initialBps) / q.milestones / 100;
  return `
  <a class="back" href="#/">Volver a proyectos</a>
  <div class="p-top">${mark(p, "big")}<div><h1>${esc(q.name)}</h1><div class="sub">${esc(p.meta.category)}, token ${esc(q.symbol)}. <span class="state ${ph.c}">${ph.t}</span></div></div></div>
  <div class="layout">
    <div>
      <section class="block"><h2>De qué se trata</h2><p>${esc(p.meta.about)}</p></section>
      <section class="block"><h2>Cómo se protege tu dinero</h2><div class="promise">
        <div>${IC.back}<div><b>Si no llega a la meta, se devuelve todo</b><p>Si al cierre no se juntan $${usd(q.softcap)}, cada inversor retira el 100% de lo que puso. Sin comisión.</p></div></div>
        <div>${IC.steps}<div><b>El equipo cobra por partes</b><p>Recibe ${q.initialBps / 100}% al cerrar la venta y el resto en ${q.milestones} entregas de ${step}%. Cada entrega se vota.</p></div></div>
        <div>${IC.lock}<div><b>Nadie puede tocarlo</b><p>El contrato no tiene administrador. Si el equipo desaparece o pierde una votación, lo que queda vuelve a los inversores.</p></div></div>
      </div></section>
      <section class="block"><h2>Entregas al equipo</h2>${stages(p)}</section>
      <section class="block"><h2>Avances del equipo</h2>${p.updates.length ? p.updates.map((u) => `<div class="update"><time>${new Date(u.ts).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}</time><p>${esc(u.text)}</p></div>`).join("") : `<p>El equipo aún no publicó avances.</p>`}</section>
      <section class="block"><h2>Contrato</h2><div class="contract">
        <div><span class="soft">Dirección</span><a class="addr" href="${CONFIG.explorer}/address/${p.address}" target="_blank" rel="noopener">${short(p.address)}</a></div>
        <div><span class="soft">Estado</span><span>${p.exists ? "Activo en la blockchain" : "Se crea con la primera inversión"}</span></div>
        <div><span class="soft">Wallet del equipo</span><span class="addr">${short(q.creator)}</span></div>
        <div><span class="soft">Comisión de Peer</span><span>1% del dinero y 1,5% de los tokens, solo si se financia</span></div>
        <div><span class="soft">Red</span><span>${esc(CONFIG.chainName)}</span></div>
      </div></section>
    </div>
    <aside class="aside">${pInvest(p)}${S.me && p.u.contributed > 0n ? pPosition(p) : ""}${pVote(p)}</aside>
  </div>`;
}

function stages(p) {
  const { s, q } = p, step = (10000 - q.initialBps) / q.milestones / 100;
  const items = [{ t: "Entrega inicial", pct: q.initialBps / 100, done: s.succeeded, sub: "Al cerrar la venta con éxito" }];
  for (let i = 0; i < q.milestones; i++) {
    const done = i < s.milestonesDone, now = s.state === 1 && i === s.milestonesDone;
    let sub = done ? "Aprobada por los inversores" : "Pendiente";
    if (now) sub = s.voteEnd > 0n ? `En votación hasta el ${day(s.voteEnd)}` : `El equipo debe pedirla antes del ${day(s.deadline)}`;
    if (s.state === 2 && !done) sub = "Cancelada: el dinero volvió a los inversores";
    items.push({ t: `Entrega ${i + 1}`, pct: step, done, now, sub });
  }
  return `<ol class="steps-list">${items.map((x, i) => `<li class="${x.done ? "done" : x.now ? "now" : ""}"><span class="n">${x.done ? IC.ok : i}</span>
    <div><div class="t">${x.t}</div><div class="s">${x.sub}</div></div><span class="pct num">${x.pct}%</span></li>`).join("")}</ol>`;
}

function pInvest(p) {
  const { s, q } = p, ended = S.now >= Number(q.saleEnd) || s.totalRaised >= q.hardcap;
  let act;
  if (s.state === 0 && !ended) {
    act = S.me ? `
      <label for="amt" class="soft" style="font-size:14px">Cuánto quieres invertir</label>
      <div class="amount" style="margin-top:6px"><input id="amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" data-testid="amount"><span class="u">USDC</span><button type="button" data-max>Máximo</button></div>
      <div class="under num"><span id="receive">Recibes 0 ${esc(q.symbol)}</span><span>Tienes ${usd(S.usdc)} USDC</span></div>
      <button class="btn btn-main btn-full" data-act="buy" data-testid="buy">Invertir</button>
      ${p.exists ? "" : `<div class="note">Serás de los primeros: tu inversión también crea el contrato del proyecto. Cuesta unos centavos extra de gas, una sola vez.</div>`}`
      : `<button class="btn btn-main btn-full" data-act="connect">Conectar wallet para invertir</button>`;
  } else if (s.state === 0) {
    act = p.exists ? `<button class="btn btn-main btn-full" data-act="finalize" data-testid="finalize">Cerrar la venta</button><div class="note">La venta terminó. Cualquier persona puede cerrarla para liberar los tokens o los reembolsos.</div>`
      : `<div class="note">La venta terminó sin inversiones.</div>`;
  } else if (s.state === 2) {
    act = `<div class="note warn">${s.succeeded ? "Los inversores rechazaron una entrega o el equipo no la pidió a tiempo." : "No se alcanzó la meta mínima."} Lo que queda se devuelve a los inversores.</div>`;
  } else act = `<div class="note">La venta terminó con éxito. El equipo recibe el dinero por partes.</div>`;
  return `<div class="panel lift">
    <div class="big num">$${usd(s.totalRaised)} <small>de $${usd(q.hardcap)}</small></div>
    <div style="margin-top:12px">${meter(p)}</div>
    <div class="fund-t num"><span>${pct(s.totalRaised, q.hardcap).toFixed(0)}% recaudado</span><span>${left(p)}</span></div>
    <dl class="facts num">
      <div><dt>Precio</dt><dd>1 USDC = ${tok((q.saleTokens * 1_000_000n) / q.hardcap)} ${esc(q.symbol)}</dd></div>
      <div><dt>Meta mínima</dt><dd>$${usd(q.softcap)}</dd></div>
      <div><dt>Meta máxima</dt><dd>$${usd(q.hardcap)}</dd></div>
      <div><dt>Cierre</dt><dd>${day(q.saleEnd)}</dd></div>
    </dl>${act}</div>`;
}

function pPosition(p) {
  const { s, u, q } = p;
  let top = "";
  if (s.state === 1) {
    const kept = s.poolAfterFees - s.usdcReleased, fee = s.totalRaised - s.poolAfterFees, risk = 100 - pct(kept, s.totalRaised);
    top = `<div class="soft" style="font-size:14px">Lo máximo que podrías perder hoy</div><div class="big num" data-testid="risk">${risk.toFixed(1)}%</div>
      <div class="cinta"><i style="width:${pct(kept, s.totalRaised)}%;background:var(--sprout)"></i><i style="width:${pct(s.usdcReleased, s.totalRaised)}%;background:#7fb59f"></i><i style="width:${pct(fee, s.totalRaised)}%;background:var(--ink-3)"></i></div>
      <div class="keys num"><span style="--c:var(--sprout)">Guardado $${usd(kept)}</span><span style="--c:#7fb59f">Entregado $${usd(s.usdcReleased)}</span><span style="--c:var(--ink-3)">Comisión $${usd(fee)}</span></div>`;
  }
  if (s.state === 0) top = `<div class="note" style="margin:0 0 8px">Tu dinero está protegido al 100% hasta que cierre la venta.</div>`;
  const back = s.state === 2 && s.totalRaised > 0n ? (s.refundPool * u.contributed) / s.totalRaised : 0n;
  const btns = [];
  if (s.succeeded && !u.claimed) btns.push(`<button class="btn btn-main btn-full" data-act="claimTokens" data-testid="claim">Recibir mis tokens</button>`);
  if (s.state === 2 && !u.settled) btns.push(`<button class="btn btn-main btn-full" data-act="refund" data-testid="refund">Recuperar mi dinero</button>`);
  return `<div class="panel"><h3>Tu inversión</h3>${top}
    <div class="lines num" style="margin-top:10px">
      <div><span>Pusiste</span><b>$${usd(u.contributed)}</b></div>
      <div><span>Tus tokens</span><b>${tok(u.balance)} ${esc(q.symbol)}</b></div>
      ${s.succeeded && !u.claimed ? `<div><span>Tokens por recibir</span><b>${tok((u.contributed * q.saleTokens) / q.hardcap)} ${esc(q.symbol)}</b></div>` : ""}
      ${s.state === 2 ? `<div><span>Te devuelven</span><b>${u.settled ? "Ya recuperado" : "$" + usd(back)}</b></div>` : ""}
    </div>${btns.length ? `<div style="display:grid;gap:8px;margin-top:12px">${btns.join("")}</div>` : ""}</div>`;
}

function pVote(p) {
  const { s, u, q } = p;
  if (s.state !== 1 || s.milestonesDone >= q.milestones) return "";
  const open = s.voteEnd > 0n && S.now < Number(s.voteEnd), total = s.votesYes + s.votesNo || 1n;
  let b;
  if (s.voteEnd > 0n) {
    b = `<p class="soft" style="margin:0">Entrega ${s.milestonesDone + 1} de ${q.milestones}. ${open ? `La votación cierra el ${day(s.voteEnd)}.` : "La votación terminó."}</p>
      <div class="cinta"><i style="width:${pct(s.votesYes, total)}%;background:var(--pine)"></i><i style="width:${pct(s.votesNo, total)}%;background:var(--red)"></i></div>
      <div class="keys num"><span style="--c:var(--pine)">Aprueban $${usd(s.votesYes)}</span><span style="--c:var(--red)">Rechazan $${usd(s.votesNo)}</span></div>`;
    if (open && u.contributed > 0n && !u.voted) b += `<div class="votes"><button class="btn btn-main" data-act="voteYes" data-testid="vote-yes">Aprobar entrega</button><button class="btn btn-warn" data-act="voteNo" data-testid="vote-no">Rechazar</button></div>`;
    else if (open && u.voted) b += `<div class="note">Ya votaste en esta entrega.</div>`;
    if (!open) b += `<button class="btn btn-main btn-full" style="margin-top:12px" data-act="closeVote" data-testid="close-vote">Aplicar el resultado</button>`;
  } else if (S.now <= Number(s.deadline)) {
    b = `<p class="soft" style="margin:0">El equipo debe pedir la entrega ${s.milestonesDone + 1} antes del ${day(s.deadline)}.</p>`;
    if (isMe(q.creator)) b += `<button class="btn btn-quiet btn-full" style="margin-top:12px" data-act="requestRelease" data-testid="request">Pedir la entrega ${s.milestonesDone + 1}</button>`;
  } else {
    b = `<p class="soft" style="margin:0">El equipo no pidió la entrega a tiempo. Cualquier persona puede cancelar el proyecto para devolver lo que queda.</p>
      <button class="btn btn-warn btn-full" style="margin-top:12px" data-act="abandon" data-testid="abandon">Cancelar y devolver el dinero</button>`;
  }
  return `<div class="panel"><h3>Votación de entregas</h3>${b}</div>`;
}

// ================================================================= vistas: creador
function vCreate() {
  if (!S.me) return `<div class="page-h"><h1>Sube tu proyecto</h1><p>Conecta tu wallet. Será la wallet que recibe el dinero y la que firma tu proyecto.</p></div>
    <button class="btn btn-main" data-act="connect">Conectar wallet</button>`;
  return `<div class="page-h"><h1>Sube tu proyecto</h1><p>Completa los datos y fírmalos con tu wallet. El equipo de Peer lo revisa antes de publicarlo. Firmar es gratis.</p></div>
  <div class="layout"><form id="form" novalidate>
    <fieldset><legend>El proyecto</legend>
      <div class="field"><label for="f-name">Nombre</label><input id="f-name" name="name" maxlength="40" required placeholder="Ej.: Panadería La Esquina"></div>
      <div class="two">
        <div class="field"><label for="f-symbol">Símbolo del token</label><input id="f-symbol" name="symbol" maxlength="8" required placeholder="PAN" style="text-transform:uppercase"></div>
        <div class="field"><label for="f-cat">Categoría</label><select id="f-cat" name="category">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label for="f-tag">Resumen en una frase</label><input id="f-tag" name="tagline" maxlength="120" required placeholder="Qué haces y para quién"></div>
      <div class="field"><label for="f-about">Descripción</label><textarea id="f-about" name="about" maxlength="2000" required placeholder="Qué vas a hacer con el dinero, en qué plazos y cómo lo van a ver los inversores."></textarea><small>Entre 40 y 2.000 caracteres.</small></div>
      <div class="field"><label>Color</label><div class="chips swatch">${COLORS.map((c, i) => `<label><input type="radio" name="color" value="${c}" ${i ? "" : "checked"}><span style="--c:${c}" aria-label="Color ${i + 1}"></span></label>`).join("")}</div></div>
    </fieldset>
    <fieldset><legend>El dinero</legend>
      <div class="two">
        <div class="field"><label for="f-soft">Meta mínima (USDC)</label><input id="f-soft" name="soft" type="number" inputmode="decimal" min="1" value="1000"><small>Si no se llega, se devuelve todo.</small></div>
        <div class="field"><label for="f-hard">Meta máxima (USDC)</label><input id="f-hard" name="hard" type="number" inputmode="decimal" min="1" value="5000"></div>
      </div>
      <div class="field"><label>Duración de la venta</label><div class="chips">${[14, 30, 45, 60].map((d) => `<label><input type="radio" name="days" value="${d}" ${d === 30 ? "checked" : ""}><span>${d} días</span></label>`).join("")}</div></div>
      <div class="two">
        <div class="field"><label for="f-st">Tokens para inversores</label><input id="f-st" name="saleTokens" type="number" inputmode="numeric" min="1" value="1000000"></div>
        <div class="field"><label for="f-ct">Tokens para tu equipo</label><input id="f-ct" name="creatorTokens" type="number" inputmode="numeric" min="0" value="300000"><small>Se liberan junto con cada entrega.</small></div>
      </div>
    </fieldset>
    <fieldset><legend>Las entregas</legend>
      <div class="field"><label>Entrega inicial al cerrar</label><div class="chips">${[0, 5, 10, 20].map((v) => `<label><input type="radio" name="initial" value="${v}" ${v === 10 ? "checked" : ""}><span>${v}%</span></label>`).join("")}</div></div>
      <div class="field"><label>Cantidad de entregas votadas</label><div class="chips">${[2, 3, 4, 6].map((v) => `<label><input type="radio" name="ms" value="${v}" ${v === 3 ? "checked" : ""}><span>${v}</span></label>`).join("")}</div></div>
      <div class="field"><label>Plazo para pedir cada entrega</label><div class="chips">${[30, 60, 90].map((v) => `<label><input type="radio" name="period" value="${v}" ${v === 60 ? "checked" : ""}><span>${v} días</span></label>`).join("")}</div><small>Si no la pides a tiempo, el dinero restante vuelve a los inversores.</small></div>
    </fieldset>
    <p class="form-error" id="ferr" role="alert"></p>
    <button class="btn btn-main" type="submit" data-testid="submit-project">Firmar y enviar a revisión</button>
  </form>
  <aside class="aside"><div class="panel lift" id="preview"></div></aside></div>`;
}

function readForm() {
  const f = new FormData($("#form")), g = (k) => String(f.get(k) ?? "").trim();
  const name = g("name"), id = (name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "proyecto") + "-" + Math.random().toString(16).slice(2, 6);
  const usdc = (v) => { try { return parseUnits(v || "0", 6).toString(); } catch { return "0"; } };
  const toks = (v) => { try { return parseUnits(v || "0", 18).toString(); } catch { return "0"; } };
  return { id, meta: { category: g("category"), color: g("color"), tagline: g("tagline"), about: g("about") },
    params: { creator: S.me, name, symbol: g("symbol").toUpperCase(), softcap: usdc(g("soft")), hardcap: usdc(g("hard")),
      saleTokens: toks(g("saleTokens")), creatorTokens: toks(g("creatorTokens")), saleEnd: String(Math.floor(Date.now() / 1000) + Number(g("days")) * 86400),
      initialBps: String(Number(g("initial")) * 100), milestones: g("ms"), milestonePeriod: String(Number(g("period")) * 86400) } };
}
function preview() {
  const p = readForm(), q = p.params, ms = Number(q.milestones), init = Number(q.initialBps) / 100, step = (100 - init) / ms;
  const hard = BigInt(q.hardcap || 0), soft = BigInt(q.softcap || 0);
  $("#preview").innerHTML = `<h3>Así lo verán los inversores</h3>
    <div class="p-top" style="margin:0 0 14px"><div class="mark" style="background:${esc(p.meta.color)}">${esc(initials(q.name || "Tu proyecto"))}</div><div><b>${esc(q.name || "Tu proyecto")}</b><div class="soft" style="font-size:14px">${esc(p.meta.tagline || "Tu resumen aparece aquí")}</div></div></div>
    <div class="lines num">
      <div><span>Meta</span><b>$${usd(soft)} a $${usd(hard)}</b></div>
      <div><span>Precio</span><b>${hard > 0n ? `1 USDC = ${tok((BigInt(q.saleTokens) * 1_000_000n) / hard)} ${esc(q.symbol || "TOKEN")}` : "-"}</b></div>
      <div><span>Recibes al cerrar</span><b>${init}%</b></div>
      <div><span>Después</span><b>${ms} entregas de ${step.toFixed(1)}%</b></div>
      <div><span>Comisión de Peer</span><b>1% + 1,5% tokens</b></div>
    </div>
    <div class="cinta" aria-hidden="true">${[init, ...Array(ms).fill(step)].map((w, i) => `<i style="width:${w}%;background:${i ? (i % 2 ? "var(--pine)" : "#7fb59f") : "var(--sprout)"}"></i>`).join("")}</div>
    <p class="soft" style="font-size:13.5px;margin:6px 0 0">Si al juntar $${usd(hard)} los inversores aprueban todo, recibes $${usd((hard * 99n) / 100n)}.</p>`;
}

function vMine() {
  if (!S.me) return `<div class="page-h"><h1>Mis proyectos</h1><p>Conecta la wallet con la que subiste tus proyectos.</p></div><button class="btn btn-main" data-act="connect">Conectar wallet</button>`;
  const mine = S.all.filter((p) => isMe(p.q.creator));
  const label = { review: "En revisión", approved: "Publicado", rejected: "No aprobado" };
  return `<div class="page-h"><h1>Mis proyectos</h1><p>Sigue lo que juntaste, pide tus entregas y cuéntales a tus inversores cómo vas.</p></div>
  ${mine.length ? mine.map((p) => `<div class="panel" style="margin-bottom:16px" data-testid="mine-${p.id}">
    <div class="p-top" style="margin-bottom:12px">${mark(p)}<div><b style="font-size:18px">${esc(p.q.name)}</b><div class="soft" style="font-size:14px">${label[p.status]}${p.status === "approved" ? `, ${phase(p).t.toLowerCase()}` : ""}</div></div></div>
    ${p.status === "approved" ? `${meter(p)}<div class="fund-t num"><span><b>$${usd(p.s.totalRaised)}</b> de $${usd(p.q.hardcap)}</span><span>Recibiste $${usd(p.s.usdcReleased)}</span></div>
      <div class="actions"><a class="btn btn-quiet btn-sm" href="#/p/${p.id}">Ver página y entregas</a></div>
      ${p.seed ? "" : `<div class="field" style="margin-top:16px"><label for="up-${p.id}">Publicar un avance</label><textarea id="up-${p.id}" maxlength="1500" placeholder="Qué lograste, con fotos o enlaces si tienes."></textarea></div>
      <button class="btn btn-main btn-sm" data-act="postUpdate" data-id="${p.id}" data-testid="post-${p.id}">Firmar y publicar</button>`}`
    : p.status === "review" ? `<div class="note">El equipo de Peer está revisando tu proyecto. Cuando lo apruebe, aparecerá en la lista.</div>` : `<div class="note bad">Tu proyecto no fue aprobado. Puedes corregirlo y enviarlo de nuevo.</div>`}
  </div>`).join("") : `<div class="list"><div class="empty">Aún no subiste proyectos. <a href="#/crear">Sube el primero</a>.</div></div>`}`;
}

// ================================================================= vista: dueño
function vAdmin() {
  if (!S.me || S.me.toLowerCase() !== OWNER) return `<div class="page-h"><h1>Panel del dueño</h1><p>Solo la wallet de la plataforma puede abrir este panel.</p></div>`;
  const live = S.list.filter((p) => p.exists);
  const funded = live.filter((p) => p.s.succeeded);
  const fees = funded.reduce((a, p) => a + (p.s.totalRaised - p.s.poolAfterFees), 0n);
  const raised = live.reduce((a, p) => a + p.s.totalRaised, 0n);
  const pending = S.all.filter((p) => p.status === "review");
  return `<div class="page-h"><h1>Panel del dueño</h1><p>Tus comisiones, la actividad de Peer y los proyectos que esperan tu aprobación.</p></div>
  <div class="tiles num">
    <div><b>$${usd(fees)}</b><span>Comisiones en USDC</span></div>
    <div><b>$${usd(raised)}</b><span>Recaudado en Peer</span></div>
    <div><b>${funded.length}</b><span>Proyectos financiados</span></div>
    <div><b>${pending.length}</b><span>Esperan tu revisión</span></div>
  </div>
  <section class="block"><h2>Comisiones por proyecto</h2>
    ${funded.length ? `<table class="tbl num"><thead><tr><th>Proyecto</th><th>USDC</th><th>Tokens</th></tr></thead><tbody>
      ${funded.map((p) => `<tr><td>${esc(p.q.name)}</td><td>$${usd(p.s.totalRaised - p.s.poolAfterFees)}</td><td>${tok(p.s.platformTokens)} ${esc(p.q.symbol)}</td></tr>`).join("")}</tbody></table>`
      : `<p>Todavía no hay proyectos financiados. Las comisiones llegan a tu wallet en cuanto uno cierre con éxito.</p>`}
  </section>
  <section class="block"><h2>Por aprobar</h2>
    ${S.reviews ? "" : `<p style="margin-bottom:12px">Firma para ver la revisión de la IA de cada proyecto. Firmar es gratis.</p><button class="btn btn-quiet" data-act="openPanel" data-testid="open-panel">Firmar y ver revisiones</button>`}
    ${pending.length ? pending.map(reviewCard).join("") : `<p>No hay proyectos esperando.</p>`}
  </section>`;
}
function reviewCard(p) {
  const r = S.reviews?.[p.id], q = p.q;
  const ai = !S.reviews ? "" : !r ? `<p class="soft">Sin revisión de IA.</p>` : !r.ok ? `<div class="note warn">${esc(r.error)}</div>` :
    `<div><span class="risk ${r.riesgo}">Riesgo ${r.riesgo}</span></div><p style="margin:10px 0 0">${esc(r.resumen)}</p>
     ${r.senales.length ? `<h4>Señales</h4><ul>${r.senales.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
     ${r.preguntas.length ? `<h4>Preguntas para el creador</h4><ul>${r.preguntas.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`;
  return `<div class="review" data-testid="review-${p.id}">
    <div class="p-top" style="margin-bottom:12px">${mark(p)}<div><b style="font-size:18px">${esc(q.name)}</b><div class="soft" style="font-size:14px">${esc(p.meta.category)}, enviado por <span class="addr">${short(q.creator)}</span></div></div></div>
    <p class="soft" style="margin:0 0 10px">${esc(p.meta.tagline)}</p>
    <details><summary>Ver descripción y números</summary><p style="margin:10px 0">${esc(p.meta.about)}</p>
      <div class="lines num"><div><span>Meta</span><b>$${usd(q.softcap)} a $${usd(q.hardcap)}</b></div><div><span>Entrega inicial</span><b>${q.initialBps / 100}%</b></div>
      <div><span>Entregas</span><b>${q.milestones} cada ${Number(q.milestonePeriod) / 86400} días</b></div><div><span>Tokens del equipo</span><b>${tok(q.creatorTokens)} de ${tok(q.saleTokens + q.creatorTokens)}</b></div></div></details>
    <div style="margin-top:14px">${ai}</div>
    <div class="actions"><button class="btn btn-main btn-sm" data-act="approve" data-id="${p.id}" data-testid="approve-${p.id}">Aprobar y publicar</button>
      <button class="btn btn-warn btn-sm" data-act="reject" data-id="${p.id}">Rechazar</button></div></div>`;
}

// ================================================================= router
function route() {
  const h = location.hash || "#/";
  const m = h.match(/^#\/p\/([\w-]+)/);
  const p = m && S.list.find((x) => x.id === m[1]);
  const key = p ? "home" : h.startsWith("#/crear") ? "crear" : h.startsWith("#/mis") ? "mis" : h.startsWith("#/admin") ? "admin" : "home";
  document.querySelectorAll("[data-nav]").forEach((a) => { if (a.dataset.nav !== key) a.removeAttribute("aria-current"); else a.setAttribute("aria-current", "page"); });
  const isOwner = S.me && S.me.toLowerCase() === OWNER;
  $("#nav-admin").classList.toggle("d-none", !isOwner); $("#tab-admin").classList.toggle("d-none", !isOwner);
  if (key === "crear" && $("#form")) return; // no borrar lo que el creador está escribiendo
  const keep = $("#amt")?.value;
  $("#app").innerHTML = p ? vProject(p) : key === "crear" ? vCreate() : key === "mis" ? vMine() : key === "admin" ? vAdmin() : vHome();
  if (p) bindAmount(p);
  if (p && keep && $("#amt")) { $("#amt").value = keep; $("#amt").dispatchEvent(new Event("input")); }
  if ($("#form")) { $("#form").addEventListener("input", preview); $("#form").addEventListener("submit", submitProject); preview(); }
}
function bindAmount(p) {
  const el = $("#amt"); if (!el) return;
  const upd = () => { let v = 0n; try { v = parseUnits(el.value || "0", 6); } catch {} $("#receive").textContent = `Recibes ${tok((v * p.q.saleTokens) / p.q.hardcap)} ${p.q.symbol}`; };
  el.oninput = upd;
  $("[data-max]").onclick = () => { const room = p.q.hardcap - p.s.totalRaised; el.value = formatUnits(S.usdc < room ? S.usdc : room, 6); upd(); };
}

// ================================================================= wallet y transacciones
const provider = () => window.phantom?.ethereum || window.ethereum;
async function connect() {
  const eth = provider();
  if (!eth) {
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) { location.href = `https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=${encodeURIComponent(location.origin)}`; return; }
    return toast("No encontramos una wallet. Instala Phantom, MetaMask o Coinbase Wallet.", true);
  }
  [S.me] = await eth.request({ method: "eth_requestAccounts" });
  const hex = "0x" + CONFIG.chainId.toString(16);
  if ((await eth.request({ method: "eth_chainId" })) !== hex) {
    try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] }); }
    catch (e) { if (e.code !== 4902) throw e; await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: hex, chainName: CONFIG.chainName, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: [CONFIG.rpc], blockExplorerUrls: [CONFIG.explorer] }] }); }
  }
  S.wallet = createWalletClient({ account: S.me, chain, transport: custom(eth) });
  $("#connect").innerHTML = `<span class="me"><i></i>${short(S.me)}</span>`; $("#connect").className = "btn btn-line btn-sm";
  eth.on?.("accountsChanged", () => location.reload()); eth.on?.("chainChanged", () => location.reload());
  if ($("#form")) $("#app").innerHTML = "";
  await refresh();
}
const sign = (message) => S.wallet.signMessage({ account: S.me, message });

function sheet(title, labels) {
  const el = $("#sheet");
  el.innerHTML = `<h3>${esc(title)}</h3><p class="soft" style="margin:0;font-size:14.5px">Confirma cada paso en tu wallet.</p><ul class="tx">${labels.map((l, i) => `<li data-i="${i}"><span class="ic">${i + 1}</span><div>${esc(l)}<small></small></div></li>`).join("")}</ul>`;
  el.classList.add("on"); $("#veil").classList.add("on");
  return {
    set(i, st, note = "") { const li = el.querySelector(`li[data-i="${i}"]`); li.className = st; li.querySelector(".ic").innerHTML = st === "done" ? IC.ok : st === "err" ? "!" : st === "active" ? "" : i + 1; li.querySelector("small").textContent = note; },
    close(ms = 900) { setTimeout(() => { el.classList.remove("on"); $("#veil").classList.remove("on"); }, ms); },
  };
}
async function step(ui, i, fn) {
  ui.set(i, "active", "Esperando tu confirmación");
  const out = await fn();
  if (typeof out === "string" && out.startsWith("0x") && out.length === 66) {
    ui.set(i, "active", "Procesando en la red");
    const r = await pub.waitForTransactionReceipt({ hash: out });
    if (r.status !== "success") throw new Error("La transacción fue rechazada por la red.");
  }
  ui.set(i, "done", "Listo");
  return out;
}
async function flow(title, labels, fns, okMsg) {
  const ui = sheet(title, labels); let i = 0;
  try { for (; i < fns.length; i++) await step(ui, i, fns[i]); ui.close(); toast(okMsg); return true; }
  catch (e) { ui.set(i, "err", e.shortMessage || e.message); ui.close(3500); return false; }
}

async function buy(p) {
  let amount = 0n; try { amount = parseUnits($("#amt").value || "0", 6); } catch {}
  if (amount <= 0n) return toast("Escribe cuánto quieres invertir.", true);
  if (S.usdc < amount) return toast(`No te alcanza: tienes ${usd(S.usdc)} USDC.`, true);
  const allowance = await pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "allowance", args: [S.me, p.address] });
  const code = await pub.getCode({ address: p.address });
  const labels = [], fns = [];
  if (allowance < amount) { labels.push("Autorizar tus USDC"); fns.push(() => S.wallet.writeContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "approve", args: [p.address, amount] })); }
  if (!code || code === "0x") { labels.push("Crear el contrato del proyecto"); fns.push(() => S.wallet.sendTransaction({ to: CONFIG.deployer, data: concat([SALT, p.initCode]) })); }
  labels.push(`Invertir ${usd(amount)} USDC`); fns.push(() => S.wallet.writeContract({ address: p.address, abi: ABI, functionName: "buy", args: [amount, S.me] }));
  await flow("Invertir", labels, fns, "Inversión hecha");
}
const ACTS = { finalize: ["Cerrar la venta", "finalize", []], claimTokens: ["Recibir mis tokens", "claimTokens", []], refund: ["Recuperar mi dinero", "refund", []],
  voteYes: ["Aprobar entrega", "vote", [true]], voteNo: ["Rechazar entrega", "vote", [false]], closeVote: ["Aplicar el resultado", "closeVote", []],
  requestRelease: ["Pedir la entrega", "requestRelease", []], abandon: ["Cancelar y devolver el dinero", "abandon", []] };

async function api(path, data) {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "El servidor no respondió.");
  return j;
}
async function submitProject(e) {
  e.preventDefault();
  const p = readForm(), err = validate(p, Math.floor(Date.now() / 1000));
  $("#ferr").textContent = err || "";
  if (err) return;
  const ok = await flow("Enviar proyecto", ["Firmar el proyecto con tu wallet", "Enviar a revisión"], [
    async () => { p._sig = await sign(msgSubmit(p.id, hashOf(p))); },
    async () => { const { _sig, ...project } = p; await api("./api/submit", { project, signature: _sig }); },
  ], "Proyecto enviado");
  if (ok) { $("#app").innerHTML = ""; location.hash = "#/mis-proyectos"; await loadCatalog(); await refresh(); }
}
async function decide(id, approve) {
  const p = S.all.find((x) => x.id === id);
  const raw = { id: p.id, meta: p.meta, params: p.params };
  const ok = await flow(approve ? "Aprobar proyecto" : "Rechazar proyecto", [`Firmar tu decisión`, "Guardar"], [
    async () => { raw._sig = await sign(msgDecision(approve, id, hashOf(raw))); },
    async () => api("./api/decide", { id, approve, signature: raw._sig }),
  ], approve ? "Proyecto publicado" : "Proyecto rechazado");
  if (ok) { await loadCatalog(); await refresh(); }
}
async function openPanel() {
  const d = new Date().toISOString().slice(0, 10);
  let sig;
  const ok = await flow("Abrir revisiones", ["Firmar para identificarte"], [async () => { sig = await sign(msgPanel(d)); }], "Panel abierto");
  if (!ok) return;
  try { S.reviews = (await api("./api/reviews", { day: d, signature: sig })).reviews; } catch (e) { toast(e.message, true); }
  route();
}
async function postUpdate(id) {
  const text = $(`#up-${id}`).value.trim();
  if (text.length < 10) return toast("Escribe al menos 10 caracteres.", true);
  const ts = Date.now(); let sig;
  const ok = await flow("Publicar avance", ["Firmar el avance", "Publicar"], [
    async () => { sig = await sign(msgUpdate(id, ts, keccak256(toBytes(text)))); },
    async () => api("./api/update", { id, text, ts, signature: sig }),
  ], "Avance publicado");
  if (ok) { await loadCatalog(); await refresh(); }
}

document.addEventListener("click", async (e) => {
  const sc = e.target.closest("[data-scroll]");
  if (sc) return document.getElementById(sc.dataset.scroll)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const act = b.dataset.act;
  if (act === "connect") return connect().catch((x) => toast(x.shortMessage || x.message, true));
  if (!S.wallet) return toast("Conecta tu wallet primero.", true);
  document.querySelectorAll("button").forEach((x) => (x.disabled = true));
  try {
    const p = S.list.find((x) => location.hash === `#/p/${x.id}`);
    if (act === "buy") await buy(p);
    else if (ACTS[act]) { const [label, fn, args] = ACTS[act]; await flow(label, [label], [() => S.wallet.writeContract({ address: p.address, abi: ABI, functionName: fn, args })], `${label}: hecho`); }
    else if (act === "approve" || act === "reject") return await decide(b.dataset.id, act === "approve");
    else if (act === "openPanel") return await openPanel();
    else if (act === "postUpdate") return await postUpdate(b.dataset.id);
    await refresh();
  } catch (x) { console.error(x); toast(x.shortMessage || x.message, true); }
  finally { document.querySelectorAll("button").forEach((x) => (x.disabled = false)); }
});

async function main() {
  $("#net").textContent = CONFIG.chainName;
  $("#connect").onclick = () => connect().catch((x) => toast(x.shortMessage || x.message, true));
  window.addEventListener("hashchange", () => { if (!location.hash.startsWith("#/crear")) $("#app").innerHTML = ""; route(); scrollTo(0, 0); });
  await loadCatalog();
  route();
  await refresh();
  const eth = provider();
  if (eth) { const accs = await eth.request({ method: "eth_accounts" }).catch(() => []); if (accs.length) await connect(); }
}
main().catch((e) => { console.error(e); toast(e.message, true); });
