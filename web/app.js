import { startHeroBg } from "./hxbg.js";
import {
  createPublicClient, createWalletClient, custom, http, encodeDeployData, getContractAddress, concat, parseUnits,
  formatUnits, erc20Abi, defineChain, keccak256, toBytes, verifyMessage, parseAbi,
} from "https://cdn.jsdelivr.net/npm/viem@2.21.54/+esm";
import { CONFIG } from "./config.js";
import { ALCANCIA_ABI as ABI, ALCANCIA_BYTECODE } from "./alcancia.js";
import { initI18n } from "./i18n.js";
import { mountChart } from "./pro.js";
import { threadHtml } from "./thread.js";
import { createDemo } from "./demo.js";
import { setLaunchChain, loadChainLaunches, lcChainLive, showLaunches, launchRows, launchItems, stopLaunches, lcLive, lcGet, lcMeBal, lcSwap, lcQuote, nextClose } from "./launch.js";
import { canonical, msgSubmit, msgDecision, msgUpdate, msgPanel, msgQuestion, msgAnswer, msgProfile, validProfile, validate, CATEGORIES, COLORS, USE_KEYS, USE_LINKS } from "./shared.js";

const RPC = new URLSearchParams(location.search).get("rpc") || CONFIG.rpc; // ?rpc= solo para pruebas locales
const SALT = "0x" + "00".repeat(32);
const OWNER = CONFIG.platform.toLowerCase();
const chain = defineChain({
  id: CONFIG.chainId, name: CONFIG.chainName, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } }, contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});
let pub = createPublicClient({ chain, transport: http(RPC) });
let DEMO = null;

const S = { tab: "overview", me: null, wallet: null, usdc: 0n, all: [], list: [], reviews: null, now: Math.floor(Date.now() / 1000) };
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = (v, d, max = 2) => { const x = Number(formatUnits(v, d)), ab = Math.abs(x);
  if (ab >= 1e9) return (x / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 }) + "B";
  if (ab >= 1e6) return (x / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 }) + "M";
  return x.toLocaleString("en-US", { maximumFractionDigits: max }); };
const usd = (v) => n(v, 6);
const tok = (v) => n(v, 18, 0);
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const day = (t) => new Date(Number(t) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const pct = (a, b) => (b > 0n ? Number((a * 10000n) / b) / 100 : 0);
const initials = (s) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const hashOf = (p) => keccak256(toBytes(canonical(p)));
const isMe = (a) => S.me && a && S.me.toLowerCase() === a.toLowerCase();
const isOwner = () => S.me && S.me.toLowerCase() === OWNER;

function toast(msg, bad = false) {
  const t = $("#toast"); t.textContent = msg; t.className = `toast on${bad ? " bad" : ""}`;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast"), 4200);
}

// ================================================================= catálogo (direcciones perezosas)
function prepare(raw) {
  const p = raw.params;
  const q = { usdc: CONFIG.usdc, platform: CONFIG.platform, creator: p.creator, name: p.name, symbol: p.symbol,
    softcap: BigInt(p.softcap), hardcap: BigInt(p.hardcap), saleTokens: BigInt(p.saleTokens), creatorTokens: BigInt(p.creatorTokens),
    saleEnd: BigInt(p.saleEnd), initialBps: Number(p.initialBps), milestones: Number(p.milestones), milestonePeriod: BigInt(p.milestonePeriod),
    liquidityBps: Number(p.liquidityBps || 0), positionManager: Number(p.liquidityBps || 0) > 0 ? CONFIG.positionManager : "0x0000000000000000000000000000000000000000" };
  const initCode = encodeDeployData({ abi: ABI, bytecode: ALCANCIA_BYTECODE, args: [q] });
  return { ...raw, q, initCode, address: getContractAddress({ opcode: "CREATE2", from: CONFIG.deployer, salt: SALT, bytecode: initCode }),
    exists: false, s: blankS(), u: blankU(), updates: raw.updates || [] };
}
const blankS = () => ({ pool: "0x0000000000000000000000000000000000000000", lpUnlock: 0n, liquidityUsdc: 0n, state: 0, totalRaised: 0n, poolAfterFees: 0n, usdcReleased: 0n, milestonesDone: 0, voteEnd: 0n, votesYes: 0n,
  votesNo: 0n, deadline: 0n, succeeded: false, refundPool: 0n, voteRound: 0n, platformTokens: 0n });
const blankU = () => ({ contributed: 0n, claimed: false, settled: false, voted: false, balance: 0n });

async function loadCatalog() {
  const seeds = await (await fetch("./projects.json", { cache: "no-store" })).json();
  let api = [], qaRaw = {}, upRaw = {};
  try { const r = await fetch("./api/projects", { cache: "no-store" }); if (r.ok) { const j = await r.json(); api = j.projects || []; qaRaw = j.qa || {}; upRaw = j.updates || {}; } } catch {}
  // El servidor no es de confianza: cada proyecto, decisión y avance se verifica aquí con firmas.
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
  S.all = [...seeds.map((p) => ({ ...p, status: "approved", seed: true })), ...checked.filter(Boolean)].map(prepare);
  DEMO?.init(S.all);
  // avances de proyectos semilla: también verificados con la firma del creador
  await Promise.all(S.all.filter((p) => p.seed).map(async (p) => {
    const ok = []; for (const u of upRaw[p.id] || []) if (await verifyMessage({ address: p.params.creator, message: msgUpdate(p.id, u.ts, keccak256(toBytes(u.text))), signature: u.signature }).catch(() => false)) ok.push(u);
    p.updates = ok;
  }));
  S.list = S.all.filter((p) => p.status === "approved");
  try { const r = await fetch("./api/profile", { cache: "no-store" }); S.prof = {};
    if (r.ok) for (const x of (await r.json()).profiles || []) if (await verifyMessage({ address: x.address, message: msgProfile(x.address, x.name, keccak256(toBytes(x.photo || ""))), signature: x.signature }).catch(() => false)) S.prof[x.address] = x; } catch { S.prof = S.prof || {}; }
  await Promise.all(S.all.map(async (p) => {
    const items = qaRaw[p.id] || [], qs = [], ans = {};
    for (const x of items) {
      const h = keccak256(toBytes(x.text));
      if (x.kind === "q" && await verifyMessage({ address: x.author, message: msgQuestion(p.id, x.ts, h), signature: x.signature }).catch(() => false)) qs.push(x);
      if (x.kind === "a" && x.author.toLowerCase() === p.params.creator.toLowerCase() && await verifyMessage({ address: x.author, message: msgAnswer(p.id, x.qts, x.ts, h), signature: x.signature }).catch(() => false)) ans[x.qts] = x;
    }
    p.qa = qs.sort((a, b) => b.ts - a.ts).map((q) => ({ ...q, answer: ans[q.ts] || null }));
  }));
}

const READS = ["pool", "lpUnlock", "liquidityUsdc", "state", "totalRaised", "poolAfterFees", "usdcReleased", "milestonesDone", "voteEnd", "votesYes", "votesNo", "deadline", "succeeded", "refundPool", "voteRound", "retrying"];
// ---- lanzamientos llenos usan EXACTAMENTE la misma terminal de trading (adaptador sobre los datos del prototipo)
const lcCache = new Map(), fakeAddr = (s) => keccak256(toBytes(s)).slice(0, 42);
function lcP(l) {
  let p = lcCache.get(l.id);
  if (!p) { const hh = [...l.name].reduce((x, c) => (x * 31 + c.charCodeAt(0)) % 360, 7);
    p = { lc: l.id, id: "lc-" + l.id, address: fakeAddr("lc-" + l.id), exists: true, q: { symbol: l.sym, name: l.name, creator: fakeAddr("cr-" + l.id), milestones: 0 }, s: { ...blankS(), pool: fakeAddr("pool-" + l.id), lpUnlock: 4102444800n, succeeded: false, milestonesDone: 0 }, u: blankU(), meta: { color: `hsl(${hh} 55% 38%)`, links: "{}", logo: /^data:image\/(webp|png|jpeg);base64,/.test(l.img || "") || /^\.\/assets\/tokens\//.test(l.img || "") ? l.img : "" }, order: {}, holders: null }; lcCache.set(l.id, p); }
  syncLc(p, l); return p;
}
function syncLc(p, l = lcGet(p.lc)) {
  if (!l) return; const shift = S.now ? S.now - Date.now() / 1000 : 0, big = (x) => BigInt(Math.round(x * 1e6)) * 10n ** 12n;
  p.mk = { price: l.rU / l.rT, round: l.p0, poolUsdc: BigInt(Math.round(l.rU * 1e6)), usdc0: false, usdc: false };
  p.supply = 1_000_000n * 10n ** 18n;
  p.tHead = BigInt(Math.floor((S.now || Date.now() / 1000) / 12));
  p.trades = l.ticks.map((t, i) => ({ ts: t.t + shift, block: BigInt(Math.floor((t.t + shift) / 12)), tx: fakeAddr(l.id + ":" + i) + "0".repeat(24), buy: !!t.b, usdc: BigInt(Math.round(t.v * 1e6)), tok: big(t.k || 0), price: t.p, who: t.w }));
  p.u.balance = big(lcMeBal().tok[l.id] || 0); p.exists = true;
}
function holdersLc(p) {
  const l = lcGet(p.lc); if (!l) return; const bal = {}; for (const t of l.ticks) bal[t.w] = (bal[t.w] || 0) + (t.b ? t.k : -t.k);
  const big = (x) => BigInt(Math.round(Math.max(0, x) * 1e6)) * 10n ** 12n, list = Object.entries(bal).filter(([, v]) => v > 0).map(([a2, v]) => ({ a: a2, b: big(v) }));
  list.push({ a: p.s.pool, b: big(l.rT) }, { a: p.q.creator, b: big(50000) }); p.holders = list.sort((x, y) => (y.b > x.b ? 1 : -1)).slice(0, 12);
}
const findTok = (fn) => S.list.find(fn) || lcLive().map(lcP).find(fn) || lcChainLive().map(lcxP).find(fn);
function lcQuoteUi(p) {
  const l = lcGet(p.lc), side = S.side || "buy", v = parseFloat($("#tamt")?.value || "0") || 0;
  if (v <= 0 || !l) { if ($("#tout")) $("#tout").textContent = "–"; if ($("#timp")) $("#timp").textContent = "–"; if ($("#tmin")) $("#tmin").textContent = "–"; S.quote = null; return; }
  const r = lcQuote(l, side, v), fT = (x) => Math.round(x).toLocaleString("en-US"), fU = (x) => "$" + x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  S.quote = { lc: v, side, imp: r.imp, out: r.out };
  $("#tout").textContent = side === "buy" ? `${fT(r.out)} ${p.q.symbol}` : `${fU(r.out)} USDC`;
  const mn = r.out * (1 - (S.slip || 1) / 100); if ($("#tmin")) $("#tmin").textContent = side === "buy" ? `${fT(mn)} ${p.q.symbol}` : `${fU(mn)} USDC`;
  $("#timp").textContent = `${r.imp.toFixed(2)}%`; $("#timp").classList.toggle("warn", r.imp > 5);
}
function showDone(kind, usdAmt, sym) {
  document.querySelectorAll(".done-ov").forEach((x) => x.remove());
  const d = document.createElement("div"); d.className = "done-ov " + kind;
  d.innerHTML = `<div class="dn-c"><svg viewBox="0 0 52 52" width="64" height="64" aria-hidden="true"><circle cx="26" cy="26" r="23" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 27l8 8 14-16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><b>${kind === "buy" ? "Purchase done" : "Sale done"}</b><span>$${usdAmt} · ${esc(sym)}</span></div>`;
  document.body.appendChild(d); setTimeout(() => d.classList.add("out"), 1500); setTimeout(() => d.remove(), 1900);
}
function offerShare(p, kind, usdAmt) {
  showDone(kind, usdAmt, p.q.symbol);
  document.querySelectorAll(".share-pop").forEach((x) => x.remove()); if (!S.me) return;
  const d = document.createElement("div"); d.className = "share-pop"; d.innerHTML = `<span>${kind === "buy" ? "Bought" : "Sold"} <b>$${usdAmt}</b> of ${esc(p.q.symbol)}</span><button type="button">Share card</button><i aria-label="Close">✕</i>`;
  d.querySelector("button").onclick = () => { d.remove(); traderCard(p, S.me, { last: { buy: kind === "buy", usd: usdAmt } }); }; d.querySelector("i").onclick = () => d.remove();
  document.body.appendChild(d); setTimeout(() => d.remove(), 9000);
}
async function swapLc(p) {
  lcQuoteUi(p); const q = S.quote; if (!q) return toast("Enter an amount to trade.", true);
  const l = lcGet(p.lc), mb = lcMeBal();
  if (q.side === "buy" ? q.lc > mb.usdc + 1e-9 : q.lc > (mb.tok[l.id] || 0) + 1e-9) return toast("Not enough balance.", true);
  lcSwap(l, q.side, q.lc, S.me); syncLc(p, l); S.quote = null; toast("Trade done"); offerShare(p, q.side, q.lc.toFixed(2));
  const box = $(".cyber"); if (box) { box.outerHTML = tradePanel(p); bindTrade(p); } const h = posBox(p), el = $("#tx-pos"); if (el) el.outerHTML = h; chartOff?.update();
}
// ---- lanzamientos REALES (contrato Launch) llenos: misma terminal, leyendo el pool de Uniswap de verdad
const lcxCache = new Map();
function lcxP(l) {
  let p = lcxCache.get(l.id);
  if (!p) { const hh = [...l.name].reduce((x, c) => (x * 31 + c.charCodeAt(0)) % 360, 7);
    p = { lcx: l.id, id: "lcx-" + l.id, address: l.chain, exists: true, q: { symbol: l.sym, name: l.name, creator: l.cs.creator, hardcap: BigInt(Math.round(l.goal * 1e6)), saleTokens: 500_000_000n * 10n ** 18n, milestones: 0 }, s: { ...blankS(), pool: l.cs.pool, lpUnlock: 4102444800n }, u: blankU(), meta: { color: `hsl(${hh} 55% 38%)`, links: "{}", logo: "" }, order: {}, holders: null }; lcxCache.set(l.id, p); }
  return p;
}
async function loadLcx(p) {
  const l = lcChainLive().find((x) => x.id === p.lcx); if (!l) return; p.s.pool = l.cs.pool;
  const [slot, bu, bt] = await Promise.all([
    pub.readContract({ address: p.s.pool, abi: POOL_ABI, functionName: "slot0" }),
    pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "balanceOf", args: [p.s.pool] }),
    pub.readContract({ address: p.address, abi: erc20Abi, functionName: "balanceOf", args: [p.s.pool] })]);
  p.mk = { sqrt: slot[0], poolUsdc: bu, poolTok: bt, usdc0: CONFIG.usdc.toLowerCase() < p.address.toLowerCase() }; p.mk.price = usdcPerToken(p.mk.sqrt, p.mk.usdc0);
  p.mk.round = Number(p.q.hardcap) / 1e6 / (Number(p.q.saleTokens) / 1e18);
  if (S.me) {
    p.u.balance = await pub.readContract({ address: p.address, abi: erc20Abi, functionName: "balanceOf", args: [S.me] });
    // lo reclamado de la ronda se compró al precio de la ronda (el mismo para todos); lo comprado en el pool ya cuenta en las operaciones
    const bought = (p.trades || []).filter((t) => t.buy && t.who && t.who.toLowerCase() === S.me.toLowerCase()).reduce((s, t) => s + Number(t.tok) / 1e18, 0), fromRound = Math.max(0, Number(p.u.balance) / 1e18 - bought);
    p.u.contributed = BigInt(Math.round(fromRound * p.mk.round * 1e6));
  }
}
async function loadChain(p) {
  if (p.lcx) return loadLcx(p);
  if (p.lc) { syncLc(p); return; }
  const code = await pub.getCode({ address: p.address });
  p.exists = !!code && code !== "0x"; p.s = blankS(); p.u = blankU();
  if (!p.exists) return;
  const c = (functionName, args) => ({ address: p.address, abi: ABI, functionName, args });
  const r = await pub.multicall({ contracts: [...READS.map((f) => c(f)), c("balanceOf", [CONFIG.platform])] });
  READS.forEach((f, i) => (p.s[f] = r[i].result));
  p.s.platformTokens = r[READS.length].result;
  p.mk = null;
  if (p.s.pool && p.s.pool !== "0x0000000000000000000000000000000000000000") {
    const [slot, bu, bt] = await Promise.all([
      pub.readContract({ address: p.s.pool, abi: POOL_ABI, functionName: "slot0" }),
      pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "balanceOf", args: [p.s.pool] }),
      pub.readContract({ address: p.address, abi: erc20Abi, functionName: "balanceOf", args: [p.s.pool] }),
    ]);
    p.mk = { sqrt: slot[0], poolUsdc: bu, poolTok: bt, usdc0: CONFIG.usdc.toLowerCase() < p.address.toLowerCase() };
    p.mk.price = usdcPerToken(p.mk.sqrt, p.mk.usdc0);
    p.mk.round = Number(p.q.hardcap) / 1e6 / (Number(p.q.saleTokens) / 1e18);
  }
  if (!S.me) return;
  const u = await pub.multicall({ contracts: [c("contributed", [S.me]), c("claimedTokens", [S.me]), c("settled", [S.me]), c("voted", [p.s.voteRound, S.me]), c("balanceOf", [S.me])] });
  [p.u.contributed, p.u.claimed, p.u.settled, p.u.voted, p.u.balance] = u.map((x) => x.result);
}
async function refresh() {
  S.now = Number((await pub.getBlock()).timestamp);
  await Promise.all(S.list.map(loadChain));
  await loadActivity();
  if (S.me) S.usdc = await pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "balanceOf", args: [S.me] });
  route();
}

// eventos con rango que se achica si el RPC rechaza rangos grandes
async function events(args, head) {
  for (const span of [45000n, 5000n, 800n]) {
    try { return await pub.getContractEvents({ ...args, fromBlock: head > span ? head - span : 0n }); } catch {}
  }
  return [];
}
// ================================================================= actividad en vivo (eventos on-chain)
async function loadActivity() {
  try {
    const head = await pub.getBlockNumber();
    const fromBlock = head > 45000n ? head - 45000n : 0n;
    const lists = await Promise.all(S.list.filter((p) => p.exists).map(async (p) => {
      const [bought, fin] = await Promise.all([
        events({ address: p.address, abi: ABI, eventName: "Bought" }, head),
        events({ address: p.address, abi: ABI, eventName: "Finalized" }, head),
      ]);
      p.backers = new Set(bought.map((e) => e.args.buyer.toLowerCase())).size; p.backersPartial = fromBlock > 0n;
      p.order = {}; bought.forEach((e) => { const a = e.args.buyer.toLowerCase(); if (!(a in p.order)) p.order[a] = Object.keys(p.order).length + 1; });
      { const since = head > 7200n ? head - 7200n : 0n, day = bought.filter((e) => e.blockNumber >= since); // ~24 h de bloques
        p.hot = day.reduce((s, e) => s + Number(e.args.usdcAmount) / 1e6, 0) + 25 * new Set(day.map((e) => e.args.buyer.toLowerCase())).size; }
      p.recent = bought.slice(-12).reverse().map((e) => ({ who: e.args.buyer, amt: e.args.usdcAmount, block: e.blockNumber })); p.head = head;
      return [...bought.map((e) => ({ kind: "buy", p, who: e.args.buyer, amt: e.args.usdcAmount, block: e.blockNumber })),
        ...fin.map((e) => ({ kind: e.args.success ? "goal" : "miss", p, block: e.blockNumber }))];
    }));
    S.activity = { head, items: lists.flat().sort((a, b) => Number(b.block - a.block)).slice(0, 12) };
  } catch { S.activity = null; }
}
function ago(blocks) {
  const m = Math.max(1, Math.round(Number(blocks) * 12 / 60));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
}
function tickerHtml() {
  const a = S.activity;
  if (!a || !a.items.length) return "";
  const one = (x) => `<span class="tk-item"><i class="tk-dot ${x.kind}"></i>${x.kind === "buy"
    ? `<span class="addr">${short(x.who)}</span> backed <b>${esc(x.p.q.name)}</b> with ${usd(x.amt)} USDC`
    : x.kind === "goal" ? `<b>${esc(x.p.q.name)}</b> reached its goal` : `<b>${esc(x.p.q.name)}</b> missed its goal, refunds open`}<span class="tk-ago">${ago(a.head - x.block)}</span></span>`;
  const row = a.items.map(one).join("");
  return `<section class="ticker" aria-label="Live activity"><div class="tk-label"><i></i>Live now</div><div class="tk-track"><div class="tk-run">${row}${a.items.length > 2 ? row : ""}</div></div></section>`;
}

// ================================================================= mercado (Uniswap v3)
const POOL_ABI = parseAbi(["function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"]);
const QUOTER_ABI = parseAbi(["function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"]);
const ROUTER_ABI = parseAbi(["function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)"]);
function usdcPerToken(sqrt, usdc0) {
  const r = Number(sqrt) / 2 ** 96, raw1per0 = r * r; // token1 por token0 en unidades mínimas
  const tokPerUsdc = usdc0 ? raw1per0 * 1e6 / 1e18 : (1 / raw1per0) * 1e6 / 1e18;
  return 1 / tokPerUsdc;
}
const SUBN = (n) => String(n).replace(/\d/g, (d) => "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089"[d]);
const tinyP = (x) => { if (!(x > 0)) return "0"; const z = Math.floor(-Math.log10(x)); const m = (x * Math.pow(10, z + 1)).toPrecision(3).replace(".", "").slice(0, 3); return z > 4 ? `0.0${SUBN(z)}${m}` : x.toFixed(z + 3); };
const fmtP = (x) => x >= 0.01 ? `$${x.toLocaleString("en-US", { maximumFractionDigits: 4 })}` : x >= 1e-4 ? `$${x.toPrecision(3)}` : `$${tinyP(x)}`;
async function loadTrades(p) {
  if (p.lc) { syncLc(p); return p.trades; }
  if (!p.mk) await loadChain(p).catch(() => {});
  if (!p.mk) return [];
  try {
    const head = await pub.getBlockNumber(), fromBlock = head > 45000n ? head - 45000n : 0n;
    const ev = await events({ address: p.s.pool, abi: POOL_ABI, eventName: "Swap" }, head);
    const list = ev.map((e) => {
      const usdcAmt = p.mk.usdc0 ? e.args.amount0 : e.args.amount1, tokAmt = p.mk.usdc0 ? e.args.amount1 : e.args.amount0;
      return { buy: usdcAmt > 0n, usdc: usdcAmt < 0n ? -usdcAmt : usdcAmt, tok: tokAmt < 0n ? -tokAmt : tokAmt, price: usdcPerToken(e.args.sqrtPriceX96, p.mk.usdc0), who: e.args.recipient, block: e.blockNumber };
    });
    if (p.trades && list.length < p.trades.length) return p.trades; // respuesta incompleta del RPC: conservar lo que ya teníamos
    p.tHead = head; S.now = Number((await pub.getBlock({ blockNumber: head })).timestamp);
    const blocks = [...new Set(list.map((t) => t.block))].slice(-300);
    const times = await Promise.all(blocks.map((b) => pub.getBlock({ blockNumber: b }).then((x) => [b, Number(x.timestamp)]).catch(() => [b, 0])));
    const tm = Object.fromEntries(times.map(([b, t]) => [String(b), t]));
    list.forEach((t) => (t.ts = tm[String(t.block)] || 0)); p.trades = list;
  } catch { p.trades = p.trades || []; }
  return p.trades;
}
function chartSvg(p) {
  const pts = [p.mk.round, ...(p.trades || []).map((t) => t.price)];
  if (pts.length < 2) pts.push(p.mk.price);
  const W = 640, H = 200, min = Math.min(...pts, p.mk.round) * 0.97, max = Math.max(...pts, p.mk.round) * 1.03;
  const x = (i) => (i / (pts.length - 1)) * W, y = (v) => H - ((v - min) / (max - min || 1)) * H;
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return `<svg class="cy-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Price since the pool opened">
    <defs><linearGradient id="cyf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3d8b" stop-opacity=".35"/><stop offset="1" stop-color="#ff3d8b" stop-opacity="0"/></linearGradient></defs>
    <line x1="0" x2="${W}" y1="${y(p.mk.round).toFixed(1)}" y2="${y(p.mk.round).toFixed(1)}" class="cy-round"/>
    <path d="${line} L${W} ${H} L0 ${H}Z" fill="url(#cyf)"/><path d="${line}" class="cy-line"/></svg>`;
}
const agoS = (s) => (s = Math.max(0, Math.round(s)), s < 60 ? s + "s" : s < 3600 ? Math.floor(s / 60) + "m" : s < 86400 ? Math.floor(s / 3600) + "h" : Math.floor(s / 86400) + "d");
const capFmt = (v) => (!v ? "–" : v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(1) + "K" : "$" + v.toFixed(0));
function chgAgo(p, secs) {
  const now = S.now || Date.now() / 1000, tr = (p.trades || []).filter((t) => t.ts), bf = tr.filter((t) => t.ts <= now - secs), o = bf.length ? bf[bf.length - 1].price : (tr[0]?.price || p.mk.round);
  return o ? ((p.mk.price - o) / o) * 100 : 0;
}
const chipsHtml = (p) => [["5m", 300], ["1h", 3600], ["6h", 21600], ["24h", 86400]].map(([l, s]) => { const c = chgAgo(p, s); return `<span class="${c >= 0.005 ? "u" : c <= -0.005 ? "d" : ""}"><small>${l}</small>${c >= 0 ? "+" : ""}${c.toFixed(1)}%</span>`; }).join("");
const feedHtml = (p) => { const now = S.now || Date.now() / 1000; return (p.trades || []).slice(-8).reverse().map((t) => `<span class="${t.buy ? "b" : "s"}${isFol(t.who) ? " fol" : ""}"${t.who ? ` data-trader="${t.who}"` : ""}>${t.who ? avatar(t.who, 18) : "<i></i>"}<em>${t.who ? esc(uname(t.who)) : ""}</em>${t.buy ? "+" : "-"}$${usd(t.usdc)}<small>${agoS(now - (t.ts || now))}</small></span>`).join("") || `<span class="none">Waiting for the first trade…</span>`; };
function tradePanel(p) {
  const side = S.side || "buy", m = p.mk, hasW = !!S.me;
  return `<div class="panel cyber" data-testid="trade-panel">
    <div class="cy-top"><span class="cy-live"><i></i>Market open</span><span>Uniswap v3</span></div>
    <div class="cy-toggle" role="tablist"><button type="button" data-side="buy" aria-selected="${side === "buy"}">Buy</button><button type="button" data-side="sell" aria-selected="${side === "sell"}">Sell</button></div>
    <label class="cy-lab" for="tamt">${side === "buy" ? "You pay" : "You sell"}</label>
    <div class="field-amt cy-field"><input id="tamt" type="number" inputmode="decimal" min="0" step="any" placeholder="0" data-testid="trade-amount"><span class="u">${side === "buy" ? "USDC" : esc(p.q.symbol)}</span></div>
    ${side === "buy" ? `<div class="tx-q tx-amts">${[5, 10, 25, 50, 100].map((v) => `<button type="button" data-amt="${v}">$${v}</button>`).join("")}<button type="button" data-pct="100">Max</button></div>` : `<div class="tx-q">${[25, 50, 100].map((v) => `<button type="button" data-pct="${v}">${v === 100 ? "Max" : v + "%"}</button>`).join("")}</div>`}
    <div class="under"><span>Balance ${!hasW ? "–" : side === "buy" ? `${p.lc ? lcMeBal().usdc.toLocaleString("en-US", { maximumFractionDigits: 2 }) : usd(S.usdc)} USDC` : `${tok(p.u.balance)} ${esc(p.q.symbol)}`}</span><span class="tx-slip">Slippage ${[0.5, 1, 2].map((v) => `<button type="button" data-slip="${v}" aria-pressed="${(S.slip || 1) === v}">${v}%</button>`).join("")}</span></div>
    <div class="lines cy-sum"><div><span>You receive</span><b id="tout">–</b></div><div><span>Minimum you'll get</span><b id="tmin">–</b></div><div><span>Price impact</span><b id="timp">–</b></div><div><span>Pool fee</span><b>0.3%</b></div></div>
    ${hasW ? `<button class="btn btn-cyber btn-block tp-${side}" data-act="swap" data-testid="swap">${side === "buy" ? `Buy ${esc(p.q.symbol)}` : `Sell ${esc(p.q.symbol)}`}</button>` : `<button class="btn btn-cyber btn-block" data-act="connect">Connect wallet to ${side === "buy" ? "buy" : "sell"}</button>`}
    <label class="cy-1tap"><input type="checkbox" data-onetap ${oneTap() ? "checked" : ""}><span>One-tap buy: quick amounts buy instantly</span></label>
    <p class="cy-fine">Trades go straight to the Uniswap pool. Holdfast never holds your funds.</p>
  </div>`;
}
let quoteT = 0;
function bindTrade(p) {
  const el = $("#tamt"); if (!el || !p.mk) return;
  el.oninput = () => { clearTimeout(quoteT); quoteT = setTimeout(() => quote(p), 250); };
  document.querySelectorAll("[data-pct]").forEach((b) => (b.onclick = () => { if (!S.me) return; const side = S.side || "buy", bal = side === "buy" ? (p.lc ? BigInt(Math.floor(lcMeBal().usdc * 1e6)) : S.usdc) : p.u.balance, d = side === "buy" ? 6 : 18;
    const v = (bal * BigInt(b.dataset.pct)) / 100n; el.value = formatUnits(v, d).replace(/(\.\d{0,6})\d*$/, "$1"); el.oninput(); }));
  document.querySelectorAll("[data-amt]").forEach((b) => (b.onclick = () => { el.value = b.dataset.amt; el.oninput(); if (oneTap() && S.me) { clearTimeout(quoteT); quote(p).then(() => document.querySelector("[data-act=swap]")?.click()); } }));
  document.querySelectorAll("[data-slip]").forEach((b) => (b.onclick = () => { S.slip = Number(b.dataset.slip); document.querySelectorAll("[data-slip]").forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
}
async function quote(p) {
  if (!S.me) return;
  if (p.lc) return lcQuoteUi(p);
  const side = S.side || "buy", raw = $("#tamt")?.value;
  let amt = 0n; try { amt = parseUnits(raw || "0", side === "buy" ? 6 : 18); } catch {}
  if (amt <= 0n) { $("#tout").textContent = "–"; $("#timp").textContent = "–"; if ($("#tmin")) $("#tmin").textContent = "–"; S.quote = null; return; }
  try {
    const { result } = await pub.simulateContract({ address: CONFIG.quoter, abi: QUOTER_ABI, functionName: "quoteExactInputSingle",
      args: [{ tokenIn: side === "buy" ? CONFIG.usdc : p.address, tokenOut: side === "buy" ? p.address : CONFIG.usdc, amountIn: amt, fee: 3000, sqrtPriceLimitX96: 0n }] });
    const out = result[0]; S.quote = { amt, out, side };
    $("#tout").textContent = side === "buy" ? `${tok(out)} ${p.q.symbol}` : `${usd(out)} USDC`;
    { const mn = (out * BigInt(Math.round(10000 - (S.slip || 1) * 100))) / 10000n; if ($("#tmin")) $("#tmin").textContent = side === "buy" ? `${tok(mn)} ${p.q.symbol}` : `${usd(mn)} USDC`; }
    const exec = side === "buy" ? (Number(amt) / 1e6) / (Number(out) / 1e18) : (Number(out) / 1e6) / (Number(amt) / 1e18);
    const imp = Math.abs(exec - p.mk.price) / p.mk.price * 100;
    $("#timp").textContent = `${imp.toFixed(2)}%`; $("#timp").classList.toggle("warn", imp > 5); S.quote.imp = imp;
  } catch { $("#tout").textContent = "Not enough liquidity"; S.quote = null; }
}
async function swap(p) {
  if (p.lc) return swapLc(p);
  await quote(p);
  const q = S.quote; if (!q) return toast("Enter an amount to trade.", true);
  const tokenIn = q.side === "buy" ? CONFIG.usdc : p.address, tokenOut = q.side === "buy" ? p.address : CONFIG.usdc;
  const bal = q.side === "buy" ? S.usdc : p.u.balance;
  if (bal < q.amt) return toast("Not enough balance.", true);
  const ik = `${q.side}:${q.amt}`; if (q.imp > 5 && S.impKey !== ik) { S.impKey = ik; const b = $('[data-testid="swap"]'); b.textContent = `Confirm: moves the price ${q.imp.toFixed(1)}%`; b.classList.add("tx-danger"); return toast(`High price impact (${q.imp.toFixed(1)}%). Tap again to confirm.`, true); }
  const allowance = await pub.readContract({ address: tokenIn, abi: erc20Abi, functionName: "allowance", args: [S.me, CONFIG.swapRouter] });
  const labels = [], fns = [];
  if (allowance < q.amt) { labels.push(q.side === "buy" ? "Allow your USDC" : `Allow your ${p.q.symbol}`); fns.push(() => S.wallet.writeContract({ address: tokenIn, abi: erc20Abi, functionName: "approve", args: [CONFIG.swapRouter, q.amt] })); }
  labels.push(q.side === "buy" ? `Buy ${p.q.symbol}` : `Sell ${p.q.symbol}`);
  fns.push(() => S.wallet.writeContract({ address: CONFIG.swapRouter, abi: ROUTER_ABI, functionName: "exactInputSingle",
    args: [{ tokenIn, tokenOut, fee: 3000, recipient: S.me, amountIn: q.amt, amountOutMinimum: (q.out * BigInt(Math.round(10000 - (S.slip || 1) * 100))) / 10000n, sqrtPriceLimitX96: 0n }] }));
  const ok = await flow(q.side === "buy" ? "Buy" : "Sell", labels, fns, "Trade done");
  if (ok) { offerShare(p, q.side, (Number(q.amt) / (q.side === "buy" ? 1e6 : 1e18) * (q.side === "buy" ? 1 : p.mk.price)).toFixed(2)); await refresh(); await loadTrades(p); const h = posBox(p), el = $("#tx-pos"); if (el) el.outerHTML = h; else if (h) $(".term-side")?.insertAdjacentHTML("afterbegin", h); S.impKey = ""; }
}

// ================================================================= terminal de trading y Market
const PERIODS = { "1m": [3600, 60], "5m": [6 * 3600, 300], "15m": [12 * 3600, 900], "1H": [3 * 86400, 3600], "4H": [14 * 86400, 14400], "1D": [60 * 86400, 86400], "1W": [365 * 86400, 604800], All: [0, 0] };
function buildCandles(p, period) {
  const tr = (p.trades || []).filter((t) => t.ts), now = S.now || Math.floor(Date.now() / 1000);
  let [span, step] = PERIODS[period] || PERIODS["5m"];
  const first = tr.length ? tr[0].ts : now - 3600;
  if (period === "All") { span = Math.max(3600, now - first + 60); step = Math.max(60, Math.ceil(span / 40)); }
  const start = period === "All" ? now - span : Math.max(now - span, (tr.length ? tr[0].ts : now) - step * 12), out = [];
  let last = p.mk.round;
  for (const t of tr) if (t.ts < start) last = t.price;
  for (let b = start - (start % step); b <= now; b += step) {
    const inB = tr.filter((t) => t.ts >= b && t.ts < b + step);
    const o = last, prices = inB.map((t) => t.price), c = prices.length ? prices[prices.length - 1] : last;
    out.push({ t: b, o, c, h: Math.max(o, c, ...prices), l: Math.min(o, c, ...prices), v: inB.reduce((a, t) => a + Number(t.usdc) / 1e6, 0) });
    last = c;
  }
  return out;
}
function candlesSvg(p, period) {
  const cs = buildCandles(p, period), W = 800, H = 320, VH = 54, PH = H - VH - 8;
  const hi = Math.max(...cs.map((c) => c.h), p.mk.round, p.mk.price) * 1.03, lo = Math.min(...cs.map((c) => c.l), p.mk.round, p.mk.price) * 0.97;
  const y = (v) => PH - ((v - lo) / (hi - lo || 1)) * PH, bw = W / cs.length, vmax = Math.max(...cs.map((c) => c.v), 0.0001);
  const grid = [0.25, 0.5, 0.75].map((k) => `<line x1="0" x2="${W}" y1="${PH * k}" y2="${PH * k}" class="cd-grid"/>`).join("");
  const vols = cs.map((c, i) => c.v ? `<rect x="${i * bw + bw * 0.2}" y="${H - (c.v / vmax) * VH}" width="${bw * 0.6}" height="${(c.v / vmax) * VH}" class="cd-vol"/>` : "").join("");
  const body = cs.map((c, i) => {
    const up = c.c >= c.o, x = i * bw + bw / 2, top = y(Math.max(c.o, c.c)), hgt = Math.max(2, Math.abs(y(c.o) - y(c.c))), flat = c.o === c.c && c.h === c.l;
    if (flat) return `<line x1="${x - bw * 0.3}" x2="${x + bw * 0.3}" y1="${y(c.c)}" y2="${y(c.c)}" class="cd-flat"/>`;
    return `<line x1="${x}" x2="${x}" y1="${y(c.h)}" y2="${y(c.l)}" class="wick"/><rect x="${x - bw * 0.3}" y="${top}" width="${bw * 0.6}" height="${hgt}" rx="1.5" class="body ${up ? "up" : "dn"}"/>`;
  }).join("");
  const line = cs.map((c, i) => `${i ? "L" : "M"}${(i * bw + bw / 2).toFixed(1)} ${y(c.c).toFixed(1)}`).join(" ");
  const yp = y(p.mk.price), ticks = [hi, (hi + lo) / 2, lo].map((v) => `<span style="top:${(y(v) / H) * 100}%">${fmtP(v)}</span>`).join("");
  return `<div class="cd-wrap"><svg class="cd" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Candlestick chart">
    <defs><linearGradient id="cdA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ddc97" stop-opacity=".28"/><stop offset="1" stop-color="#3ddc97" stop-opacity="0"/></linearGradient>
      <linearGradient id="cdB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ddc97"/><stop offset="1" stop-color="#3ddc97"/></linearGradient></defs>
    ${grid}<path d="${line} L${W - bw / 2} ${PH} L${bw / 2} ${PH}Z" fill="url(#cdA)"/>${vols}
    <line x1="0" x2="${W}" y1="${y(p.mk.round)}" y2="${y(p.mk.round)}" class="cd-round"/>${body}<path d="${line}" class="cd-line"/>
    <line x1="0" x2="${W}" y1="${yp}" y2="${yp}" class="cd-now"/></svg>
    <div class="cd-y">${ticks}<em class="cd-tag" style="top:${(yp / H) * 100}%">${fmtP(p.mk.price)}</em></div></div>`;
}
function spark(p) {
  if (!p.mk) return "";
  const pts = [p.mk.round, ...(p.trades || []).map((t) => t.price)]; if (pts.length < 2) pts.push(p.mk.price);
  const lo = Math.min(...pts), hi = Math.max(...pts), W = 120, H = 36;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * W).toFixed(1)} ${(H - ((v - lo) / (hi - lo || 1)) * H).toFixed(1)}`).join(" ");
  const ly = (H - ((pts[pts.length - 1] - lo) / (hi - lo || 1)) * H).toFixed(1), id = "sg" + Math.random().toString(36).slice(2, 7);
  return `<svg class="spark" viewBox="-2 -4 ${W + 6} ${H + 8}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ddc97" stop-opacity=".35"/><stop offset="1" stop-color="#3ddc97" stop-opacity="0"/></linearGradient></defs><path class="sa" d="${d} L${W} ${H} L0 ${H}Z" style="fill:url(#${id});stroke:none;filter:none"/><path d="${d}"/><circle cx="${W}" cy="${ly}" r="2.6" class="spark-dot"/></svg>`;
}
const vol24 = (p) => (p.trades || []).filter((t) => t.ts > (S.now || 0) - 86400).reduce((a, t) => a + t.usdc, 0n);
async function loadHolders(p) {
  if (p.lc) { holdersLc(p); return; }
  // Sin recorrer todo el historial: saldos de las direcciones conocidas (inversores, operadores del pool y cuentas del proyecto).
  try {
    const set = new Set([p.s.pool, p.address, CONFIG.platform, p.q.creator, ...Object.keys(p.order || {}), ...(p.trades || []).map((t) => t.who)].filter(Boolean).map((a) => a.toLowerCase()));
    const addrs = [...set];
    const [bals, sup] = await Promise.all([
      pub.multicall({ contracts: addrs.map((a) => ({ address: p.address, abi: erc20Abi, functionName: "balanceOf", args: [a] })) }),
      pub.readContract({ address: p.address, abi: erc20Abi, functionName: "totalSupply" })]);
    p.holders = addrs.map((a, i) => ({ a, b: bals[i].result || 0n })).filter((x) => x.b > 0n).sort((x, y) => (y.b > x.b ? 1 : -1)).slice(0, 12);
    p.supply = sup;
  } catch (e) { console.error("holders", e?.shortMessage || e?.message); p.holders = []; }
}
function holderLabel(p, a) {
  const l = a.toLowerCase();
  if (l === p.s.pool.toLowerCase()) return "Uniswap pool";
  if (l === p.address.toLowerCase()) return "Project contract";
  if (l === CONFIG.platform.toLowerCase()) return "Holdfast fee";
  if (l === p.q.creator.toLowerCase()) return "Team";
  return "";
}
function depthRows(p) {
  const Ru = Number(p.mk.poolUsdc) / 1e6, Rt = Number(p.mk.poolTok) / 1e18, price = p.mk.price;
  return [1, 5, 10].map((f) => {
    const k = f / 100, buy = Ru * (Math.sqrt(1 + k) - 1), sellTok = Rt * (1 / Math.sqrt(1 - k) - 1), sell = sellTok * price * Math.sqrt(1 - k);
    return `<li><span>${f}%</span><b class="up">$${buy.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b><b class="dn">$${sell.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b></li>`;
  }).join("");
}
function termTab(p) {
  const t = S.ttab || "trades";
  if (t === "heat") return heatHtml(p);
  if (t === "chat") return chatHtml(p);
  if (t === "holders") return p.holders ? (p.holders.length ? `${(() => { const sup = Math.max(p.supply ? Number(p.supply) : 0, p.holders.reduce((s, h) => s + Number(h.b), 0)), pc = (h) => (sup ? (Number(h.b) / sup) * 100 : 0), wallets = p.holders.filter((h) => !holderLabel(p, h.a) || holderLabel(p, h.a) === "Team"), top10 = wallets.slice(0, 10).reduce((s, h) => s + pc(h), 0), mx = Math.max(...p.holders.map(pc), 1);
      return `<div class="hd-sum"><div><small>Holders</small><b>${wallets.length}</b></div><div><small>Top 10 hold</small><b>${top10.toFixed(1)}%</b></div><div><small>Biggest wallet</small><b>${Math.max(0, ...wallets.map(pc)).toFixed(1)}%</b></div></div><ul class="hold hd">${p.holders.map((h, i) => { const lb = holderLabel(p, h.a), me = S.me && h.a.toLowerCase() === S.me.toLowerCase(), pct = pc(h), big = !lb && pct > 10;
        return `<li${me ? ' class="me"' : ""}><span class="rk">${i + 1}</span>${avatar(h.a, 34)}<div class="hd-n"><b>${lb === "Uniswap pool" ? "Liquidity pool" : lb && lb !== "Team" ? lb : esc(uname(h.a))}${me ? ' <em class="th-tag">You</em>' : ""}${lb === "Team" ? ' <em class="th-tag c">Creator</em>' : ""}${lb === "Uniswap pool" ? ' <em class="th-tag">🔒 Locked</em>' : ""}${big ? ' <em class="th-tag w">Whale</em>' : ""}</b><span class="hd-b"><i style="width:${Math.max(2, (pct / mx) * 100)}%"></i></span></div><b class="hd-p">${pct.toFixed(2)}%</b></li>`; }).join("")}</ul>`; })()}` : `<p class="prose">No holders yet.</p>`) : `<p class="prose">Loading holders…</p>`;
  if (t === "depth") return `<p class="fine" style="margin:0 0 12px">How much it takes to move the price. Small pools move fast: check before large trades.</p>
    <ul class="depth"><li class="dh"><span>Move</span><b>Buy to push up</b><b>Sell to push down</b></li>${depthRows(p)}</ul>`;
  if (t === "mine" && !S.me) return `<p class="prose">Connect your wallet to see your trades.</p>`;
  if (t === "top") return boardHtml(p);
  if (t === "whales") { const wl = (p.trades || []).filter((x) => isWhale(p, x)).slice(-15).reverse();
    return `<p class="fine" style="margin:0 0 12px">Trades of $${whaleMin(p).toFixed(0)} or more (5% of the pool). Big buys can push the price up; big sells can push it down.</p>` + (wl.length ? `<ul class="cy-trades whales">${wl.map((x) => `<li><span class="${x.buy ? "b" : "s"}">${ICO.whale} ${x.buy ? "Buy" : "Sell"}</span><span class="addr who">${x.who ? esc(uname(x.who)) : "–"}</span><span>$${usd(x.usdc)}</span><span>${fmtP(x.price)}</span><span class="faint">${ago((p.tHead || 0n) - x.block)}</span></li>`).join("")}</ul>` : `<p class="prose">No big trades yet.</p>`); }
  const tr = (p.trades || []).filter((x) => t !== "mine" || x.who?.toLowerCase() === S.me.toLowerCase()).slice(-(S.trN || 10)).reverse();
  const more = (p.trades || []).length > (S.trN || 10) && t === "trades";
  if (t === "mine" && !tr.length) return `<p class="prose">You haven't traded ${esc(p.q.symbol)} yet.</p>`;
  return tr.length ? `<ul class="cy-trades">${tr.map((x) => `<li class="${isWhale(p, x) ? "wh" : ""}"><span class="${x.buy ? "b" : "s"}">${isWhale(p, x) ? ICO.whale + " " : ""}${x.buy ? "Buy" : "Sell"}</span><span>${tok(x.tok)} ${esc(p.q.symbol)}</span><span>$${usd(x.usdc)}</span><span>${fmtP(x.price)}</span><span class="faint">${ago((p.tHead || 0n) - x.block)}</span></li>`).join("")}</ul>${more ? `<button type="button" class="btn btn-line btn-sm tx-trmore" data-trmore>Show more</button>` : ""}` : `<p class="prose">No trades yet. Be the first.</p>`;
}
// íconos dibujados con código (sin emojis)
const ICO = {
  whale: `<svg class="ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13c0 3.3 3.6 6 8 6 4.6 0 8-3 8-7.5V9l2.5-2.5M19 9c-1 0-2-.6-2.5-1.5"/><path d="M3 13c2.5 0 4.5-1 6-3"/><circle cx="14.5" cy="12.5" r=".6" fill="currentColor"/></svg>`,
  lock: `<svg class="ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  shield: `<svg class="ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/></svg>`,
  flame: `<svg class="ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.6 3-5.4 3.5-9 2 1.3 3.2 3 3.4 5 1-.7 1.6-1.8 1.8-3 2 1.6 4.3 4 4.3 7 0 3.4-2.6 6-6.5 6z"/></svg>`,
  share: `<svg class="ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>`,
};
const whaleMin = (p) => Math.max(25, (Number(p.mk?.poolUsdc || 0n) / 1e6) * 0.05); // compra/venta >= 5% del pool
const isWhale = (p, t) => Number(t.usdc) / 1e6 >= whaleMin(p);
async function pnlCard(p) {
  const x = myPos(p); if (!pnlReady(p, x)) return toast("Make a winning trade first.", true); const up = x.pnl >= 0, col = up ? "#3ddc97" : "#ff5d5d", W = 1200, H = 675;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  g.fillStyle = "#09090b"; g.fillRect(0, 0, W, H);
  const img = logoSrc(p) && await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = logoSrc(p); });
  if (img) { g.save(); g.globalAlpha = .55; const s = H; g.drawImage(img, W - s, 0, s, s); g.restore(); const fade = g.createLinearGradient(W - H, 0, W - H * .35, 0); fade.addColorStop(0, "#09090b"); fade.addColorStop(1, "rgba(9,9,11,0)"); g.fillStyle = fade; g.fillRect(W - H, 0, H, H); }
  const glow = g.createRadialGradient(260, 380, 20, 260, 380, 520); glow.addColorStop(0, up ? "rgba(232,80,143,.22)" : "rgba(143,107,232,.22)"); glow.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
  g.fillStyle = "#fff"; g.font = "600 44px 'Inter Tight', sans-serif"; g.fillText(`$${p.q.symbol}`, 70, 110);
  g.fillStyle = "#8d8f95"; g.font = "400 26px 'Inter Tight', sans-serif"; g.fillText(p.q.name, 70, 150);
  g.shadowColor = col; g.shadowBlur = 40; g.fillStyle = col; g.font = "800 150px 'Inter Tight', sans-serif"; g.fillText(`${x.pct >= 0 ? "+" : ""}${x.pct.toFixed(1)}%`, 60, 345); g.shadowBlur = 0;
  g.fillStyle = "#fff"; g.font = "600 52px 'Inter Tight', sans-serif"; g.fillText(`${up ? "+" : "-"}$${Math.abs(x.pnl).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, 70, 425);
  g.fillStyle = "#8d8f95"; g.font = "400 24px 'Inter Tight', sans-serif"; g.fillText("Holding", 70, 500); g.fillText("Worth today", 360, 500); g.fillText("Price now", 650, 500);
  g.fillStyle = "#fff"; g.font = "600 30px 'Inter Tight', sans-serif"; g.fillText(`${x.bal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, 70, 540); g.fillText(`$${x.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`, 360, 540); g.fillText(fmtP(p.mk.price), 650, 540);
  g.fillStyle = "#fff"; g.font = "600 30px 'Inter Tight', sans-serif"; g.fillText("Holdfast", 70, 620); g.fillStyle = "#6f6d72"; g.font = "400 22px 'Inter Tight', sans-serif"; g.fillText("Back it. Hold it. Trade it.", 220, 620);
  const url = c.toDataURL("image/png"), ov = document.createElement("div"); ov.className = "pnl-ov";
  ov.innerHTML = `<div class="pnl-box"><img src="${url}" alt="Your PnL card"><div class="pnl-act"><button type="button" class="btn btn-ember" data-pshare>Share</button><button type="button" class="btn btn-line" data-pdl>Download</button><button type="button" class="btn btn-line" data-px>Close</button></div></div>`;
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add("on"));
  const close = () => { ov.classList.remove("on"); setTimeout(() => ov.remove(), 250); };
  ov.onclick = async (e) => { if (e.target === ov || e.target.closest("[data-px]")) return close();
    if (e.target.closest("[data-pdl]") || e.target.closest("[data-pshare]")) { const blob = await (await fetch(url)).blob(), file = new File([blob], `${p.q.symbol}-pnl.png`, { type: "image/png" });
      if (e.target.closest("[data-pshare]")) { try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `My ${p.q.symbol} on Holdfast` }); return; } } catch { return; } }
      const l = document.createElement("a"); l.href = url; l.download = file.name; l.click(); toast("Image saved"); } };
}
async function shareToken(p) {
  const W = 1200, H = 630, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), st = stats24(p), up = st.chg >= 0;
  x.fillStyle = "#0b0b0d"; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W * 0.8, H, 50, W * 0.8, H, 700); g.addColorStop(0, up ? "rgba(232,80,143,.28)" : "rgba(143,107,232,.28)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const img = logoSrc(p) && await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = logoSrc(p); });
  if (img) { x.save(); x.beginPath(); x.arc(110, 110, 50, 0, Math.PI * 2); x.clip(); x.drawImage(img, 60, 60, 100, 100); x.restore(); x.strokeStyle = "rgba(255,255,255,.25)"; x.lineWidth = 2; x.beginPath(); x.arc(110, 110, 51, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = "#fff"; x.font = "600 48px 'Inter Tight', sans-serif"; x.fillText(`${p.q.symbol} / USDC`, 185, 105);
  x.fillStyle = "#8d8f95"; x.font = "400 26px 'Inter Tight', sans-serif"; x.fillText(p.q.name, 185, 145);
  x.fillStyle = "#fff"; x.font = "700 92px 'Inter Tight', sans-serif"; x.fillText(fmtP(p.mk.price), 60, 300);
  x.fillStyle = up ? "#3ddc97" : "#ff5d5d"; x.font = "600 40px 'Inter Tight', sans-serif"; x.fillText(`${up ? "+" : ""}${st.chg.toFixed(2)}% 24h`, 60, 360);
  const cs = buildCandles(p, "5m"), lo = Math.min(...cs.map((k) => k.l)), hi = Math.max(...cs.map((k) => k.h)), cw = 560 / cs.length;
  cs.forEach((k, i) => { const yy = (v) => 560 - ((v - lo) / (hi - lo || 1)) * 300, X = 600 + i * cw + cw / 2, col = k.c >= k.o ? "#3ddc97" : "#ff5d5d";
    x.strokeStyle = col; x.lineWidth = 1.5; x.beginPath(); x.moveTo(X, yy(k.h)); x.lineTo(X, yy(k.l)); x.stroke(); x.fillStyle = col; const t = yy(Math.max(k.o, k.c)); x.fillRect(X - Math.max(1.5, cw * 0.25), t, Math.max(3, cw * 0.5), Math.max(2, Math.abs(yy(k.o) - yy(k.c)))); });
  x.fillStyle = "#8d8f95"; x.font = "400 24px 'Inter Tight', sans-serif"; x.fillText(`Liquidity $${usd(p.mk.poolUsdc)}  ·  Volume 24h $${usd(st.vol)}`, 60, 520);
  x.fillStyle = "#fff"; x.font = "600 30px 'Inter Tight', sans-serif"; x.fillText("Holdfast", 60, 585); x.fillStyle = "#77757a"; x.font = "400 22px 'Inter Tight', sans-serif"; x.fillText("Back it. Hold it. Trade it.", 210, 585);
  const blob = await new Promise((r) => c.toBlob(r, "image/png")), file = new File([blob], `${p.q.symbol}-holdfast.png`, { type: "image/png" });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${p.q.symbol} on Holdfast` }); return; } } catch { return; }
  const a2 = document.createElement("a"); a2.href = URL.createObjectURL(blob); a2.download = file.name; a2.click(); toast("Image saved");
}
function stats24(p) {
  if (!p.mk) return { chg: 0, hi: 0, lo: 0, vol: 0n, cap: 0 };
  const now = S.now || Date.now() / 1000, tr = (p.trades || []).filter((t) => t.ts), day = tr.filter((t) => t.ts > now - 86400), before = tr.filter((t) => t.ts <= now - 86400);
  const open = before.length ? before[before.length - 1].price : p.mk.round, ps = day.map((t) => t.price);
  return { chg: ((p.mk.price - open) / open) * 100, hi: Math.max(p.mk.price, ...ps), lo: Math.min(p.mk.price, ...ps), vol: vol24(p), cap: p.supply ? p.mk.price * (Number(p.supply) / 1e18) : 0 };
}
const favs = () => { try { return JSON.parse(localStorage.getItem("hf-fav") || "[]"); } catch { return []; } };
const health = (p) => { const u = Number(p.mk.poolUsdc) / 1e6; return u >= 10000 ? ["Healthy", "ok"] : u >= 1000 ? ["Medium", "mid"] : ["Thin: prices move fast", "low"]; };
function traderBoard(p, per) {
  const now = S.now || Date.now() / 1000, since = per === "day" ? now - 86400 : per === "week" ? now - 7 * 86400 : 0, m = {};
  for (const t of (p.trades || []).filter((x) => x.who && x.ts >= since)) { const k = t.who.toLowerCase(), r = (m[k] ||= { a: k, spent: 0, got: 0, buys: 0, sells: 0, tok: 0, best: 0, cost: 0 }), u = Number(t.usdc) / 1e6, q = Number(t.tok) / 1e18;
    if (t.buy) { r.spent += u; r.buys++; r.tok += q; r.cost += u; } else { r.got += u; r.sells++; r.tok -= q; const avg = r.cost && r.tok + q > 0 ? r.cost / (r.tok + q) : 0; if (avg) r.best = Math.max(r.best, u - avg * q); } }
  const ex = new Set([p.s.pool, p.address, CONFIG.platform].filter(Boolean).map((x) => x.toLowerCase()));
  return Object.values(m).filter((r) => !ex.has(r.a) && r.spent > 0).map((r) => { const val = Math.max(0, r.tok) * p.mk.price, pnl = val + r.got - r.spent; return { ...r, val, pnl, pct: (pnl / r.spent) * 100 }; }).sort((x, y) => y.pnl - x.pnl).slice(0, 10);
}
function boardHtml(p) {
  const per = S.bper || "all", l = traderBoard(p, per);
  return `<div class="lb-tabs">${[["day", "Today"], ["week", "Week"], ["all", "All time"]].map(([k, t]) => `<button type="button" data-bper="${k}" aria-selected="${per === k}">${t}</button>`).join("")}${S.me ? `<button type="button" class="lb-me" data-prof>Edit my profile</button>` : ""}</div>
    ${l.length ? `<ol class="lb">${l.map((r, i) => `<li><button type="button" data-trader="${r.a}"><span class="rk">${i + 1}</span>${avatar(r.a, 34)}<span class="nm">${esc(uname(r.a))}<small>${short(r.a)}</small></span><b class="${r.pnl >= 0 ? "u" : "d"}">${r.pnl >= 0 ? "+" : "-"}$${Math.abs(r.pnl).toLocaleString("en-US", { maximumFractionDigits: 2 })}</b><em class="${r.pct >= 0 ? "u" : "d"}">${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(0)}%</em></button></li>`).join("")}</ol>` : `<p class="prose">No trades in this period yet.</p>`}`;
}
const loadImg = (src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });
async function traderPng(p, r, rank, opt = {}) {
  try { await document.fonts.load("700 60px 'Space Grotesk'"); await document.fonts.load("600 60px 'JetBrains Mono'"); } catch {}
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  const up = r.pnl >= 0, col = up ? "#ff4fa3" : "#8f6bff", F = "'Space Grotesk', sans-serif", M = "'JetBrains Mono', monospace", rr = (x, y, w, h, k) => { g.beginPath(); g.roundRect(x, y, w, h, k); };
  // marco blanco + tarjeta negra
  g.fillStyle = "#f4f4f1"; g.fillRect(0, 0, W, H); g.fillStyle = "#050506"; rr(24, 24, W - 48, 1020, 56); g.fill();
  // token
  const lg = logoSrc(p), tx = 76, ty = 76; g.save(); rr(tx, ty, 112, 112, 56); g.clip(); let ok = false;
  if (lg) { try { const im = await loadImg(lg); g.drawImage(im, tx, ty, 112, 112); ok = true; } catch {} }
  if (!ok) { g.fillStyle = p.meta?.color || "#222"; g.fillRect(tx, ty, 112, 112); g.fillStyle = "#fff"; g.font = `700 44px ${F}`; g.textAlign = "center"; g.fillText(p.q.symbol.slice(0, 2), tx + 56, ty + 70); }
  g.restore(); g.textAlign = "left"; g.fillStyle = "#f4f4f1"; g.font = `700 64px ${F}`; g.fillText(p.q.symbol, 220, 140); g.fillStyle = "#77777e"; g.font = `500 36px ${F}`; g.fillText(p.q.name.slice(0, 24), 220, 188);
  g.textAlign = "right"; g.fillStyle = "#5a5a62"; g.font = `500 32px ${F}`; g.fillText(new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }), W - 76, 140); g.textAlign = "left";
  // gráfico de línea del token con las compras del trader
  const all = (p.trades || []).filter((t) => t.ts && t.price).sort((x, y) => x.ts - y.ts), mine = all.filter((t) => t.who && t.who.toLowerCase() === r.a.toLowerCase());
  const btokAll = mine.filter((t) => t.buy).reduce((s2, t) => s2 + Number(t.tok) / 1e18, 0), cx0 = 48, cx1 = W - 48, cy0 = 270, cy1 = 700, pts = all.length ? all : [{ ts: 0, price: p.mk.price }, { ts: 1, price: p.mk.price }];
  const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts || t0 + 1, ps = pts.map((t) => t.price), lo = Math.min(...ps), hi = Math.max(...ps), X = (t) => cx0 + ((t - t0) / (t1 - t0 || 1)) * (cx1 - cx0 - 40), Y = (v) => cy1 - ((v - lo) / (hi - lo || 1)) * (cy1 - cy0 - 70) - 20;
  const gr = g.createLinearGradient(0, cy0, 0, cy1); gr.addColorStop(0, up ? "rgba(255,79,163,.30)" : "rgba(143,107,255,.30)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  const path = () => { g.beginPath(); pts.forEach((t, i) => (i ? g.lineTo(X(t.ts), Y(t.price)) : g.moveTo(X(t.ts), Y(t.price)))); };
  path(); g.lineTo(X(t1), cy1 + 10); g.lineTo(X(t0), cy1 + 10); g.closePath(); g.fillStyle = gr; g.fill();
  path(); g.strokeStyle = col; g.lineWidth = 9; g.lineJoin = "round"; g.lineCap = "round"; g.shadowColor = col; g.shadowBlur = 24; g.stroke(); g.shadowBlur = 0;
  const mk6 = [...mine].sort((x, y) => Number(y.usdc) - Number(x.usdc)).slice(0, 6); for (const t of mine.filter((q) => mk6.includes(q) || mine.length <= 6)) { const x = X(t.ts), y = Y(t.price), mc = t.buy ? "#ff4fa3" : "#8f6bff"; g.fillStyle = mc; g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill(); g.strokeStyle = "#050506"; g.lineWidth = 6; g.stroke(); g.strokeStyle = "#16040e"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x + 12, y); if (t.buy) { g.moveTo(x, y - 12); g.lineTo(x, y + 12); } g.stroke(); }
  { const avgP = r.spent && btokAll ? r.spent / btokAll : 0; if (avgP > 0 && avgP >= lo && avgP <= hi) { const ey = Y(avgP); g.setLineDash([10, 10]); g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx0 + 150, ey); g.lineTo(cx1, ey); g.stroke(); g.setLineDash([]); g.fillStyle = "#f4f4f1"; rr(cx0 + 16, ey - 24, 124, 48, 24); g.fill(); g.fillStyle = "#09090b"; g.font = `700 26px ${F}`; g.textAlign = "center"; g.fillText("Entry", cx0 + 78, ey + 9); g.textAlign = "left"; } }
  { const lt = opt.last ? { buy: opt.last.buy, usd: Number(opt.last.usd) } : mine.length ? { buy: mine[mine.length - 1].buy, usd: Number(mine[mine.length - 1].usdc) / 1e6 } : null;
    if (lt) { g.fillStyle = "#9a9aa2"; g.font = `500 32px ${F}`; g.textAlign = "left"; g.fillText(`${lt.buy ? "Bought" : "Sold"} $${lt.usd.toLocaleString("en-US", { maximumFractionDigits: 2 })} of ${p.q.symbol}`, 72, 236); } }
  // caja de posición
  g.fillStyle = "#0e0e11"; rr(64, 720, W - 128, 312, 40); g.fill(); g.strokeStyle = "#1f1f25"; g.lineWidth = 2; g.stroke();
  const pr = S.prof?.[r.a.toLowerCase()], ax = 300, ay = 776, AR = 40; g.save(); g.beginPath(); g.arc(ax, ay, AR, 0, 7); g.clip(); let d2 = false;
  if (pr?.photo) { try { const im = await loadImg(pr.photo); const sc = Math.max(2 * AR / im.width, 2 * AR / im.height); g.drawImage(im, ax - im.width * sc / 2, ay - im.height * sc / 2, im.width * sc, im.height * sc); d2 = true; } catch {} }
  if (!d2) { const hh = parseInt(r.a.slice(2, 6), 16) % 360, ag = g.createLinearGradient(ax - AR, ay - AR, ax + AR, ay + AR); ag.addColorStop(0, `hsl(${hh} 70% 55%)`); ag.addColorStop(1, `hsl(${(hh + 140) % 360} 65% 45%)`); g.fillStyle = ag; g.fillRect(ax - AR, ay - AR, 2 * AR, 2 * AR); }
  g.restore(); g.fillStyle = "#f4f4f1"; g.font = `600 36px ${F}`; g.fillText(uname(r.a).slice(0, 16) + "'s", ax + 56, ay + 12); const nw = g.measureText(uname(r.a).slice(0, 16) + "'s").width; g.fillStyle = "#77777e"; g.fillText(" position", ax + 56 + nw, ay + 12);
  g.textAlign = "center"; g.fillStyle = col; g.font = `600 92px ${M}`; g.fillText(`${up ? "+" : "-"}$${Math.abs(r.pnl).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, W / 2 - 90, 900); g.fillStyle = "#f4f4f1"; g.font = `600 44px ${M}`; g.fillText(`${up ? "▲" : "▼"} ${Math.abs(r.pct).toFixed(2)}%`, W / 2 + 330, 896);
  // tres cifras
  const bt = mine.filter((t) => t.buy), btok = bt.reduce((s2, t) => s2 + Number(t.tok) / 1e18, 0), avg = btok ? r.spent / btok : p.mk.round, sup = p.supply ? Number(p.supply) / 1e18 : 1, mc = (v) => capFmt(v * sup);
  g.strokeStyle = "#1f1f25"; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 926); g.lineTo(W - 64, 926); g.moveTo(W / 3 + 21, 926); g.lineTo(W / 3 + 21, 1032); g.moveTo((W / 3) * 2 - 21, 926); g.lineTo((W / 3) * 2 - 21, 1032); g.stroke();
  [["Invested", "$" + (r.spent >= 1000 ? (r.spent / 1000).toFixed(1) + "K" : r.spent.toFixed(2))], ["Entry", mc(avg)], ["Current", mc(p.mk.price)]].forEach(([k, v], i) => { const x = 64 + ((W - 128) / 3) * (i + 0.5); g.fillStyle = "#77777e"; g.font = `500 28px ${F}`; g.fillText(k, x, 968); g.fillStyle = "#f4f4f1"; g.font = `600 38px ${M}`; g.fillText(v, x, 1012); });
  // pie
  g.textAlign = "left"; g.fillStyle = "#050506"; g.font = `700 76px ${F}`; g.fillText("Holdfast", 70, 1190); g.textAlign = "right"; g.fillStyle = "#6a6a72"; g.font = `500 34px ${F}`; g.fillText(`#${rank} on ${p.q.symbol}`, W - 70, 1190);
  return new Promise((ok2) => c.toBlob(ok2, "image/png"));
}
if (CONFIG.demo) window.__hf = { traderPng, traderBoard, S };
async function traderCard(p, addr, opt = {}) {
  const lc = String(addr).toLowerCase(), r = traderBoard(p, "all").find((x) => x.a.toLowerCase() === lc) || { a: lc, spent: 0, got: 0, buys: 0, sells: 0, tok: 0, best: 0, val: 0, pnl: 0, pct: 0 }, rank = traderBoard(p, "all").findIndex((x) => x.a.toLowerCase() === lc) + 1; 
  const ov = document.createElement("div"); ov.className = "pnl-ov";
  ov.innerHTML = `<div class="tc"><div class="tc-cover" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><button type="button" class="tc-x" data-px aria-label="Close">✕</button>
    <div class="tc-h">${avatar(r.a, 72)}<div><b>${esc(uname(r.a))}</b><small>${short(r.a)} · #${rank} on ${esc(p.q.symbol)}</small></div></div>
    <div class="tc-pnl ${r.pnl >= 0 ? "u" : "d"}">${r.pnl >= 0 ? "+" : "-"}$${Math.abs(r.pnl).toLocaleString("en-US", { maximumFractionDigits: 2 })}<span>${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(1)}%</span></div>
    <div class="tc-g"><div><span>Bought</span><b>$${r.spent.toFixed(2)}</b></div><div><span>Sold</span><b>$${r.got.toFixed(2)}</b></div><div><span>Trades</span><b>${r.buys + r.sells} (${r.buys} buy · ${r.sells} sell)</b></div>
      <div><span>Best sale</span><b>${r.best > 0 ? "+$" + r.best.toFixed(2) : "–"}</b></div><div><span>Holding now</span><b>${Math.max(0, r.tok).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${esc(p.q.symbol)}</b></div><div><span>Worth today</span><b>$${r.val.toFixed(2)}</b></div></div>
    <div class="tc-pos"><span>Position</span><b>${Math.max(0, r.tok).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${esc(p.q.symbol)} · $${r.val.toFixed(2)}</b></div>
    <div class="tc-act"><button type="button" class="btn btn-ember btn-sm" data-dl>Download image</button>${S.me && S.me.toLowerCase() === r.a.toLowerCase() ? "" : `<button type="button" class="btn btn-line btn-sm" data-fol>${isFol(r.a) ? "Following" : "Follow"}</button>`}<button type="button" class="btn btn-line btn-sm" data-sh>Share</button>${S.me && S.me.toLowerCase() === r.a.toLowerCase() ? `<button type="button" class="btn btn-soft btn-sm" data-ed>Edit my profile</button>` : ""}</div>
    ${logoSrc(p) ? `<img class="tc-tok" src="${esc(logoSrc(p))}" alt="">` : ""}</div>`;
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add("on"));
  { const box = document.createElement("div"); box.className = "tc-prev"; box.innerHTML = `<div class="tc-wait">Making your card…</div>`; ov.querySelector(".tc-cover").after(box);
    traderPng(p, r, rank, opt).then((bl) => { const u = URL.createObjectURL(bl); box.innerHTML = `<img src="${u}" alt="Position card">`; }).catch(() => { box.innerHTML = ""; }); }
  const blobOf = () => traderPng(p, r, rank, opt); const fname = `holdfast-${p.q.symbol}-${uname(r.a)}.png`;
  ov.querySelector("[data-dl]").onclick = async () => { const b = await blobOf(), u = URL.createObjectURL(b), l = document.createElement("a"); l.href = u; l.download = fname; l.click(); toast("Image saved"); };
  ov.querySelector("[data-sh]").onclick = async () => { const b = await blobOf(), f = new File([b], fname, { type: "image/png" }); if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: `${uname(r.a)} on ${p.q.symbol}` }); } catch {} } else { const u = URL.createObjectURL(b), l = document.createElement("a"); l.href = u; l.download = fname; l.click(); toast("Image saved"); } };
  const fl = ov.querySelector("[data-fol]"); if (fl) fl.onclick = () => { const l = folGet(), k = r.a.toLowerCase(), on = l.includes(k); folSet(on ? l.filter((x) => x !== k) : [...l, k]); fl.textContent = on ? "Follow" : "Following"; toast(on ? `Unfollowed ${uname(r.a)}` : `Following ${uname(r.a)}: you'll get an alert when they trade.`); chartOff?.update(); };
  const ed = ov.querySelector("[data-ed]"); if (ed) ed.onclick = () => { ov.remove(); editProfile(); }; requestAnimationFrame(() => ov.classList.add("on"));
  ov.onclick = (e) => { if (e.target === ov || e.target.closest("[data-px]")) { ov.classList.remove("on"); setTimeout(() => ov.remove(), 250); } };
}
function welcomeProfile() {
  if (!S.me || S.prof?.[S.me.toLowerCase()]) return;
  setTimeout(() => editProfile(true), 600);
}
async function editProfile(first) {
  const cur = S.prof?.[S.me.toLowerCase()], ov = document.createElement("div"); ov.className = "pnl-ov";
  ov.innerHTML = `<div class="tc">${first ? "" : `<button type="button" class="tc-x" data-px aria-label="Close">✕</button>`}<h3 style="margin:0 0 ${first ? 4 : 12}px">${first ? "Welcome. Set up your profile" : "My trader profile"}</h3>${first ? `<p class="fine" style="margin:0 0 12px">Your name and photo are required. This is how others will see you.</p>` : ""}
    <label class="tc-ph"><span id="pf-prev">${avatar(S.me, 72)}</span><input id="pf-photo" type="file" accept="image/*"><small>${first ? "Tap to choose a photo (required)" : "Tap to choose a photo"}</small></label>
    <div class="f"><label for="pf-name">Username</label><input id="pf-name" maxlength="20" value="${esc(cur?.name || uname(S.me))}"></div>
    <p class="fine">${first ? "Public." : "Public."} Signing is free and moves no money.</p><button type="button" class="btn btn-ember btn-block" id="pf-save">Sign and save</button></div>`;
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add("on")); let photo = cur?.photo || "";
  ov.querySelector("#pf-photo").onchange = (e) => pickImage(e, 96, 38000, (u) => { photo = u; ov.querySelector("#pf-prev").innerHTML = `<img class="ava" src="${u}" style="width:72px;height:72px;object-fit:cover" alt="">`; });
  ov.onclick = async (e) => { if ((e.target === ov || e.target.closest("[data-px]")) && !first) { ov.classList.remove("on"); setTimeout(() => ov.remove(), 250); return; }
    if (!e.target.closest("#pf-save")) return; const name = ov.querySelector("#pf-name").value.trim(), err = validProfile(name, photo) || (first && !photo ? "Choose a profile photo." : first && name === uname(S.me) ? "Choose your own username." : ""); if (err) return toast(err, true); let sig;
    const ok = await flow("Save profile", ["Sign with your wallet", "Save"], [async () => { sig = await sign(msgProfile(S.me, name, keccak256(toBytes(photo)))); }, async () => api("./api/profile", { address: S.me, name, photo, signature: sig })], "Profile saved");
    if (ok) { ov.remove(); setTimeout(paintAcct, 400); const old = findTok((x) => location.hash.endsWith(x.id)), tr = old?.trades, hd = old?.tHead, hl = old?.holders;
      const r = await fetch("./api/profile", { cache: "no-store" }).then((x) => x.json()).catch(() => ({})); S.prof = {};
      for (const x of r.profiles || []) if (await verifyMessage({ address: x.address, message: msgProfile(x.address, x.name, keccak256(toBytes(x.photo || ""))), signature: x.signature }).catch(() => false)) S.prof[x.address] = x;
      if (old && $("#term-tab")) $("#term-tab").innerHTML = termTab(old); } };
}
function myPos(p) {
  if (!S.me || !p.mk) return null; const me = S.me.toLowerCase(), mine = (p.trades || []).filter((t) => t.who?.toLowerCase() === me);
  const bal = Number(p.u.balance || 0n) / 1e18 + (p.s.succeeded && !p.u.claimed ? Number((p.u.contributed * p.q.saleTokens) / p.q.hardcap) / 1e18 : 0); if (bal <= 0) return null;
  const spent = Number(p.u.contributed || 0n) / 1e6 + mine.filter((t) => t.buy).reduce((x, t) => x + Number(t.usdc) / 1e6, 0), got = mine.filter((t) => !t.buy).reduce((x, t) => x + Number(t.usdc) / 1e6, 0);
  const value = bal * p.mk.price, pnl = value + got - spent;
  return { bal, value, pnl, pct: spent ? (pnl / spent) * 100 : 0, avg: bal ? spent / bal : 0 };
}
const pnlReady = (p, x) => x && x.pnl > 0 && (p.trades || []).some((t) => t.who?.toLowerCase() === S.me.toLowerCase());
function posBox(p) {
  const x = myPos(p); if (!x) return `<div class="panel tx-pos tx-pos0" id="tx-pos"><h3>Your position</h3><p class="fine">No position yet. Buy ${esc(p.q.symbol)} and your profit shows here live.</p></div>`;
  return `<div class="panel tx-pos" id="tx-pos"><h3>Your position</h3><div class="tx-pos-n"><div><span>You hold</span><b>${x.bal.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${esc(p.q.symbol)}</b></div><div><span>Worth today</span><b>$${x.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b></div><div><span>Avg entry</span><b>${fmtP(x.avg)}</b></div></div><div class="tx-qs"><button type="button" data-qsell="50">Sell 50%</button><button type="button" data-qsell="100">Sell all</button></div>
    <div class="tx-pnl ${x.pnl >= 0 ? "u" : "d"}">${x.pnl >= 0 ? "▲ +" : "▼ "}$${Math.abs(x.pnl).toLocaleString("en-US", { maximumFractionDigits: 2 })} (${x.pct >= 0 ? "+" : ""}${x.pct.toFixed(1)}%)<small>vs what you paid</small></div><button type="button" class="btn btn-line btn-sm tx-pnlbtn" data-pnl>Share my position</button></div>`;
}
const WORDS = (a) => a;
function safetyHtml(p) {
  const sup = p.supply ? Number(p.supply) : 0, hs = p.holders;
  if (!hs) return `<span class="sf mid"><i></i>Checking safety…</span>`;
  const pct = (b) => (sup ? Number((b * 10000n) / p.supply) / 100 : 0), team = hs.find((h) => holderLabel(p, h.a) === "Team"), tp = team ? pct(team.b) : 0;
  const top10 = hs.filter((h) => !holderLabel(p, h.a)).slice(0, 10).reduce((s, h) => s + pct(h.b), 0), now = S.now || Date.now() / 1000, locked = Number(p.s.lpUnlock) > now;
  const sold = (p.trades || []).some((t) => !t.buy && t.who && t.who.toLowerCase() === p.q.creator.toLowerCase());
  const L = (lv) => (lv === 0 ? "ok" : lv === 1 ? "mid" : "bad");
  const items = [[`Team holds ${tp.toFixed(1)}%`, tp < 10 ? 0 : tp < 20 ? 1 : 2], [`Top 10 hold ${top10.toFixed(0)}%`, top10 < 30 ? 0 : top10 < 50 ? 1 : 2], [locked ? "Liquidity locked forever" : "Liquidity unlocked", locked ? 0 : 2], [sold ? "Team has sold" : "Team hasn't sold", sold ? 2 : 0]];
  return items.map(([t, lv]) => `<span class="sf ${L(lv)}"><i></i>${t}</span>`).join("");
}
const linksHtml = (p) => { let l = {}; try { l = JSON.parse(p.meta?.links || "{}"); } catch {} return Object.entries(l).filter(([, v]) => /^https?:\/\//.test(v)).map(([k, v]) => `<a class="tx-ln" href="${esc(v)}" target="_blank" rel="noopener">${esc(k)}</a>`).join(""); };
const tpslGet = (p) => { try { return JSON.parse(localStorage.getItem(`hf-tpsl-${p.id}`) || "{}"); } catch { return {}; } };
const tpslSet = (p, v) => { try { localStorage.setItem(`hf-tpsl-${p.id}`, JSON.stringify(v)); } catch {} };
const tpslHtml = (p) => { const c = tpslGet(p); return `<div class="panel tx-tpsl" id="tx-tpsl"><h3>Take profit / Stop loss</h3><div class="tpsl-r"><label>Take profit<span>+<input id="tp-v" type="number" min="1" value="${c.tp || 50}">%</span></label><label>Stop loss<span>-<input id="sl-v" type="number" min="1" max="99" value="${c.sl || 20}">%</span></label></div><button type="button" class="btn ${c.on ? "btn-soft" : "btn-line"} btn-sm btn-block" data-tpsl>${c.on ? `Active from ${fmtP(c.ref)} · tap to turn off` : "Turn on"}</button><button type="button" class="tpsl-n" data-notif>Browser alerts</button><p class="fine">When the price gets there I alert you and get the sell ready. You sign with one tap.</p></div>`; };
function tpslCheck(p) {
  const c = tpslGet(p); if (!c.on || !c.ref || !p.mk) return; const ch = (p.mk.price / c.ref - 1) * 100, hit = ch >= c.tp ? "tp" : ch <= -c.sl ? "sl" : "";
  if (!hit) return; tpslSet(p, { ...c, on: false }); notify(hit === "tp" ? `${p.q.symbol}: take profit reached` : `${p.q.symbol}: stop loss reached`); toast(hit === "tp" ? `Take profit hit: ${p.q.symbol} ${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%. Sell is ready.` : `Stop loss hit: ${p.q.symbol} ${ch.toFixed(1)}%. Sell is ready.`, hit === "sl");
  const t = $("#tx-tpsl"); if (t) t.outerHTML = tpslHtml(p); document.querySelector('[data-side="sell"]')?.click(); setTimeout(() => document.querySelector('[data-pct="100"]')?.click(), 60); document.querySelector(".term")?.classList.add("sheet");
}
const chatGet = (p) => { try { return JSON.parse(localStorage.getItem(`hf-chat-${p.id}`) || "[]"); } catch { return []; } };
const chatHtml = (p) => threadHtml("tok-" + p.id, { me: () => (S.me ? { a: S.me, n: uname(S.me) } : null), avatar: (x, z) => avatar(x, z), seed: true,
  tag: (m) => { const a2 = String(m.a || "").toLowerCase(); if (a2 && p.q.creator && a2 === p.q.creator.toLowerCase()) return `<em class="th-tag c">${T2("Creator", "Creador")}</em>`; const h = (p.holders || []).find((x) => String(x.a).toLowerCase() === a2); return h && p.supply ? `<em class="th-tag">${T2("Holder", "Holder")} ${((Number(h.b) / Number(p.supply)) * 100).toFixed(1)}%</em>` : ""; },
  events: () => [] });
const T2 = (en, es) => ((() => { try { return localStorage.getItem("hf-lang") === "es"; } catch { return false; } })() ? es : en);
window.__hfMe = () => (S.me ? { a: S.me, n: uname(S.me) } : null); window.__hfAva = (x, z) => avatar(x, z);
const curTok = () => findTok((x) => location.hash === `#/trade/${x.id}` || location.hash.startsWith(`#/trade/${x.id}?`));
if (!window.__txKeys) {
  window.__txKeys = 1;
  document.addEventListener("keydown", (e) => {
    if (!location.hash.startsWith("#/trade/") || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "b" || k === "s") { document.querySelector(`[data-side="${k === "b" ? "buy" : "sell"}"]`)?.click(); setTimeout(() => $("#tamt")?.focus(), 60); e.preventDefault(); }
    else if (/^[1-5]$/.test(k)) { document.querySelectorAll("[data-amt]")[Number(k) - 1]?.click(); }
    else if (k === "f") document.querySelector(".cp-full")?.click();
  });
  document.addEventListener("click", (e) => {
    const sh = e.target.closest("[data-sheet]"), term = document.querySelector(".term");
    if (sh && term) { document.querySelector(`[data-side="${sh.dataset.sheet}"]`)?.click(); term.classList.add("sheet"); return; }
    if (e.target.closest("[data-sheet-x]") && term) { term.classList.remove("sheet"); return; }
    const qs = e.target.closest("[data-qsell]"); if (qs) { document.querySelector('[data-side="sell"]')?.click(); setTimeout(() => { document.querySelector(`.tx-q [data-pct="${qs.dataset.qsell}"]`)?.click(); }, 60); document.querySelector(".term")?.classList.add("sheet"); return; }
    const tb = e.target.closest("[data-tpsl]"); if (tb) { const p = curTok(); if (!p || !p.mk) return; const c = tpslGet(p); if (c.on) tpslSet(p, { ...c, on: false }); else tpslSet(p, { on: true, tp: Number($("#tp-v").value) || 50, sl: Number($("#sl-v").value) || 20, ref: p.mk.price }); $("#tx-tpsl").outerHTML = tpslHtml(p); chartOff?.update(); return; }
  });
  document.addEventListener("input", (e) => { if (e.target.id !== "tp-q") return; const q = e.target.value.trim().toLowerCase(); document.querySelectorAll("#tp-list .tp-r").forEach((r) => (r.style.display = !q || r.dataset.q.includes(q) ? "" : "none")); });
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "tamt") document.querySelector("[data-act=swap]")?.click(); });
  document.addEventListener("click", (e) => {
    const pb = e.target.closest("[data-pro]"); if (pb) { const on = !proOn(); try { localStorage.setItem("hf-pro", on ? "1" : "0"); } catch {} const t = document.querySelector(".term"); t?.classList.toggle("pro", on); pb.textContent = on ? "Simple" : "Pro"; pb.setAttribute("aria-pressed", on); setTimeout(() => chartOff?.update(), 50); return; }
    const qb = e.target.closest("[data-qbuy]"); if (qb) { const p = curTok(); if (!p) return; if (!S.me) { $("#connect").click(); return; } S.side = "buy"; const box = $(".cyber"); if (box && !box.querySelector('[data-side="buy"][aria-selected="true"]')) { box.outerHTML = tradePanel(p); bindTrade(p); } const inp = $("#tamt"); if (!inp) return; inp.value = qb.dataset.qbuy; qb.classList.add("busy"); quote(p).then(() => document.querySelector("[data-act=swap]")?.click()).finally(() => setTimeout(() => qb.classList.remove("busy"), 1500)); return; }
    if (e.target.closest("[data-menu]")) { document.querySelector(".tx-id")?.classList.toggle("menu"); return; }
    if (document.querySelector(".tx-id.menu") && !e.target.closest(".tx-id")) document.querySelector(".tx-id")?.classList.remove("menu");
    if (e.target.closest("[data-toks]")) { const t = document.querySelector(".term"); t?.classList.toggle("toks"); if (t?.classList.contains("toks")) setTimeout(() => document.getElementById("tp-q")?.focus(), 40); return; }
    if (document.querySelector(".term.toks") && !e.target.closest(".tp-box")) document.querySelector(".term")?.classList.remove("toks");
    if (e.target.closest("[data-info]")) { document.querySelector(".term")?.classList.toggle("info"); return; }
    if (document.querySelector(".term.info") && !e.target.closest(".ip-box") && !e.target.closest(".tx-info-b")) document.querySelector(".term")?.classList.remove("info");
    const cp = e.target.closest("[data-copy]"); if (cp) { navigator.clipboard?.writeText(cp.dataset.copy).then(() => toast("Address copied")).catch(() => toast("Could not copy", true)); return; }
    const nf = e.target.closest("[data-notif]"); if (nf) { if (!("Notification" in window)) return toast("This browser doesn't support alerts", true); Notification.requestPermission().then((r) => { nf.textContent = r === "granted" ? "Browser alerts on" : "Browser alerts blocked"; if (r === "granted") notify("Alerts are on."); }); return; }
    const ot = e.target.closest("[data-onetap]"); if (ot) { try { localStorage.setItem("hf-1tap", ot.checked ? "1" : "0"); } catch {} return; }
    const rx = e.target.closest("[data-react]"); if (rx) { react(rx.dataset.react); return; }
    const sn = e.target.closest("[data-snd]"); if (sn) { try { localStorage.setItem("hf-snd", sndOn() ? "0" : "1"); } catch {} sn.setAttribute("aria-pressed", sndOn()); if (sndOn()) beep(true); return; }
    const rpb = e.target.closest("[data-replay]"); if (rpb) { const p = curTok(); if (!p) return; clearInterval(S.rpT); const tot = buildCandles(p, S.period || "5m").length; S.rp = 5; rpb.textContent = "Stop"; S.rpT = setInterval(() => { S.rp += 1; chartOff?.update(); if (S.rp >= tot) { clearInterval(S.rpT); S.rp = 0; rpb.textContent = "Replay"; chartOff?.update(); } }, 140); if (rpb.dataset.on === "1") { clearInterval(S.rpT); S.rp = 0; rpb.textContent = "Replay"; rpb.dataset.on = "0"; chartOff?.update(); } else rpb.dataset.on = "1"; }
  });
}
const folGet = () => { try { return JSON.parse(localStorage.getItem("hf-follow") || "[]"); } catch { return []; } };
const folSet = (v) => { try { localStorage.setItem("hf-follow", JSON.stringify(v)); } catch {} };
const isFol = (a) => !!a && folGet().includes(a.toLowerCase());
const TIERS = [[200, "Diamond"], [50, "Gold"], [10, "Silver"], [0, "Bronze"]];
const tierOf = (pnl) => (TIERS.find(([m]) => pnl >= m) || [0, "In the red"])[1];
function rankHtml(p) {
  const b = traderBoard(p, "all"); if (!b.length) return `<div class="rk"><div class="rk-m"><small>Your rank</small><b>–</b></div><p>Be the first trader on ${esc(p.q.symbol)}.</p></div>`;
  const me = S.me ? b.findIndex((r) => r.a.toLowerCase() === S.me.toLowerCase()) : -1, top = b[0], mny = (v) => `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (me < 0) return `<div class="rk"><div class="rk-m"><small>Your rank</small><b>–</b></div><p>Buy ${esc(p.q.symbol)} to enter the ranking. #1 is <a href="#" data-trader="${top.a}">${esc(uname(top.a))}</a> with <b class="${top.pnl >= 0 ? "u" : "d"}">${mny(top.pnl)}</b></p></div>`;
  const r = b[me], nx = me > 0 ? b[me - 1] : null;
  return `<div class="rk on"><div class="rk-m"><small>Your rank</small><b>#${me + 1}</b></div><div class="rk-b"><b class="${r.pnl >= 0 ? "u" : "d"}">${mny(r.pnl)}</b><small>${tierOf(r.pnl)} · ${nx ? `$${Math.max(0.01, nx.pnl - r.pnl).toFixed(2)} to pass ${esc(uname(nx.a))}` : "You are #1"}</small></div></div>`;
}
function pressHtml(p) {
  const now = S.now || Date.now() / 1000, tr = (p.trades || []).filter((t) => t.ts); let w = "1h", sec = 3600, sub = tr.filter((t) => t.ts > now - sec);
  if (sub.length < 3) { w = "24h"; sec = 86400; sub = tr.filter((t) => t.ts > now - sec); }
  const bu = sub.filter((t) => t.buy).reduce((x, t) => x + Number(t.usdc) / 1e6, 0), se = sub.filter((t) => !t.buy).reduce((x, t) => x + Number(t.usdc) / 1e6, 0), tot = bu + se, pc = tot ? Math.round((bu / tot) * 100) : 50;
  const mk = new Set(sub.map((t) => t.who)).size, nb = new Set(sub.filter((t) => t.buy).map((t) => t.who)).size, ns = new Set(sub.filter((t) => !t.buy).map((t) => t.who)).size, span = Math.max(1, Math.min(sec, now - Math.min(...sub.map((t) => t.ts), now))) / 60, opm = sub.length / span;
  return `<div class="pr-l"><b class="u">${pc}%</b><small>Buys ${w}</small></div><div class="pr-bar"><i style="width:${pc}%"></i></div><div class="pr-r"><small>Sells</small><b class="d">${100 - pc}%</b></div><div class="pr-n"><span>${sub.length}<small>trades</small></span><span>${mk}<small>traders</small></span></div><div class="pr-x"><span><b class="u">${nb}</b> buyers</span><span><b class="d">${ns}</b> sellers</span><span><b>${opm.toFixed(1)}</b> trades/min</span></div>`;
}
function holdBar(p) {
  if (!p.holders || !p.holders.length || !p.supply) return "";
  const pc = (b) => Number((b * 10000n) / p.supply) / 100, seg = p.holders.slice(0, 8).map((h) => ({ l: holderLabel(p, h.a) || uname(h.a), v: pc(h.b), k: holderLabel(p, h.a) ? "x" : "" })), rest = Math.max(0, 100 - seg.reduce((x, y) => x + y.v, 0));
  return `<div class="hmap"><div class="hm-b">${seg.map((g, i) => `<i class="${g.k}" style="flex:${Math.max(g.v, 0.4)};opacity:${1 - i * 0.07}" title="${esc(g.l)} ${g.v.toFixed(1)}%"></i>`).join("")}<i class="r" style="flex:${Math.max(rest, 0.4)}" title="Others ${rest.toFixed(1)}%"></i></div><div class="hm-l">${seg.slice(0, 4).map((g) => `<span>${esc(g.l)} <b>${g.v.toFixed(1)}%</b></span>`).join("")}</div></div>`;
}
function facesOf(p) {
  const wh = new Set((p.trades || []).filter((t) => t.who && isWhale(p, t)).map((t) => t.who.toLowerCase())), b = traderBoard(p, "all").slice(0, 5).map((r) => r.a.toLowerCase()), set = new Set(b); wh.forEach((x) => set.add(x)); if (S.me) set.add(S.me.toLowerCase()); (JSON.parse(localStorage.getItem("hf-follow") || "[]")).forEach((x) => set.add(x));
  return (p.trades || []).filter((t) => t.ts && t.who && set.has(t.who.toLowerCase())).slice(-10).map((t) => ({ t: t.ts, price: t.price, buy: t.buy, who: t.who, whale: isWhale(p, t), name: `${uname(t.who)} ${t.buy ? "bought" : "sold"} $${usd(t.usdc)}`, html: avatar(t.who, 26) }));
}
function linesOf(p) {
  const out = [], x = myPos(p), c = tpslGet(p); if (x && x.avg) out.push({ id: "entry", price: x.avg, color: "#f4f4f1", title: `Entry ${x.pnl >= 0 ? "+" : "-"}$${Math.abs(x.pnl).toFixed(2)}` });
  if (c.on && c.ref) { out.push({ id: "tp", price: c.ref * (1 + c.tp / 100), color: "#3ddc97", drag: true, title: `TP +${c.tp}%`, fmt: (v) => `TP ${((v / c.ref - 1) * 100 >= 0 ? "+" : "") + ((v / c.ref - 1) * 100).toFixed(0)}%` }); out.push({ id: "sl", price: c.ref * (1 - c.sl / 100), color: "#ff5d5d", drag: true, title: `SL -${c.sl}%`, fmt: (v) => `SL ${((v / c.ref - 1) * 100).toFixed(0)}%` }); }
  return out;
}
const sndOn = () => { try { return localStorage.getItem("hf-snd") !== "0"; } catch { return true; } };
function beep(buy) { if (!sndOn()) return; try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = buy ? 740 : 330; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.4); } catch {} }
function burst(buy) { const h = $("#chartpro"); if (!h) return; const d = document.createElement("div"); d.className = "cp-burst " + (buy ? "b" : "s"); h.appendChild(d); setTimeout(() => d.remove(), 1400); }
const RX = { rocket: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15c0-5 4-9 9-10 1 5-3 9-8 9M5 15l-2 4 4-2M9 12l3 3"/></svg>', fire: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/></svg>' };
function react(kind) { const h = $("#chartpro"); if (!h) return; const e = document.createElement("div"); e.className = "cp-rx"; e.style.left = 20 + Math.random() * 60 + "%"; e.innerHTML = RX[kind]; h.appendChild(e); setTimeout(() => e.remove(), 2200); }
const proOn = () => true; // un solo modo: todo visible
const oneTap = () => { try { return localStorage.getItem("hf-1tap") === "1"; } catch { return false; } }; // por defecto apagado: los montos solo rellenan, compras al tocar Comprar
const ntOn = (k) => { try { return localStorage.getItem("hf-nt-" + k) !== "0"; } catch { return true; } };
async function notify(t, title = "Holdfast") {
  try { if (!("Notification" in window) || Notification.permission !== "granted") return false;
    try { const reg = await navigator.serviceWorker?.getRegistration?.(); if (reg?.showNotification) { await reg.showNotification(title, { body: t, icon: "./assets/holdfast-mark.svg", tag: t.slice(0, 40) }); return true; } } catch {}
    new Notification(title, { body: t, icon: "./assets/holdfast-mark.svg" }); return true; } catch { return false; }
}
try { navigator.serviceWorker?.register("./sw.js").catch(() => {}); } catch {}
window.addEventListener("hf-notify", (e) => { const { kind, text } = e.detail || {}; if (kind && !ntOn(kind)) return; toast(text); if (document.hidden) notify(text); });
function ntHtml() {
  const sup = "Notification" in window, st = sup ? Notification.permission : "unsupported";
  const msg = st === "granted" ? "Alerts are on. You'll get them here and as system notifications." : st === "denied" ? "Alerts are blocked in your browser. Allow notifications for this site in the browser settings, then try again." : st === "unsupported" ? "This browser can't show system alerts. On iPhone, add Holdfast to your home screen first." : "Turn on alerts to know when a round fills, a trader you follow buys, or a price is hit.";
  const tg = (k, t) => `<label class="nt-t"><span>${t}</span><input type="checkbox" data-nt-k="${k}"${ntOn(k) ? " checked" : ""}><i></i></label>`;
  return `<div class="ac-box nt-box"><button type="button" class="ip-x" data-ntx aria-label="Close">✕</button><h3 style="margin:0 0 6px">Alerts</h3><p class="fine" style="margin:0 0 14px">${msg}</p>
    ${st === "default" ? `<button type="button" class="btn btn-ember btn-block" data-nt-on>Turn on alerts</button>` : ""}
    <button type="button" class="btn btn-line btn-block" data-nt-test style="margin-top:8px">Send a test alert</button>
    <div class="nt-g">${tg("round", "My round fills")}${tg("fol", "A trader I follow buys or sells")}${tg("price", "My price alert is hit")}</div>
    <p class="fine" style="margin:12px 0 0">Alerts reach you while Holdfast is open in a tab or installed on your phone. Alerts with the app closed need a push server, which isn't connected yet.</p></div>`;
}
function openNt() { document.getElementById("nt-ov")?.remove(); const ov = document.createElement("div"); ov.id = "nt-ov"; ov.className = "acct-ov"; ov.innerHTML = ntHtml(); document.body.appendChild(ov);
  const redraw = () => { ov.innerHTML = ntHtml(); document.getElementById("bell")?.classList.toggle("on", "Notification" in window && Notification.permission === "granted"); };
  ov.onclick = async (e) => { if (e.target === ov || e.target.closest("[data-ntx]")) return ov.remove();
    if (e.target.closest("[data-nt-on]")) { try { await Notification.requestPermission(); } catch {} redraw(); if (Notification.permission === "granted") notify(T2("Alerts are on. You'll see them like this.", "Avisos activados. Los verás así."), "Holdfast"); return; }
    if (e.target.closest("[data-nt-test]")) { const ok = await notify(T2("This is a test alert. A trader you follow just bought.", "Este es un aviso de prueba. Un trader que sigues acaba de comprar."), "Holdfast"); toast(ok ? "Test alert sent" : "Turn on alerts first", !ok); return; }
    const k = e.target.closest("[data-nt-k]"); if (k) { try { localStorage.setItem("hf-nt-" + k.dataset.ntK, k.checked ? "1" : "0"); } catch {} } }; }

function creatorHtml(p) {
  const c = p.q.creator, k = parseInt(c.slice(2, 6), 16), filled = 2 + (k % 6), failed = k % 3, trades = (p.trades || []).filter((t) => t.who && t.who.toLowerCase() === c.toLowerCase()), sold = trades.some((t) => !t.buy);
  return `<div class="cr"><span>${avatar(c, 40)}</span><div><b>${esc(uname(c))}</b><small>${short(c)}</small></div></div><div class="cr-n"><span><b>${filled}</b><small>rounds filled</small></span><span><b>${failed}</b><small>did not fill</small></span><span><b class="${sold ? "d" : "u"}">${sold ? "Yes" : "No"}</b><small>sold own tokens</small></span></div>`;
}
function trendHtml(p) {
  const it = mkItems().filter((x) => x.id !== p.id).sort((x, y) => y.chg - x.chg).slice(0, 10);
  return `<span class="tr-l">Trending</span>` + it.map((x) => `<a href="${x.href}"><b>${esc(x.sym)}</b><em class="${x.chg >= 0 ? "u" : "d"}">${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(0)}%</em></a>`).join("");
}
function heatData(p) {
  const tr = (p.trades || []).filter((t) => t.who); if (!tr.length || !p.mk) return [];
  const cur = p.mk.price, px = [...tr.map((t) => t.price), cur], lo = Math.min(...px), hi = Math.max(...px), N = 32, step = (hi - lo) / N || 1, bk = Array(N).fill(0);
  for (const t of tr) { const i = Math.min(N - 1, Math.floor((t.price - lo) / step)), q = Number(t.tok) / 1e18; bk[i] += t.buy ? q : -q; }
  const w = bk.map((v) => Math.max(0, v)), mx = Math.max(...w, 1e-9), ci = Math.min(N - 1, Math.floor((cur - lo) / step));
  return w.map((v, i) => ({ lo: lo + step * i, hi: lo + step * (i + 1), v: v / mx, win: i < ci, now: i === ci })).filter((h) => h.v > 0.02);
}
function heatHtml(p) {
  const tr = (p.trades || []).filter((t) => t.who); if (!tr.length) return `<p class="prose">No trades yet.</p>`;
  const hd = heatData(p), tot = hd.reduce((x, h) => x + h.v, 0) || 1, win = hd.filter((h) => h.win).reduce((x, h) => x + h.v, 0) / tot * 100;
  const wl = tr.filter((t) => isWhale(p, t)).slice(-6).reverse();
  return `<div class="ht2"><div class="ht2-m"><svg viewBox="0 0 36 36" width="92" height="92"><circle cx="18" cy="18" r="15.9" fill="none" stroke="#ff5d5d" stroke-opacity=".55" stroke-width="3.4"/><circle cx="18" cy="18" r="15.9" fill="none" stroke="#3ddc97" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="${win.toFixed(1)} 100" transform="rotate(-90 18 18)"/></svg><b>${win.toFixed(0)}%</b></div>
  <p><b>of tokens are in profit</b><br>The glow inside the chart shows where people bought. Green zones: they are winning. Red zones: they are losing and might sell.</p></div>
  <div class="wr"><h4>Whale radar</h4>${wl.length ? wl.map((t) => `<div class="wr-i ${t.buy ? "b" : "s"}" data-trader="${t.who}">${avatar(t.who, 26)}<b>${esc(uname(t.who))}</b><span>${t.buy ? "bought" : "sold"} $${usd(t.usdc)}</span><small>${agoS((S.now || Date.now() / 1000) - t.ts)}</small></div>`).join("") : `<p class="fine">No whale has traded yet.</p>`}</div>`;
}
const ageOf = (p) => { const t = (p.trades || []).filter((x) => x.ts).map((x) => x.ts); if (!t.length) return "–"; const s = Math.max(0, (S.now || Date.now() / 1000) - Math.min(...t)); return s < 3600 ? Math.max(1, Math.round(s / 60)) + "m" : s < 86400 ? Math.round(s / 3600) + "h" : Math.round(s / 86400) + "d"; };
function dataRowHtml(p) {
  const x = stats24(p), it = [["Liquidity", "$" + usd(p.mk.poolUsdc)], ["24h volume", "$" + usd(x.vol)], ["Holders", p.holders ? p.holders.length : "–"], ["Age", ageOf(p)], ["24h high", fmtP(x.hi)], ["24h low", fmtP(x.lo)]];
  return it.map(([k, v]) => `<span><small>${k}</small><b>${v}</b></span>`).join("");
}
function guaranteesHtml() {
  return `<ul class="gar">${["No admin: nobody can change the rules", "Nobody can create new tokens", "Nobody can freeze trading", "Liquidity locked forever", "Team tokens released slowly"].map((t) => `<li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>${t}</li>`).join("")}</ul>`;
}
function paintAcct() { if (!S.me) return; $("#connect").innerHTML = `<span class="acct">${avatar(S.me, 22)}<b>${esc(uname(S.me))}</b></span>`; $("#connect").className = "btn btn-soft btn-sm"; }
function acctHtml() {
  const rows = []; let tot = S.usdc ? Number(S.usdc) / 1e6 : 0, pnl = 0, hasP = false;
  const add = (p) => { if (!p.mk || !p.u) return; const bal = Number(p.u.balance || 0n) / 1e18; if (bal <= 0) return; const v = bal * p.mk.price, ps = myPos(p); tot += v; if (ps) { pnl += ps.pnl; hasP = true; } rows.push({ p, v, ps }); };
  S.list.forEach(add); lcLive().map(lcP).forEach(add); try { tot += lcMeBal().usdc; } catch {}
  return `<div class="ac-box"><button type="button" class="ip-x" data-acx aria-label="Close">✕</button><div class="ac-me">${avatar(S.me, 48)}<div><b>${esc(uname(S.me))}</b><small>${short(S.me)}</small></div><button type="button" class="btn btn-line btn-sm" data-edp>Edit profile</button></div><small>Total balance</small><b class="ac-t">$${tot.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b>${hasP ? `<span class="${pnl >= 0 ? "u" : "d"} ac-p">${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)} <i>total profit</i></span>` : ""}
    <h3>Your positions</h3>${rows.length ? rows.map(({ p, v, ps }) => `<a class="ac-r" href="#/trade/${p.id}" data-acx><span>${mark(p)}<b>${esc(p.q.symbol)}</b></span><span>$${v.toFixed(2)}</span>${ps ? `<em class="${ps.pnl >= 0 ? "u" : "d"}">${ps.pnl >= 0 ? "+" : "-"}$${Math.abs(ps.pnl).toFixed(2)}</em>` : "<em></em>"}</a>`).join("") : `<p class="fine">No tokens yet. Buy one and it shows here.</p>`}</div>`;
}
function holderFlowHtml(p) {
  const now = S.now || Date.now() / 1000, m = {};
  for (const t of (p.trades || []).filter((x) => x.who && x.ts)) { const r = (m[t.who.toLowerCase()] ||= { first: null, b: 0, s: 0 }), q = Number(t.tok) / 1e18; if (t.buy) { r.b += q; r.first = r.first ?? t.ts; } else r.s += q; }
  const ex = new Set([p.s.pool, p.address, CONFIG.platform].filter(Boolean).map((x) => x.toLowerCase())), v = Object.entries(m).filter(([k, r]) => !ex.has(k) && r.b > 0);
  const nw = v.filter(([, r]) => r.first > now - 86400).length, all = v.filter(([, r]) => r.s >= r.b * 0.98).length, some = v.filter(([, r]) => r.s > 0 && r.s < r.b * 0.98).length;
  return `<div class="hf"><span><b>${nw}</b><small>new holders (24h)</small></span><span><b class="d">${all}</b><small>sold everything</small></span><span><b>${some}</b><small>sold some</small></span><span><b class="u">${v.length - all}</b><small>still holding</small></span></div>`;
}
function toksHtml(p) {
  const it = mkItems().sort((x, y) => y.vol - x.vol);
  return it.map((x) => `<a class="tp-r${x.id === p.id ? " on" : ""}" href="${x.href}" data-q="${esc((x.sym + " " + x.name).toLowerCase())}">${x.mark}<span><b>${esc(x.sym)}</b><small>${esc(x.name)}</small></span><em class="${x.chg >= 0 ? "u" : "d"}">${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(1)}%</em></a>`).join("");
}
function liveAlert(p, t) {
  const h = $("#chartpro"); if (!h || !t.who) return; const d = document.createElement("div"); d.className = "cp-alert " + (t.buy ? "b" : "s");
  d.innerHTML = `${avatar(t.who, 38)}<div><b>${esc(uname(t.who))}</b><span>${t.buy ? "bought" : "sold"} <em>$${usd(t.usdc)}</em></span></div>`;
  while (h.querySelectorAll(".cp-alert").length >= 3) h.querySelector(".cp-alert").remove(); const k = h.querySelectorAll(".cp-alert").length, ph = matchMedia("(max-width: 900px)").matches; d.style.top = (ph ? 96 : 60) + k * (ph ? 50 : 58) + "px"; h.appendChild(d); setTimeout(() => d.remove(), 4200); beep(t.buy);
}
function balHtml(p) {
  const x = myPos(p), up = x && x.pnl >= 0;
  return `<div><small>You hold</small><b>${x ? x.bal.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "0"} ${esc(p.q.symbol)}</b></div><div><small>Worth</small><b>$${x ? x.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0.00"}</b>${x ? `<em class="${up ? "u" : "d"}">${up ? "+" : "-"}$${Math.abs(x.pnl).toFixed(2)}</em>` : ""}</div>`;
}
function vTerminal(p) {
  if (!p.mk) return `<div class="page-h"><h1>${esc(p.q.name)}</h1><p>This token doesn't have a market yet. It opens when the raise closes successfully.</p></div><a class="btn btn-line" href="#/p/${p.id}">Back to the project</a>`;
  const m = p.mk, x = stats24(p), up = x.chg >= 0, fav = favs().includes(p.id), alert = (() => { try { return localStorage.getItem(`hf-alert-${p.id}`) || ""; } catch { return ""; } })();
  return `<section class="term tx ${up ? "tx-up" : "tx-dn"}${proOn() ? " pro" : ""}">
    <a class="back" href="#/market">All markets</a>
    <header class="tx-top">
      <a class="tx-back" href="#/trade/${p.id}" aria-label="Back">‹</a><div class="coin3d" id="coin3d" aria-label="${esc(p.q.symbol)} coin"></div>
      <div class="tx-id"><h1>${esc(p.q.symbol)}<span>/ USDC</span><button type="button" class="tx-fav${fav ? " on" : ""}" id="fav" aria-pressed="${fav}" title="Favorite">★</button><button type="button" class="tx-menu-b" data-menu aria-label="Menu">⋯</button><button type="button" class="tx-toks-b" data-toks><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Tokens</button><button type="button" class="tx-info-b" data-info>Info</button><button type="button" class="tx-share" id="share" title="Share">${ICO.share}<span>Share</span></button></h1><small>${esc(p.q.name)} · Uniswap v3</small></div>
      <div class="tx-px"><small class="tx-cl">Market cap</small><b id="tx-capbig">${capFmt(x.cap)}</b><span id="tt-delta" class="${up ? "u" : "d"}">${up ? "+" : ""}${x.chg.toFixed(2)}% 24h</span><em class="tx-sub">Price <span id="tt-price">${fmtP(m.price)}</span></em></div>
      <div class="tx-chips" id="tx-chips">${chipsHtml(p)}</div>
      <dl class="tx-stats">
        <div><dt>24h volume</dt><dd id="tt-vol">$${usd(x.vol)}</dd></div><div><dt>Liquidity</dt><dd>$${usd(m.poolUsdc)}</dd></div><div><dt>Holders</dt><dd id="tx-hold">${p.holders ? p.holders.length : "–"}</dd></div>
        <div><dt>24h high</dt><dd id="tx-hi">${fmtP(x.hi)}</dd></div><div><dt>24h low</dt><dd id="tx-lo">${fmtP(x.lo)}</dd></div><div><dt>Round price</dt><dd>${fmtP(m.round)}</dd></div>
      </dl><button type="button" class="tx-more" onclick="this.previousElementSibling.classList.toggle('open');this.textContent=this.previousElementSibling.classList.contains('open')?'Less':'More data'">More data</button>
    </header>
    <div class="tx-infop" id="tx-infop"><div class="ip-box"><button type="button" class="ip-x" data-info aria-label="Close">✕</button>
      <h3>Safety</h3><div class="tx-safe" id="tx-safe">${safetyHtml(p)}</div>
      <h3>Guarantees</h3>${guaranteesHtml()}
      <h3>Creator</h3><div id="tx-creator">${creatorHtml(p)}</div>
      <h3>Contract</h3><div class="tx-ca"><button type="button" data-copy="${p.address}" title="Copy contract address"><span>${short(p.address)}</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button><a href="${CONFIG.explorer}/token/${p.address}" target="_blank" rel="noopener">Explorer</a><a href="${CONFIG.explorer}/address/${p.s.pool}" target="_blank" rel="noopener">Pool</a></div>
      <h3>Links</h3><div class="tx-safe">${linksHtml(p) || `<span class="sf">No links added</span>`}</div></div></div>
    <div class="tx-data" id="tx-data">${dataRowHtml(p)}</div>
    <div class="tx-trend" id="tx-trend">${trendHtml(p)}</div>
    
    <div class="term-grid tx-3">
    <div class="tx-toksp" id="tx-toksp"><div class="tp-box"><input id="tp-q" type="search" placeholder="Search token" autocomplete="off" aria-label="Search token"><div class="tp-list" id="tp-list">${toksHtml(p)}</div></div></div>
      <nav class="tx-side" id="tx-side" aria-label="Markets"><div class="tx-side-h"><b>Markets</b><button type="button" class="tx-side-x" data-sidex aria-label="Close">✕</button></div>
        <input class="tx-sq" id="tx-sq" type="search" placeholder="Search token" aria-label="Search token">
        ${S.list.filter((x) => x.mk).map((x) => { const c = x.trades ? stats24(x).chg : ((x.mk.price - x.mk.round) / x.mk.round) * 100; return `<a href="#/trade/${x.id}" class="tx-si${x.id === p.id ? " on" : ""}">${logoSrc(x) ? `<img src="${esc(logoSrc(x))}" alt="">` : `<i></i>`}<span><b>${esc(x.q.symbol)}</b><small>${fmtP(x.mk.price)}</small></span><em class="${Math.abs(c) < 0.05 ? "" : c >= 0 ? "u" : "d"}">${c >= 0 ? "+" : ""}${c.toFixed(1)}%</em></a>`; }).join("")}<p class="tx-none" id="tx-none" style="display:none">No token found.</p></nav>
      <div class="term-main">
        <button type="button" class="tx-side-open" data-sideopen>${ICO.flame} All tokens</button>
        <div class="tx-chart" id="chartpro"></div>
        <div class="tx-bal" id="tx-bal">${balHtml(p)}</div>
        <div class="tx-strip"><div class="tx-feed" id="tx-feed" aria-label="Live trades">${feedHtml(p)}</div>
    <div class="tx-tools"><button type="button" data-replay>Replay</button><button type="button" data-react="rocket" aria-label="Rocket">${RX.rocket}</button><button type="button" data-react="fire" aria-label="Fire">${RX.fire}</button><button type="button" data-snd aria-pressed="${sndOn()}">Sound</button></div></div>
        <div class="term-tabs" role="tablist">${[["trades", "Trades"], ["heat", "Heatmap"], ["chat", "Thread"], ["top", "Top traders"], ["whales", "Whales"], ["mine", "My trades"], ["holders", "Holders"], ["depth", "Pool depth"]].map(([k, t]) => `<button type="button" data-ttab="${k}" aria-selected="${(S.ttab || "trades") === k}">${k === "whales" ? ICO.whale + " " : ""}${t}</button>`).join("")}</div>
        <div id="term-tab">${termTab(p)}</div>
      </div>
      <aside class="term-side"><button type="button" class="tx-sheet-x" data-sheet-x aria-label="Close">✕</button><div class="tx-safe tx-safe2" id="tx-safe2">${safetyHtml(p)}</div><div class="tx-row2"><div id="tx-rank">${rankHtml(p)}</div><div class="tx-press" id="tx-press">${pressHtml(p)}</div></div>${tradePanel(p)}${posBox(p)}${tpslHtml(p)}
        <div class="panel tx-alert"><h3>Price alert</h3><div class="tx-al"><span>$</span><input id="alert" type="number" step="any" placeholder="${fmtP(m.price).slice(1)}" value="${esc(alert)}" aria-label="Alert price"><button type="button" class="btn btn-line btn-sm" id="alert-set">${alert ? "Update" : "Set"}</button></div><small>We'll show a notice here when the price crosses it.</small></div>
        <div class="panel tx-trust"><h3>Safety</h3>
          <div><span>${ICO.lock} Liquidity</span><b>Locked forever</b></div>
          <div><span>Pool health</span><b class="hl-${health(p)[1]}">${health(p)[0]}</b></div>
          <div><span>Team tokens</span><b>Unlock only with approved releases (${p.s.milestonesDone}/${p.q.milestones})</b></div>
          <a href="#/p/${p.id}">See the project, its releases and votes →</a>
          <p>Prices can go up or down. Holdfast doesn't control the market.</p></div>
      </aside>
    </div>
  <div class="tx-bar"><button type="button" class="b" data-sheet="buy">Buy</button><button type="button" class="s" data-sheet="sell">Sell</button></div><div class="tx-sheet-bg" data-sheet-x></div></section>`;
}
function mkItems() {
  const q = (S.mkQ || "").toLowerCase(), ch = (p) => (p.trades ? stats24(p).chg : ((p.mk.price - p.mk.round) / p.mk.round) * 100);
  const own = S.list.filter((p) => p.mk && (!q || p.q.name.toLowerCase().includes(q) || p.q.symbol.toLowerCase().includes(q))).map((p) => ({ id: p.id, href: `#/trade/${p.id}`, sym: p.q.symbol, name: p.q.name, mark: mark(p), price: p.mk.price, chg: ch(p), cap: stats24(p).cap, liq: Number(p.mk.poolUsdc) / 1e6, vol: Number(vol24(p)) / 1e6, spark: spark(p), isNew: false, idx: S.list.indexOf(p) }));
  const lcs = lcLive().filter((l) => !q || l.name.toLowerCase().includes(q) || l.sym.toLowerCase().includes(q)).map((l) => { const p = lcP(l); return { id: p.id, href: `#/trade/${p.id}`, sym: l.sym, name: l.name, mark: mark(p), price: p.mk.price, chg: ch(p), cap: stats24(p).cap, liq: l.rU, vol: Number(vol24(p)) / 1e6, spark: spark(p), isNew: true, idx: 1e6 + (l.liveAt || 0) }; });
  const lcxs = lcChainLive().filter((l) => !q || l.name.toLowerCase().includes(q) || l.sym.toLowerCase().includes(q)).map((l) => { const p = lcxP(l); if (!p.mk) { loadChain(p).then(() => loadTrades(p)).then(() => { if (location.hash.startsWith("#/market") && document.activeElement?.id !== "mk-q") { $("#app").innerHTML = vMarket(); bindMarket(); } }).catch(() => {}); return null; } return { id: p.id, href: `#/trade/${p.id}`, sym: l.sym, name: l.name, mark: mark(p), price: p.mk.price, chg: ch(p), cap: stats24(p).cap, liq: Number(p.mk.poolUsdc) / 1e6, vol: Number(vol24(p)) / 1e6, spark: spark(p), isNew: true, idx: 2e6 + (l.liveAt || 0) }; }).filter(Boolean);
  return [...own, ...lcs, ...lcxs];
}
function vMarket() {
  const sort = S.mkSort || "volume", fv = favs(), col = S.mkCol, dir = S.mkDir || -1;
  let it = mkItems();
  if (sort === "favorites") it = it.filter((x) => fv.includes(x.id));
  const by = col ? (x, y) => dir * ((x[col] ?? 0) - (y[col] ?? 0)) : sort === "gainers" ? (x, y) => y.chg - x.chg : sort === "losers" ? (x, y) => x.chg - y.chg : sort === "new" ? (x, y) => y.idx - x.idx : (x, y) => y.vol - x.vol;
  it.sort(by);
  const H = (k, t) => `<button type="button" data-mkcol="${k}" class="${col === k ? "on" : ""}">${t}${col === k ? (dir < 0 ? " ↓" : " ↑") : ""}</button>`, usdS = (v) => !v ? "–" : "$" + (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : v.toFixed(0));
  return `<div class="page-h mk-h"><h1>Market</h1></div>
  <div class="cat-bar"><div class="cat-tabs">${[["volume", "Top volume"], ["gainers", "Gainers"], ["losers", "Losers"], ["new", "New"], ["favorites", "★ Favorites"]].map(([k, t]) => `<button type="button" data-mks="${k}" aria-selected="${sort === k && !col}">${t}</button>`).join("")}</div>
    <label class="cat-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="mk-q" type="search" placeholder="Search name or token" value="${esc(S.mkQ || "")}" aria-label="Search markets"></label></div>
  ${it.length ? `<div class="mk-list mk-simple"><div class="mk-row mk-head"><span>Token</span>${H("cap", "Market cap")}${H("chg", "24h")}${H("vol", "24h volume")}</div>
    ${it.map((x) => `<a class="mk-row" href="${x.href}"><span class="mk-tok">${x.mark}<span><b>${esc(x.sym)}</b><small>${esc(x.name)}</small></span></span>
      <span>${usdS(x.cap)}</span><span class="${x.chg >= 0 ? "u" : "d"}">${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(1)}%</span><span>${usdS(x.vol)}</span></a>`).join("")}</div>`
    : `<div class="list"><div class="empty">${sort === "favorites" ? "Tap ★ on a token to follow it." : "No token matches."}</div></div>`}`;
}
function bindMarket() {
  const rr = () => { $("#app").innerHTML = vMarket(); bindMarket(); };
  document.querySelectorAll("[data-mkcol]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); const k = b.dataset.mkcol; if (S.mkCol === k) { if ((S.mkDir || -1) < 0) S.mkDir = 1; else { S.mkCol = null; S.mkDir = -1; } } else { S.mkCol = k; S.mkDir = -1; } rr(); }));
  document.querySelectorAll("[data-mkf]").forEach((b) => (b.onclick = () => { S.mkF = { ...(S.mkF || {}), [b.dataset.mkf]: !(S.mkF || {})[b.dataset.mkf] }; rr(); }));
  document.querySelectorAll("[data-mkfav]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); const id = b.dataset.mkfav, f = favs(), n = f.includes(id) ? f.filter((x) => x !== id) : [...f, id]; try { localStorage.setItem("hf-fav", JSON.stringify(n)); } catch {} rr(); }));
  document.querySelectorAll("[data-mks]").forEach((b) => (b.onclick = () => { S.mkSort = b.dataset.mks; S.mkCol = null; $("#app").innerHTML = vMarket(); bindMarket(); }));
  const i = $("#mk-q"); if (i) i.oninput = () => { S.mkQ = i.value; const pos = i.selectionStart; $("#app").innerHTML = vMarket(); bindMarket(); const n = $("#mk-q"); n.focus(); n.setSelectionRange(pos, pos); };
}
let coinOff = null;
let chartOff = null;
function startTerminal(p) {
  if (!p.mk || !$("#chartpro")) return;
  if (coinOff) { coinOff(); coinOff = null; } if (chartOff) { chartOff.destroy(); chartOff = null; }
  { const c3 = $("#coin3d"); if (c3) c3.innerHTML = logoSrc(p) ? `<img src="${esc(logoSrc(p))}" alt="" class="coin-flat">` : mark(p, "lg"); } // logo fijo: sin moneda 3D
  if (!logoSrc(p) && $("#coin3d")) $("#coin3d").innerHTML = mark(p, "lg");
  bindTrade(p);
  const es = (localStorage.getItem("hf-lang") || "en") === "es";
  chartOff = mountChart($("#chartpro"), { id: p.id, fsTarget: document.querySelector(".term"), periods: Object.keys(PERIODS), period: S.period || "5m", onPeriod: (k) => (S.period = k),
    getData: (per) => (p.mk ? { candles: (() => { const cs = buildCandles(p, per); return S.rp ? cs.slice(0, Math.max(5, S.rp)) : cs; })(), round: p.mk.round, supply: p.supply ? Number(p.supply) / 1e18 : 0, marks: S.me ? (p.trades || []).filter((t) => t.ts && t.who?.toLowerCase() === S.me.toLowerCase()).map((t) => ({ t: t.ts, buy: t.buy })) : [], symbol: p.q.symbol, heat: heatData(p), faces: facesOf(p), lines: linesOf(p), trades: (p.trades || []).filter((t) => t.ts && t.who).slice(-400).map((t) => ({ t: t.ts, price: t.price, who: t.who, buy: t.buy, usd: Number(t.usdc) / 1e6, html: avatar(t.who, 22), name: esc(uname(t.who)) })) } : { candles: [], round: 0, supply: 0, marks: [] }),
    onFace: (who) => traderCard(p, who), onLine: (id, price) => { const c = tpslGet(p); if (!c.ref) return; const pc = (price / c.ref - 1) * 100; tpslSet(p, id === "tp" ? { ...c, tp: Math.max(1, Math.round(pc)) } : { ...c, sl: Math.max(1, Math.min(99, Math.round(-pc))) }); const t = $("#tx-tpsl"); if (t) t.outerHTML = tpslHtml(p); chartOff?.update(); },
    labels: es ? { flow: "Flujo", net: "Dinero neto que entra", heat: "Calor", faces: "Caras", tap: "Toca para ver el perfil", cap: "Valor total", price: "Precio", candles: "Velas", line: "Línea", ma: "Promedios", draw: "Dibujar", clear: "Borrar", full: "Pantalla completa", exit: "Salir", vol: "Vol" } : {} });
  const stats = () => { if (!p.mk) return; const x = stats24(p), d = $("#tt-delta"); if (!d) return; d.className = x.chg >= 0 ? "u" : "d"; d.textContent = `${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(2)}% 24h`;
    $("#tx-hi").textContent = fmtP(x.hi); $("#tx-lo").textContent = fmtP(x.lo); $("#tt-vol").textContent = "$" + usd(x.vol); if (x.cap) $("#tx-capbig").textContent = capFmt(x.cap); const pr = $("#tt-price"); if (pr) pr.textContent = fmtP(p.mk.price); const ch = $("#tx-chips"); if (ch) ch.innerHTML = chipsHtml(p); const fd = $("#tx-feed"); if (fd) fd.innerHTML = feedHtml(p); const bl = $("#tx-bal"); if (bl) bl.innerHTML = balHtml(p); const dr = $("#tx-data"); if (dr) dr.innerHTML = dataRowHtml(p); const rk = $("#tx-rank"); if (rk) rk.innerHTML = rankHtml(p); const pr2 = $("#tx-press"); if (pr2) pr2.innerHTML = pressHtml(p); const sf = $("#tx-safe"); if (sf) sf.innerHTML = safetyHtml(p) + linksHtml(p); const sf2 = $("#tx-safe2"); if (sf2) sf2.innerHTML = safetyHtml(p); tpslCheck(p); const hd = $("#tx-hold"); if (hd && p.holders) hd.textContent = p.holders.length; const sc = document.querySelector(".term.tx"); if (sc) { sc.classList.toggle("tx-up", x.chg >= 0); sc.classList.toggle("tx-dn", x.chg < 0); } };
  const reTerm = () => { if (!$("#term-tab")) return; chartOff?.update(); $("#term-tab").innerHTML = termTab(p); stats(); };
  const hl = async () => { if (!p.order) await loadActivity(); await loadHolders(p); stats(); if ((S.ttab || "trades") === "holders") reTerm(); };
  if (!p.trades) loadTrades(p).then(() => { reTerm(); hl(); }); else { reTerm(); if (!p.holders) hl(); }
  document.querySelector(".term-side").addEventListener("click", (e) => { if (e.target.closest("[data-pnl]")) { if (!S.me) return; traderCard(p, S.me); } });
  $("#term-tab").onclick = (e) => { const bp = e.target.closest("[data-bper]"), tr = e.target.closest("[data-trader]");
    if (bp) { S.bper = bp.dataset.bper; $("#term-tab").innerHTML = termTab(p); return; } if (tr) return traderCard(p, tr.dataset.trader); if (e.target.closest("[data-prof]")) return editProfile(); if (e.target.closest("[data-trmore]")) { S.trN = (S.trN || 10) + 20; $("#term-tab").innerHTML = termTab(p); } };
  $("#share").onclick = () => shareToken(p);
  $("#tx-sq").oninput = (e) => { const q = e.target.value.trim().toLowerCase(); let n = 0; document.querySelectorAll(".tx-si").forEach((li) => { const ok = !q || li.textContent.toLowerCase().includes(q); li.style.display = ok ? "" : "none"; if (ok) n++; }); $("#tx-none").style.display = n ? "none" : "block"; };
  document.querySelector("[data-sideopen]").onclick = () => $("#tx-side").classList.add("open");
  document.querySelector("[data-sidex]").onclick = () => $("#tx-side").classList.remove("open");
  $("#fav").onclick = () => { let f = favs(); f = f.includes(p.id) ? f.filter((x) => x !== p.id) : [...f, p.id]; try { localStorage.setItem("hf-fav", JSON.stringify(f)); } catch {} $("#fav").classList.toggle("on", f.includes(p.id)); };
  $("#alert-set").onclick = () => { const v = $("#alert").value.trim(); try { v ? localStorage.setItem(`hf-alert-${p.id}`, v) : localStorage.removeItem(`hf-alert-${p.id}`); } catch {} p.alertSide = v ? (Number(v) >= p.mk.price ? "up" : "dn") : null; toast(v ? `Alert set at $${v}` : "Alert removed"); };
  { const v = Number(localStorage.getItem(`hf-alert-${p.id}`) || 0); p.alertSide = v ? (v >= p.mk.price ? "up" : "dn") : null; }
  clearInterval(S.poll);
  S.poll = setInterval(async () => {
    if (!location.hash.startsWith(`#/trade/${p.id}`)) { clearInterval(S.poll); chartOff?.destroy(); chartOff = null; return; }
    const before = p.mk.price; await loadChain(p); if (!p.mk) return;
    if (!p.trades || !p.trades.length) { await loadTrades(p); reTerm(); }
    if (Math.abs(p.mk.price - before) / before > 1e-6) {
      const el = $("#tx-capbig") || $("#tt-price"); el.textContent = capFmt(stats24(p).cap) !== "–" ? capFmt(stats24(p).cap) : fmtP(p.mk.price);
      const mo = $("#tx-mood"); if (mo) { const dn = p.mk.price < before, base = stats24(p).chg; mo.src = `./assets/mood-${dn ? "down" : "up"}.webp`; mo.classList.remove("pop"); void mo.offsetWidth; mo.classList.add("pop"); clearTimeout(S.moodT); S.moodT = setTimeout(() => { const m2 = $("#tx-mood"); if (m2) m2.src = `./assets/mood-${base > 1 ? "up" : base < -1 ? "down" : "calm"}.webp`; }, 3500); }
      el.classList.remove("flash-up", "flash-dn"); void el.offsetWidth; el.classList.add(p.mk.price > before ? "flash-up" : "flash-dn");
      const n0 = (p.trades || []).length; await loadTrades(p); reTerm();
      (p.trades || []).slice(n0).slice(-2).forEach((t) => liveAlert(p, t));
      (p.trades || []).slice(n0).filter((t) => t.who && isFol(t.who)).slice(-2).forEach((t) => window.dispatchEvent(new CustomEvent("hf-notify", { detail: { kind: "fol", text: `${uname(t.who)} ${t.buy ? "bought" : "sold"} $${usd(t.usdc)} of ${p.q.symbol}` } })));
      (p.trades || []).slice(n0).filter((t) => isWhale(p, t)).slice(-1).forEach((t) => { burst(t.buy); beep(t.buy); });
      (p.trades || []).slice(n0).filter((t) => isWhale(p, t)).slice(-1).forEach((t) => toast(`Whale ${t.buy ? "bought" : "sold"} $${usd(t.usdc)} of ${p.q.symbol}`));
      const pb = $("#tx-pos"); if (pb) pb.outerHTML = posBox(p);
      const av = Number(localStorage.getItem(`hf-alert-${p.id}`) || 0);
      if (av && p.alertSide && ((p.alertSide === "up" && p.mk.price >= av) || (p.alertSide === "dn" && p.mk.price <= av))) { window.dispatchEvent(new CustomEvent("hf-notify", { detail: { kind: "price", text: `${p.q.symbol} reached $${av}` } })); p.alertSide = null; }
    }
  }, Number(new URLSearchParams(location.search).get("poll")) || (CONFIG.demo ? 3000 : 6000));
}

// ================================================================= estados
function phase(p) {
  const { s, q } = p;
  if (s.state === 2) return { t: "Refunding", c: "refund" };
  if (s.state === 1) return s.milestonesDone >= q.milestones ? { t: "Completed", c: "funded" } : { t: "Funded", c: "funded" };
  if (S.now >= Number(q.saleEnd) || s.totalRaised >= q.hardcap) return { t: "Raise closed", c: "closed" };
  return { t: "Open", c: "open" };
}
function left(p) {
  if (p.s?.succeeded) return p.mk ? "Market open" : "Funded";
  const d = Number(p.q.saleEnd) - S.now;
  if (d <= 0) return "Closed " + day(p.q.saleEnd);
  const days = Math.floor(d / 86400);
  return days >= 1 ? `${days} day${days === 1 ? "" : "s"} left` : `${Math.ceil(d / 3600)} hours left`;
}
const logoSrc = (p) => { const l = p.meta?.logo || ""; return /^data:image\/(webp|png|jpeg);base64,/.test(l) || /^\.\/assets\/tokens\/[\w-]+\.(svg|webp)$/.test(l) ? l : ""; };
const coverSrc = (p) => { const c = p.meta?.cover || ""; return /^data:image\/(webp|png|jpeg);base64,/.test(c) || /^\.\/assets\/covers\/[\w-]+\.webp$/.test(c) ? c : ""; };
const mark = (p, lg = "") => logoSrc(p) ? `<img class="mark ${lg} logo" src="${esc(logoSrc(p))}" alt="" width="64" height="64">` : `<div class="mark ${lg}" style="background:${esc(p.meta.color)}" aria-hidden="true">${esc(initials(p.q.name))}</div>`;
const meter = (p) => `<div class="meter" role="img" aria-label="${pct(p.s.totalRaised, p.q.hardcap).toFixed(0)}% raised"><b style="width:${pct(p.s.totalRaised, p.q.hardcap)}%"></b><s style="left:${pct(p.q.softcap, p.q.hardcap)}%"></s></div>`;
const maxLoss = (p) => (p.s.state === 1 ? 100 - pct(p.s.poolAfterFees - p.s.usdcReleased, p.s.totalRaised) : p.s.state === 2 ? null : 0);

// ================================================================= portada
function vHome() {
  const live = S.list.filter((p) => p.exists);
  const raised = live.reduce((a, p) => a + p.s.totalRaised, 0n);
  const funded = live.filter((p) => p.s.succeeded).length;
  const open = S.list.filter((p) => phase(p).c === "open").length;
  return `
  <section class="hero">
    <div class="noir" aria-hidden="true"><div class="city3d"></div><div class="rain"></div><div class="rain r2"></div><div class="wet"></div></div>
    <div>
      <h1 class="glitch" data-text="Hold fast to what you back.">Hold fast to <em>what you back.</em></h1>
      <p>Back early-stage projects with USDC. Your money stays locked in a contract no one owns, and the team gets paid in stages, only when backers vote yes.</p>
      <div class="cta"><button class="btn btn-dark" type="button" data-scroll="projects">Browse projects</button><a class="btn btn-line" href="#/launch">Launch a project</a></div>
      <p class="hero-promise"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ember)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>Goal missed? You get 100% back.</p>
    </div>
    <div class="stage"><div class="moon" aria-hidden="true"></div><img src="./assets/keystone-3d.webp" width="900" height="900" alt="The Holdfast torii: a gate held up by its ember beam" fetchpriority="high"></div>
  </section>
  ${tickerHtml()}
  <section class="live" aria-label="Live numbers">
    <div><b>$${usd(raised)}</b><span>Raised on Holdfast</span></div>
    <div><b>${funded}</b><span>Projects funded</span></div>
    <div><b>${open}</b><span>Open raises</span></div>
    <div class="live-note"><i></i>Read live from the ${esc(CONFIG.chainName)} blockchain</div>
  </section>
  <h2 class="h2">How it works</h2>
  <ol class="steps">
    <li><h3>Back a project</h3><p>Your USDC goes into that project's own contract. If it's the first backing, your transaction creates the contract for a few cents.</p></li>
    <li><h3>Vote on every release</h3><p>The team gets a small part when the raise closes and the rest in stages. Each stage is paid only if backers approve it.</p></li>
    <li><h3>Get it back if it fails</h3><p>If the goal isn't met, you get 100% back. If the team disappears or loses a vote, what's left returns to backers.</p></li>
  </ol>
  ${carousel()}
  <div class="sec-h" id="projects"><h2 class="h2">Featured projects</h2><span class="faint">${S.list.length} live</span></div>
  <div class="cat-bar"><div class="cat-tabs" role="tablist">${[["trending", "Trending"], ["new", "New"], ["ending", "Ending soon"], ["funded", "Funded"]].map(([k, t]) => `<button type="button" role="tab" data-cat="${k}" aria-selected="${(S.cat || "trending") === k}">${k === "trending" ? ICO.flame + " " : ""}${t}</button>`).join("")}</div>
    <label class="cat-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="cat-q" type="search" placeholder="Search name or token" value="${esc(S.catQ || "")}" aria-label="Search projects"></label></div>
  <div class="deck" id="deck">${deckHtml()}</div>`;
}
const STAR = `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.5l2.6 7.2 7.4.3-5.8 4.7 2 7.3L12 16.8 5.8 21l2-7.3L2 9l7.4-.3z"/></svg>`;
function rarity(p) {
  const f = pct(p.s.totalRaised, p.q.hardcap);
  if (p.s.succeeded || f >= 100) return { k: "legendary", t: "Legendary", n: 4 };
  if (f >= 60) return { k: "epic", t: "Epic", n: 3 };
  if (f >= 25) return { k: "rare", t: "Rare", n: 2 };
  return { k: "common", t: "Common", n: 1 };
}
const countdown = (end) => { const s = Math.max(0, end - Math.floor(Date.now() / 1000) - ((S.now || 0) ? 0 : 0)); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return s ? `Closes in ${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(x).padStart(2, "0")}s` : "Closing"; };
const faces = (p) => { const list = Object.keys(p.order || {}).slice(-4).reverse(), n = p.backers || 0;
  if (!n) return `<span class="pc-first">Be the first backer</span>`;
  return `<span class="pc-faces">${list.map((a) => `<i style="--h:${parseInt(a.slice(2, 6), 16) % 360}"></i>`).join("")}</span><span>${n} backer${n === 1 ? "" : "s"}</span>`; };
const hot = (p) => p.hot || 0;
function catalog() {
  const q = (S.catQ || "").trim().toLowerCase(), now = S.now || Date.now() / 1000;
  let l = S.list.filter((p) => !q || p.q.name.toLowerCase().includes(q) || p.q.symbol.toLowerCase().includes(q));
  const open = (p) => phase(p).c === "open";
  switch (S.cat || "trending") {
    case "new": l = l.slice().reverse(); break;
    case "ending": l = l.filter(open).sort((a, b) => Number(a.q.saleEnd) - Number(b.q.saleEnd)); break;
    case "funded": l = l.filter((p) => p.s.succeeded); break;
    default: l = l.slice().sort((a, b) => hot(b) - hot(a) || Number(b.s.totalRaised - a.s.totalRaised));
  }
  return l;
}
function deckHtml() {
  const l = catalog(), n = S.catN || 12;
  if (!S.list.length) return `<div class="empty">No projects are live yet. <a href="#/launch">Launch the first one</a>.</div>`;
  if (!l.length) return `<div class="empty">Nothing matches. Try another name or tab.</div>`;
  return l.slice(0, n).map(card).join("") + (l.length > n ? `<button type="button" class="btn btn-line cat-more" data-more>Load more</button>` : "");
}
function bindCatalog() {
  const re = () => { $("#deck").innerHTML = deckHtml(); bindCards(); };
  document.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { S.cat = b.dataset.cat; S.catN = 12; document.querySelectorAll("[data-cat]").forEach((x) => x.setAttribute("aria-selected", x === b)); re(); }));
  const i = $("#cat-q"); if (i) i.oninput = () => { S.catQ = i.value; S.catN = 12; re(); };
  $("#deck").onclick = (e) => { if (e.target.closest("[data-more]")) { S.catN = (S.catN || 12) + 12; re(); } };
}
function carousel() {
  const list = S.list.filter((p) => coverSrc(p)).sort((a, b) => hot(b) - hot(a)).slice(0, 5); if (list.length < 2) return "";
  return `<section class="car" aria-roledescription="carousel" aria-label="Featured">
    <div class="car-track" id="car">${list.map((p) => `<a class="car-slide" href="#/p/${p.id}" style="--pc:${esc(p.meta.color)}">
      <img src="${esc(coverSrc(p))}" alt="" loading="lazy">
      <div class="car-txt">${hot(p) > 0 ? `<span class="car-hot">${ICO.flame} Trending</span>` : ""}${p.exists ? `<span class="kv-ver">✓ Verified</span>` : ""}<h3>${esc(p.q.name)}</h3><p>${esc(p.meta.tagline)}</p>
        <div class="car-num">${p.mk ? `<b>${fmtP(p.mk.price)}</b><span>Market price</span>` : `<b>$${usd(p.s.totalRaised)} <small>of $${usd(p.q.hardcap)}</small></b><span>Raised</span>`}</div></div></a>`).join("")}</div>
    <div class="car-dots">${list.map((_, i) => `<button type="button" data-car="${i}" aria-label="Slide ${i + 1}"${i ? "" : ' aria-current="true"'}></button>`).join("")}</div>
  </section>`;
}
function bindCarousel() {
  const t = $("#car"); if (!t) return; const dots = [...document.querySelectorAll("[data-car]")];
  const idx = () => Math.round(t.scrollLeft / t.clientWidth);
  const go = (i) => t.scrollTo({ left: i * t.clientWidth, behavior: "smooth" });
  t.onscroll = () => dots.forEach((d, i) => d.toggleAttribute("aria-current", i === idx()));
  dots.forEach((d, i) => (d.onclick = () => go(i)));
  let hold = 0; t.onpointerdown = () => (hold = Date.now() + 8000);
  clearInterval(S.carT); if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  S.carT = setInterval(() => { if (!document.body.contains(t)) return clearInterval(S.carT); if (Date.now() > hold) go((idx() + 1) % dots.length); }, 5000);
}
function card(p) {
  const ph = phase(p), f = pct(p.s.totalRaised, p.q.hardcap);
  const d = Math.max(0, Math.ceil((Number(p.q.saleEnd) - S.now) / 86400));
  const img = coverSrc(p) ? `<img src="${esc(coverSrc(p))}" alt="" loading="lazy">` : logoSrc(p) ? `<img class="pc-logo" src="${esc(logoSrc(p))}" alt="">` : `<b>${esc(p.q.symbol)}</b>`;
  return `<a class="pcard" href="#/p/${p.id}" data-testid="row-${p.id}" style="--pc:${esc(p.meta.color)}">
    <div class="pc-img">${img}<span class="pc-tick">${esc(p.q.symbol)}</span></div>
    <div class="pc-body">
      <h3>${esc(p.q.name)}</h3>
      <div class="meter"><b style="width:${f}%"></b><s style="left:${pct(p.q.softcap, p.q.hardcap)}%"></s></div>
      <dl class="pc-stats">
        <div><dt>Raised</dt><dd>$${usd(p.s.totalRaised)}</dd></div>
        <div><dt>Goal</dt><dd>$${usd(p.q.hardcap)}</dd></div>
        <div><dt>${ph.c === "open" ? "Days left" : "Status"}</dt><dd>${ph.c === "open" ? d : ph.t}</dd></div>
      </dl>
    </div>
  </a>`;
}
function bindCards() {
  clearInterval(S.cdT); S.cdT = setInterval(() => { const els = document.querySelectorAll(".pc-count"); if (!els.length) return clearInterval(S.cdT); els.forEach((e) => (e.textContent = countdown(Number(e.dataset.end)))); }, 1000);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll(".pcard").forEach((c) => {
    c.onpointermove = (e) => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty("--mx", `${x * 100}%`); c.style.setProperty("--my", `${y * 100}%`);
      c.style.setProperty("--rx", `${(0.5 - y) * 8}deg`); c.style.setProperty("--ry", `${(x - 0.5) * 10}deg`);
    };
    c.onpointerleave = () => { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); };
  });
}
function row(p) {
  const ph = phase(p);
  return `<a class="row" href="#/p/${p.id}" data-testid="row-${p.id}">
    ${mark(p)}
    <div><h3>${esc(p.q.name)}</h3><p class="tag">${esc(p.meta.tagline)}</p></div>
    <div class="fund">${meter(p)}<div class="meter-t"><span><b>$${usd(p.s.totalRaised)}</b> of $${usd(p.q.hardcap)}</span><span>min $${usd(p.q.softcap)}</span></div></div>
    <div class="side"><div class="status ${ph.c}">${ph.t}</div><div class="when">${left(p)}</div></div>
  </a>`;
}

// ================================================================= proyecto
const IC = {
  back: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>`,
  steps: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4v-5h4v-5h4V5h4"/></svg>`,
  lock: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  ok: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`,
};
const sib = (p, d) => S.list[(S.list.indexOf(p) + d + S.list.length) % S.list.length];
function bindSwipe(p) {
  const h = $(".kv-hero"); if (!h || S.list.length < 2) return; let x0 = null, y0 = 0;
  h.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  h.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { document.body.classList.add(dx < 0 ? "sw-l" : "sw-r"); setTimeout(() => document.body.classList.remove("sw-l", "sw-r"), 400); location.hash = `#/p/${sib(p, dx < 0 ? 1 : -1).id}`; } }, { passive: true });
}
function moneyBar(p) {
  const s = p.s; if (!p.exists || s.totalRaised === 0n) return "";
  const fee = s.succeeded ? (s.totalRaised * 100n) / 10000n : 0n, pool = s.liquidityUsdc || 0n, rel = s.usdcReleased || 0n;
  const locked = s.succeeded ? (s.poolAfterFees > rel ? s.poolAfterFees - rel : 0n) : s.totalRaised;
  const tot = Number(locked + rel + pool + fee) || 1, w = (x) => ((Number(x) / tot) * 100).toFixed(2);
  const parts = [["Locked in the contract", locked, "lk"], ["Paid to the team", rel, "pd"], ["In the market pool", pool, "pl"], ["Holdfast fee", fee, "fe"]].filter((x) => x[1] > 0n);
  return `<section class="money"><div class="money-h"><h3>Where the money is</h3><span>Read live from the contract</span></div>
    <div class="money-bar">${parts.map(([, v, c]) => `<i class="${c}" style="width:${w(v)}%"></i>`).join("")}</div>
    <dl class="money-k">${parts.map(([t, v, c]) => `<div><dt><i class="${c}"></i>${t}</dt><dd>$${usd(v)}</dd></div>`).join("")}</dl></section>`;
}
function creatorHistory(p) {
  const c = p.params.creator.toLowerCase(), mine = S.list.filter((x) => x.params.creator.toLowerCase() === c && x.id !== p.id);
  if (!mine.length) return `<section class="hist"><b>First project from this creator</b><span>Their track record on Holdfast starts here. Every release they deliver, or miss, will show on their next projects.</span></section>`;
  const ok = mine.filter((x) => x.s.succeeded && x.s.state !== 2).length, bad = mine.filter((x) => x.s.state === 2).length, done = mine.reduce((n, x) => n + Number(x.s.milestonesDone || 0), 0);
  return `<section class="hist"><b>Creator track record</b><div class="hist-n"><div><strong>${mine.length}</strong><span>Other projects</span></div><div><strong>${ok}</strong><span>Funded</span></div><div><strong>${done}</strong><span>Releases delivered</span></div><div><strong>${bad}</strong><span>Cancelled</span></div></div>
    <div class="hist-l">${mine.slice(0, 4).map((x) => `<a href="#/p/${x.id}">${esc(x.q.name)} <em>${phase(x).t}</em></a>`).join("")}</div></section>`;
}
function asideFor(p) {
  const mine = S.me && p.u.contributed > 0n, s = p.s, voting = s.voteEnd > 0n && S.now < Number(s.voteEnd);
  const main = p.mk && S.me ? tradePanel(p) : pInvest(p);
  if (mine && voting) return `${pVote(p)}${pPosition(p)}<details class="fold"><summary>${p.mk ? `Buy or sell ${esc(p.q.symbol)}` : "Back more"}</summary>${main}</details>`;
  if (mine) return `${pPosition(p)}${main}${pVote(p)}`;
  return `${main}${pVote(p)}`;
}
function vProject(p) {
  const { q } = p, ph = phase(p), step = (10000 - q.initialBps) / q.milestones / 100;
  return `
  <a class="back" href="#/">All projects</a>
  ${S.list.length > 1 ? `<nav class="kv-nav" aria-label="Other projects"><a href="#/p/${sib(p, -1).id}" aria-label="Previous project">‹</a><span>${S.list.indexOf(p) + 1} / ${S.list.length}</span><a href="#/p/${sib(p, 1).id}" aria-label="Next project">›</a></nav>` : ""}
  <header class="kv-hero${coverSrc(p) ? " has-cover" : ""}" style="--pc:${esc(p.meta.color)}">
    ${coverSrc(p) ? `<img class="kv-cover" src="${esc(coverSrc(p))}" alt="">` : `<div class="kv-art" aria-hidden="true"><i class="pc-sun"></i></div>`}
    <div class="kv-id">
      ${coverSrc(p) ? "" : logoSrc(p) ? `<img class="kv-coin" src="${esc(logoSrc(p))}" alt="">` : `<div class="kv-coin kv-coin-text">${esc(q.symbol)}</div>`}
      <div class="kv-text">
        ${p.exists ? `<div class="kv-tags"><span class="kv-ver">✓ Verified</span></div>` : ""}
        <h1>${esc(q.name)}</h1>
        <p>${esc(p.meta.tagline)}</p>
        
      </div>
    </div>
  </header>
  <section class="kv-stats" aria-label="Key numbers">
    <div><b class="kv-faces">${faces(p)}</b><span>Backers</span></div>
    <div>${ph.c === "open" ? `<b class="pc-count kv-count" data-end="${Number(q.saleEnd)}">${countdown(Number(q.saleEnd)).replace("Closes in ", "")}</b><span>Until the raise closes</span>` : `<b>${ph.t}</b><span>Status</span>`}</div>
    <div>${p.mk ? `<b>${fmtP(p.mk.price)} <em class="kv-chg ${p.mk.price >= p.mk.round ? "up" : "dn"}">${p.mk.price >= p.mk.round ? "+" : ""}${(((p.mk.price - p.mk.round) / p.mk.round) * 100).toFixed(1)}%</em></b><span>Market price</span>` : `<b>${fmtP(Number(q.hardcap) / 1e6 / (Number(q.saleTokens) / 1e18))}</b><span>Price per ${esc(q.symbol)}</span>`}</div>
  </section>
  <div class="layout">
    <div>
      <div class="ptabs" role="tablist" aria-label="Project sections">${TABS_ALL(p).slice(0).filter(([k]) => k !== "team" || true).map(([k, t]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${S.tab === k}">${t}</button>`).join("")}</div>
      <div class="ptab-body">${tabBody(p)}</div>
    </div>
    <aside class="aside">${asideFor(p)}</aside>
  </div>
  ${buyBar(p)}`;
}
const TORII = `<svg viewBox="0 0 100 100" width="28" height="28" aria-hidden="true"><path class="g-top" d="M6 18 Q50 27 94 18 L92 30 Q50 38 8 30Z"/><rect class="g-top" x="16" y="38" width="68" height="8" rx="2"/><path class="g-leg" d="M26 34 H35 L34 96 H25Z M65 34 H74 L75 96 H66Z"/></svg>`;
const TABS_ALL = (p) => [["overview", "Overview"], ...(p.mk ? [["trade", "Trade"]] : []), ["team", "Team"], ["releases", "Releases"], ["updates", "Updates"], ["backers", "Backers"], ["qa", "Q&A"], ["contract", "Contract"]];
const TABS = TABS_ALL({});
const NAMES = ["Lobo", "Zorro", "Halcon", "Tigre", "Cobra", "Puma", "Oso", "Buho", "Lince", "Jaguar"];
const uname = (a) => S.prof?.[a.toLowerCase()]?.name || `${NAMES[parseInt(keccak256(toBytes(a.toLowerCase())).slice(2, 4), 16) % NAMES.length]}-${parseInt(a.slice(-4), 16) % 9000 + 1000}`;
function avatar(addr, size = 36) {
  const pr = S.prof?.[addr.toLowerCase()]; if (pr?.photo) return `<img class="ava" src="${esc(pr.photo)}" alt="" style="width:${size}px;height:${size}px;object-fit:cover" aria-hidden="true">`;
  const h = keccak256(toBytes(addr.toLowerCase())), a = parseInt(h.slice(2, 6), 16) % 360, b = (a + 140) % 360;
  return `<span class="ava" style="width:${size}px;height:${size}px;background:conic-gradient(from ${parseInt(h.slice(6, 8), 16)}deg, hsl(${a} 70% 55%), hsl(${b} 65% 45%), hsl(${a} 70% 55%))" aria-hidden="true"></span>`;
}
function team(p) { try { return JSON.parse(p.meta.team || "[]"); } catch { return []; } }
function tabBody(p) {
  const { q } = p, step = (10000 - q.initialBps) / q.milestones / 100;
  if (S.tab === "team") {
    const t = team(p);
    return t.length ? `<div class="team">${t.map((m) => `<div class="member">${m.photo ? `<img src="${esc(m.photo)}" alt="" width="56" height="56">` : `<span class="m-ini" style="--pc:${esc(p.meta.color)}">${esc(initials(m.name))}</span>`}
      <div><b>${esc(m.name)}</b><span>${esc(m.role || "")}</span>${m.link ? `<a href="${esc(m.link)}" target="_blank" rel="noopener nofollow">${esc(m.link.replace(/^https:\/\//, "").replace(/\/$/, ""))}</a>` : ""}</div></div>`).join("")}</div>
      <p class="fine">Team details are provided and signed by the creator. Holdfast reviews them before approval.</p>` : `<p class="prose">The team hasn't added profiles yet.</p>`;
  }
  if (S.tab === "trade" && p.mk) {
    const m = p.mk, tr = (p.trades || []).slice(-10).reverse();
    return `<div class="cy-wrap">
      <a class="btn btn-cyber" href="#/trade/${p.id}" style="margin-bottom:24px">Open trading terminal</a>
      <div class="cy-stats"><div><span>Price</span><b>${fmtP(m.price)}</b></div><div><span>Round price</span><b>${fmtP(m.round)}</b></div>
        <div><span>Pool liquidity</span><b>$${usd(m.poolUsdc)}</b></div><div><span>Liquidity</span><b>Locked forever</b></div></div>
      <div class="cy-chart-box"><div class="cy-legend"><span class="l1">Price</span><span class="l2">Round price</span></div>${chartSvg(p)}</div>
      <h3 class="cy-h">Recent trades</h3>
      ${tr.length ? `<ul class="cy-trades">${tr.map((t) => `<li><span class="${t.buy ? "b" : "s"}">${t.buy ? "Buy" : "Sell"}</span><span>${tok(t.tok)} ${esc(p.q.symbol)}</span><span>$${usd(t.usdc)}</span><span>${fmtP(t.price)}</span><span class="faint">${ago((p.tHead || 0n) - t.block)}</span></li>`).join("")}</ul>` : `<p class="prose">No trades yet. Be the first.</p>`}
      <p class="fine">The pool was created by the project's contract at the round price. Its liquidity is locked in the contract forever: nobody can take it out. <a href="https://app.uniswap.org/explore/pools/ethereum_sepolia/${p.s.pool}" target="_blank" rel="noopener">View on Uniswap</a></p>
    </div>`;
  }
  if (S.tab === "releases") return stages(p);
  if (S.tab === "updates") {
    const mine = S.me && S.me.toLowerCase() === p.params.creator.toLowerCase(), ups = (p.updates || []).slice().sort((x, y) => y.ts - x.ts);
    return `${mine ? `<div class="ask"><textarea id="up-${p.id}" maxlength="1500" placeholder="Share progress with your backers: what shipped, links, numbers"></textarea><button class="btn btn-dark btn-sm" data-act="postUpdate" data-id="${p.id}">Sign and post</button></div>` : ""}
      ${ups.length ? `<ol class="ups">${ups.map((u) => `<li><div class="up-h"><span class="up-ok">✓ Signed by the creator's wallet</span><time>${new Date(u.ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time></div><p>${esc(u.text)}</p></li>`).join("")}</ol>`
        : `<p class="prose">No updates yet. Every update here is signed by the creator's wallet, so no one else can post in their name.</p>`}`;
  }
  if (S.tab === "backers") {
    const r = p.recent || [];
    return r.length ? `<ul class="backers">${r.map((x) => `<li>${avatar(x.who)}<span class="addr">${short(x.who)}</span><b>$${usd(x.amt)}</b><span class="faint">${ago((p.head || 0n) - x.block)}</span></li>`).join("")}</ul>
      <p class="fine">Read live from the blockchain.</p>` : `<p class="prose">No backers yet. Be the first: your backing also creates the contract.</p>`;
  }
  if (S.tab === "qa") {
    const isCreator = isMe(q.creator);
    const list = (p.qa || []).map((x) => `<div class="qa">
      <div class="qa-q">${avatar(x.author, 28)}<div><div class="qa-meta"><span class="addr">${short(x.author)}</span>${p.order?.[x.author.toLowerCase()] ? `<span class="tag-b">Backer</span>` : ""}</div><p>${esc(x.text)}</p></div></div>
      ${x.answer ? `<div class="qa-a"><span class="tag-c">Creator</span><p>${esc(x.answer.text)}</p></div>` : isCreator ? `<div class="qa-reply"><textarea id="ans-${x.ts}" maxlength="800" placeholder="Write your answer"></textarea><button class="btn btn-line btn-sm" data-act="answer" data-qts="${x.ts}">Sign and answer</button></div>` : `<p class="faint qa-wait">Waiting for the creator's answer.</p>`}
    </div>`).join("");
    return `${S.me ? `<div class="ask"><textarea id="ask" maxlength="800" placeholder="Ask the team anything about this project"></textarea><button class="btn btn-dark btn-sm" data-act="ask">Sign and ask</button></div>` : `<p class="fine">Connect your wallet to ask a question.</p>`}
      ${list || `<p class="prose">No questions yet.</p>`}`;
  }
  if (S.tab === "contract") return `<div class="kv">
      <div><span class="muted">Address</span><a class="addr" href="${CONFIG.explorer}/address/${p.address}" target="_blank" rel="noopener">${short(p.address)}</a></div>
      <div><span class="muted">Status</span><span>${p.exists ? "Live on-chain" : "Created by the first backing"}</span></div>
      <div><span class="muted">Team wallet</span><span class="addr">${short(q.creator)}</span></div>
      <div><span class="muted">Holdfast fee</span><span>1% of funds + 1.5% of tokens, only if funded</span></div>
      <div><span class="muted">Network</span><span>${esc(CONFIG.chainName)}</span></div></div>`;
  return `<p class="prose">${esc(p.meta.about)}</p>
    ${moneyBar(p)}${creatorHistory(p)}
${phase(p).c === "open" ? `    <section class="sim" aria-label="Investment simulator">
      <div class="sim-h"><h3>Simulate your backing</h3><b id="sim-v">$100</b></div>
      <input id="sim" type="range" min="10" max="1000" step="10" value="100" aria-label="Amount to simulate">
      <div class="sim-rows">
        <div class="sim-case"><span>Goal of $${usd(q.softcap)} missed</span><b id="sim-miss"></b><i class="sim-bar"><s id="bar-miss"></s></i></div>
        <div class="sim-case"><span>Team stops after release 1</span><b id="sim-stop"></b><i class="sim-bar"><s id="bar-stop"></s></i></div>
        <div class="sim-case"><span>Every release approved</span><b>You keep all your tokens</b><i class="sim-bar"><s style="width:100%"></s></i></div>
      </div>
    </section>` : ""}
`;
}
function bindTab(p) {
  const r = $("#sim"); if (!r) return;
  const upd = () => {
    const v = BigInt(r.value) * 1_000_000n, q = p.q, first = BigInt(q.initialBps) + BigInt(Math.floor((10000 - q.initialBps) / q.milestones));
    $("#sim-v").textContent = `$${usd(v)}`;
    if ($("#sim-tok")) $("#sim-tok").textContent = `${tok((v * q.saleTokens) / q.hardcap)} ${q.symbol}`;
    $("#sim-miss").textContent = `$${usd(v)} back`;
    const stop = (v * 99n * (10000n - first)) / 1000000n;
    $("#sim-stop").textContent = `about $${usd(stop)} back`;
    $("#bar-miss").style.width = "100%"; $("#bar-stop").style.width = `${Number((stop * 1000n) / v) / 10}%`;
    r.style.setProperty("--fill", `${((Number(r.value) - 10) / 990) * 100}%`);
  };
  r.oninput = upd; upd();
}
function celebrate(p) {
  if (!p.s.succeeded) return;
  const k = `hf-cele-${p.id}`;
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, "1"); } catch {}
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.createElement("div"); el.className = "cele"; el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<div class="cele-in">${TORII}<b>Goal reached</b><span>${esc(p.q.name)} is funded</span></div>`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}
async function backerCard(p) {
  const n = p.order?.[S.me.toLowerCase()], amt = p.u.contributed, r = rarity(p);
  const c = document.createElement("canvas"); c.width = 900; c.height = 1260; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 1260); g.addColorStop(0, "#1a1b1f"); g.addColorStop(1, "#0f1012");
  x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, 900, 1260, 48); x.fill();
  const rim = x.createLinearGradient(0, 0, 900, 1260); ["#f2f2ef", "#ffd36b", "#4fd1c5", "#7868e6", "#e0335c"].forEach((col, i) => rim.addColorStop(i / 4, col));
  x.strokeStyle = r.k === "legendary" ? rim : r.k === "common" ? "#393b40" : "#f2f2ef"; x.lineWidth = 8; x.beginPath(); x.roundRect(4, 4, 892, 1252, 46); x.stroke();
  x.save(); x.beginPath(); x.roundRect(48, 120, 804, 600, 32); x.clip();
  x.fillStyle = p.meta.color; x.globalAlpha = .25; x.fillRect(48, 120, 804, 600); x.globalAlpha = 1;
  const sun = x.createLinearGradient(0, 200, 0, 680); sun.addColorStop(0, "#ffb27a"); sun.addColorStop(.5, p.meta.color); sun.addColorStop(1, "#3a1440");
  x.fillStyle = sun; x.beginPath(); x.arc(450, 440, 230, 0, Math.PI * 2); x.fill();
  x.fillStyle = "rgba(15,16,18,.6)"; [[520, 14], [570, 12], [615, 10]].forEach(([y, h]) => x.fillRect(200, y, 500, h));
  x.restore();
  const src = logoSrc(p);
  if (src) { const im = new Image(); im.src = src; await im.decode().catch(() => {}); x.save(); x.beginPath(); x.arc(450, 420, 120, 0, Math.PI * 2); x.clip(); x.drawImage(im, 330, 300, 240, 240); x.restore(); }
  x.fillStyle = "#f2f2ef"; x.font = "600 30px 'Inter Tight', sans-serif"; x.fillText(`${"★".repeat(r.n)} ${r.t.toUpperCase()}`, 56, 82);
  x.textAlign = "right"; x.fillText("HOLDFAST", 844, 82); x.textAlign = "left";
  x.font = "500 76px 'Instrument Serif', Georgia, serif"; x.fillText(p.q.name, 56, 830);
  x.fillStyle = "#b4b5b1"; x.font = "400 34px 'Inter Tight', sans-serif"; x.fillText(n ? `Backer #${n}` : "Backer", 56, 890);
  x.fillStyle = "#ff2e88"; x.font = "600 96px 'Inter Tight', sans-serif"; x.fillText(`$${usd(amt)}`, 56, 1030);
  x.fillStyle = "#7e8085"; x.font = "400 30px 'Inter Tight', sans-serif"; x.fillText(`${tok((amt * p.q.saleTokens) / p.q.hardcap)} ${p.q.symbol}  ·  ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, 56, 1090);
  x.fillText(short(S.me), 56, 1190); x.textAlign = "right"; x.fillText("holdfast", 844, 1190);
  const url = c.toDataURL("image/png");
  const el = $("#sheet");
  el.innerHTML = `<h3>Your backer card</h3><p class="muted" style="margin:0;font-size:14.5px">Save it or share it. It shows your backing, not a financial instrument.</p>
    <img class="bcard" src="${url}" alt="Your Holdfast backer card for ${esc(p.q.name)}">
    <div class="actions"><a class="btn btn-ember btn-sm" href="${url}" download="holdfast-${p.id}-backer.png">Download</a><button class="btn btn-line btn-sm" type="button" id="bc-share">Share</button><button class="btn btn-soft btn-sm" type="button" id="bc-close">Close</button></div>`;
  el.classList.add("on"); $("#veil").classList.add("on");
  $("#bc-close").onclick = () => { el.classList.remove("on"); $("#veil").classList.remove("on"); };
  $("#bc-share").onclick = async () => {
    try { const blob = await (await fetch(url)).blob(); const file = new File([blob], `holdfast-${p.id}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `I backed ${p.q.name} on Holdfast` }); else toast("Sharing isn't available here. Use Download.");
    } catch {}
  };
}
function buyBar(p) {
  const ended = S.now >= Number(p.q.saleEnd) || p.s.totalRaised >= p.q.hardcap;
  if (!S.me || p.s.state !== 0 || ended) return "";
  return `<div class="buybar" id="buybar"><div><span class="bb-k">Back ${esc(p.q.symbol)}</span><b id="bb-amt">Enter an amount</b></div><button type="button" class="btn btn-ember" id="bb-go">Back now</button></div>`;
}
function stages(p) {
  const { s, q } = p, step = (10000 - q.initialBps) / q.milestones / 100;
  const items = [{ t: "Upfront", pct: q.initialBps / 100, done: s.succeeded, sub: "When the raise closes successfully" }];
  for (let i = 0; i < q.milestones; i++) {
    const done = i < s.milestonesDone, now = s.state === 1 && i === s.milestonesDone;
    let sub = done ? "Approved by backers" : "Pending";
    if (now) sub = s.voteEnd > 0n ? `Voting until ${day(s.voteEnd)}${s.retrying ? " · second chance" : ""}` : s.retrying ? `Rejected once · second chance until ${day(s.deadline)}` : `The team must request it by ${day(s.deadline)}`;
    if (s.state === 2 && !done) sub = "Cancelled, funds returned to backers";
    items.push({ t: `Release ${i + 1}`, pct: step, done, now, sub });
  }
  return `<ol class="tl tl-torii">${items.map((x, i) => `<li class="${x.done ? "done" : x.now ? "now" : ""}"><span class="gate">${TORII}</span>
    <div><div class="t">${x.t}</div><div class="s">${x.sub}</div></div><span class="pct">${x.pct}%</span></li>`).join("")}</ol>`;
}
function pInvest(p) {
  const { s, q } = p, ended = S.now >= Number(q.saleEnd) || s.totalRaised >= q.hardcap;
  const room = q.hardcap > s.totalRaised ? q.hardcap - s.totalRaised : 0n;
  let act;
  if (s.state === 0 && !ended) {
    act = S.me ? `
      <div class="inv-field">
        <label for="amt">Amount</label>
        <div class="field-amt"><input id="amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" data-testid="amount"><span class="u">USDC</span></div>
        <div class="quick">${[25, 50, 100].map((v) => `<button type="button" data-quick="${v}">$${v}</button>`).join("")}<button type="button" data-max>Max</button></div>
      </div>
      <div class="inv-get"><span>You receive</span><b id="receive">0 ${esc(q.symbol)}</b></div>
      <button class="btn btn-ember btn-block" data-act="buy" data-testid="buy">Back ${esc(q.name)}</button>
      ${p.exists ? "" : `<p class="inv-note">You're early: your backing also creates this project's contract.</p>`}`
      : `<button class="btn btn-ember btn-block" data-act="connect">Connect wallet to back</button>`;
  } else if (s.state === 0) {
    act = p.exists ? `<button class="btn btn-dark btn-block" data-act="finalize" data-testid="finalize">Close the raise</button><div class="note">The raise has ended. Anyone can close it to release tokens or refunds.</div>`
      : `<div class="note">The raise ended with no backers.</div>`;
  } else if (s.state === 2) {
    act = `<div class="note warn">${s.succeeded ? "Backers rejected a release or the team missed a deadline." : "The minimum goal wasn't reached."} What's left is being returned to backers.</div>`;
  } else act = `<div class="note ok">Funded. The team is paid in stages that backers approve.</div>`;
  return `<div class="panel inv">
    <div class="inv-head"><span>Raised</span><span>${pct(s.totalRaised, q.hardcap).toFixed(0)}%</span></div>
    <div class="big">$${usd(s.totalRaised)} <small>of $${usd(q.hardcap)}</small></div>
    <div style="margin-top:16px">${meter(p)}</div>
    <div class="meter-t"><span>Minimum $${usd(q.softcap)}</span><span>${room > 0n && s.state === 0 ? `$${usd(room)} left` : left(p)}</span></div>
    ${act}
    <details class="inv-more"><summary>Details</summary>
      <div class="lines">
        <div><span>Price</span><b>1 USDC = ${tok((q.saleTokens * 1_000_000n) / q.hardcap)} ${esc(q.symbol)}</b></div>
        <div><span>Closes</span><b>${day(q.saleEnd)}</b></div>
        <div><span>If the goal is missed</span><b id="refundline">100% back</b></div>
        <div><span>Network fee</span><b>${p.exists ? "Less than $0.01" : "A few cents, once"}</b></div>
        ${S.me ? `<div><span>Your balance</span><b>${usd(S.usdc)} USDC</b></div>` : ""}
        <div><span>Safety</span><b>No admin keys · paid in voted stages</b></div>
      </div></details></div>`;
}
function pPosition(p) {
  const { s, u, q } = p;
  const back = s.state === 2 && s.totalRaised > 0n ? (s.refundPool * u.contributed) / s.totalRaised : 0n;
  const btns = [];
  if (s.succeeded && !u.claimed) btns.push(`<button class="btn btn-ember btn-block" data-act="claimTokens" data-testid="claim">Claim my tokens</button>`);
  if (s.state === 2 && !u.settled) btns.push(`<button class="btn btn-ember btn-block" data-act="refund" data-testid="refund">Get my money back</button>`);
  const safe = s.state === 0 ? "100% protected until the raise closes" : s.state === 1 ? `${(100 - maxLoss(p)).toFixed(0)}% of your money is still protected` : s.state === 2 ? (u.settled ? "Refund withdrawn" : `Refund ready: $${usd(back)}`) : "";
  return `<div class="panel pos-c"><div class="pos-top"><div><span>Your investment</span><b>$${usd(u.contributed)}</b></div><div><span>Your tokens</span><b>${tok(s.succeeded && !u.claimed ? (u.contributed * q.saleTokens) / q.hardcap : u.balance)} ${esc(q.symbol)}</b></div></div>
    ${safe ? `<p class="pos-safe" data-testid="risk">${ICO.shield} ${safe}</p>` : ""}
    ${btns.length ? `<div style="display:grid;gap:8px;margin-top:12px">${btns.join("")}</div>` : ""}
    <button class="pos-card" type="button" data-act="card" data-testid="backer-card">Get my backer card →</button></div>`;
}
function pVote(p) {
  const { s, u, q } = p;
  if (s.state !== 1 || s.milestonesDone >= q.milestones) return "";
  const open = s.voteEnd > 0n && S.now < Number(s.voteEnd), total = s.votesYes + s.votesNo || 1n;
  let b;
  if (s.voteEnd > 0n) {
    const promise = (() => { try { return JSON.parse(p.meta.plan || "[]")[s.milestonesDone] || ""; } catch { return ""; } })();
    const yp = pct(s.votesYes, total), np = pct(s.votesNo, total);
    b = `<div class="vt-h"><span>Release ${s.milestonesDone + 1} of ${q.milestones}${s.retrying ? " · second chance" : ""}</span><b>${open ? `Closes ${day(s.voteEnd)}` : "Voting ended"}</b></div>
      ${promise ? `<div class="vt-promise"><span>They promised</span><p>${esc(promise)}</p></div>` : ""}
      <p class="vt-hint">Check the Updates tab, then vote. Your vote weighs as much as you put in.</p>
      <div class="vt-bar"><i class="y" style="width:${yp}%"></i><i class="n" style="width:${np}%"></i></div>
      <div class="vt-k"><span class="y">Approve $${usd(s.votesYes)} · ${yp.toFixed(0)}%</span><span class="n">Reject $${usd(s.votesNo)} · ${np.toFixed(0)}%</span></div>`;
    if (open && u.contributed > 0n && !u.voted) b += `<div class="vt-btns"><button class="btn btn-ember" data-act="voteYes" data-testid="vote-yes">Approve release</button><button class="btn btn-line" data-act="voteNo" data-testid="vote-no">Reject</button></div>`;
    else if (open && u.voted) b += `<div class="note ok">You voted on this release. Results update live.</div>`;
    else if (open) b += `<p class="vt-hint">Only backers can vote.</p>`;
    if (!open) b += `<button class="btn btn-dark btn-block" style="margin-top:16px" data-act="closeVote" data-testid="close-vote">Apply the result</button>`;
  } else if (S.now <= Number(s.deadline)) {
    b = s.retrying ? `<div class="note warn">Backers rejected release ${s.milestonesDone + 1}. Second chance: the team has until ${day(s.deadline)} to show progress and ask again. No money is released meanwhile; if they lose again, what's left returns to backers.</div>`
      : `<p class="muted" style="margin:0">The team must request release ${s.milestonesDone + 1} by ${day(s.deadline)}.</p>`;
    if (isMe(q.creator)) b += `<button class="btn btn-line btn-block" style="margin-top:16px" data-act="requestRelease" data-testid="request">Request release ${s.milestonesDone + 1}</button>`;
  } else {
    b = `<p class="muted" style="margin:0">The team missed the deadline. Anyone can cancel the project and return what's left.</p>
      <button class="btn btn-danger btn-block" style="margin-top:16px" data-act="abandon" data-testid="abandon">Cancel and refund backers</button>`;
  }
  return `<div class="panel vt"><h3>Release vote</h3>${b}</div>`;
}

// ================================================================= creador
const chip = (name, vals, def, fmt = (v) => v) => `<div class="chips">${vals.map((v) => `<label><input type="radio" name="${name}" value="${v}" ${v === def ? "checked" : ""}><span>${fmt(v)}</span></label>`).join("")}</div>`;
const STEPS = ["Project", "Team", "Money", "Review"];
function vLaunch() {
  if (!S.me) return `<div class="page-h"><h1>Launch a project</h1><p>Connect your wallet. It's the wallet that receives the funds and signs your project.</p></div>
    <button class="btn btn-dark" data-act="connect">Connect wallet</button>`;
  return `<div class="page-h"><h1>Launch a project</h1><p>Four short steps. Holdfast reviews every project before it goes live. Signing is free.</p></div>
  <ol class="wz-steps" id="wz-steps">${STEPS.map((t, i) => `<li data-go="${i}"${i ? "" : ' aria-current="step"'}><b>${i + 1}</b><span>${t}</span></li>`).join("")}</ol>
  <div class="layout"><form id="form" novalidate>
    <section class="wz" data-step="0">
      <h2 class="wz-h">Your project</h2>
      <div class="f"><label>Cover image</label><label class="cover-pick" id="cover-pick"><input id="f-cover" type="file" accept="image/png,image/jpeg,image/webp"><span>Upload cover · 4:3 · it's the first thing backers see</span></label></div>
      <div class="two">
        <div class="f"><label>Token logo</label><div class="logo-pick"><span class="logo-prev" id="logo-prev" aria-hidden="true"></span><input id="f-logo" type="file" accept="image/png,image/jpeg,image/webp"></div><small>Square. So people recognise your token.</small></div>
        <div class="f"><label>Colour</label><div class="chips swatch">${COLORS.map((c, i) => `<label><input type="radio" name="color" value="${c}" ${i ? "" : "checked"}><span style="--c:${c}" aria-label="Colour ${i + 1}"></span></label>`).join("")}</div></div>
      </div>
      <div class="f"><label for="f-name">Name</label><input id="f-name" name="name" maxlength="40" placeholder="Rooftop Gardens"></div>
      <div class="two">
        <div class="f"><label for="f-symbol">Ticker</label><input id="f-symbol" name="symbol" maxlength="8" placeholder="ROOF" style="text-transform:uppercase"></div>
        <div class="f"><label for="f-cat">Category</label><select id="f-cat" name="category">${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select></div>
      </div>
      <div class="f"><label for="f-tag">One-line summary</label><input id="f-tag" name="tagline" maxlength="120" placeholder="What you do and who it's for"></div>
      <div class="f"><label for="f-about">Description</label><textarea id="f-about" name="about" maxlength="2000" placeholder="What the money is for, the timeline, and how backers will see progress."></textarea><small>40 to 2,000 characters.</small></div>
      <div class="f"><label>Official links</label><div class="two">${[["web", "Website"], ["x", "X / Twitter"], ["telegram", "Telegram"], ["discord", "Discord"], ["github", "GitHub"]].map(([k, t]) => `<input name="ln-${k}" maxlength="120" placeholder="${t} · https://" aria-label="${t}">`).join("")}</div><small>At least one. Backers use them to check you exist.</small></div>
      <div class="f"><label for="f-risks">Main risks</label><textarea id="f-risks" name="risks" maxlength="800" placeholder="Be honest: what could go wrong and how you'd handle it."></textarea></div>
    </section>
    <section class="wz" data-step="1" hidden>
      <h2 class="wz-h">Your team</h2>
      <div class="f"><label class="anon-t"><input type="checkbox" name="anon" id="f-anon"><span><b>We're anonymous</b><small>Allowed with protected mode: 0% upfront, at least 5 small releases voted by backers, and up to $10,000 on your first project. The most anyone could lose is one release.</small></span></label></div>
      <div id="tm-box"><p class="fine" style="margin:0 0 16px">Add up to 4 people with a photo and a public link (X, GitHub, LinkedIn or a website).</p>
      ${[0, 1, 2, 3].map((i) => `<div class="tm-row${i > 0 ? " d-none" : ""}" data-tm="${i}">
        <label class="tm-photo" title="Photo"><input type="file" accept="image/png,image/jpeg,image/webp" data-tmphoto="${i}"><span id="tmp-${i}" aria-hidden="true"></span></label>
        <input name="tm-name-${i}" maxlength="40" placeholder="Name" aria-label="Team member name">
        <input name="tm-role-${i}" maxlength="40" placeholder="Role" aria-label="Team member role">
        <input name="tm-link-${i}" maxlength="120" placeholder="https://" aria-label="Team member link">
      </div>`).join("")}
      <button type="button" class="btn btn-soft btn-sm" id="tm-add">Add team member</button></div>
    </section>
    <section class="wz" data-step="2" hidden>
      <h2 class="wz-h">The money</h2>
      <div class="two">
        <div class="f"><label for="f-soft">Minimum goal (USDC)</label><input id="f-soft" name="soft" type="number" inputmode="decimal" min="1" value="1000"><small>Below this, everyone is refunded.</small></div>
        <div class="f"><label for="f-hard">Maximum goal (USDC)</label><input id="f-hard" name="hard" type="number" inputmode="decimal" min="1" value="5000"></div>
      </div>
      <div class="f"><label>Raise length</label>${chip("days", [14, 30, 45, 60], 30, (d) => `${d} days`)}</div>
      <div class="f"><label>How the money will be used</label><div class="use-grid">${USE_KEYS.map((k, i) => `<label class="use-i"><span>${k}</span><input type="number" name="use-${i}" min="0" max="100" value="${[60, 15, 15, 10, 0][i]}"><em>%</em></label>`).join("")}</div><small id="use-sum">Must add up to 100%.</small></div>
      <details class="adv"><summary>Advanced: tokens, releases and market</summary>
        <div class="two">
          <div class="f"><label for="f-st">Tokens for backers</label><input id="f-st" name="saleTokens" type="number" inputmode="numeric" min="1" value="1000000"></div>
          <div class="f"><label for="f-ct">Tokens for your team</label><input id="f-ct" name="creatorTokens" type="number" inputmode="numeric" min="0" value="300000"><small>Unlocked with each approved release.</small></div>
        </div>
        <div class="f"><label>Upfront when the raise closes</label>${chip("initial", [0, 5, 10, 20], 10, (v) => `${v}%`)}</div>
        <div class="f"><label>Number of voted releases</label>${chip("ms", [2, 3, 4, 5, 6], 3)}</div>
        <div class="f"><label>Window to request each release</label>${chip("period", [30, 60, 90], 60, (v) => `${v} days`)}<small>If you don't request it in time, the rest goes back to backers.</small></div>
        <div class="f"><label>Liquidity for the Uniswap market</label>${chip("liq", [5, 10, 15, 20, 25], 10, (v) => `${v}%`)}<small>Opens a pool at the round price, locked forever.</small></div>
      </details>
      <div class="f"><label>What you deliver in each release</label><div id="plan-box"></div><small>Backers vote on each release against this promise.</small></div>
    </section>
    <section class="wz" data-step="3" hidden>
      <h2 class="wz-h">Review and sign</h2>
      <div id="review"></div>
      <p class="fine">Signing is free and doesn't move money. Holdfast reviews your project; once approved it goes live and its contract is created by the first backer.</p>
    </section>
    <p class="form-error" id="ferr" role="alert"></p>
    <div class="wz-nav"><button type="button" class="btn btn-line" id="wz-back" hidden>Back</button><button type="button" class="btn btn-ember" id="wz-next">Continue</button>
      <button class="btn btn-ember" type="submit" id="wz-sign" data-testid="submit-project" hidden>Sign and submit for review</button></div>
  </form>
  <aside class="aside"><div class="wz-prev-h">Live preview</div><div id="preview"></div><div id="prev-facts"></div></aside></div>`;
}
function readForm() {
  const f = new FormData($("#form")), g = (k) => String(f.get(k) ?? "").trim();
  const name = g("name"), id = (name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "project") + "-" + (S.draftId ||= Math.random().toString(16).slice(2, 6));
  const usdc = (v) => { try { return parseUnits(v || "0", 6).toString(); } catch { return "0"; } };
  const toks = (v) => { try { return parseUnits(v || "0", 18).toString(); } catch { return "0"; } };
  const anon = !!f.get("anon");
  const tm = anon ? [] : [0, 1, 2, 3].map((i) => ({ name: g(`tm-name-${i}`), role: g(`tm-role-${i}`), link: g(`tm-link-${i}`), photo: S.tmPhotos?.[i] || "" }))
    .filter((m) => m.name).map((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v)));
  const links = Object.fromEntries(USE_LINKS.map((k) => [k, g(`ln-${k}`)]).filter(([, v]) => v));
  const use = Object.fromEntries(USE_KEYS.map((k, i) => [k, Math.round(Number(g(`use-${i}`)) || 0)]).filter(([, v]) => v > 0));
  const ms = anon ? String(Math.max(5, Number(g("ms")))) : g("ms");
  const plan = [...Array(Number(ms))].map((_, i) => g(`plan-${i}`));
  return { id, meta: { category: g("category"), color: g("color"), tagline: g("tagline"), about: g("about"), logo: S.logo || "", team: tm.length ? JSON.stringify(tm) : "",
      cover: S.cover || "", links: Object.keys(links).length ? JSON.stringify(links) : "", plan: JSON.stringify(plan), use: JSON.stringify(use), risks: g("risks"), anon: anon ? "1" : "" },
    params: { creator: S.me, name, symbol: g("symbol").toUpperCase(), softcap: usdc(g("soft")), hardcap: usdc(g("hard")),
      saleTokens: toks(g("saleTokens")), creatorTokens: toks(g("creatorTokens")), saleEnd: String(Math.floor(Date.now() / 1000) + Number(g("days")) * 86400),
      initialBps: anon ? "0" : String(Number(g("initial")) * 100), milestones: ms, milestonePeriod: String(Number(g("period")) * 86400), liquidityBps: String(Number(g("liq") || 10) * 100) } };
}
async function pickImage(e, size, max, done) {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const img = await createImageBitmap(f), c = document.createElement("canvas"); c.width = c.height = size;
    const k = Math.max(size / img.width, size / img.height), w = img.width * k, h = img.height * k;
    c.getContext("2d").drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    let url = c.toDataURL("image/webp", 0.85); if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/jpeg", 0.85);
    for (let q = 0.7; url.length > max && q > 0.2; q -= 0.15) url = c.toDataURL("image/jpeg", q);
    if (url.length > max) return toast("That image is too big. Try a simpler one.", true);
    done(url);
  } catch { toast("That file isn't an image we can read.", true); }
}
async function pickCover(e) {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const img = await createImageBitmap(f), c = document.createElement("canvas"); c.width = 800; c.height = 600;
    const k = Math.max(800 / img.width, 600 / img.height), w = img.width * k, h = img.height * k;
    c.getContext("2d").drawImage(img, (800 - w) / 2, (600 - h) / 2, w, h);
    let url = ""; for (const qv of [0.82, 0.7, 0.55, 0.4]) { url = c.toDataURL("image/webp", qv); if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/jpeg", qv); if (url.length <= 300000) break; }
    if (url.length > 300000) return toast("That cover is too big. Try a simpler image.", true);
    S.cover = url; $("#cover-pick").style.backgroundImage = `url("${url}")`; $("#cover-pick").classList.add("has"); preview();
  } catch { toast("That file isn't an image we can read.", true); }
}
async function pickLogo(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const img = await createImageBitmap(f);
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const k = Math.max(256 / img.width, 256 / img.height), w = img.width * k, h = img.height * k;
    c.getContext("2d").drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h);
    let url = c.toDataURL("image/webp", 0.85);
    if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/png");
    if (url.length > 90000) return toast("That logo is too big. Try a simpler image.", true);
    S.logo = url;
    $("#logo-prev").style.backgroundImage = `url("${url}")`;
    preview();
  } catch { toast("That file isn't an image we can read.", true); }
}
function planInputs() {
  const box = $("#plan-box"); if (!box) return; const anon = $("#f-anon")?.checked, msEl = document.querySelector('[name="ms"]:checked');
  const ms = anon ? Math.max(5, Number(msEl?.value || 5)) : Number(msEl?.value || 3), have = box.querySelectorAll("input").length;
  if (have === ms) return; const old = [...box.querySelectorAll("input")].map((i) => i.value);
  box.innerHTML = [...Array(ms)].map((_, i) => `<div class="plan-row"><b>${i + 1}</b><input name="plan-${i}" maxlength="140" placeholder="Release ${i + 1}: what backers will see delivered" value="${esc(old[i] || "")}"></div>`).join("");
}
function preview() {
  planInputs();
  const anon = $("#f-anon")?.checked; $("#tm-box")?.toggleAttribute("hidden", !!anon);
  document.querySelectorAll('[name="initial"]').forEach((x) => (x.disabled = !!anon && x.value !== "0"));
  document.querySelectorAll('[name="ms"]').forEach((x) => (x.disabled = !!anon && Number(x.value) < 5));
  const d = readForm(), q = d.params, ms = Number(q.milestones), init = Number(q.initialBps) / 100, step = (100 - init) / ms, hard = BigInt(q.hardcap || 0), soft = BigInt(q.softcap || 0);
  const fake = { id: "preview", meta: { ...d.meta, tagline: d.meta.tagline || "Your one-line summary appears here" }, q: { ...q, name: q.name || "Your project", symbol: q.symbol || "TOKEN", hardcap: hard || 1n, softcap: soft, saleEnd: BigInt(q.saleEnd), saleTokens: BigInt(q.saleTokens || 0) }, s: blankS(), exists: false, backers: 0 };
  let html = ""; try { html = card(fake).replace(/href="[^"]*"/, 'href="javascript:void 0"'); } catch { html = ""; }
  if (!d.meta.cover) html = html.replace('<div class="pc-art', '<div class="pc-art pc-noc');
  $("#preview").innerHTML = html;
  const sum = Object.values(JSON.parse(d.meta.use || "{}")).reduce((x, y) => x + y, 0), us = $("#use-sum");
  if (us) { us.textContent = sum === 100 ? "Adds up to 100% ✓" : `Adds up to ${sum}%. It must be 100%.`; us.classList.toggle("bad", sum !== 100); }
  $("#prev-facts").innerHTML = `<div class="lines pf">
      <div><span>Goal</span><b>$${usd(soft)} to $${usd(hard)}</b></div>
      <div><span>Price</span><b>${hard > 0n ? `1 USDC = ${tok((BigInt(q.saleTokens || 0) * 1_000_000n) / hard)} ${esc(q.symbol || "TOKEN")}` : "-"}</b></div>
      <div><span>Paid to you</span><b>${init}% at close, then ${ms} × ${step.toFixed(1)}%</b></div>
      <div><span>Holdfast fee</span><b>1% + 1.5% of tokens, only if funded</b></div>
      ${anon ? `<div><span>Team</span><b class="pf-anon">Anonymous · protected mode</b></div>` : ""}
    </div><div class="split" aria-hidden="true">${[init, ...Array(ms).fill(step)].map((w, i) => `<i style="width:${w}%;background:${i ? (i % 2 ? "#f4f1ef" : "#5a585d") : "#ff2e88"}"></i>`).join("")}</div>
    <p class="muted" style="font-size:13px;margin:8px 0 0">If you raise $${usd(hard)} and backers approve every release, you receive $${usd((hard * 99n) / 100n)}.</p>`;
  if (S.wz === 3) review(d);
}
function review(d) {
  const err = validate(d, Math.floor(Date.now() / 1000)), links = JSON.parse(d.meta.links || "{}"), plan = JSON.parse(d.meta.plan || "[]"), use = JSON.parse(d.meta.use || "{}");
  $("#review").innerHTML = `${err ? `<div class="note warn">${esc(err)}</div>` : `<div class="note ok">Everything looks complete. Sign to send it for review.</div>`}
    <div class="pay-to"><span>Payments go to your wallet</span><b>${esc(d.params.creator)}</b><small>The same wallet that signs. Every approved release lands here automatically, in USDC.</small></div>
    <div class="lines rv"><div><span>Project</span><b>${esc(d.params.name || "-")} · ${esc(d.params.symbol || "-")}</b></div>
      <div><span>Links</span><b>${Object.keys(links).join(", ") || "-"}</b></div>
      <div><span>Team</span><b>${d.meta.anon ? "Anonymous · protected mode" : `${JSON.parse(d.meta.team || "[]").length} people`}</b></div>
      <div><span>Use of funds</span><b>${Object.entries(use).map(([k, v]) => `${k} ${v}%`).join(" · ")}</b></div>
      ${plan.map((x, i) => `<div><span>Release ${i + 1}</span><b>${esc(x || "-")}</b></div>`).join("")}</div>`;
}
function wzGo(i) {
  if (i > (S.wz || 0)) { const e = wzCheck(S.wz || 0); if (e) { $("#ferr").textContent = e; return; } }
  $("#ferr").textContent = ""; S.wz = i;
  document.querySelectorAll(".wz").forEach((x) => (x.hidden = Number(x.dataset.step) !== i));
  document.querySelectorAll("#wz-steps li").forEach((x) => { const n = Number(x.dataset.go); x.toggleAttribute("aria-current", n === i); x.classList.toggle("done", n < i); });
  $("#wz-back").hidden = i === 0; $("#wz-next").hidden = i === 3; $("#wz-sign").hidden = i !== 3;
  preview(); window.scrollTo({ top: 0, behavior: "smooth" });
}
function wzCheck(step) {
  const d = readForm(), m = d.meta, q = d.params;
  if (step === 0) {
    if (!m.cover) return "Add a cover image."; if (!m.logo) return "Add your token logo."; if ((q.name || "").length < 3) return "Write the project name.";
    if (!/^[A-Z0-9]{2,8}$/.test(q.symbol)) return "The ticker must be 2 to 8 capital letters or digits."; if ((m.tagline || "").length < 10) return "Write a one-line summary (10+ characters).";
    if ((m.about || "").length < 40) return "Write a description (40+ characters)."; if (!m.links) return "Add at least one official link."; if ((m.risks || "").length < 20) return "Describe the main risks (20+ characters).";
  }
  if (step === 1 && !m.anon) { const t = JSON.parse(m.team || "[]"); if (!t.length || !t.some((x) => x.link)) return "Add at least one person with a public link, or choose anonymous."; }
  if (step === 2) { const e = validate(d, Math.floor(Date.now() / 1000)); if (e && !/cover|logo|link|risk|summary|description|name|ticker|team/i.test(e)) return e; }
  return "";
}

// ================================================================= portafolio y proyectos propios
function vPortfolio() {
  if (!S.me) return `<div class="page-h"><h1>Portfolio</h1><p>Connect your wallet to see what you've backed and what you've launched.</p></div><button class="btn btn-dark" data-act="connect">Connect wallet</button>`;
  const backed = S.list.filter((p) => p.u.contributed > 0n);
  const mine = S.all.filter((p) => isMe(p.q.creator));
  const put = backed.reduce((a, p) => a + p.u.contributed, 0n);
  const label = { review: "In review", approved: "Live", rejected: "Not approved" };
  return `<div class="page-h"><h1>Portfolio</h1><p>Everything you've backed, how much is still protected, and the projects you've launched.</p></div>
  <section class="stats"><div><b>$${usd(put)}</b><span>Total backed</span></div><div><b>${backed.length}</b><span>Projects backed</span></div>
    <div><b>${mine.length}</b><span>Projects launched</span></div><div><b>$${usd(S.usdc)}</b><span>USDC in wallet</span></div></section>
  <h2 class="h2">Backed</h2>
  <div class="list" style="margin-bottom:64px">${backed.length ? backed.map((p) => {
    const ml = maxLoss(p);
    return `<a class="pos" href="#/p/${p.id}" data-testid="pos-${p.id}">${mark(p)}<div><b>${esc(p.q.name)}</b><div class="status ${phase(p).c}">${phase(p).t}</div></div>
      <div class="c"><span>Put in</span><b>$${usd(p.u.contributed)}</b></div>
      <div class="c"><span>Tokens</span><b>${tok(p.u.balance)} ${esc(p.q.symbol)}</b></div>
      <div class="c"><span>Most you could lose</span><b>${ml === null ? "Refunding" : ml.toFixed(1) + "%"}</b></div></a>`;
  }).join("") : `<div class="empty">You haven't backed anything yet. <a href="#/">Browse projects</a>.</div>`}</div>
  <h2 class="h2">Launched</h2>
  ${mine.length ? mine.map((p) => `<div class="panel" style="margin-bottom:16px" data-testid="mine-${p.id}">
    <div class="p-head" style="margin:0 0 16px">${mark(p)}<div><b style="font-size:17px">${esc(p.q.name)}</b><p style="font-size:14px">${label[p.status]}${p.status === "approved" ? `, ${phase(p).t.toLowerCase()}` : ""}</p></div></div>
    ${p.status === "approved" ? `${meter(p)}<div class="meter-t"><span><b>$${usd(p.s.totalRaised)}</b> of $${usd(p.q.hardcap)}</span><span>You've received $${usd(p.s.usdcReleased)}</span></div>
      <div class="actions"><a class="btn btn-line btn-sm" href="#/p/${p.id}">Open project and releases</a></div>
      ${p.seed ? "" : `<div class="f" style="margin:24px 0 16px"><label for="up-${p.id}">Post an update</label><textarea id="up-${p.id}" maxlength="1500" placeholder="What you've done since the last update, with links."></textarea></div>
      <button class="btn btn-dark btn-sm" data-act="postUpdate" data-id="${p.id}" data-testid="post-${p.id}">Sign and post</button>`}`
    : p.status === "review" ? `<div class="note">Holdfast is reviewing your project. It goes live once approved.</div>` : `<div class="note bad">Your project wasn't approved. You can fix it and submit again.</div>`}
  </div>`).join("") : `<div class="list"><div class="empty">You haven't launched a project. <a href="#/launch">Launch one</a>.</div></div>`}`;
}

// ================================================================= estudio del creador
function alertsFor(p) {
  const s = p.s, q = p.q, out = [], dleft = Math.ceil((Number(q.saleEnd) - S.now) / 86400);
  if (p.status === "review") out.push(["info", "In review", "Holdfast is reviewing your project. It goes live once approved."]);
  if (p.status === "rejected") out.push(["bad", "Not approved", "Fix the details and submit again."]);
  if (p.status !== "approved") return out;
  if (phase(p).c === "open") out.push([dleft <= 5 ? "warn" : "info", `${dleft} days left in your raise`, `$${usd(s.totalRaised)} of $${usd(q.hardcap)} raised. Share your project to reach the goal.`]);
  if (s.state === 1 && s.milestonesDone < q.milestones) {
    if (s.voteEnd > 0n) out.push(["info", `Backers are voting on release ${s.milestonesDone + 1}`, `Voting closes ${day(s.voteEnd)}. Post an update showing what you delivered.`]);
    else { const d = Math.ceil((Number(s.deadline) - S.now) / 86400); out.push([d <= 7 || s.retrying ? "warn" : "info", s.retrying ? `Second chance: present release ${s.milestonesDone + 1} again within ${Math.max(0, d)} days` : `Request release ${s.milestonesDone + 1} within ${Math.max(0, d)} days`, `Deadline ${day(s.deadline)}. If you miss it, what's left returns to backers.`, `#/p/${p.id}`, "Request release"]); }
  }
  const open = (p.qa || []).filter((x) => !x.answer).length;
  if (open) out.push(["warn", `${open} question${open === 1 ? "" : "s"} waiting for your answer`, "Answering fast builds trust.", `#/p/${p.id}`, "Answer"]);
  const last = Math.max(0, ...(p.updates || []).map((u) => u.ts));
  if (s.succeeded && Date.now() - last > 30 * 86400000) out.push(["info", "No update in 30 days", "Backers trust teams that show progress. Post an update."]);
  return out;
}
function vStudio() {
  if (!S.me) return `<div class="page-h"><h1>Creator studio</h1><p>Connect the wallet you launched with.</p></div><button class="btn btn-dark" data-act="connect">Connect wallet</button>`;
  const mine = S.all.filter((p) => isMe(p.q.creator)), live = mine.filter((p) => p.status === "approved");
  if (!mine.length) return `<div class="page-h"><h1>Creator studio</h1><p>Launch your first project and manage it here.</p></div><a class="btn btn-ember" href="#/launch">Launch a project</a>`;
  const raised = live.reduce((x, p) => x + p.s.totalRaised, 0n), paid = live.reduce((x, p) => x + (p.s.usdcReleased || 0n), 0n), backers = live.reduce((x, p) => x + (p.backers || 0), 0);
  const done = live.reduce((x, p) => x + Number(p.s.milestonesDone || 0), 0), cancelled = live.filter((p) => p.s.state === 2).length, funded = live.filter((p) => p.s.succeeded).length;
  const alerts = mine.flatMap((p) => alertsFor(p).map((x) => [p, ...x]));
  return `<div class="page-h"><h1>Creator studio</h1><p>Your projects, what needs your attention, and your reputation as backers see it.</p></div>
  <section class="st-stats"><div><b>$${usd(raised)}</b><span>Raised</span></div><div><b>${backers}</b><span>Backers</span></div><div><b>$${usd(paid)}</b><span>Paid to you</span></div><div><b>$${usd(S.usdc)}</b><span>USDC in your wallet ${short(S.me)}</span></div></section>
  ${alerts.length ? `<section class="st-block"><h2>Needs your attention</h2><ul class="st-alerts">${alerts.map(([p, k, t, d, href, cta]) => `<li class="${k}"><i></i><div><b>${esc(t)}</b><span>${esc(p.q.name)} · ${esc(d)}</span></div>${href ? `<a class="btn btn-line btn-sm" href="${href}">${cta}</a>` : ""}</li>`).join("")}</ul></section>` : ""}
  <section class="st-block"><h2>Your projects</h2><div class="st-list">${mine.map((p) => {
    const ph = p.status === "approved" ? phase(p) : { t: p.status === "review" ? "In review" : "Not approved", c: p.status };
    return `<article class="st-card" data-testid="mine-${p.id}">
      <div class="st-cover">${coverSrc(p) ? `<img src="${esc(coverSrc(p))}" alt="">` : ""}<span class="st-chip ${ph.c}">${ph.t}</span></div>
      <div class="st-body"><h3>${esc(p.q.name)} <small>${esc(p.q.symbol)}</small></h3>
        ${p.status === "approved" ? `${meter(p)}<div class="st-nums"><div><b>$${usd(p.s.totalRaised)}</b><span>of $${usd(p.q.hardcap)}</span></div><div><b>${p.backers || 0}</b><span>Backers</span></div>
          <div><b>${p.s.succeeded ? `${p.s.milestonesDone}/${p.q.milestones}` : phase(p).c === "open" ? Math.max(0, Math.ceil((Number(p.q.saleEnd) - S.now) / 86400)) : "–"}</b><span>${p.s.succeeded ? "Releases" : "Days left"}</span></div>
          <div><b>${p.mk ? fmtP(p.mk.price) : `$${usd(p.s.usdcReleased || 0n)}`}</b><span>${p.mk ? "Market price" : "Paid to you"}</span></div></div>
          ${p.s.voteEnd > 0n ? (() => { const t = p.s.votesYes + p.s.votesNo || 1n, y = pct(p.s.votesYes, t); return `<div class="st-vote"><div class="vt-h"><span>Vote on release ${p.s.milestonesDone + 1}</span><b>Closes ${day(p.s.voteEnd)}</b></div><div class="vt-bar"><i class="y" style="width:${y}%"></i><i class="n" style="width:${pct(p.s.votesNo, t)}%"></i></div><div class="vt-k"><span class="y">Approve $${usd(p.s.votesYes)}</span><span class="n">Reject $${usd(p.s.votesNo)}</span></div></div>`; })() : ""}
          <div class="st-act"><a class="btn btn-line btn-sm" href="#/p/${p.id}">Open project</a><button class="btn btn-ember btn-sm" type="button" data-upopen="${p.id}">Post update</button></div>
          <div class="st-up" id="upbox-${p.id}" hidden><textarea id="up-${p.id}" maxlength="1500" placeholder="What you delivered, with links and numbers"></textarea><button class="btn btn-dark btn-sm" data-act="postUpdate" data-id="${p.id}" data-testid="post-${p.id}">Sign and post</button></div>`
        : `<p class="muted">${p.status === "review" ? "Holdfast is reviewing it. You'll see it live here once approved." : "It wasn't approved. Fix it and submit again."}</p>`}
      </div></article>`;
  }).join("")}</div></section>
  <section class="st-block"><h2>Your reputation</h2><p class="muted" style="margin-top:-6px">This is what backers see on every project you launch. It can't be edited: it comes from the blockchain.</p>
    <div class="st-rep"><div><b>${funded}</b><span>Funded</span></div><div><b>${done}</b><span>Releases delivered</span></div><div><b>${cancelled}</b><span>Cancelled</span></div><div><b>${(mine.reduce((n, p) => n + (p.updates || []).length, 0))}</b><span>Updates posted</span></div></div></section>`;
}

// ================================================================= dueño
function vOwner() {
  if (!isOwner()) return `<div class="page-h"><h1>Owner</h1><p>Only the platform wallet can open this panel.</p></div>`;
  const live = S.list.filter((p) => p.exists), funded = live.filter((p) => p.s.succeeded);
  const fees = funded.reduce((a, p) => a + (p.s.totalRaised * 100n) / 10000n, 0n);
  const raised = live.reduce((a, p) => a + p.s.totalRaised, 0n);
  const pending = S.all.filter((p) => p.status === "review");
  return `<div class="page-h"><h1>Owner</h1><p>Your fees, platform activity and the projects waiting for your approval.</p></div>
  <section class="stats"><div><b>$${usd(fees)}</b><span>Fees earned in USDC</span></div><div><b>$${usd(raised)}</b><span>Raised on Holdfast</span></div>
    <div><b>${funded.length}</b><span>Projects funded</span></div><div><b>${pending.length}</b><span>Awaiting review</span></div></section>
  <section class="block"><h2>Fees by project</h2>
    ${funded.length ? `<table class="tbl"><thead><tr><th>Project</th><th>USDC</th><th>Tokens</th></tr></thead><tbody>
      ${funded.map((p) => `<tr><td>${esc(p.q.name)}</td><td>$${usd((p.s.totalRaised * 100n) / 10000n)}</td><td>${tok(p.s.platformTokens)} ${esc(p.q.symbol)}</td></tr>`).join("")}</tbody></table>`
      : `<p>No project has been funded yet. Fees reach your wallet the moment one closes successfully.</p>`}
  </section>
  <section class="block"><h2>Awaiting review</h2>
    ${S.reviews ? "" : `<p style="margin-bottom:16px">Sign to see the AI review of each project. Signing is free.</p><button class="btn btn-line" data-act="openPanel" data-testid="open-panel">Sign and show reviews</button>`}
    <div style="margin-top:24px">${pending.length ? pending.map(reviewCard).join("") : `<p>Nothing is waiting.</p>`}</div>
  </section>`;
}
function reviewCard(p) {
  const r = S.reviews?.[p.id], q = p.q, word = { bajo: "Low", medio: "Medium", alto: "High" };
  const ai = !S.reviews ? "" : !r ? `<p class="muted">No AI review.</p>` : !r.ok ? `<div class="note warn">${esc(r.error)}</div>` :
    `<div><span class="risk ${r.riesgo}">${word[r.riesgo]} risk</span></div><p style="margin:12px 0 0">${esc(r.resumen)}</p>
     ${r.senales.length ? `<h4>Signals</h4><ul>${r.senales.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
     ${r.preguntas.length ? `<h4>Questions for the creator</h4><ul>${r.preguntas.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`;
  return `<div class="review" data-testid="review-${p.id}">
    <div class="p-head" style="margin:0 0 16px">${mark(p)}<div><b style="font-size:17px">${esc(q.name)}</b><p style="font-size:14px">${esc(p.meta.category)}, sent by <span class="addr">${short(q.creator)}</span></p></div></div>
    <p class="muted" style="margin:0 0 12px">${esc(p.meta.tagline)}</p>
    <details><summary>Description and numbers</summary><p style="margin:12px 0">${esc(p.meta.about)}</p>
      <div class="lines"><div><span>Goal</span><b>$${usd(q.softcap)} to $${usd(q.hardcap)}</b></div><div><span>Upfront</span><b>${q.initialBps / 100}%</b></div>
      <div><span>Releases</span><b>${q.milestones}, every ${Number(q.milestonePeriod) / 86400} days</b></div><div><span>Team tokens</span><b>${tok(q.creatorTokens)} of ${tok(q.saleTokens + q.creatorTokens)}</b></div></div></details>
    <div style="margin-top:16px">${ai}</div>
    <div class="actions"><button class="btn btn-dark btn-sm" data-act="approve" data-id="${p.id}" data-testid="approve-${p.id}">Approve and publish</button>
      <button class="btn btn-danger btn-sm" data-act="reject" data-id="${p.id}">Reject</button></div></div>`;
}

// ================================================================= router
// Inicio (compu): el video de Blender avanza con el scroll; los textos aparecen según el avance.
let heroOff = null;
function startHero() {
  if (heroOff) { heroOff(); heroOff = null; }
  const hx = $("#hx"); if (!hx) return; const v = $("#hx-vid"); v?.play?.().catch(() => {});
  const paintLive = () => { const n = nextClose(), cd = $("#hx-cd"), bid = $("#hx-bid"); if (!cd) return;
    if (!n) { cd.hidden = true; bid.hidden = true; return; } cd.hidden = false; const s = n.secs, p2 = (x) => String(x).padStart(2, "0");
    $("#hx-cdl").textContent = T2(`${n.name} closes in`, `${n.name} cierra en`); $("#hx-ch").textContent = p2(Math.floor(s / 3600)); $("#hx-cm").textContent = p2(Math.floor((s % 3600) / 60)); $("#hx-cs").textContent = p2(s % 60);
    if (n.fillName) { bid.hidden = false; bid.href = "#/lc/" + n.fillId; $("#hx-bn").textContent = n.fillName; $("#hx-bp").textContent = n.fillPct + "%"; $("#hx-bv").textContent = `$${Math.round(n.fillRaised).toLocaleString("en-US")} ${T2("of", "de")} $${n.fillGoal.toLocaleString("en-US")}`; $("#hx-bu").style.width = Math.min(100, n.fillPct) + "%"; } else bid.hidden = true; };
  paintLive(); const tm = setInterval(() => { if (!$("#hx")) return clearInterval(tm); paintLive(); }, 1000);
  let raf = 0, on = true, tx = 0, ty = 0, cx = 0, cy = 0, cp = 0;
  const desk = () => matchMedia("(min-width: 901px)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const prog = () => { const r = hx.getBoundingClientRect(), span = hx.offsetHeight - innerHeight + 64; return Math.min(1, Math.max(0, -r.top / Math.max(1, span))); };
  const mv = (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; }; addEventListener("pointermove", mv);
  const paint = () => { if (!on || !$("#hx")) return; const tp = prog(); cp += (tp - cp) * 0.12; cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
    if (desk()) { hx.style.setProperty("--pr", cp.toFixed(4)); hx.style.setProperty("--mx", cx.toFixed(3)); hx.style.setProperty("--my", cy.toFixed(3)); }
    hx.querySelectorAll(".hx-chips li").forEach((c) => c.classList.toggle("on", tp >= Number(c.dataset.p)));
    raf = requestAnimationFrame(paint); };
  raf = requestAnimationFrame(paint);
  heroOff = () => { on = false; cancelAnimationFrame(raf); clearInterval(tm); removeEventListener("pointermove", mv); };
}

function route() {
  const h = location.hash || "#/";
  if (h.startsWith("#/lc")) { document.querySelectorAll("[data-nav]").forEach((x) => (x.dataset.nav === (location.hash === "#/lc/new" ? "launch" : "lc") ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current"))); showLaunches($("#app")); return; }
  if (h === "#/" || h === "#" || h === "") {
    document.querySelectorAll("[data-nav]").forEach((x) => (x.dataset.nav === "lc" ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current")));
    if (!$("#lc-home")) $("#app").innerHTML = `<section class="hx" id="hx"><div class="hx-pin">
      <img class="hx-bd" src="./assets/hero-backdrop.webp" alt="" aria-hidden="true">
      <svg class="hx-rings" viewBox="0 0 1000 1000" aria-hidden="true"><defs><linearGradient id="rg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3b7f"/><stop offset="1" stop-color="#9ad9ff"/></linearGradient></defs>
        <circle class="r1" cx="500" cy="500" r="470" fill="none" stroke="url(#rg1)" stroke-width="1.5" stroke-dasharray="720 560 140 400"/>
        <circle class="r2" cx="500" cy="500" r="395" fill="none" stroke="#9ad9ff" stroke-opacity=".55" stroke-width="1" stroke-dasharray="260 900 60 600"/>
        <circle class="r3" cx="500" cy="500" r="330" fill="none" stroke="#ff3b7f" stroke-opacity=".7" stroke-width="1.5" stroke-dasharray="500 700 100 780"/></svg>
      <div class="hx-fig"><video id="hx-vid" muted loop playsinline autoplay preload="auto" poster="./assets/hero-bust.webp" src="./assets/hero-bust.mp4" aria-hidden="true"></video></div>
      <div class="hx-shade"></div>
      <div class="hx-t"><h1><span>If it fills,</span><span>it opens.</span></h1>
        <p>Back a token with USDC for 24 hours. When the round fills, trading opens. If it doesn't, you get everything back.</p>
        <div class="hx-b"><a class="btn btn-ember" href="#/lc">See launches</a><a class="btn btn-line" href="#/lc/new">Launch a token</a></div></div>
      <ul class="hx-chips"><li class="c1" data-p="0.04">Liquidity locked forever</li><li class="c2" data-p="0.2">Automatic refund</li><li class="c3" data-p="0.36">Same price for everyone</li></ul>
      <a class="hx-bid" id="hx-bid" href="#/lc" hidden><small>Fullest round</small><span class="hx-bn" id="hx-bn"></span><span class="hx-bm"><b id="hx-bp"></b><i id="hx-bv"></i></span><span class="hx-bb"><u id="hx-bu"></u></span></a>
      <div class="hx-cd" id="hx-cd" hidden><small id="hx-cdl"></small><div class="hx-cb"><span><b id="hx-ch">00</b><i>hours</i></span><span><b id="hx-cm">00</b><i>minutes</i></span><span><b id="hx-cs">00</b><i>seconds</i></span></div></div>
    </div></section><div id="lc-home"></div>`;
    startHero();
    showLaunches($("#lc-home")); return;
  }
  if (/^#\/(projects|p\/|studio|portfolio|launch$)/.test(h)) { location.hash = "#/lc"; return; }
  if (heroOff) { heroOff(); heroOff = null; }
  stopLaunches();
  const m = h.match(/^#\/p\/([\w-]+)/);
  const p = m && S.list.find((x) => x.id === m[1]);
  const tm = h.match(/^#\/trade\/([\w-]+)/), tp = tm && findTok((x) => x.id === tm[1]);
  const key = tp || h.startsWith("#/market") ? "market" : p ? "home" : h.startsWith("#/launch") ? "launch" : h.startsWith("#/portfolio") ? "portfolio" : h.startsWith("#/studio") ? "studio" : h.startsWith("#/owner") ? "owner" : "home";
  document.querySelectorAll("[data-nav]").forEach((a) => (a.dataset.nav === key ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("#nav-owner").classList.toggle("d-none", !isOwner()); $("#tab-owner").classList.toggle("d-none", !isOwner());
  if (key === "launch" && $("#form")) return; // no borrar lo que el creador está escribiendo
  const keep = $("#amt")?.value;
  if (tp?.lcx && !tp.mk) { if (!tp._ld) { tp._ld = true; Promise.all([loadChain(tp)]).then(() => loadTrades(tp)).then(() => { tp._ld = false; route(); }).catch(() => { tp._ld = false; }); } $("#app").innerHTML = `<div class="page-h"><h1>${esc(tp.q.symbol)}</h1><p>Loading the market…</p></div>`; return; }
  if (tp && matchMedia("(max-width: 900px)").matches && !/[?&]op=1/.test(h)) { renderCommunity(tp); return; }
  if (tp) { const kv = $("#tamt")?.value; $("#app").innerHTML = vTerminal(tp); if (kv && $("#tamt")) $("#tamt").value = kv; startTerminal(tp); return; }
  if (key === "market") { $("#app").innerHTML = vMarket(); bindMarket(); S.list.filter((x) => x.mk && !x.supply).forEach((x) => { try { pub.readContract({ address: x.address, abi: erc20Abi, functionName: "totalSupply" }).then((v) => { x.supply = v; if (location.hash.startsWith("#/market") && document.activeElement?.id !== "mk-q") { $("#app").innerHTML = vMarket(); bindMarket(); } }).catch(() => {}); } catch {} });
  S.list.filter((x) => x.mk && !x.trades).forEach((x) => loadTrades(x).then(() => { if (location.hash.startsWith("#/market") && document.activeElement?.id !== "mk-q") { $("#app").innerHTML = vMarket(); bindMarket(); } })); return; }
  $("#app").innerHTML = p ? vProject(p) : key === "launch" ? vLaunch() : key === "portfolio" ? vPortfolio() : key === "studio" ? vStudio() : key === "owner" ? vOwner() : vHome();
  if (p) { bindSwipe(p); clearInterval(S.cdT); S.cdT = setInterval(() => { const e = document.querySelector(".kv-count"); if (!e) return clearInterval(S.cdT); e.textContent = countdown(Number(e.dataset.end)).replace("Closes in ", ""); }, 1000); bindAmount(p); bindTab(p); bindTrade(p); celebrate(p); if (p.mk && !p.trades) loadTrades(p).then(() => { if (S.tab === "trade") { $(".ptab-body").innerHTML = tabBody(p); } }); }
  if (key === "studio") document.querySelectorAll("[data-upopen]").forEach((b) => (b.onclick = () => { const x = $(`#upbox-${b.dataset.upopen}`); x.hidden = !x.hidden; }));
  if (!p && key === "home") { bindCards(); bindCarousel(); bindCatalog(); S.list.filter((x) => x.mk).forEach((x) => loadTrades(x).then(() => { const el = document.querySelector(`[data-testid="row-${x.id}"] .pc-mkt .spark`); if (el) el.outerHTML = spark(x); })); }
  if (p && keep && $("#amt")) { $("#amt").value = keep; $("#amt").dispatchEvent(new Event("input")); }
  if ($("#form")) { S.wz = 0; S.draftId = ""; $("#form").addEventListener("input", preview); $("#form").addEventListener("change", preview); $("#form").addEventListener("submit", submitProject); $("#f-logo").addEventListener("change", pickLogo);
    $("#f-cover").addEventListener("change", (e) => pickCover(e));
    $("#wz-next").onclick = () => wzGo((S.wz || 0) + 1); $("#wz-back").onclick = () => wzGo((S.wz || 0) - 1);
    document.querySelectorAll("#wz-steps li").forEach((li) => (li.onclick = () => { const n = Number(li.dataset.go); if (n < (S.wz || 0)) wzGo(n); else for (let k = S.wz || 0; k < n; k++) { if (wzCheck(k)) { $("#ferr").textContent = wzCheck(k); return; } wzGo(k + 1); } }));
    $("#tm-add").onclick = () => { const h = document.querySelector(".tm-row.d-none"); if (h) h.classList.remove("d-none"); if (!document.querySelector(".tm-row.d-none")) $("#tm-add").remove(); };
    document.querySelectorAll("[data-tmphoto]").forEach((inp) => inp.addEventListener("change", (e) => pickImage(e, 128, 40000, (url) => { (S.tmPhotos ||= [])[inp.dataset.tmphoto] = url; $(`#tmp-${inp.dataset.tmphoto}`).style.backgroundImage = `url("${url}")`; })));
    preview(); }
}
// ===== Comunidad de un token (celular): hilo, holders y operaciones. Operar lleva al trading.
const cmBody = (p) => {
  const t = S.cmTab || "thread";
  if (t === "thread") return chatHtml(p);
  const old = S.ttab; S.ttab = t === "holders" ? "holders" : "trades"; let h = ""; try { h = termTab(p); } finally { S.ttab = old; } return h;
};
function communityHtml(p) {
  const x = stats24(p), up = x.chg >= 0, t = S.cmTab || "thread", fav = favs().includes(p.id);
  return `<section class="cm" data-cm="${p.id}">
    <header class="cm-h"><a class="cm-bk" href="#/lc" aria-label="Back">‹</a><span class="cm-av">${logoSrc(p) ? `<img src="${esc(logoSrc(p))}" alt="">` : mark(p, "lg")}</span>
      <div class="cm-t"><h1>${esc(p.q.name)}</h1><small>${esc(p.q.symbol)} · ${short(p.q.creator)}</small></div>
      <div class="cm-p"><b id="cm-px">${fmtP(p.mk.price)}</b><em id="cm-ch" class="${up ? "u" : "d"}">${up ? "+" : ""}${x.chg.toFixed(1)}%</em></div></header>
    <div class="cm-st"><div><small>${T2("Value", "Valor")}</small><b>$${usd(x.cap)}</b></div><div><small>${T2("Holders", "Holders")}</small><b id="cm-hn">${p.holders ? p.holders.filter((h) => !holderLabel(p, h.a) || holderLabel(p, h.a) === "Team").length : "–"}</b></div><div><small>${T2("Liquidity", "Liquidez")}</small><b>🔒 ${T2("Locked", "Bloqueada")}</b></div></div>
    <div class="cm-tabs" role="tablist">${[["thread", T2("Thread", "Hilo")], ["holders", "Holders"], ["trades", T2("Trades", "Operaciones")]].map(([k, n]) => `<button type="button" data-cmt="${k}" aria-selected="${t === k}">${n}</button>`).join("")}</div>
    <div class="cm-b" id="cm-b">${cmBody(p)}</div>
    <div class="cm-op"><a class="btn btn-ember btn-block" href="#/trade/${p.id}?op=1">${T2("Trade", "Operar")} ${esc(p.q.symbol)}</a></div></section>`;
}
function renderCommunity(p) {
  clearInterval(S.poll); if (chartOff) { chartOff.destroy(); chartOff = null; }
  document.querySelectorAll("[data-nav]").forEach((x) => (x.dataset.nav === "lc" ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current")));
  $("#app").innerHTML = communityHtml(p); scrollTo(0, 0);
  const paint = async () => { if (!location.hash.startsWith(`#/trade/${p.id}`) || /[?&]op=1/.test(location.hash)) { clearInterval(S.poll); return; }
    try { await loadHolders(p); } catch {}
    const x = stats24(p); if ($("#cm-px")) $("#cm-px").textContent = fmtP(p.mk.price); if ($("#cm-ch")) { $("#cm-ch").textContent = `${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(1)}%`; $("#cm-ch").className = x.chg >= 0 ? "u" : "d"; }
    if ($("#cm-hn") && p.holders) $("#cm-hn").textContent = p.holders.filter((h) => !holderLabel(p, h.a) || holderLabel(p, h.a) === "Team").length;
    if ((S.cmTab || "thread") !== "thread" && $("#cm-b")) $("#cm-b").innerHTML = cmBody(p); };
  paint(); S.poll = setInterval(paint, 4000);
  $("#app").querySelector(".cm-tabs").onclick = (e) => { const b = e.target.closest("[data-cmt]"); if (!b) return; S.cmTab = b.dataset.cmt; document.querySelectorAll("[data-cmt]").forEach((x) => x.setAttribute("aria-selected", x === b)); $("#cm-b").innerHTML = cmBody(p); };
}

function bindAmount(p) {
  const el = $("#amt"); if (!el) return;
  const upd = () => { let v = 0n; try { v = parseUnits(el.value || "0", 6); } catch {} $("#receive").textContent = `${tok((v * p.q.saleTokens) / p.q.hardcap)} ${p.q.symbol}`; if ($("#bb-amt")) $("#bb-amt").textContent = v > 0n ? `$${usd(v)} for ${tok((v * p.q.saleTokens) / p.q.hardcap)} ${p.q.symbol}` : "Enter an amount"; if ($("#refundline")) $("#refundline").textContent = v > 0n ? `$${usd(v)} back` : "100% back"; };
  el.oninput = upd;
  const bb = $("#buybar");
  if (bb && "IntersectionObserver" in window) { const io = new IntersectionObserver(([en]) => bb.classList.toggle("show", !en.isIntersecting), { threshold: 0 }); io.observe($('[data-act="buy"]')); }
  const room = p.q.hardcap - p.s.totalRaised, cap = (v) => (v < room ? v : room);
  $("[data-max]").onclick = () => { el.value = formatUnits(cap(S.usdc), 6); upd(); };
  document.querySelectorAll("[data-quick]").forEach((b) => (b.onclick = () => { el.value = formatUnits(cap(parseUnits(b.dataset.quick, 6)), 6); upd(); }));
}

// ================================================================= wallet y transacciones
const provider = () => window.phantom?.ethereum || window.ethereum;
async function connect() {
  const eth = provider();
  if (!eth) {
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) { location.href = `https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=${encodeURIComponent(location.origin)}`; return; }
    return toast("No wallet found. Install Phantom, MetaMask or Coinbase Wallet.", true);
  }
  [S.me] = await eth.request({ method: "eth_requestAccounts" });
  const hex = "0x" + CONFIG.chainId.toString(16);
  if ((await eth.request({ method: "eth_chainId" })) !== hex) {
    try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] }); }
    catch (e) { if (e.code !== 4902) throw e; await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: hex, chainName: CONFIG.chainName, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: [CONFIG.rpc], blockExplorerUrls: [CONFIG.explorer] }] }); }
  }
  S.wallet = createWalletClient({ account: S.me, chain, transport: custom(eth) });
  setLaunchChain({ CONFIG, pub, wallet: S.wallet, account: S.me });
  $("#connect").innerHTML = `<span class="acct"><i></i>${short(S.me)}</span>`; $("#connect").className = "btn btn-soft btn-sm";
  eth.on?.("accountsChanged", () => location.reload()); eth.on?.("chainChanged", () => location.reload());
  if ($("#form")) $("#app").innerHTML = "";
  await refresh();
  paintAcct();
  welcomeProfile();
}
const sign = (message) => S.wallet.signMessage({ account: S.me, message });

function sheet(title, labels) {
  const el = $("#sheet");
  el.innerHTML = `<h3>${esc(title)}</h3><p class="muted" style="margin:0;font-size:14.5px">Confirm each step in your wallet.</p><ul class="tx">${labels.map((l, i) => `<li data-i="${i}"><span class="ic">${i + 1}</span><div>${esc(l)}<small></small></div></li>`).join("")}</ul>`;
  el.classList.add("on"); $("#veil").classList.add("on");
  return {
    set(i, st, note = "") { const li = el.querySelector(`li[data-i="${i}"]`); li.className = st; li.querySelector(".ic").innerHTML = st === "done" ? IC.ok : st === "err" ? "!" : st === "active" ? "" : i + 1; li.querySelector("small").textContent = note; },
    close(ms = 900) { setTimeout(() => { el.classList.remove("on"); $("#veil").classList.remove("on"); }, ms); },
  };
}
async function step(ui, i, fn) {
  ui.set(i, "active", "Waiting for your confirmation");
  const out = await fn();
  if (typeof out === "string" && out.startsWith("0x") && out.length === 66) {
    ui.set(i, "active", "Processing on-chain");
    const r = await pub.waitForTransactionReceipt({ hash: out });
    if (r.status !== "success") throw new Error("The network rejected the transaction.");
  }
  ui.set(i, "done", "Done");
  return out;
}
function friendly(e) {
  const m = String(e?.shortMessage || e?.message || e);
  if (/too little received|slippage|STF|price slippage|Too little/i.test(m)) return "The price changed while you were trading. You didn't lose anything: try again or raise the slippage.";
  if (/user rejected|denied|rejected the request/i.test(m)) return "You cancelled it in your wallet. Nothing happened.";
  if (/insufficient funds/i.test(m)) return "Your wallet needs a little ETH to pay the network fee.";
  return m.length > 140 ? "Something failed and nothing was charged. Try again." : m;
}
async function flow(title, labels, fns, okMsg) {
  const ui = sheet(title, labels); let i = 0;
  try { for (; i < fns.length; i++) await step(ui, i, fns[i]); ui.close(); toast(okMsg); return true; }
  catch (e) { ui.set(i, "err", friendly(e)); ui.close(4500); return false; }
}
async function buy(p) {
  let amount = 0n; try { amount = parseUnits($("#amt").value || "0", 6); } catch {}
  if (amount <= 0n) return toast("Enter how much you want to back.", true);
  if (S.usdc < amount) return toast(`Not enough USDC: you have ${usd(S.usdc)}.`, true);
  const allowance = await pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "allowance", args: [S.me, p.address] });
  const code = await pub.getCode({ address: p.address });
  const labels = [], fns = [];
  if (allowance < amount) { labels.push("Allow your USDC"); fns.push(() => S.wallet.writeContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "approve", args: [p.address, amount] })); }
  if (!code || code === "0x") { labels.push("Create the project contract"); fns.push(() => S.wallet.sendTransaction({ to: CONFIG.deployer, data: concat([SALT, p.initCode]) })); }
  labels.push(`Back with ${usd(amount)} USDC`); fns.push(() => S.wallet.writeContract({ address: p.address, abi: ABI, functionName: "buy", args: [amount, S.me] }));
  if (await flow("Back this project", labels, fns, "Backed")) { await refresh(); await loadActivity(); const np = S.list.find((x) => x.id === p.id); if (np) setTimeout(() => backerCard(np), 900); }
}
const ACTS = { finalize: ["Close the raise", "finalize", []], claimTokens: ["Claim my tokens", "claimTokens", []], refund: ["Get my money back", "refund", []],
  voteYes: ["Approve release", "vote", [true]], voteNo: ["Reject release", "vote", [false]], closeVote: ["Apply the result", "closeVote", []],
  requestRelease: ["Request release", "requestRelease", []], abandon: ["Cancel and refund backers", "abandon", []] };

async function api(path, data) {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "The server didn't respond.");
  return j;
}
async function submitProject(e) {
  e.preventDefault();
  const p = readForm(), err = validate(p, Math.floor(Date.now() / 1000));
  $("#ferr").textContent = err || "";
  if (err) return;
  let sig;
  const ok = await flow("Submit project", ["Sign the project with your wallet", "Send for review"], [
    async () => { sig = await sign(msgSubmit(p.id, hashOf(p))); },
    async () => api("./api/submit", { project: p, signature: sig }),
  ], "Submitted for review");
  if (ok) { $("#app").innerHTML = ""; location.hash = "#/studio"; await loadCatalog(); await refresh(); }
}
async function decide(id, approve) {
  const p = S.all.find((x) => x.id === id), raw = { id: p.id, meta: p.meta, params: p.params };
  let sig;
  const ok = await flow(approve ? "Approve project" : "Reject project", ["Sign your decision", "Save"], [
    async () => { sig = await sign(msgDecision(approve, id, hashOf(raw))); },
    async () => api("./api/decide", { id, approve, signature: sig }),
  ], approve ? "Published" : "Rejected");
  if (ok) { await loadCatalog(); await refresh(); }
}
async function openPanel() {
  const d = new Date().toISOString().slice(0, 10);
  let sig;
  if (!(await flow("Show reviews", ["Sign to identify yourself"], [async () => { sig = await sign(msgPanel(d)); }], "Reviews unlocked"))) return;
  try { S.reviews = (await api("./api/reviews", { day: d, signature: sig })).reviews; } catch (e) { toast(e.message, true); }
  route();
}
async function qaPost(p, act, qts) {
  const text = (act === "ask" ? $("#ask") : $(`#ans-${qts}`)).value.trim();
  if (text.length < 5) return toast("Write at least 5 characters.", true);
  const ts = Date.now(); let sig;
  const msg = act === "ask" ? msgQuestion(p.id, ts, keccak256(toBytes(text))) : msgAnswer(p.id, Number(qts), ts, keccak256(toBytes(text)));
  const ok = await flow(act === "ask" ? "Ask a question" : "Answer", ["Sign with your wallet", "Post"], [
    async () => { sig = await sign(msg); },
    async () => api("./api/qa", { id: p.id, kind: act === "ask" ? "q" : "a", text, ts, qts: Number(qts) || undefined, author: S.me, signature: sig }),
  ], act === "ask" ? "Question posted" : "Answer posted");
  if (ok) { S.tab = "qa"; await loadCatalog(); await refresh(); }
}
async function postUpdate(id) {
  const text = $(`#up-${id}`).value.trim();
  if (text.length < 10) return toast("Write at least 10 characters.", true);
  const ts = Date.now(); let sig;
  const ok = await flow("Post update", ["Sign the update", "Post"], [
    async () => { sig = await sign(msgUpdate(id, ts, keccak256(toBytes(text)))); },
    async () => api("./api/update", { id, text, ts, signature: sig }),
  ], "Update posted");
  if (ok) { S.tab = "updates"; await loadCatalog(); await refresh(); }
}

document.addEventListener("click", async (e) => {
  const pr = e.target.closest("[data-period]");
  if (pr) { S.period = pr.dataset.period; document.querySelectorAll("[data-period]").forEach((x) => x.setAttribute("aria-selected", x === pr)); const tp = findTok((x) => location.hash === `#/trade/${x.id}`); if (tp) $("#candles").innerHTML = candlesSvg(tp, S.period); return; }
  const tt = e.target.closest("[data-ttab]");
  if (tt) { S.ttab = tt.dataset.ttab; document.querySelectorAll("[data-ttab]").forEach((x) => x.setAttribute("aria-selected", x === tt)); const tp = findTok((x) => location.hash === `#/trade/${x.id}`); if (tp) $("#term-tab").innerHTML = termTab(tp); return; }
  const sd = e.target.closest("[data-side]");
  if (sd) { S.side = sd.dataset.side; const p = findTok((x) => location.hash === `#/p/${x.id}` || location.hash === `#/trade/${x.id}`); if (p) { const box = $(".cyber"); box.outerHTML = tradePanel(p); bindTrade(p); } return; }
  const tb = e.target.closest("[data-tab]");
  if (tb) { S.tab = tb.dataset.tab; document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", x === tb)); const p = findTok((x) => location.hash === `#/p/${x.id}`); if (p) { $(".ptab-body").innerHTML = tabBody(p); bindTab(p); if (S.tab === "trade" && p.mk) loadTrades(p).then(() => { if (S.tab === "trade") $(".ptab-body").innerHTML = tabBody(p); }); } return; }
  if (e.target.closest("#bb-go")) { const v = $("#amt")?.value; if (v && Number(v) > 0) return $('[data-act="buy"]')?.click(); $("#amt")?.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => $("#amt")?.focus(), 400); return; }
  const sc = e.target.closest("[data-scroll]");
  if (sc) return document.getElementById(sc.dataset.scroll)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const act = b.dataset.act;
  if (act === "connect") return connect().catch((x) => toast(x.shortMessage || x.message, true));
  if (!S.wallet) return toast("Connect your wallet first.", true);
  document.querySelectorAll("button").forEach((x) => (x.disabled = true));
  try {
    const p = findTok((x) => location.hash === `#/p/${x.id}` || location.hash === `#/trade/${x.id}`);
    if (act === "buy") await buy(p);
    else if (ACTS[act]) { const [label, fn, args] = ACTS[act]; await flow(label, [label], [() => S.wallet.writeContract({ address: p.address, abi: ABI, functionName: fn, args })], `${label}: done`); }
    else if (act === "approve" || act === "reject") return await decide(b.dataset.id, act === "approve");
    else if (act === "openPanel") return await openPanel();
    else if (act === "postUpdate") return await postUpdate(b.dataset.id);
    else if (act === "card") return await backerCard(p);
    else if (act === "swap") { const sb = document.querySelector("[data-act=swap]"); sb?.classList.add("loading"); try { await swap(p); } finally { document.querySelector("[data-act=swap]")?.classList.remove("loading"); } if (!p.lc) p.trades = null; }
    else if (act === "ask" || act === "answer") return await qaPost(p, act, b.dataset.qts);
    await refresh();
  } catch (x) { console.error(x); toast(x.shortMessage || x.message, true); }
  finally { document.querySelectorAll("button").forEach((x) => (x.disabled = false)); }
});

function demoBar() {
  const bar = document.createElement("div"); bar.className = "demo-bar";
  bar.innerHTML = `<b>DEMO</b><span>Simulated chain, fake money. Switch who you are:</span><button data-role="investor" class="on">Investor</button><button data-role="creator">Creator + Owner</button><button data-fwd>Skip 7 days</button>`;
  document.body.appendChild(bar);
  bar.onclick = async (e) => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.fwd !== undefined) { DEMO.forward(7); await refresh(); route(); return toast("7 days later"); }
    DEMO.setRole(b.dataset.role); bar.querySelectorAll("[data-role]").forEach((x) => x.classList.toggle("on", x === b)); await connect(); route(); };
}
async function main() {
  if (CONFIG.demo) { try { if (!localStorage.getItem("hf-lang")) localStorage.setItem("hf-lang", "es"); } catch {} DEMO = createDemo({ CONFIG, ABI, ERC20: erc20Abi, ROUTER_ABI, QUOTER_ABI }); pub = DEMO.pub; window.ethereum = DEMO.eth; demoBar(); window.__demo = DEMO; }
  initI18n();
  $("#net span").textContent = CONFIG.chainName;
  setLaunchChain({ CONFIG, pub, wallet: null, account: null }); if (!CONFIG.demo) loadChainLaunches().catch(() => {});
  $("#tab-me").onclick = () => $("#connect").click();
  $("#bell").onclick = openNt; $("#bell").classList.toggle("on", "Notification" in window && Notification.permission === "granted");
  $("#connect").onclick = () => { if (S.me) { const o = document.getElementById("acct-ov"); if (o) { o.remove(); return; } const ov = document.createElement("div"); ov.id = "acct-ov"; ov.innerHTML = acctHtml(); document.body.appendChild(ov); ov.onclick = (e) => { if (e.target.closest("[data-edp]")) { ov.remove(); editProfile(); return; } if (e.target === ov || e.target.closest("[data-acx]")) ov.remove(); }; return; } connect().catch((x) => toast(x.shortMessage || x.message, true)); };
  window.addEventListener("hashchange", () => { S.tab = "overview"; clearInterval(S.poll); if (!location.hash.startsWith("#/launch")) $("#app").innerHTML = ""; route(); scrollTo(0, 0); });
  await loadCatalog();
  route();
  await refresh();
  const eth = provider();
  if (eth) { const accs = await eth.request({ method: "eth_accounts" }).catch(() => []); if (accs.length) await connect(); }
}
main().catch((e) => { console.error(e); toast(e.message, true); });
