import {
  createPublicClient, createWalletClient, custom, http, encodeDeployData, getContractAddress, concat, parseUnits,
  formatUnits, erc20Abi, defineChain, keccak256, toBytes, verifyMessage, parseAbi,
} from "https://cdn.jsdelivr.net/npm/viem@2.21.54/+esm";
import { CONFIG } from "./config.js";
import { ALCANCIA_ABI as ABI, ALCANCIA_BYTECODE } from "./alcancia.js";
import { initI18n } from "./i18n.js";
import { canonical, msgSubmit, msgDecision, msgUpdate, msgPanel, msgQuestion, msgAnswer, validate, CATEGORIES, COLORS } from "./shared.js";

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
  let api = [], qaRaw = {};
  try { const r = await fetch("./api/projects", { cache: "no-store" }); if (r.ok) { const j = await r.json(); api = j.projects || []; qaRaw = j.qa || {}; } } catch {}
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

const READS = ["pool", "lpUnlock", "liquidityUsdc", "state", "totalRaised", "poolAfterFees", "usdcReleased", "milestonesDone", "voteEnd", "votesYes", "votesNo", "deadline", "succeeded", "refundPool", "voteRound"];
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

// ================================================================= actividad en vivo (eventos on-chain)
async function loadActivity() {
  try {
    const head = await pub.getBlockNumber();
    const fromBlock = head > 45000n ? head - 45000n : 0n;
    const lists = await Promise.all(S.list.filter((p) => p.exists).map(async (p) => {
      const [bought, fin] = await Promise.all([
        pub.getContractEvents({ address: p.address, abi: ABI, eventName: "Bought", fromBlock }).catch(() => []),
        pub.getContractEvents({ address: p.address, abi: ABI, eventName: "Finalized", fromBlock }).catch(() => []),
      ]);
      p.backers = new Set(bought.map((e) => e.args.buyer.toLowerCase())).size; p.backersPartial = fromBlock > 0n;
      p.order = {}; bought.forEach((e) => { const a = e.args.buyer.toLowerCase(); if (!(a in p.order)) p.order[a] = Object.keys(p.order).length + 1; });
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
  if (!p.mk) return [];
  try {
    const head = await pub.getBlockNumber(), fromBlock = head > 45000n ? head - 45000n : 0n;
    const ev = await pub.getContractEvents({ address: p.s.pool, abi: POOL_ABI, eventName: "Swap", fromBlock });
    p.trades = ev.map((e) => {
      const usdcAmt = p.mk.usdc0 ? e.args.amount0 : e.args.amount1, tokAmt = p.mk.usdc0 ? e.args.amount1 : e.args.amount0;
      return { buy: usdcAmt > 0n, usdc: usdcAmt < 0n ? -usdcAmt : usdcAmt, tok: tokAmt < 0n ? -tokAmt : tokAmt, price: usdcPerToken(e.args.sqrtPriceX96, p.mk.usdc0), who: e.args.recipient, block: e.blockNumber };
    });
    p.tHead = head;
  } catch { p.trades = []; }
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

// ================================================================= estados
function phase(p) {
  const { s, q } = p;
  if (s.state === 2) return { t: "Refunding", c: "refund" };
  if (s.state === 1) return s.milestonesDone >= q.milestones ? { t: "Completed", c: "funded" } : { t: "Funded", c: "funded" };
  if (S.now >= Number(q.saleEnd) || s.totalRaised >= q.hardcap) return { t: "Raise closed", c: "closed" };
  return { t: "Open", c: "open" };
}
function left(p) {
  const d = Number(p.q.saleEnd) - S.now;
  if (d <= 0) return "Closed " + day(p.q.saleEnd);
  const days = Math.floor(d / 86400);
  return days >= 1 ? `${days} day${days === 1 ? "" : "s"} left` : `${Math.ceil(d / 3600)} hours left`;
}
const logoSrc = (p) => { const l = p.meta?.logo || ""; return /^data:image\/(webp|png|jpeg);base64,/.test(l) || /^\.\/assets\/tokens\/[\w-]+\.svg$/.test(l) ? l : ""; };
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
    <div>
      <h1>Hold fast to what you back.</h1>
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
  <div class="sec-h" id="projects"><h2 class="h2">Featured projects</h2><span class="faint">${S.list.length} live</span></div>
  <div class="deck">${S.list.length ? S.list.map(card).join("") : `<div class="empty">No projects are live yet. <a href="#/launch">Launch the first one</a>.</div>`}</div>`;
}
const STAR = `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.5l2.6 7.2 7.4.3-5.8 4.7 2 7.3L12 16.8 5.8 21l2-7.3L2 9l7.4-.3z"/></svg>`;
function rarity(p) {
  const f = pct(p.s.totalRaised, p.q.hardcap);
  if (p.s.succeeded || f >= 100) return { k: "legendary", t: "Legendary", n: 4 };
  if (f >= 60) return { k: "epic", t: "Epic", n: 3 };
  if (f >= 25) return { k: "rare", t: "Rare", n: 2 };
  return { k: "common", t: "Common", n: 1 };
}
function card(p) {
  const r = rarity(p), ph = phase(p), f = pct(p.s.totalRaised, p.q.hardcap);
  const d = Math.max(0, Math.ceil((Number(p.q.saleEnd) - S.now) / 86400));
  return `<a class="pcard ${r.k}" href="#/p/${p.id}" data-testid="row-${p.id}" style="--pc:${esc(p.meta.color)}">
    <div class="pc-in">
      <div class="pc-top"><span class="pc-rar">${STAR.repeat(r.n)}<span>${r.t}</span></span><span class="pc-pct">${f.toFixed(0)}%</span></div>
      <div class="pc-art" aria-hidden="true"><i class="pc-sun"></i>${logoSrc(p) ? `<img class="pc-coin" src="${esc(logoSrc(p))}" alt="">` : `<b>${esc(p.q.symbol)}</b>`}<span class="pc-tick">${esc(p.q.symbol)}</span></div>
      <div class="pc-body">
        <h3>${esc(p.q.name)}</h3>
        <p>${esc(p.meta.tagline)}</p>
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
function vProject(p) {
  const { q } = p, ph = phase(p), step = (10000 - q.initialBps) / q.milestones / 100;
  return `
  <a class="back" href="#/">All projects</a>
  <header class="kv-hero" style="--pc:${esc(p.meta.color)}">
    <div class="kv-art" aria-hidden="true"><i class="pc-sun"></i></div>
    <div class="kv-id">
      ${logoSrc(p) ? `<img class="kv-coin" src="${esc(logoSrc(p))}" alt="">` : `<div class="kv-coin kv-coin-text">${esc(q.symbol)}</div>`}
      <div class="kv-text">
        <div class="kv-tags"><span class="kv-rar ${rarity(p).k}">${STAR.repeat(rarity(p).n)} ${rarity(p).t}</span><span class="status ${ph.c}">${ph.t}</span></div>
        <h1>${esc(q.name)}</h1>
        <p>${esc(p.meta.tagline)}</p>
        <div class="kv-meta"><span>${esc(p.meta.category)}</span><span>Token ${esc(q.symbol)}</span><span>${left(p)}</span></div>
      </div>
    </div>
  </header>
  <section class="kv-stats" aria-label="Key numbers">
    <div><b>$${usd(p.s.totalRaised)}</b><span>Raised of $${usd(q.hardcap)}</span></div>
    <div><b>${p.backers ?? "–"}</b><span>${p.backersPartial ? "Backers this week" : "Backers"}</span></div>
    <div><b>${ph.c === "open" ? Math.max(0, Math.ceil((Number(q.saleEnd) - S.now) / 86400)) : "–"}</b><span>${ph.c === "open" ? "Days left" : ph.t}</span></div>
  </section>
  <div class="layout">
    <div>
      <div class="ptabs" role="tablist" aria-label="Project sections">${TABS_ALL(p).slice(0).filter(([k]) => k !== "team" || true).map(([k, t]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${S.tab === k}">${t}</button>`).join("")}</div>
      <div class="ptab-body">${tabBody(p)}</div>
    </div>
    <aside class="aside">${p.mk && S.me ? tradePanel(p) : pInvest(p)}${S.me && p.u.contributed > 0n ? pPosition(p) : ""}${pVote(p)}</aside>
  </div>
  ${buyBar(p)}`;
}
const TORII = `<svg viewBox="0 0 100 100" width="28" height="28" aria-hidden="true"><path class="g-top" d="M6 18 Q50 27 94 18 L92 30 Q50 38 8 30Z"/><rect class="g-top" x="16" y="38" width="68" height="8" rx="2"/><path class="g-leg" d="M26 34 H35 L34 96 H25Z M65 34 H74 L75 96 H66Z"/></svg>`;
const TABS_ALL = (p) => [["overview", "Overview"], ...(p.mk ? [["trade", "Trade"]] : []), ["team", "Team"], ["releases", "Releases"], ["backers", "Backers"], ["qa", "Q&A"], ["contract", "Contract"]];
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
      <div class="cy-stats"><div><span>Price</span><b>${fmtP(m.price)}</b></div><div><span>Round price</span><b>${fmtP(m.round)}</b></div>
        <div><span>Pool liquidity</span><b>$${usd(m.poolUsdc)}</b></div><div><span>Liquidity unlocks</span><b>${day(p.s.lpUnlock)}</b></div></div>
      <div class="cy-chart-box"><div class="cy-legend"><span class="l1">Price</span><span class="l2">Round price</span></div>${chartSvg(p)}</div>
      <h3 class="cy-h">Recent trades</h3>
      ${tr.length ? `<ul class="cy-trades">${tr.map((t) => `<li><span class="${t.buy ? "b" : "s"}">${t.buy ? "Buy" : "Sell"}</span><span>${tok(t.tok)} ${esc(p.q.symbol)}</span><span>$${usd(t.usdc)}</span><span>${fmtP(t.price)}</span><span class="faint">${ago((p.tHead || 0n) - t.block)}</span></li>`).join("")}</ul>` : `<p class="prose">No trades yet. Be the first.</p>`}
      <p class="fine">The pool was created by the project's contract at the round price. Its liquidity is locked in the contract until ${day(p.s.lpUnlock)}. <a href="https://app.uniswap.org/explore/pools/ethereum_sepolia/${p.s.pool}" target="_blank" rel="noopener">View on Uniswap</a></p>
    </div>`;
  }
  if (S.tab === "releases") return stages(p);
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
    <section class="sim" aria-label="Investment simulator">
      <div class="sim-h"><h3>Simulate your backing</h3><b id="sim-v">$100</b></div>
      <input id="sim" type="range" min="10" max="1000" step="10" value="100" aria-label="Amount to simulate">
      <div class="sim-rows">
        <div><span>You receive</span><b id="sim-tok"></b></div>
        <div><span>Goal of $${usd(q.softcap)} missed</span><b id="sim-miss"></b></div>
        <div><span>Team stops after release 1</span><b id="sim-stop"></b></div>
        <div><span>Every release approved</span><b>You keep all your tokens</b></div>
      </div>
    </section>
    <div class="rules">
      <div>${IC.back}<div><b>Goal missed, full refund</b><p>If less than $${usd(q.softcap)} is raised by the close, every backer withdraws 100% of what they put in. No fee.</p></div></div>
      <div>${IC.steps}<div><b>The team is paid in stages</b><p>${q.initialBps / 100}% when the raise closes, then ${q.milestones} releases of ${step}%. Backers vote on each one.</p></div></div>
      <div>${IC.lock}<div><b>No one can touch it</b><p>The contract has no admin. If the team vanishes or loses a vote, the rest goes back to backers.</p></div></div>
    </div>`;
}
function bindTab(p) {
  const r = $("#sim"); if (!r) return;
  const upd = () => {
    const v = BigInt(r.value) * 1_000_000n, q = p.q, first = BigInt(q.initialBps) + BigInt(Math.floor((10000 - q.initialBps) / q.milestones));
    $("#sim-v").textContent = `$${usd(v)}`;
    $("#sim-tok").textContent = `${tok((v * q.saleTokens) / q.hardcap)} ${q.symbol}`;
    $("#sim-miss").textContent = `$${usd(v)} back`;
    $("#sim-stop").textContent = `about $${usd((v * 99n * (10000n - first)) / 1000000n)} back`;
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
  const rim = x.createLinearGradient(0, 0, 900, 1260); ["#ff6a3d", "#ffd36b", "#4fd1c5", "#7868e6", "#e0335c"].forEach((col, i) => rim.addColorStop(i / 4, col));
  x.strokeStyle = r.k === "legendary" ? rim : r.k === "common" ? "#393b40" : "#ff6a3d"; x.lineWidth = 8; x.beginPath(); x.roundRect(4, 4, 892, 1252, 46); x.stroke();
  x.save(); x.beginPath(); x.roundRect(48, 120, 804, 600, 32); x.clip();
  x.fillStyle = p.meta.color; x.globalAlpha = .25; x.fillRect(48, 120, 804, 600); x.globalAlpha = 1;
  const sun = x.createLinearGradient(0, 200, 0, 680); sun.addColorStop(0, "#ffb27a"); sun.addColorStop(.5, p.meta.color); sun.addColorStop(1, "#3a1440");
  x.fillStyle = sun; x.beginPath(); x.arc(450, 440, 230, 0, Math.PI * 2); x.fill();
  x.fillStyle = "rgba(15,16,18,.6)"; [[520, 14], [570, 12], [615, 10]].forEach(([y, h]) => x.fillRect(200, y, 500, h));
  x.restore();
  const src = logoSrc(p);
  if (src) { const im = new Image(); im.src = src; await im.decode().catch(() => {}); x.save(); x.beginPath(); x.arc(450, 420, 120, 0, Math.PI * 2); x.clip(); x.drawImage(im, 330, 300, 240, 240); x.restore(); }
  x.fillStyle = "#f2f2ef"; x.font = "600 30px Geist, sans-serif"; x.fillText(`${"★".repeat(r.n)} ${r.t.toUpperCase()}`, 56, 82);
  x.textAlign = "right"; x.fillText("HOLDFAST", 844, 82); x.textAlign = "left";
  x.font = "500 76px Newsreader, Georgia, serif"; x.fillText(p.q.name, 56, 830);
  x.fillStyle = "#b4b5b1"; x.font = "400 34px Geist, sans-serif"; x.fillText(n ? `Backer #${n}` : "Backer", 56, 890);
  x.fillStyle = "#ff6a3d"; x.font = "600 96px Geist, sans-serif"; x.fillText(`$${usd(amt)}`, 56, 1030);
  x.fillStyle = "#7e8085"; x.font = "400 30px Geist, sans-serif"; x.fillText(`${tok((amt * p.q.saleTokens) / p.q.hardcap)} ${p.q.symbol}  ·  ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, 56, 1090);
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
    if (now) sub = s.voteEnd > 0n ? `Voting until ${day(s.voteEnd)}` : `The team must request it by ${day(s.deadline)}`;
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
      <div class="lines inv-sum">
        <div><span>You receive</span><b id="receive">0 ${esc(q.symbol)}</b></div>
        <div><span>If the goal is missed</span><b id="refundline">100% back</b></div>
        <div><span>Network fee</span><b>${p.exists ? "Less than $0.01" : "A few cents, once"}</b></div>
        <div><span>Your balance</span><b>${usd(S.usdc)} USDC</b></div>
      </div>
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
    <dl class="facts">
      <div><dt>Price</dt><dd>1 USDC = ${tok((q.saleTokens * 1_000_000n) / q.hardcap)} ${esc(q.symbol)}</dd></div>
      <div><dt>Closes</dt><dd>${day(q.saleEnd)}</dd></div>
    </dl>${act}
    <ul class="guarantees">
      <li>${IC.back}<span>Refund if goal missed</span></li>
      <li>${IC.lock}<span>No admin keys</span></li>
      <li>${IC.steps}<span>Paid in voted stages</span></li>
    </ul></div>`;
}
function pPosition(p) {
  const { s, u, q } = p;
  let top = "";
  if (s.state === 1) {
    const kept = s.poolAfterFees - s.usdcReleased, inPool = s.liquidityUsdc || 0n, fee = (s.totalRaised * 100n) / 10000n;
    top = `<div class="muted" style="font-size:14px">Most you could lose today</div><div class="big" data-testid="risk">${maxLoss(p).toFixed(1)}%</div>
      <div class="split"><i style="width:${pct(kept, s.totalRaised)}%;background:var(--ink)"></i><i style="width:${pct(s.usdcReleased, s.totalRaised)}%;background:var(--ember)"></i><i style="width:${pct(inPool, s.totalRaised)}%;background:#3de0ff"></i><i style="width:${pct(fee, s.totalRaised)}%;background:var(--rule-2)"></i></div>
      <div class="keys"><span style="--c:var(--ink)">Locked $${usd(kept)}</span><span style="--c:var(--ember)">Released $${usd(s.usdcReleased)}</span>${inPool > 0n ? `<span style="--c:#3de0ff">In pool $${usd(inPool)}</span>` : ""}<span style="--c:var(--rule-2)">Fee $${usd(fee)}</span></div>`;
  }
  if (s.state === 0) top = `<div class="note ok" style="margin:0 0 8px">Fully protected until the raise closes.</div>`;
  const back = s.state === 2 && s.totalRaised > 0n ? (s.refundPool * u.contributed) / s.totalRaised : 0n;
  const btns = [];
  if (s.succeeded && !u.claimed) btns.push(`<button class="btn btn-dark btn-block" data-act="claimTokens" data-testid="claim">Claim my tokens</button>`);
  if (s.state === 2 && !u.settled) btns.push(`<button class="btn btn-dark btn-block" data-act="refund" data-testid="refund">Get my money back</button>`);
  btns.push(`<button class="btn btn-line btn-block" data-act="card" data-testid="backer-card">Get my backer card</button>`);
  return `<div class="panel"><h3>Your position</h3>${top}
    <div class="lines" style="margin-top:12px">
      <div><span>You put in</span><b>$${usd(u.contributed)}</b></div>
      <div><span>Your tokens</span><b>${tok(u.balance)} ${esc(q.symbol)}</b></div>
      ${s.succeeded && !u.claimed ? `<div><span>Tokens to claim</span><b>${tok((u.contributed * q.saleTokens) / q.hardcap)} ${esc(q.symbol)}</b></div>` : ""}
      ${s.state === 2 ? `<div><span>Refund</span><b>${u.settled ? "Withdrawn" : "$" + usd(back)}</b></div>` : ""}
    </div>${btns.length ? `<div style="display:grid;gap:8px;margin-top:16px">${btns.join("")}</div>` : ""}</div>`;
}
function pVote(p) {
  const { s, u, q } = p;
  if (s.state !== 1 || s.milestonesDone >= q.milestones) return "";
  const open = s.voteEnd > 0n && S.now < Number(s.voteEnd), total = s.votesYes + s.votesNo || 1n;
  let b;
  if (s.voteEnd > 0n) {
    b = `<p class="muted" style="margin:0">Release ${s.milestonesDone + 1} of ${q.milestones}. ${open ? `Voting closes ${day(s.voteEnd)}.` : "Voting has ended."}</p>
      <div class="split"><i style="width:${pct(s.votesYes, total)}%;background:var(--ok)"></i><i style="width:${pct(s.votesNo, total)}%;background:var(--bad)"></i></div>
      <div class="keys"><span style="--c:var(--ok)">Approve $${usd(s.votesYes)}</span><span style="--c:var(--bad)">Reject $${usd(s.votesNo)}</span></div>`;
    if (open && u.contributed > 0n && !u.voted) b += `<div class="votes"><button class="btn btn-dark" data-act="voteYes" data-testid="vote-yes">Approve</button><button class="btn btn-danger" data-act="voteNo" data-testid="vote-no">Reject</button></div>`;
    else if (open && u.voted) b += `<div class="note">You've voted on this release.</div>`;
    if (!open) b += `<button class="btn btn-dark btn-block" style="margin-top:16px" data-act="closeVote" data-testid="close-vote">Apply the result</button>`;
  } else if (S.now <= Number(s.deadline)) {
    b = `<p class="muted" style="margin:0">The team must request release ${s.milestonesDone + 1} by ${day(s.deadline)}.</p>`;
    if (isMe(q.creator)) b += `<button class="btn btn-line btn-block" style="margin-top:16px" data-act="requestRelease" data-testid="request">Request release ${s.milestonesDone + 1}</button>`;
  } else {
    b = `<p class="muted" style="margin:0">The team missed the deadline. Anyone can cancel the project and return what's left.</p>
      <button class="btn btn-danger btn-block" style="margin-top:16px" data-act="abandon" data-testid="abandon">Cancel and refund backers</button>`;
  }
  return `<div class="panel"><h3>Release vote</h3>${b}</div>`;
}

// ================================================================= creador
function vLaunch() {
  if (!S.me) return `<div class="page-h"><h1>Launch a project</h1><p>Connect your wallet. It's the wallet that receives the funds and signs your project.</p></div>
    <button class="btn btn-dark" data-act="connect">Connect wallet</button>`;
  return `<div class="page-h"><h1>Launch a project</h1><p>Fill in the details and sign them with your wallet. Holdfast reviews every project before it goes live. Signing is free.</p></div>
  <div class="layout"><form id="form" novalidate>
    <fieldset><legend>The project</legend>
      <div class="f"><label for="f-name">Name</label><input id="f-name" name="name" maxlength="40" required placeholder="Rooftop Gardens"></div>
      <div class="two">
        <div class="f"><label for="f-symbol">Ticker</label><input id="f-symbol" name="symbol" maxlength="8" required placeholder="ROOF" style="text-transform:uppercase"></div>
        <div class="f"><label for="f-cat">Category</label><select id="f-cat" name="category">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select></div>
      </div>
      <div class="f"><label for="f-tag">One-line summary</label><input id="f-tag" name="tagline" maxlength="120" required placeholder="What you do and who it's for"></div>
      <div class="f"><label for="f-about">Description</label><textarea id="f-about" name="about" maxlength="2000" required placeholder="What the money is for, the timeline, and how backers will see progress."></textarea><small>40 to 2,000 characters.</small></div>
      <div class="f"><label for="f-logo">Token logo</label>
        <div class="logo-pick"><span class="logo-prev" id="logo-prev" aria-hidden="true"></span><input id="f-logo" type="file" accept="image/png,image/jpeg,image/webp"></div>
        <small>Optional. PNG, JPG or WebP. It's shown on your project card and is part of what you sign.</small></div>
      <div class="f"><label>Colour</label><div class="chips swatch">${COLORS.map((c, i) => `<label><input type="radio" name="color" value="${c}" ${i ? "" : "checked"}><span style="--c:${c}" aria-label="Colour ${i + 1}"></span></label>`).join("")}</div></div>
    </fieldset>
    <fieldset><legend>Your team</legend>
      <p class="fine" style="margin:0 0 16px">Backers trust teams they can see. Add up to 4 people with a public link (X, GitHub, LinkedIn or a website).</p>
      ${[0, 1, 2, 3].map((i) => `<div class="tm-row${i > 0 ? " d-none" : ""}" data-tm="${i}">
        <label class="tm-photo" title="Photo"><input type="file" accept="image/png,image/jpeg,image/webp" data-tmphoto="${i}"><span id="tmp-${i}" aria-hidden="true"></span></label>
        <input name="tm-name-${i}" maxlength="40" placeholder="Name" aria-label="Team member name">
        <input name="tm-role-${i}" maxlength="40" placeholder="Role" aria-label="Team member role">
        <input name="tm-link-${i}" maxlength="120" placeholder="https://" aria-label="Team member link">
      </div>`).join("")}
      <button type="button" class="btn btn-soft btn-sm" id="tm-add">Add team member</button>
    </fieldset>
    <fieldset><legend>The money</legend>
      <div class="two">
        <div class="f"><label for="f-soft">Minimum goal (USDC)</label><input id="f-soft" name="soft" type="number" inputmode="decimal" min="1" value="1000"><small>Below this, everyone is refunded.</small></div>
        <div class="f"><label for="f-hard">Maximum goal (USDC)</label><input id="f-hard" name="hard" type="number" inputmode="decimal" min="1" value="5000"></div>
      </div>
      <div class="f"><label>Raise length</label><div class="chips">${[14, 30, 45, 60].map((d) => `<label><input type="radio" name="days" value="${d}" ${d === 30 ? "checked" : ""}><span>${d} days</span></label>`).join("")}</div></div>
      <div class="two">
        <div class="f"><label for="f-st">Tokens for backers</label><input id="f-st" name="saleTokens" type="number" inputmode="numeric" min="1" value="1000000"></div>
        <div class="f"><label for="f-ct">Tokens for your team</label><input id="f-ct" name="creatorTokens" type="number" inputmode="numeric" min="0" value="300000"><small>Unlocked with each release.</small></div>
      </div>
    </fieldset>
    <fieldset><legend>Releases</legend>
      <div class="f"><label>Upfront when the raise closes</label><div class="chips">${[0, 5, 10, 20].map((v) => `<label><input type="radio" name="initial" value="${v}" ${v === 10 ? "checked" : ""}><span>${v}%</span></label>`).join("")}</div></div>
      <div class="f"><label>Liquidity for the Uniswap market</label><div class="chips">${[5, 10, 15, 20, 25].map((v) => `<label><input type="radio" name="liq" value="${v}" ${v === 10 ? "checked" : ""}><span>${v}%</span></label>`).join("")}</div><small>When the raise succeeds, this share of the funds and matching tokens open a Uniswap pool at the round price, locked for 12 months.</small></div>
      <div class="f"><label>Number of voted releases</label><div class="chips">${[2, 3, 4, 6].map((v) => `<label><input type="radio" name="ms" value="${v}" ${v === 3 ? "checked" : ""}><span>${v}</span></label>`).join("")}</div></div>
      <div class="f"><label>Window to request each release</label><div class="chips">${[30, 60, 90].map((v) => `<label><input type="radio" name="period" value="${v}" ${v === 60 ? "checked" : ""}><span>${v} days</span></label>`).join("")}</div><small>Miss it and the remaining funds go back to backers.</small></div>
    </fieldset>
    <p class="form-error" id="ferr" role="alert"></p>
    <button class="btn btn-dark" type="submit" data-testid="submit-project">Sign and submit for review</button>
  </form>
  <aside class="aside"><div class="panel lift" id="preview"></div></aside></div>`;
}
function readForm() {
  const f = new FormData($("#form")), g = (k) => String(f.get(k) ?? "").trim();
  const name = g("name"), id = (name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "project") + "-" + Math.random().toString(16).slice(2, 6);
  const usdc = (v) => { try { return parseUnits(v || "0", 6).toString(); } catch { return "0"; } };
  const toks = (v) => { try { return parseUnits(v || "0", 18).toString(); } catch { return "0"; } };
  const tm = [0, 1, 2, 3].map((i) => ({ name: g(`tm-name-${i}`), role: g(`tm-role-${i}`), link: g(`tm-link-${i}`), photo: S.tmPhotos?.[i] || "" }))
    .filter((m) => m.name).map((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v)));
  return { id, meta: { category: g("category"), color: g("color"), tagline: g("tagline"), about: g("about"), logo: S.logo || "", team: tm.length ? JSON.stringify(tm) : "" },
    params: { creator: S.me, name, symbol: g("symbol").toUpperCase(), softcap: usdc(g("soft")), hardcap: usdc(g("hard")),
      saleTokens: toks(g("saleTokens")), creatorTokens: toks(g("creatorTokens")), saleEnd: String(Math.floor(Date.now() / 1000) + Number(g("days")) * 86400),
      initialBps: String(Number(g("initial")) * 100), milestones: g("ms"), milestonePeriod: String(Number(g("period")) * 86400), liquidityBps: String(Number(g("liq") || 10) * 100) } };
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
function preview() {
  const p = readForm(), q = p.params, ms = Number(q.milestones), init = Number(q.initialBps) / 100, step = (100 - init) / ms;
  const hard = BigInt(q.hardcap || 0), soft = BigInt(q.softcap || 0);
  $("#preview").innerHTML = `<h3>How backers will see it</h3>
    <div class="p-head" style="margin:0 0 16px">${p.meta.logo ? `<img class="mark logo" src="${esc(p.meta.logo)}" alt="">` : `<div class="mark" style="background:${esc(p.meta.color)}">${esc(initials(q.name || "Your project"))}</div>`}<div><b>${esc(q.name || "Your project")}</b><p style="font-size:14px">${esc(p.meta.tagline || "Your summary shows here")}</p></div></div>
    <div class="lines">
      <div><span>Goal</span><b>$${usd(soft)} to $${usd(hard)}</b></div>
      <div><span>Price</span><b>${hard > 0n ? `1 USDC = ${tok((BigInt(q.saleTokens) * 1_000_000n) / hard)} ${esc(q.symbol || "TOKEN")}` : "-"}</b></div>
      <div><span>You get at close</span><b>${init}%</b></div>
      <div><span>Then</span><b>${ms} releases of ${step.toFixed(1)}%</b></div>
      <div><span>Holdfast fee</span><b>1% + 1.5% of tokens</b></div>
    </div>
    <div class="split" aria-hidden="true">${[init, ...Array(ms).fill(step)].map((w, i) => `<i style="width:${w}%;background:${i ? (i % 2 ? "var(--ink)" : "var(--ink-3)") : "var(--ember)"}"></i>`).join("")}</div>
    <p class="muted" style="font-size:13.5px;margin:8px 0 0">If you raise $${usd(hard)} and backers approve every release, you receive $${usd((hard * 99n) / 100n)}.</p>`;
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
  const key = p ? "home" : h.startsWith("#/launch") ? "launch" : h.startsWith("#/portfolio") ? "portfolio" : h.startsWith("#/owner") ? "owner" : "home";
  document.querySelectorAll("[data-nav]").forEach((a) => (a.dataset.nav === key ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("#nav-owner").classList.toggle("d-none", !isOwner()); $("#tab-owner").classList.toggle("d-none", !isOwner());
  if (key === "launch" && $("#form")) return; // no borrar lo que el creador está escribiendo
  const keep = $("#amt")?.value;
  $("#app").innerHTML = p ? vProject(p) : key === "launch" ? vLaunch() : key === "portfolio" ? vPortfolio() : key === "owner" ? vOwner() : vHome();
  if (p) { bindAmount(p); bindTab(p); bindTrade(p); celebrate(p); if (p.mk && !p.trades) loadTrades(p).then(() => { if (S.tab === "trade") { $(".ptab-body").innerHTML = tabBody(p); } }); }
  if (!p && key === "home") bindCards();
  if (p && keep && $("#amt")) { $("#amt").value = keep; $("#amt").dispatchEvent(new Event("input")); }
  if ($("#form")) { $("#form").addEventListener("input", preview); $("#form").addEventListener("submit", submitProject); $("#f-logo").addEventListener("change", pickLogo);
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
  if (ok) { $("#app").innerHTML = ""; location.hash = "#/portfolio"; await loadCatalog(); await refresh(); }
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
  if (ok) { await loadCatalog(); await refresh(); }
}

document.addEventListener("click", async (e) => {
  const sd = e.target.closest("[data-side]");
  if (sd) { S.side = sd.dataset.side; const p = S.list.find((x) => location.hash === `#/p/${x.id}`); if (p) { const box = $(".cyber"); box.outerHTML = tradePanel(p); bindTrade(p); } return; }
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
    const p = S.list.find((x) => location.hash === `#/p/${x.id}`);
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
  window.addEventListener("hashchange", () => { S.tab = "overview"; if (!location.hash.startsWith("#/launch")) $("#app").innerHTML = ""; route(); scrollTo(0, 0); });
  await loadCatalog();
  route();
  await refresh();
  const eth = provider();
  if (eth) { const accs = await eth.request({ method: "eth_accounts" }).catch(() => []); if (accs.length) await connect(); }
}
main().catch((e) => { console.error(e); toast(e.message, true); });
