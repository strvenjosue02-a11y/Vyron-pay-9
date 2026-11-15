import {
  createPublicClient, createWalletClient, custom, http, encodeDeployData, getContractAddress,
  concat, parseUnits, formatUnits, erc20Abi, defineChain,
} from "https://cdn.jsdelivr.net/npm/viem@2.21.54/+esm";
import { CONFIG } from "./config.js";
import { ALCANCIA_ABI as ABI, ALCANCIA_BYTECODE } from "./alcancia.js";

// ?rpc=... solo para pruebas locales
const RPC = new URLSearchParams(location.search).get("rpc") || CONFIG.rpc;
const SALT = "0x" + "00".repeat(32);

const chain = defineChain({
  id: CONFIG.chainId, name: CONFIG.chainName,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Explorer", url: CONFIG.explorer } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});
const pub = createPublicClient({ chain, transport: http(RPC) });

let wallet = null, me = null, projects = [], usdcBal = 0n;
const $ = (s) => document.querySelector(s);
const fmt = (v, d, max = 2) => Number(formatUnits(v, d)).toLocaleString("es", { maximumFractionDigits: max });
const usd = (v) => fmt(v, 6);
const tok = (v) => fmt(v, 18, 0);
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const date = (t) => new Date(Number(t) * 1000).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const initials = (n) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg; t.className = `toast show ${kind}`;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast"), 4500);
}

// ------------------------------------------------------------ dirección perezosa
function prepare(project) {
  const p = project.params;
  const params = {
    usdc: CONFIG.usdc, platform: CONFIG.platform, creator: p.creator, name: p.name, symbol: p.symbol,
    softcap: BigInt(p.softcap), hardcap: BigInt(p.hardcap), saleTokens: BigInt(p.saleTokens),
    creatorTokens: BigInt(p.creatorTokens), saleEnd: BigInt(p.saleEnd), initialBps: p.initialBps,
    milestones: p.milestones, milestonePeriod: BigInt(p.milestonePeriod),
  };
  const initCode = encodeDeployData({ abi: ABI, bytecode: ALCANCIA_BYTECODE, args: [params] });
  const address = getContractAddress({ opcode: "CREATE2", from: CONFIG.deployer, salt: SALT, bytecode: initCode });
  return { ...project, q: params, initCode, address, exists: false, now: Math.floor(Date.now() / 1000), s: emptyState(), u: emptyUser() };
}
const emptyState = () => ({ state: 0, totalRaised: 0n, poolAfterFees: 0n, usdcReleased: 0n, milestonesDone: 0, voteEnd: 0n,
  votesYes: 0n, votesNo: 0n, deadline: 0n, succeeded: false, refundPool: 0n, voteRound: 0n });
const emptyUser = () => ({ contributed: 0n, claimed: false, settled: false, voted: false, balance: 0n });

// ------------------------------------------------------------ lectura on-chain
const READS = Object.keys(emptyState());

async function load(p, now) {
  const code = await pub.getCode({ address: p.address });
  p.exists = !!code && code !== "0x";
  p.now = now;
  p.s = emptyState(); p.u = emptyUser();
  if (!p.exists) return;
  const r = await pub.multicall({ contracts: READS.map((f) => ({ address: p.address, abi: ABI, functionName: f })) });
  READS.forEach((f, i) => (p.s[f] = r[i].result));
  if (!me) return;
  const c = (functionName, args) => ({ address: p.address, abi: ABI, functionName, args });
  const u = await pub.multicall({ contracts: [c("contributed", [me]), c("claimedTokens", [me]), c("settled", [me]),
    c("voted", [p.s.voteRound, me]), c("balanceOf", [me])] });
  [p.u.contributed, p.u.claimed, p.u.settled, p.u.voted, p.u.balance] = u.map((x) => x.result);
}

async function refresh() {
  const block = await pub.getBlock();
  const now = Number(block.timestamp);
  await Promise.all(projects.map((p) => load(p, now)));
  if (me) usdcBal = await pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "balanceOf", args: [me] });
  route();
}

// ------------------------------------------------------------ estado legible
function status(p) {
  const { s, q } = p;
  if (s.state === 2) return { label: "Reembolsos", cls: "refund" };
  if (s.state === 1) return s.milestonesDone >= q.milestones ? { label: "Completado", cls: "funded" } : { label: "Financiado", cls: "funded" };
  if (p.now >= Number(q.saleEnd) || s.totalRaised >= q.hardcap) return { label: "Venta cerrada", cls: "" };
  return { label: "Venta abierta", cls: "live" };
}
function timeLeft(p) {
  const d = Number(p.q.saleEnd) - p.now;
  if (d <= 0) return "Finalizada";
  const days = Math.floor(d / 86400);
  return days >= 1 ? `Cierra en ${days} día${days === 1 ? "" : "s"}` : `Cierra en ${Math.ceil(d / 3600)} h`;
}
const pct = (a, b) => (b > 0n ? Number((a * 10000n) / b) / 100 : 0);
const avatar = (p, lg = "") => `<div class="avatar ${lg}" style="background:${p.color}">${initials(p.q.name)}</div>`;

// ------------------------------------------------------------ vistas
function viewHome() {
  const total = projects.reduce((a, p) => a + p.s.totalRaised, 0n);
  const open = projects.filter((p) => status(p).cls === "live").length;
  return `
  <section class="hero">
    <div class="eyebrow">Launchpad on-chain</div>
    <h1>Financia proyectos con tu dinero protegido por contrato</h1>
    <p>Cada proyecto tiene su propio contrato sin administrador. Si no llega a su meta, recuperas el 100%.
      Si la alcanza, el equipo recibe los fondos por etapas que votan los inversores.</p>
  </section>
  <div class="stats">
    <div class="stat"><b>${open}</b><span>Ventas abiertas</span></div>
    <div class="stat"><b>$${usd(total)}</b><span>Recaudado total</span></div>
    <div class="stat"><b>100%</b><span>Reembolso si no hay meta</span></div>
  </div>
  <div class="sec-h"><h2>Proyectos</h2><span class="muted" style="font-size:13px">${projects.length} proyectos</span></div>
  <div class="grid">${projects.map(cardHtml).join("")}</div>`;
}

function cardHtml(p) {
  const { s, q } = p, st = status(p);
  return `<a class="card" href="#/p/${p.id}" data-testid="card-${p.id}">
    <div class="p-head">${avatar(p)}<div style="flex:1;min-width:0">
      <div class="p-name">${esc(q.name)}</div><div class="p-sym">$${esc(q.symbol)} · <span class="tag">${esc(p.category)}</span></div></div>
      <span class="pill ${st.cls}"><i></i>${st.label}</span></div>
    <p class="p-desc">${esc(p.tagline)}</p>
    <div class="bar"><b style="width:${pct(s.totalRaised, q.hardcap)}%"></b><s style="left:${pct(q.softcap, q.hardcap)}%"></s></div>
    <div class="p-meta"><span><b>$${usd(s.totalRaised)}</b> de $${usd(q.hardcap)}</span><span>${pct(s.totalRaised, q.hardcap).toFixed(0)}%</span></div>
    <div class="p-foot"><span>Mínimo $${usd(q.softcap)}</span><span>${timeLeft(p)}</span></div>
  </a>`;
}

const ICON = {
  refund: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>`,
  steps: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4v-6h4v-4h4V4h4"/></svg>`,
  lock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#04130a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>`,
};

function viewDetail(p) {
  const { s, q } = p, st = status(p);
  const stepBps = (10000 - q.initialBps) / q.milestones;
  return `
  <a class="back" href="#/">&larr; Todos los proyectos</a>
  <div class="d-head">${avatar(p, "lg")}<div>
    <h1>${esc(q.name)}</h1>
    <div class="p-sym">$${esc(q.symbol)} · ${esc(p.category)} &nbsp;<span class="pill ${st.cls}"><i></i>${st.label}</span></div></div></div>
  <div class="d-grid">
    <div class="d-side" style="position:static">
      <div class="card"><h3>Sobre el proyecto</h3><p class="muted" style="margin:0">${esc(p.about)}</p></div>
      <div class="card"><h3>Cómo se protege tu dinero</h3><div class="guard">
        <div>${ICON.refund}<div><b>Reembolso garantizado</b><p>Si al cierre no se alcanzan $${usd(q.softcap)}, cada inversor retira el 100% de lo que aportó.</p></div></div>
        <div>${ICON.steps}<div><b>Fondos por etapas</b><p>El equipo recibe ${q.initialBps / 100}% al cierre y el resto en ${q.milestones} etapas de ${stepBps / 100}%. Cada etapa la votan los inversores.</p></div></div>
        <div>${ICON.lock}<div><b>Sin administrador</b><p>Nadie, ni la plataforma, puede mover los fondos fuera de estas reglas. Si el equipo abandona, el saldo restante se devuelve.</p></div></div>
      </div></div>
      <div class="card"><h3>Entregas al equipo</h3>${timeline(p)}</div>
      <div class="card"><h3>Contrato</h3>
        <div class="addr-row"><span class="muted">Dirección</span><a class="mono" target="_blank" rel="noopener" href="${CONFIG.explorer}/address/${p.address}">${short(p.address)}</a></div>
        <div class="addr-row"><span class="muted">Estado</span><span>${p.exists ? "Desplegado" : "Se despliega con la primera compra"}</span></div>
        <div class="addr-row"><span class="muted">Equipo</span><span class="mono">${short(q.creator)}</span></div>
        <div class="addr-row"><span class="muted">Comisión</span><span>1% USDC + 1,5% tokens, solo si se financia</span></div>
        <div class="addr-row"><span class="muted">Red</span><span>${CONFIG.chainName}</span></div>
      </div>
    </div>
    <div class="d-side">
      ${panelInvest(p)}
      ${me && (p.u.contributed > 0n) ? panelPosition(p) : ""}
      ${panelVote(p)}
    </div>
  </div>`;
}

function timeline(p) {
  const { s, q } = p;
  const items = [{ t: `Entrega inicial · ${q.initialBps / 100}%`, d: s.state >= 1 && s.succeeded, sub: "Al cerrar la venta con éxito" }];
  const stepBps = (10000 - q.initialBps) / q.milestones;
  for (let i = 0; i < q.milestones; i++) {
    const done = i < s.milestonesDone;
    const now = s.state === 1 && i === s.milestonesDone;
    let sub = done ? "Aprobada por los inversores" : "Pendiente";
    if (now) sub = s.voteEnd > 0n ? `En votación hasta ${date(s.voteEnd)}` : `El equipo debe solicitarla antes del ${date(s.deadline)}`;
    if (s.state === 2 && !done) sub = "Cancelada · fondos devueltos";
    items.push({ t: `Etapa ${i + 1} · ${stepBps / 100}%`, d: done, now, sub });
  }
  return `<ul class="tl">${items.map((x) => `<li class="${x.d ? "done" : x.now ? "now" : ""}"><span class="dot">${x.d ? ICON.check : ""}</span>
    <div><div class="t">${x.t}</div><div class="s">${x.sub}</div></div></li>`).join("")}</ul>`;
}

function panelInvest(p) {
  const { s, q } = p;
  const ended = p.now >= Number(q.saleEnd) || s.totalRaised >= q.hardcap;
  const perUsdc = (q.saleTokens * 1_000_000n) / q.hardcap;
  let action = "";
  if (s.state === 0 && !ended) {
    action = me ? `
      <label class="muted" style="font-size:13px" for="amt">Monto a invertir</label>
      <div class="field"><input id="amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" data-testid="amount">
        <span class="unit">USDC</span><button data-max="1">MAX</button></div>
      <div class="hint"><span id="receive">Recibirás 0 ${esc(q.symbol)}</span><span>Saldo: ${usd(usdcBal)}</span></div>
      <button class="btn btn-primary btn-block" data-act="buy" data-testid="buy">Invertir</button>
      ${p.exists ? "" : `<div class="notice">El contrato de este proyecto aún no existe. Se crea automáticamente con la primera inversión, por unos centavos de gas.</div>`}`
      : `<button class="btn btn-primary btn-block" data-act="connect">Conectar wallet para invertir</button>`;
  } else if (s.state === 0 && ended) {
    action = p.exists ? `<button class="btn btn-primary btn-block" data-act="finalize" data-testid="finalize">Cerrar venta</button>
      <div class="notice">La venta terminó. Cualquier persona puede cerrarla para liberar tokens o reembolsos.</div>` : `<div class="notice">La venta terminó sin inversiones.</div>`;
  } else if (s.state === 2) {
    action = `<div class="notice warn">${s.succeeded ? "El proyecto fue cancelado por los inversores o por abandono." : "El proyecto no alcanzó la meta mínima."}
      El saldo restante se devuelve a los inversores.</div>`;
  } else {
    action = `<div class="notice">Venta finalizada con éxito. Los fondos se entregan al equipo por etapas.</div>`;
  }
  return `<div class="card">
    <div class="raised">$${usd(s.totalRaised)} <small>de $${usd(q.hardcap)}</small></div>
    <div class="bar" style="margin-top:10px"><b style="width:${pct(s.totalRaised, q.hardcap)}%"></b><s style="left:${pct(q.softcap, q.hardcap)}%"></s></div>
    <div class="p-meta"><span>${pct(s.totalRaised, q.hardcap).toFixed(0)}% recaudado</span><span>${timeLeft(p)}</span></div>
    <div class="kv">
      <div><span>Precio</span><b>1 USDC = ${tok(perUsdc)} ${esc(q.symbol)}</b></div>
      <div><span>Meta mínima</span><b>$${usd(q.softcap)}</b></div>
      <div><span>Meta máxima</span><b>$${usd(q.hardcap)}</b></div>
      <div><span>Cierre</span><b>${date(q.saleEnd)}</b></div>
    </div>
    ${action}
  </div>`;
}

function panelPosition(p) {
  const { s, u, q } = p;
  let risk = 0, rows = "", split = "";
  if (s.state === 1) {
    const locked = s.poolAfterFees - s.usdcReleased;
    const fee = s.totalRaised - s.poolAfterFees;
    risk = 100 - pct(locked, s.totalRaised);
    split = `<div class="split"><i style="width:${pct(locked, s.totalRaised)}%;background:var(--ok)"></i><i style="width:${pct(s.usdcReleased, s.totalRaised)}%;background:var(--accent)"></i><i style="width:${pct(fee, s.totalRaised)}%;background:var(--faint)"></i></div>
      <div class="legend"><span style="--c:var(--ok)">Protegido $${usd(locked)}</span><span style="--c:var(--accent)">Entregado $${usd(s.usdcReleased)}</span><span style="--c:var(--faint)">Comisión $${usd(fee)}</span></div>`;
  }
  const refundable = s.state === 2 && s.totalRaised > 0n ? (s.refundPool * u.contributed) / s.totalRaised : 0n;
  rows = `<div><span>Tu inversión</span><b>$${usd(u.contributed)}</b></div>
    <div><span>Tus tokens</span><b>${tok(u.balance)} ${esc(q.symbol)}</b></div>
    ${s.succeeded && !u.claimed ? `<div><span>Tokens por reclamar</span><b>${tok((u.contributed * q.saleTokens) / q.hardcap)} ${esc(q.symbol)}</b></div>` : ""}
    ${s.state === 2 ? `<div><span>Reembolso disponible</span><b>${u.settled ? "Retirado" : "$" + usd(refundable)}</b></div>` : ""}`;
  const btns = [];
  if (s.succeeded && !u.claimed) btns.push(`<button class="btn btn-primary btn-block" data-act="claimTokens" data-testid="claim">Reclamar tokens</button>`);
  if (s.state === 2 && !u.settled) btns.push(`<button class="btn btn-ok btn-block" data-act="refund" data-testid="refund">Retirar reembolso</button>`);
  return `<div class="card"><h3>Tu posición</h3>
    ${s.state === 1 ? `<div class="muted" style="font-size:13px">Máximo que podrías perder hoy</div><div class="risk-num" data-testid="risk">${risk.toFixed(1)}%</div>${split}` : ""}
    ${s.state === 0 ? `<div class="notice" style="margin:0 0 6px">Protegido al 100% hasta el cierre de la venta.</div>` : ""}
    <div class="rows">${rows}</div>
    ${btns.length ? `<div style="display:grid;gap:8px;margin-top:12px">${btns.join("")}</div>` : ""}</div>`;
}

function panelVote(p) {
  const { s, u, q } = p;
  if (s.state !== 1 || s.milestonesDone >= q.milestones) return "";
  const isCreator = me && me.toLowerCase() === q.creator.toLowerCase();
  const voteOpen = s.voteEnd > 0n && p.now < Number(s.voteEnd);
  const total = s.votesYes + s.votesNo;
  let body = "";
  if (s.voteEnd > 0n) {
    body = `<div class="muted" style="font-size:13px">Etapa ${s.milestonesDone + 1} de ${q.milestones} · ${voteOpen ? `termina el ${date(s.voteEnd)}` : "votación terminada"}</div>
      <div class="votebar"><i style="width:${pct(s.votesYes, total || 1n)}%;background:var(--ok)"></i><i style="width:${pct(s.votesNo, total || 1n)}%;background:var(--bad)"></i></div>
      <div class="legend"><span style="--c:var(--ok)">A favor $${usd(s.votesYes)}</span><span style="--c:var(--bad)">En contra $${usd(s.votesNo)}</span></div>`;
    if (voteOpen && u.contributed > 0n && !u.voted) body += `<div class="vote"><button class="btn btn-ok" data-act="voteYes" data-testid="vote-yes">Aprobar etapa</button><button class="btn btn-bad" data-act="voteNo" data-testid="vote-no">Rechazar</button></div>`;
    else if (voteOpen && u.voted) body += `<div class="notice">Ya votaste en esta etapa.</div>`;
    if (!voteOpen) body += `<button class="btn btn-primary btn-block" style="margin-top:12px" data-act="closeVote" data-testid="close-vote">Ejecutar resultado</button>`;
  } else if (p.now <= Number(s.deadline)) {
    body = `<p class="muted" style="margin:0 0 4px;font-size:14px">El equipo debe solicitar la etapa ${s.milestonesDone + 1} antes del ${date(s.deadline)}.</p>`;
    if (isCreator) body += `<button class="btn btn-ghost btn-block" style="margin-top:10px" data-act="requestRelease" data-testid="request">Solicitar etapa ${s.milestonesDone + 1} (equipo)</button>`;
  } else {
    body = `<p class="muted" style="margin:0;font-size:14px">El equipo no solicitó la etapa a tiempo. Cualquier persona puede cancelar el proyecto y devolver el saldo.</p>
      <button class="btn btn-bad btn-block" style="margin-top:12px" data-act="abandon" data-testid="abandon">Cancelar y devolver fondos</button>`;
  }
  return `<div class="card"><h3>Gobernanza</h3>${body}</div>`;
}

function route() {
  const m = location.hash.match(/^#\/p\/([\w-]+)/);
  const p = m && projects.find((x) => x.id === m[1]);
  const keep = $("#amt")?.value;
  $("#app").innerHTML = p ? viewDetail(p) : viewHome();
  if (p && keep && $("#amt")) $("#amt").value = keep;
  if (p) bindAmount(p);
}
function bindAmount(p) {
  const el = $("#amt");
  if (!el) return;
  const upd = () => {
    let v = 0n;
    try { v = parseUnits(el.value || "0", 6); } catch {}
    $("#receive").textContent = `Recibirás ${tok((v * p.q.saleTokens) / p.q.hardcap)} ${p.q.symbol}`;
  };
  el.oninput = upd; upd();
  document.querySelector("[data-max]").onclick = () => {
    const room = p.q.hardcap - p.s.totalRaised;
    el.value = formatUnits(usdcBal < room ? usdcBal : room, 6); upd();
  };
}

// ------------------------------------------------------------ wallet
const provider = () => window.phantom?.ethereum || window.ethereum;

async function connect() {
  const eth = provider();
  if (!eth) {
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      location.href = `https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=${encodeURIComponent(location.origin)}`;
      return;
    }
    return toast("No se encontró una wallet. Instala Phantom, MetaMask o Coinbase Wallet.", "bad");
  }
  const [addr] = await eth.request({ method: "eth_requestAccounts" });
  me = addr;
  await ensureChain(eth);
  wallet = createWalletClient({ account: me, chain, transport: custom(eth) });
  $("#connect").innerHTML = `<span class="acct"><i></i>${short(me)}</span>`;
  $("#connect").className = "btn btn-ghost btn-sm";
  eth.on?.("accountsChanged", () => location.reload());
  eth.on?.("chainChanged", () => location.reload());
  await refresh();
}

async function ensureChain(eth) {
  const hex = "0x" + CONFIG.chainId.toString(16);
  if ((await eth.request({ method: "eth_chainId" })) === hex) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (e) {
    if (e.code !== 4902) throw e;
    await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: hex, chainName: CONFIG.chainName,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: [CONFIG.rpc], blockExplorerUrls: [CONFIG.explorer] }] });
  }
}

// ------------------------------------------------------------ hoja de transacciones
function sheet(title, steps) {
  const el = $("#sheet");
  el.innerHTML = `<h3>${title}</h3><div class="muted" style="font-size:13.5px">Confirma cada paso en tu wallet.</div>
    <ul class="steps">${steps.map((s, i) => `<li data-i="${i}"><span class="ic">${i + 1}</span><div>${s}<small></small></div></li>`).join("")}</ul>`;
  el.classList.add("open"); $("#sheet-bg").classList.add("open");
  return {
    set(i, state, note = "") {
      const li = el.querySelector(`li[data-i="${i}"]`);
      li.className = state;
      li.querySelector(".ic").innerHTML = state === "done" ? ICON.check : state === "err" ? "!" : state === "active" ? "" : i + 1;
      li.querySelector("small").textContent = note;
    },
    close(delay = 900) { setTimeout(() => { el.classList.remove("open"); $("#sheet-bg").classList.remove("open"); }, delay); },
  };
}

async function tx(ui, i, fn) {
  ui.set(i, "active", "Esperando confirmación en la wallet");
  const hash = await fn();
  ui.set(i, "active", "Procesando en la red");
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error("La transacción falló");
  ui.set(i, "done", "Confirmada");
}

async function buy(p) {
  let amount;
  try { amount = parseUnits($("#amt").value || "0", 6); } catch { amount = 0n; }
  if (amount <= 0n) return toast("Ingresa un monto válido.", "bad");
  if (usdcBal < amount) return toast(`Saldo insuficiente: tienes ${usd(usdcBal)} USDC.`, "bad");
  const allowance = await pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "allowance", args: [me, p.address] });
  const code = await pub.getCode({ address: p.address });
  const needApprove = allowance < amount, needDeploy = !code || code === "0x";
  const labels = [];
  if (needApprove) labels.push("Autorizar USDC");
  if (needDeploy) labels.push("Crear contrato del proyecto");
  labels.push(`Invertir ${usd(amount)} USDC`);
  const ui = sheet("Confirmar inversión", labels);
  let i = 0;
  try {
    if (needApprove) await tx(ui, i++, () => wallet.writeContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "approve", args: [p.address, amount] }));
    if (needDeploy) await tx(ui, i++, () => wallet.sendTransaction({ to: CONFIG.deployer, data: concat([SALT, p.initCode]) }));
    await tx(ui, i, () => wallet.writeContract({ address: p.address, abi: ABI, functionName: "buy", args: [amount, me] }));
    ui.close(); toast("Inversión confirmada", "ok");
  } catch (e) { ui.set(i, "err", e.shortMessage || e.message); ui.close(3500); throw e; }
}

const LABELS = { finalize: "Cerrar venta", claimTokens: "Reclamar tokens", refund: "Retirar reembolso", voteYes: "Aprobar etapa",
  voteNo: "Rechazar etapa", closeVote: "Ejecutar resultado", requestRelease: "Solicitar etapa", abandon: "Cancelar proyecto" };

async function simple(p, act) {
  const [fn, args] = act === "voteYes" ? ["vote", [true]] : act === "voteNo" ? ["vote", [false]] : [act, []];
  const ui = sheet(LABELS[act], [LABELS[act]]);
  try {
    await tx(ui, 0, () => wallet.writeContract({ address: p.address, abi: ABI, functionName: fn, args }));
    ui.close(); toast(`${LABELS[act]}: confirmado`, "ok");
  } catch (e) { ui.set(0, "err", e.shortMessage || e.message); ui.close(3500); throw e; }
}

async function onClick(e) {
  const el = e.target.closest("button[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  if (act === "connect") return connect().catch((err) => toast(err.shortMessage || err.message, "bad"));
  const p = projects.find((x) => location.hash === `#/p/${x.id}`);
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    if (act === "buy") await buy(p);
    else await simple(p, act);
  } catch (err) {
    console.error(err);
  } finally {
    await refresh();
  }
}

// ------------------------------------------------------------ inicio
async function main() {
  $("#net").querySelector("span").textContent = CONFIG.chainName;
  $("#connect").onclick = () => connect().catch((e) => toast(e.shortMessage || e.message, "bad"));
  document.addEventListener("click", onClick);
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  const list = await (await fetch("./projects.json", { cache: "no-store" })).json();
  projects = list.map(prepare);
  route();
  await refresh();
  const eth = provider();
  if (eth) {
    const accs = await eth.request({ method: "eth_accounts" }).catch(() => []);
    if (accs.length) await connect();
  }
}
main().catch((e) => { console.error(e); toast(e.message, "bad"); });
