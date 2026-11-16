import {
  createPublicClient, createWalletClient, custom, http, encodeDeployData, getContractAddress, concat, parseUnits,
  formatUnits, erc20Abi, defineChain, keccak256, toBytes, verifyMessage,
} from "https://cdn.jsdelivr.net/npm/viem@2.21.54/+esm";
import { CONFIG } from "./config.js";
import { ALCANCIA_ABI as ABI, ALCANCIA_BYTECODE } from "./alcancia.js";
import { mountHero } from "./hero.js";
import { initI18n } from "./i18n.js";
import { canonical, msgSubmit, msgDecision, msgUpdate, msgPanel, validate, CATEGORIES, COLORS } from "./shared.js";

const RPC = new URLSearchParams(location.search).get("rpc") || CONFIG.rpc; // ?rpc= solo para pruebas locales
const SALT = "0x" + "00".repeat(32);
const OWNER = CONFIG.platform.toLowerCase();
const chain = defineChain({
  id: CONFIG.chainId, name: CONFIG.chainName, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } }, contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});
const pub = createPublicClient({ chain, transport: http(RPC) });

const S = { me: null, wallet: null, usdc: 0n, all: [], list: [], reviews: null, now: Math.floor(Date.now() / 1000) };
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
  await Promise.all(S.list.map(loadChain));
  if (S.me) S.usdc = await pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "balanceOf", args: [S.me] });
  route();
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
const mark = (p, lg = "") => `<div class="mark ${lg}" style="background:${esc(p.meta.color)}" aria-hidden="true">${esc(initials(p.q.name))}</div>`;
const meter = (p) => `<div class="meter" role="img" aria-label="${pct(p.s.totalRaised, p.q.hardcap).toFixed(0)}% raised"><b style="width:${pct(p.s.totalRaised, p.q.hardcap)}%"></b><s style="left:${pct(p.q.softcap, p.q.hardcap)}%"></s></div>`;
const maxLoss = (p) => (p.s.state === 1 ? 100 - pct(p.s.poolAfterFees - p.s.usdcReleased, p.s.totalRaised) : p.s.state === 2 ? null : 0);

// ================================================================= portada
function vHome() {
  const live = S.list.filter((p) => p.exists);
  const raised = live.reduce((a, p) => a + p.s.totalRaised, 0n);
  const funded = live.filter((p) => p.s.succeeded).length;
  const open = S.list.filter((p) => phase(p).c === "open").length;
  return `
  <section class="vitrina" aria-label="Holdfast">
    <div class="vitrina-stage">
      <div class="vitrina-light" aria-hidden="true"></div>
      <canvas class="vitrina-art" role="img" aria-label="The two halves of the Holdfast mark coming together"></canvas>
      <p class="vitrina-label left" data-beat="a">Your money.</p>
      <p class="vitrina-label right" data-beat="a">Their work.</p>
      <div class="vitrina-copy" data-beat="b">
        <h1>Hold fast to what you back.</h1>
        <p class="vitrina-promise">Goal missed? You get 100% back.</p>
      </div>
      <p class="vitrina-cue" data-beat="cue"><span aria-hidden="true"></span>Scroll to bring them together</p>
    </div>
  </section>
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
  <div class="list">${S.list.length ? S.list.map(row).join("") : `<div class="empty">No projects are live yet. <a href="#/launch">Launch the first one</a>.</div>`}</div>`;
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
  <div class="p-head">${mark(p, "lg")}<div><h1>${esc(q.name)}</h1><p>${esc(p.meta.category)}, token ${esc(q.symbol)}. <span class="status ${ph.c}">${ph.t}</span></p></div></div>
  <div class="layout">
    <div>
      <section class="block"><h2>About</h2><p>${esc(p.meta.about)}</p></section>
      <section class="block"><h2>How your money is protected</h2><div class="rules">
        <div>${IC.back}<div><b>Goal missed, full refund</b><p>If less than $${usd(q.softcap)} is raised by the close, every backer withdraws 100% of what they put in. No fee.</p></div></div>
        <div>${IC.steps}<div><b>The team is paid in stages</b><p>${q.initialBps / 100}% when the raise closes, then ${q.milestones} releases of ${step}%. Backers vote on each one.</p></div></div>
        <div>${IC.lock}<div><b>No one can touch it</b><p>The contract has no admin. If the team vanishes or loses a vote, the rest goes back to backers.</p></div></div>
      </div></section>
      <section class="block"><h2>Releases</h2>${stages(p)}</section>
      <section class="block"><h2>Team updates</h2>${p.updates.length ? p.updates.map((u) => `<div class="update"><time>${new Date(u.ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time><p>${esc(u.text)}</p></div>`).join("") : `<p>No updates yet.</p>`}</section>
      <section class="block"><h2>Contract</h2><div class="kv">
        <div><span class="muted">Address</span><a class="addr" href="${CONFIG.explorer}/address/${p.address}" target="_blank" rel="noopener">${short(p.address)}</a></div>
        <div><span class="muted">Status</span><span>${p.exists ? "Live on-chain" : "Created by the first backing"}</span></div>
        <div><span class="muted">Team wallet</span><span class="addr">${short(q.creator)}</span></div>
        <div><span class="muted">Holdfast fee</span><span>1% of funds + 1.5% of tokens, only if funded</span></div>
        <div><span class="muted">Network</span><span>${esc(CONFIG.chainName)}</span></div>
      </div></section>
    </div>
    <aside class="aside">${pInvest(p)}${S.me && p.u.contributed > 0n ? pPosition(p) : ""}${pVote(p)}</aside>
  </div>`;
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
  return `<ol class="tl">${items.map((x, i) => `<li class="${x.done ? "done" : x.now ? "now" : ""}"><span class="n">${x.done ? IC.ok : i}</span>
    <div><div class="t">${x.t}</div><div class="s">${x.sub}</div></div><span class="pct">${x.pct}%</span></li>`).join("")}</ol>`;
}
function pInvest(p) {
  const { s, q } = p, ended = S.now >= Number(q.saleEnd) || s.totalRaised >= q.hardcap;
  let act;
  if (s.state === 0 && !ended) {
    act = S.me ? `
      <label for="amt" class="muted" style="font-size:14px">Amount to back</label>
      <div class="field-amt"><input id="amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" data-testid="amount"><span class="u">USDC</span><button type="button" data-max>Max</button></div>
      <div class="under"><span id="receive">You get 0 ${esc(q.symbol)}</span><span>Balance ${usd(S.usdc)} USDC</span></div>
      <button class="btn btn-dark btn-block" data-act="buy" data-testid="buy">Back this project</button>
      ${p.exists ? "" : `<div class="note">You're early: your backing also creates this project's contract. It costs a few extra cents of gas, once.</div>`}`
      : `<button class="btn btn-dark btn-block" data-act="connect">Connect wallet to back</button>`;
  } else if (s.state === 0) {
    act = p.exists ? `<button class="btn btn-dark btn-block" data-act="finalize" data-testid="finalize">Close the raise</button><div class="note">The raise has ended. Anyone can close it to release tokens or refunds.</div>`
      : `<div class="note">The raise ended with no backers.</div>`;
  } else if (s.state === 2) {
    act = `<div class="note warn">${s.succeeded ? "Backers rejected a release or the team missed a deadline." : "The minimum goal wasn't reached."} What's left is being returned to backers.</div>`;
  } else act = `<div class="note ok">Funded. The team is paid in stages that backers approve.</div>`;
  return `<div class="panel lift">
    <div class="big">$${usd(s.totalRaised)} <small>of $${usd(q.hardcap)}</small></div>
    <div style="margin-top:16px">${meter(p)}</div>
    <div class="meter-t"><span>${pct(s.totalRaised, q.hardcap).toFixed(0)}% raised</span><span>${left(p)}</span></div>
    <dl class="facts">
      <div><dt>Price</dt><dd>1 USDC = ${tok((q.saleTokens * 1_000_000n) / q.hardcap)} ${esc(q.symbol)}</dd></div>
      <div><dt>Minimum goal</dt><dd>$${usd(q.softcap)}</dd></div>
      <div><dt>Maximum goal</dt><dd>$${usd(q.hardcap)}</dd></div>
      <div><dt>Closes</dt><dd>${day(q.saleEnd)}</dd></div>
    </dl>${act}</div>`;
}
function pPosition(p) {
  const { s, u, q } = p;
  let top = "";
  if (s.state === 1) {
    const kept = s.poolAfterFees - s.usdcReleased, fee = s.totalRaised - s.poolAfterFees;
    top = `<div class="muted" style="font-size:14px">Most you could lose today</div><div class="big" data-testid="risk">${maxLoss(p).toFixed(1)}%</div>
      <div class="split"><i style="width:${pct(kept, s.totalRaised)}%;background:var(--ink)"></i><i style="width:${pct(s.usdcReleased, s.totalRaised)}%;background:var(--ember)"></i><i style="width:${pct(fee, s.totalRaised)}%;background:var(--rule-2)"></i></div>
      <div class="keys"><span style="--c:var(--ink)">Locked $${usd(kept)}</span><span style="--c:var(--ember)">Released $${usd(s.usdcReleased)}</span><span style="--c:var(--rule-2)">Fee $${usd(fee)}</span></div>`;
  }
  if (s.state === 0) top = `<div class="note ok" style="margin:0 0 8px">Fully protected until the raise closes.</div>`;
  const back = s.state === 2 && s.totalRaised > 0n ? (s.refundPool * u.contributed) / s.totalRaised : 0n;
  const btns = [];
  if (s.succeeded && !u.claimed) btns.push(`<button class="btn btn-dark btn-block" data-act="claimTokens" data-testid="claim">Claim my tokens</button>`);
  if (s.state === 2 && !u.settled) btns.push(`<button class="btn btn-dark btn-block" data-act="refund" data-testid="refund">Get my money back</button>`);
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
      <div class="f"><label>Colour</label><div class="chips swatch">${COLORS.map((c, i) => `<label><input type="radio" name="color" value="${c}" ${i ? "" : "checked"}><span style="--c:${c}" aria-label="Colour ${i + 1}"></span></label>`).join("")}</div></div>
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
  return { id, meta: { category: g("category"), color: g("color"), tagline: g("tagline"), about: g("about") },
    params: { creator: S.me, name, symbol: g("symbol").toUpperCase(), softcap: usdc(g("soft")), hardcap: usdc(g("hard")),
      saleTokens: toks(g("saleTokens")), creatorTokens: toks(g("creatorTokens")), saleEnd: String(Math.floor(Date.now() / 1000) + Number(g("days")) * 86400),
      initialBps: String(Number(g("initial")) * 100), milestones: g("ms"), milestonePeriod: String(Number(g("period")) * 86400) } };
}
function preview() {
  const p = readForm(), q = p.params, ms = Number(q.milestones), init = Number(q.initialBps) / 100, step = (100 - init) / ms;
  const hard = BigInt(q.hardcap || 0), soft = BigInt(q.softcap || 0);
  $("#preview").innerHTML = `<h3>How backers will see it</h3>
    <div class="p-head" style="margin:0 0 16px"><div class="mark" style="background:${esc(p.meta.color)}">${esc(initials(q.name || "Your project"))}</div><div><b>${esc(q.name || "Your project")}</b><p style="font-size:14px">${esc(p.meta.tagline || "Your summary shows here")}</p></div></div>
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
  const fees = funded.reduce((a, p) => a + (p.s.totalRaised - p.s.poolAfterFees), 0n);
  const raised = live.reduce((a, p) => a + p.s.totalRaised, 0n);
  const pending = S.all.filter((p) => p.status === "review");
  return `<div class="page-h"><h1>Owner</h1><p>Your fees, platform activity and the projects waiting for your approval.</p></div>
  <section class="stats"><div><b>$${usd(fees)}</b><span>Fees earned in USDC</span></div><div><b>$${usd(raised)}</b><span>Raised on Holdfast</span></div>
    <div><b>${funded.length}</b><span>Projects funded</span></div><div><b>${pending.length}</b><span>Awaiting review</span></div></section>
  <section class="block"><h2>Fees by project</h2>
    ${funded.length ? `<table class="tbl"><thead><tr><th>Project</th><th>USDC</th><th>Tokens</th></tr></thead><tbody>
      ${funded.map((p) => `<tr><td>${esc(p.q.name)}</td><td>$${usd(p.s.totalRaised - p.s.poolAfterFees)}</td><td>${tok(p.s.platformTokens)} ${esc(p.q.symbol)}</td></tr>`).join("")}</tbody></table>`
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
  if (!p && key === "home") mountHero($("#app"));
  if (p) bindAmount(p);
  if (p && keep && $("#amt")) { $("#amt").value = keep; $("#amt").dispatchEvent(new Event("input")); }
  if ($("#form")) { $("#form").addEventListener("input", preview); $("#form").addEventListener("submit", submitProject); preview(); }
}
function bindAmount(p) {
  const el = $("#amt"); if (!el) return;
  const upd = () => { let v = 0n; try { v = parseUnits(el.value || "0", 6); } catch {} $("#receive").textContent = `You get ${tok((v * p.q.saleTokens) / p.q.hardcap)} ${p.q.symbol}`; };
  el.oninput = upd;
  $("[data-max]").onclick = () => { const room = p.q.hardcap - p.s.totalRaised; el.value = formatUnits(S.usdc < room ? S.usdc : room, 6); upd(); };
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
  await flow("Back this project", labels, fns, "Backed");
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
    await refresh();
  } catch (x) { console.error(x); toast(x.shortMessage || x.message, true); }
  finally { document.querySelectorAll("button").forEach((x) => (x.disabled = false)); }
});

async function main() {
  initI18n();
  $("#net span").textContent = CONFIG.chainName;
  $("#connect").onclick = () => connect().catch((x) => toast(x.shortMessage || x.message, true));
  window.addEventListener("hashchange", () => { if (!location.hash.startsWith("#/launch")) $("#app").innerHTML = ""; route(); scrollTo(0, 0); });
  await loadCatalog();
  route();
  await refresh();
  const eth = provider();
  if (eth) { const accs = await eth.request({ method: "eth_accounts" }).catch(() => []); if (accs.length) await connect(); }
}
main().catch((e) => { console.error(e); toast(e.message, true); });
