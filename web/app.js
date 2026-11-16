import {
  createPublicClient, createWalletClient, custom, http, encodeDeployData, getContractAddress, concat, parseUnits,
  formatUnits, erc20Abi, defineChain, keccak256, toBytes, verifyMessage, parseAbi,
} from "https://cdn.jsdelivr.net/npm/viem@2.21.54/+esm";
import { CONFIG } from "./config.js";
import { ALCANCIA_ABI as ABI, ALCANCIA_BYTECODE } from "./alcancia.js";
import { initI18n } from "./i18n.js";
import { mountCoin } from "./coin3d.js";
import { canonical, msgSubmit, msgDecision, msgUpdate, msgPanel, msgQuestion, msgAnswer, validate, CATEGORIES, COLORS, USE_KEYS, USE_LINKS } from "./shared.js";

const RPC = new URLSearchParams(location.search).get("rpc") || CONFIG.rpc; // ?rpc= solo para pruebas locales
const SALT = "0x" + "00".repeat(32);
const OWNER = CONFIG.platform.toLowerCase();
const chain = defineChain({
  id: CONFIG.chainId, name: CONFIG.chainName, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } }, contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});
const pub = createPublicClient({ chain, transport: http(RPC) });

const S = { tab: "overview", me: null, wallet: null, usdc: 0n, all: [], list: [], reviews: null, now: Math.floor(Date.now() / 1000) };
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = (v, d, max = 2) => Number(formatUnits(v, d)).toLocaleString("en-US", { maximumFractionDigits: max });
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
  // avances de proyectos semilla: también verificados con la firma del creador
  await Promise.all(S.all.filter((p) => p.seed).map(async (p) => {
    const ok = []; for (const u of upRaw[p.id] || []) if (await verifyMessage({ address: p.params.creator, message: msgUpdate(p.id, u.ts, keccak256(toBytes(u.text))), signature: u.signature }).catch(() => false)) ok.push(u);
    p.updates = ok;
  }));
  S.list = S.all.filter((p) => p.status === "approved");
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
async function loadChain(p) {
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
const fmtP = (x) => x >= 0.01 ? `$${x.toLocaleString("en-US", { maximumFractionDigits: 4 })}` : `$${x.toPrecision(3)}`;
async function loadTrades(p) {
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
function tradePanel(p) {
  const side = S.side || "buy", m = p.mk;
  return `<div class="panel cyber" data-testid="trade-panel">
    <div class="cy-top"><span class="cy-live"><i></i>Market open</span><span>Uniswap v3</span></div>
    <div class="cy-price">${fmtP(m.price)}<small>per ${esc(p.q.symbol)}</small></div>
    <div class="cy-delta ${m.price >= m.round ? "up" : "down"}">${m.price >= m.round ? "+" : ""}${(((m.price - m.round) / m.round) * 100).toFixed(1)}% vs round price</div>
    <div class="cy-toggle" role="tablist"><button type="button" data-side="buy" aria-selected="${side === "buy"}">Buy</button><button type="button" data-side="sell" aria-selected="${side === "sell"}">Sell</button></div>
    <label class="cy-lab" for="tamt">${side === "buy" ? "You pay" : "You sell"}</label>
    <div class="field-amt cy-field"><input id="tamt" type="number" inputmode="decimal" min="0" step="any" placeholder="0" data-testid="trade-amount"><span class="u">${side === "buy" ? "USDC" : esc(p.q.symbol)}</span></div>
    <div class="under"><span>Balance ${side === "buy" ? `${usd(S.usdc)} USDC` : `${tok(p.u.balance)} ${esc(p.q.symbol)}`}</span><span>Slippage 1%</span></div>
    <div class="lines cy-sum"><div><span>You receive</span><b id="tout">–</b></div><div><span>Price impact</span><b id="timp">–</b></div></div>
    <button class="btn btn-cyber btn-block" data-act="swap" data-testid="swap">${side === "buy" ? `Buy ${esc(p.q.symbol)}` : `Sell ${esc(p.q.symbol)}`}</button>
    <p class="cy-fine">Trades go straight to the Uniswap pool. Holdfast never holds your funds.</p>
  </div>`;
}
let quoteT = 0;
function bindTrade(p) {
  const el = $("#tamt"); if (!el || !p.mk) return;
  el.oninput = () => { clearTimeout(quoteT); quoteT = setTimeout(() => quote(p), 250); };
}
async function quote(p) {
  const side = S.side || "buy", raw = $("#tamt")?.value;
  let amt = 0n; try { amt = parseUnits(raw || "0", side === "buy" ? 6 : 18); } catch {}
  if (amt <= 0n) { $("#tout").textContent = "–"; $("#timp").textContent = "–"; S.quote = null; return; }
  try {
    const { result } = await pub.simulateContract({ address: CONFIG.quoter, abi: QUOTER_ABI, functionName: "quoteExactInputSingle",
      args: [{ tokenIn: side === "buy" ? CONFIG.usdc : p.address, tokenOut: side === "buy" ? p.address : CONFIG.usdc, amountIn: amt, fee: 3000, sqrtPriceLimitX96: 0n }] });
    const out = result[0]; S.quote = { amt, out, side };
    $("#tout").textContent = side === "buy" ? `${tok(out)} ${p.q.symbol}` : `${usd(out)} USDC`;
    const exec = side === "buy" ? (Number(amt) / 1e6) / (Number(out) / 1e18) : (Number(out) / 1e6) / (Number(amt) / 1e18);
    const imp = Math.abs(exec - p.mk.price) / p.mk.price * 100;
    $("#timp").textContent = `${imp.toFixed(2)}%`; $("#timp").classList.toggle("warn", imp > 3);
  } catch { $("#tout").textContent = "Not enough liquidity"; S.quote = null; }
}
async function swap(p) {
  await quote(p);
  const q = S.quote; if (!q) return toast("Enter an amount to trade.", true);
  const tokenIn = q.side === "buy" ? CONFIG.usdc : p.address, tokenOut = q.side === "buy" ? p.address : CONFIG.usdc;
  const bal = q.side === "buy" ? S.usdc : p.u.balance;
  if (bal < q.amt) return toast("Not enough balance.", true);
  const allowance = await pub.readContract({ address: tokenIn, abi: erc20Abi, functionName: "allowance", args: [S.me, CONFIG.swapRouter] });
  const labels = [], fns = [];
  if (allowance < q.amt) { labels.push(q.side === "buy" ? "Allow your USDC" : `Allow your ${p.q.symbol}`); fns.push(() => S.wallet.writeContract({ address: tokenIn, abi: erc20Abi, functionName: "approve", args: [CONFIG.swapRouter, q.amt] })); }
  labels.push(q.side === "buy" ? `Buy ${p.q.symbol}` : `Sell ${p.q.symbol}`);
  fns.push(() => S.wallet.writeContract({ address: CONFIG.swapRouter, abi: ROUTER_ABI, functionName: "exactInputSingle",
    args: [{ tokenIn, tokenOut, fee: 3000, recipient: S.me, amountIn: q.amt, amountOutMinimum: (q.out * 99n) / 100n, sqrtPriceLimitX96: 0n }] }));
  await flow(q.side === "buy" ? "Buy" : "Sell", labels, fns, "Trade done");
}

// ================================================================= terminal de trading y Market
const PERIODS = { "1H": [3600, 120], "1D": [86400, 3600], "1W": [604800, 21600], ALL: [0, 0] };
function buildCandles(p, period) {
  const tr = (p.trades || []).filter((t) => t.ts), now = S.now || Math.floor(Date.now() / 1000);
  let [span, step] = PERIODS[period];
  const first = tr.length ? tr[0].ts : now - 3600;
  if (period === "ALL") { span = Math.max(3600, now - first + 60); step = Math.max(60, Math.ceil(span / 40)); }
  const start = now - span, out = [];
  let last = p.mk.round;
  for (const t of tr) if (t.ts < start) last = t.price;
  for (let b = start - (start % step); b <= now; b += step) {
    const inB = tr.filter((t) => t.ts >= b && t.ts < b + step);
    const o = last, prices = inB.map((t) => t.price), c = prices.length ? prices[prices.length - 1] : last;
    out.push({ o, c, h: Math.max(o, c, ...prices), l: Math.min(o, c, ...prices), v: inB.reduce((a, t) => a + Number(t.usdc) / 1e6, 0) });
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
    <defs><linearGradient id="cdA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff2e88" stop-opacity=".28"/><stop offset="1" stop-color="#ff2e88" stop-opacity="0"/></linearGradient>
      <linearGradient id="cdB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7ab8"/><stop offset="1" stop-color="#ff2e88"/></linearGradient></defs>
    ${grid}<path d="${line} L${W - bw / 2} ${PH} L${bw / 2} ${PH}Z" fill="url(#cdA)"/>${vols}
    <line x1="0" x2="${W}" y1="${y(p.mk.round)}" y2="${y(p.mk.round)}" class="cd-round"/>${body}<path d="${line}" class="cd-line"/>
    <line x1="0" x2="${W}" y1="${yp}" y2="${yp}" class="cd-now"/></svg>
    <div class="cd-y">${ticks}<em class="cd-tag" style="top:${(yp / H) * 100}%">${fmtP(p.mk.price)}</em></div></div>`;
}
function spark(p) {
  const pts = [p.mk.round, ...(p.trades || []).map((t) => t.price)]; if (pts.length < 2) pts.push(p.mk.price);
  const lo = Math.min(...pts), hi = Math.max(...pts), W = 120, H = 36;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * W).toFixed(1)} ${(H - ((v - lo) / (hi - lo || 1)) * H).toFixed(1)}`).join(" ");
  const ly = (H - ((pts[pts.length - 1] - lo) / (hi - lo || 1)) * H).toFixed(1), id = "sg" + Math.random().toString(36).slice(2, 7);
  return `<svg class="spark" viewBox="-2 -4 ${W + 6} ${H + 8}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff2e88" stop-opacity=".35"/><stop offset="1" stop-color="#ff2e88" stop-opacity="0"/></linearGradient></defs><path class="sa" d="${d} L${W} ${H} L0 ${H}Z" style="fill:url(#${id});stroke:none;filter:none"/><path d="${d}"/><circle cx="${W}" cy="${ly}" r="2.6" class="spark-dot"/></svg>`;
}
const vol24 = (p) => (p.trades || []).filter((t) => t.ts > (S.now || 0) - 86400).reduce((a, t) => a + t.usdc, 0n);
async function loadHolders(p) {
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
  if (t === "holders") return p.holders ? (p.holders.length ? `<ul class="hold">${p.holders.map((h, i) => `<li><span class="rk">${i + 1}</span>${avatar(h.a, 26)}<span class="addr">${short(h.a)}</span><span class="hl">${holderLabel(p, h.a)}</span><b>${p.supply ? ((Number(h.b) / Number(p.supply)) * 100).toFixed(2) : "–"}%</b></li>`).join("")}</ul>` : `<p class="prose">No holders yet.</p>`) : `<p class="prose">Loading holders…</p>`;
  if (t === "depth") return `<p class="fine" style="margin:0 0 12px">How much it takes to move the price. Small pools move fast: check before large trades.</p>
    <ul class="depth"><li class="dh"><span>Move</span><b>Buy to push up</b><b>Sell to push down</b></li>${depthRows(p)}</ul>`;
  const tr = (p.trades || []).slice(-20).reverse();
  return tr.length ? `<ul class="cy-trades">${tr.map((x) => `<li><span class="${x.buy ? "b" : "s"}">${x.buy ? "Buy" : "Sell"}</span><span>${tok(x.tok)} ${esc(p.q.symbol)}</span><span>$${usd(x.usdc)}</span><span>${fmtP(x.price)}</span><span class="faint">${ago((p.tHead || 0n) - x.block)}</span></li>`).join("")}</ul>` : `<p class="prose">No trades yet. Be the first.</p>`;
}
function vTerminal(p) {
  if (!p.mk) return `<div class="page-h"><h1>${esc(p.q.name)}</h1><p>This token doesn't have a market yet. It opens when the raise closes successfully.</p></div><a class="btn btn-line" href="#/p/${p.id}">Back to the project</a>`;
  const m = p.mk, per = S.period || "1D", up = m.price >= m.round;
  return `<section class="term">
    <a class="back" href="#/market">All markets</a>
    <header class="term-top">
      <div class="coin3d" id="coin3d" aria-label="${esc(p.q.symbol)} coin"></div>
      <div class="tt-id"><h1>${esc(p.q.name)} <span>${esc(p.q.symbol)} / USDC</span></h1>
        <div class="tt-price" id="tt-price">${fmtP(m.price)}</div>
        <div class="tt-delta ${up ? "up" : "dn"}" id="tt-delta">${up ? "+" : ""}${(((m.price - m.round) / m.round) * 100).toFixed(1)}% vs round price</div></div>
      <dl class="tt-stats">
        <div><dt>Round price</dt><dd>${fmtP(m.round)}</dd></div>
        <div><dt>Pool liquidity</dt><dd>$${usd(m.poolUsdc)}</dd></div>
        <div><dt>24h volume</dt><dd id="tt-vol">$${usd(vol24(p))}</dd></div>
        <div><dt>Liquidity unlocks</dt><dd>${day(p.s.lpUnlock)}</dd></div>
      </dl>
    </header>
    <div class="term-grid">
      <div class="term-main">
        <div class="chart-card"><div class="neon-floor" aria-hidden="true"></div>
          <div class="chart-head"><div class="periods" role="tablist">${Object.keys(PERIODS).map((k) => `<button type="button" data-period="${k}" aria-selected="${k === per}">${k === "ALL" ? "All" : k}</button>`).join("")}</div>
            <div class="cy-legend"><span class="l1">Price</span><span class="l2">Round price</span></div></div>
          <div id="candles">${candlesSvg(p, per)}</div></div>
        <div class="term-tabs" role="tablist">${[["trades", "Trades"], ["holders", "Top holders"], ["depth", "Pool depth"]].map(([k, t]) => `<button type="button" data-ttab="${k}" aria-selected="${(S.ttab || "trades") === k}">${t}</button>`).join("")}</div>
        <div id="term-tab">${termTab(p)}</div>
      </div>
      <aside class="term-side">${S.me ? tradePanel(p) : `<div class="panel cyber"><p class="muted" style="margin:0 0 16px">Connect your wallet to buy or sell ${esc(p.q.symbol)}. Anyone can buy with USDC.</p><button class="btn btn-cyber btn-block" data-act="connect">Connect wallet</button></div>`}</aside>
    </div>
  </section>`;
}
function vMarket() {
  const live = S.list.filter((p) => p.mk);
  return `<div class="page-h mk-h"><h1>Market</h1><p>Every Holdfast token with an open Uniswap pool. Anyone can buy with USDC; liquidity is locked for 12 months.</p></div>
  ${live.length ? `<div class="mk-list"><div class="mk-row mk-head"><span>Token</span><span>Price</span><span>vs round</span><span>Liquidity</span><span>24h volume</span><span></span></div>
    ${live.map((p) => { const up = p.mk.price >= p.mk.round; return `<a class="mk-row" href="#/trade/${p.id}" data-testid="mk-${p.id}">
      <span class="mk-tok">${mark(p)}<span><b>${esc(p.q.name)}</b><small>${esc(p.q.symbol)}</small></span></span>
      <span class="mk-p">${fmtP(p.mk.price)}</span><span class="${up ? "up" : "dn"}">${up ? "+" : ""}${(((p.mk.price - p.mk.round) / p.mk.round) * 100).toFixed(1)}%</span>
      <span>$${usd(p.mk.poolUsdc)}</span><span>$${usd(vol24(p))}</span><span>${spark(p)}</span></a>`; }).join("")}</div>`
    : `<div class="list"><div class="empty">No token has a market yet. Markets open when a raise closes successfully.</div></div>`}`;
}
let coinOff = null;
function startTerminal(p) {
  if (coinOff) { coinOff(); coinOff = null; }
  mountCoin($("#coin3d"), { logo: logoSrc(p), color: p.meta.color, symbol: p.q.symbol }).then((off) => (coinOff = off)).catch(() => {});
  bindTrade(p);
  const reTerm = () => { if (!$("#term-tab")) return; $("#candles").innerHTML = candlesSvg(p, S.period || "1D"); $("#term-tab").innerHTML = termTab(p); };
  const hl = async () => { if (!p.order) await loadActivity(); await loadHolders(p); if ((S.ttab || "trades") === "holders") reTerm(); };
  if (!p.trades) loadTrades(p).then(() => { reTerm(); hl(); }); else if (!p.holders) hl();
  clearInterval(S.poll);
  S.poll = setInterval(async () => {
    if (!location.hash.startsWith(`#/trade/${p.id}`)) return clearInterval(S.poll);
    const before = p.mk.price; await loadChain(p); if (!p.mk) return;
    if (!p.trades || !p.trades.length) { await loadTrades(p); reTerm(); }
    if (Math.abs(p.mk.price - before) / before > 1e-6) {
      const el = $("#tt-price"); el.textContent = fmtP(p.mk.price);
      el.classList.remove("flash-up", "flash-dn"); void el.offsetWidth; el.classList.add(p.mk.price > before ? "flash-up" : "flash-dn");
      await loadTrades(p); reTerm();
      const d = $("#tt-delta"), up = p.mk.price >= p.mk.round; if (d) { d.className = "tt-delta " + (up ? "up" : "dn"); d.textContent = `${up ? "+" : ""}${(((p.mk.price - p.mk.round) / p.mk.round) * 100).toFixed(1)}% vs round price`; }
      const v = $("#tt-vol"); if (v) v.textContent = "$" + usd(vol24(p));
      const cp = $(".cy-price"), cd = $(".cy-delta"); if (cp) cp.firstChild.textContent = fmtP(p.mk.price); if (cd && d) { cd.className = "cy-delta " + (up ? "up" : "down"); cd.textContent = d.textContent; }
    }
  }, Number(new URLSearchParams(location.search).get("poll")) || 12000);
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
const logoSrc = (p) => { const l = p.meta?.logo || ""; return /^data:image\/(webp|png|jpeg);base64,/.test(l) || /^\.\/assets\/tokens\/[\w-]+\.svg$/.test(l) ? l : ""; };
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
  <div class="cat-bar"><div class="cat-tabs" role="tablist">${[["trending", "🔥 Trending"], ["new", "New"], ["ending", "Ending soon"], ["funded", "Funded"]].map(([k, t]) => `<button type="button" role="tab" data-cat="${k}" aria-selected="${(S.cat || "trending") === k}">${t}</button>`).join("")}</div>
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
      <div class="car-txt">${hot(p) > 0 ? `<span class="car-hot">🔥 Trending</span>` : ""}${p.exists ? `<span class="kv-ver">✓ Verified</span>` : ""}<h3>${esc(p.q.name)}</h3><p>${esc(p.meta.tagline)}</p>
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
  const r = rarity(p), ph = phase(p), f = pct(p.s.totalRaised, p.q.hardcap);
  const d = Math.max(0, Math.ceil((Number(p.q.saleEnd) - S.now) / 86400));
  return `<a class="pcard ${r.k}" href="#/p/${p.id}" data-testid="row-${p.id}" style="--pc:${esc(p.meta.color)}">
    <div class="pc-in">
      <div class="pc-top"><span class="pc-rar">${STAR.repeat(r.n)}<span>${r.t}</span></span><span class="pc-pct">${f.toFixed(0)}%</span></div>
      ${coverSrc(p) ? `<div class="pc-art has-cover" aria-hidden="true"><img class="pc-cover" src="${esc(coverSrc(p))}" alt="" loading="lazy"><span class="pc-tick">${esc(p.q.symbol)}</span>${p.exists ? `<span class="pc-ver" title="Contract created on-chain"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>Verified</span>` : ""}${ph.c === "open" ? `<span class="pc-count" data-end="${Number(p.q.saleEnd)}">${countdown(Number(p.q.saleEnd))}</span>` : ""}</div>`
        : `<div class="pc-art" aria-hidden="true"><i class="pc-sun"></i>${logoSrc(p) ? `<img class="pc-coin" src="${esc(logoSrc(p))}" alt="">` : `<b>${esc(p.q.symbol)}</b>`}<span class="pc-tick">${esc(p.q.symbol)}</span></div>`}
      <div class="pc-body">
        <h3>${esc(p.q.name)}</h3>
        <p>${esc(p.meta.tagline)}</p>
        ${p.mk ? `<div class="pc-mkt"><span class="pc-px">${fmtP(p.mk.price)}</span><span class="pc-chg ${p.mk.price >= p.mk.round ? "up" : "dn"}">${p.mk.price >= p.mk.round ? "+" : ""}${(((p.mk.price - p.mk.round) / p.mk.round) * 100).toFixed(1)}%</span>${spark(p)}</div>` : ""}
        <div class="pc-backers">${faces(p)}</div>
        <div class="meter"><b style="width:${f}%"></b><s style="left:${pct(p.q.softcap, p.q.hardcap)}%"></s></div>
        <dl class="pc-stats">
          <div><dt>Raised</dt><dd>$${usd(p.s.totalRaised)}</dd></div>
          <div><dt>Goal</dt><dd>$${usd(p.q.hardcap)}</dd></div>
          <div><dt>${ph.c === "open" ? "Days left" : "Status"}</dt><dd>${ph.c === "open" ? d : ph.t}</dd></div>
        </dl>
      </div>
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
function avatar(addr, size = 36) {
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
        <div><span>Pool liquidity</span><b>$${usd(m.poolUsdc)}</b></div><div><span>Liquidity unlocks</span><b>${day(p.s.lpUnlock)}</b></div></div>
      <div class="cy-chart-box"><div class="cy-legend"><span class="l1">Price</span><span class="l2">Round price</span></div>${chartSvg(p)}</div>
      <h3 class="cy-h">Recent trades</h3>
      ${tr.length ? `<ul class="cy-trades">${tr.map((t) => `<li><span class="${t.buy ? "b" : "s"}">${t.buy ? "Buy" : "Sell"}</span><span>${tok(t.tok)} ${esc(p.q.symbol)}</span><span>$${usd(t.usdc)}</span><span>${fmtP(t.price)}</span><span class="faint">${ago((p.tHead || 0n) - t.block)}</span></li>`).join("")}</ul>` : `<p class="prose">No trades yet. Be the first.</p>`}
      <p class="fine">The pool was created by the project's contract at the round price. Its liquidity is locked in the contract until ${day(p.s.lpUnlock)}. <a href="https://app.uniswap.org/explore/pools/ethereum_sepolia/${p.s.pool}" target="_blank" rel="noopener">View on Uniswap</a></p>
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
  const rim = x.createLinearGradient(0, 0, 900, 1260); ["#ff2e88", "#ffd36b", "#4fd1c5", "#7868e6", "#e0335c"].forEach((col, i) => rim.addColorStop(i / 4, col));
  x.strokeStyle = r.k === "legendary" ? rim : r.k === "common" ? "#393b40" : "#ff2e88"; x.lineWidth = 8; x.beginPath(); x.roundRect(4, 4, 892, 1252, 46); x.stroke();
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
    ${safe ? `<p class="pos-safe" data-testid="risk">🛡 ${safe}</p>` : ""}
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
        <div class="f"><label for="f-cat">Category</label><select id="f-cat" name="category">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select></div>
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
        <div class="f"><label>Liquidity for the Uniswap market</label>${chip("liq", [5, 10, 15, 20, 25], 10, (v) => `${v}%`)}<small>Opens a pool at the round price, locked 12 months.</small></div>
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
    let url = c.toDataURL("image/webp", 0.85); if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/png");
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
  <section class="st-stats"><div><b>$${usd(raised)}</b><span>Raised</span></div><div><b>${backers}</b><span>Backers</span></div><div><b>$${usd(paid)}</b><span>Paid to you</span></div><div><b>${mine.length}</b><span>Projects</span></div></section>
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
function route() {
  const h = location.hash || "#/";
  const m = h.match(/^#\/p\/([\w-]+)/);
  const p = m && S.list.find((x) => x.id === m[1]);
  const tm = h.match(/^#\/trade\/([\w-]+)/), tp = tm && S.list.find((x) => x.id === tm[1]);
  const key = tp || h.startsWith("#/market") ? "market" : p ? "home" : h.startsWith("#/launch") ? "launch" : h.startsWith("#/portfolio") ? "portfolio" : h.startsWith("#/studio") ? "studio" : h.startsWith("#/owner") ? "owner" : "home";
  document.querySelectorAll("[data-nav]").forEach((a) => (a.dataset.nav === key ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("#nav-owner").classList.toggle("d-none", !isOwner()); $("#tab-owner").classList.toggle("d-none", !isOwner());
  if (key === "launch" && $("#form")) return; // no borrar lo que el creador está escribiendo
  const keep = $("#amt")?.value;
  if (tp) { const kv = $("#tamt")?.value; $("#app").innerHTML = vTerminal(tp); if (kv && $("#tamt")) $("#tamt").value = kv; startTerminal(tp); return; }
  if (key === "market") { $("#app").innerHTML = vMarket(); S.list.filter((x) => x.mk && !x.trades).forEach((x) => loadTrades(x).then(() => { if (location.hash.startsWith("#/market")) $("#app").innerHTML = vMarket(); })); return; }
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
  $("#connect").innerHTML = `<span class="acct"><i></i>${short(S.me)}</span>`; $("#connect").className = "btn btn-soft btn-sm";
  eth.on?.("accountsChanged", () => location.reload()); eth.on?.("chainChanged", () => location.reload());
  if ($("#form")) $("#app").innerHTML = "";
  await refresh();
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
async function flow(title, labels, fns, okMsg) {
  const ui = sheet(title, labels); let i = 0;
  try { for (; i < fns.length; i++) await step(ui, i, fns[i]); ui.close(); toast(okMsg); return true; }
  catch (e) { ui.set(i, "err", e.shortMessage || e.message); ui.close(3500); return false; }
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
  if (pr) { S.period = pr.dataset.period; document.querySelectorAll("[data-period]").forEach((x) => x.setAttribute("aria-selected", x === pr)); const tp = S.list.find((x) => location.hash === `#/trade/${x.id}`); if (tp) $("#candles").innerHTML = candlesSvg(tp, S.period); return; }
  const tt = e.target.closest("[data-ttab]");
  if (tt) { S.ttab = tt.dataset.ttab; document.querySelectorAll("[data-ttab]").forEach((x) => x.setAttribute("aria-selected", x === tt)); const tp = S.list.find((x) => location.hash === `#/trade/${x.id}`); if (tp) $("#term-tab").innerHTML = termTab(tp); return; }
  const sd = e.target.closest("[data-side]");
  if (sd) { S.side = sd.dataset.side; const p = S.list.find((x) => location.hash === `#/p/${x.id}` || location.hash === `#/trade/${x.id}`); if (p) { const box = $(".cyber"); box.outerHTML = tradePanel(p); bindTrade(p); } return; }
  const tb = e.target.closest("[data-tab]");
  if (tb) { S.tab = tb.dataset.tab; document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", x === tb)); const p = S.list.find((x) => location.hash === `#/p/${x.id}`); if (p) { $(".ptab-body").innerHTML = tabBody(p); bindTab(p); if (S.tab === "trade" && p.mk) loadTrades(p).then(() => { if (S.tab === "trade") $(".ptab-body").innerHTML = tabBody(p); }); } return; }
  if (e.target.closest("#bb-go")) { const v = $("#amt")?.value; if (v && Number(v) > 0) return $('[data-act="buy"]')?.click(); $("#amt")?.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => $("#amt")?.focus(), 400); return; }
  const sc = e.target.closest("[data-scroll]");
  if (sc) return document.getElementById(sc.dataset.scroll)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const act = b.dataset.act;
  if (act === "connect") return connect().catch((x) => toast(x.shortMessage || x.message, true));
  if (!S.wallet) return toast("Connect your wallet first.", true);
  document.querySelectorAll("button").forEach((x) => (x.disabled = true));
  try {
    const p = S.list.find((x) => location.hash === `#/p/${x.id}` || location.hash === `#/trade/${x.id}`);
    if (act === "buy") await buy(p);
    else if (ACTS[act]) { const [label, fn, args] = ACTS[act]; await flow(label, [label], [() => S.wallet.writeContract({ address: p.address, abi: ABI, functionName: fn, args })], `${label}: done`); }
    else if (act === "approve" || act === "reject") return await decide(b.dataset.id, act === "approve");
    else if (act === "openPanel") return await openPanel();
    else if (act === "postUpdate") return await postUpdate(b.dataset.id);
    else if (act === "card") return await backerCard(p);
    else if (act === "swap") { await swap(p); p.trades = null; }
    else if (act === "ask" || act === "answer") return await qaPost(p, act, b.dataset.qts);
    await refresh();
  } catch (x) { console.error(x); toast(x.shortMessage || x.message, true); }
  finally { document.querySelectorAll("button").forEach((x) => (x.disabled = false)); }
});

async function main() {
  initI18n();
  $("#net span").textContent = CONFIG.chainName;
  $("#connect").onclick = () => connect().catch((x) => toast(x.shortMessage || x.message, true));
  window.addEventListener("hashchange", () => { S.tab = "overview"; clearInterval(S.poll); if (!location.hash.startsWith("#/launch")) $("#app").innerHTML = ""; route(); scrollTo(0, 0); });
  await loadCatalog();
  route();
  await refresh();
  const eth = provider();
  if (eth) { const accs = await eth.request({ method: "eth_accounts" }).catch(() => []); if (accs.length) await connect(); }
}
main().catch((e) => { console.error(e); toast(e.message, true); });
