// MODO DEMO: una "blockchain" simulada que vive en el navegador (sin red, sin servidor, sin dinero real).
// Se activa con `demo: true` en config.js. La app corre igual; solo cambian pub (lectura), la wallet y /api.
import { privateKeyToAccount } from "https://cdn.jsdelivr.net/npm/viem@2.21.54/accounts/+esm";
import { decodeFunctionData, keccak256, toBytes } from "https://cdn.jsdelivr.net/npm/viem@2.21.54/+esm";

const K = {
  investor: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // llave pública de pruebas (anvil #2)
  creator: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // anvil #1
};
const BOTS = ["0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", "0x976EA74026E726554dB657fA54763abd0C3a0aa9", "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"];
const Z = "0x0000000000000000000000000000000000000000";
const L = (a) => String(a).toLowerCase();
const rnd = (a, b) => a + Math.random() * (b - a);
const U = 1_000_000n, E = 10n ** 18n;

export function createDemo({ CONFIG, ABI, ERC20, ROUTER_ABI, QUOTER_ABI }) {
  const accts = { investor: privateKeyToAccount(K.investor), creator: privateKeyToAccount(K.creator) };
  const st = { head: 5_000_000n, t0: Math.floor(Date.now() / 1000), offset: 0, ts: new Map(), proj: new Map(), usdc: new Map(), log: [], me: null, role: "investor", seeded: false, api: { qa: {}, updates: {}, profiles: {}, subs: [] } };
  const now = () => st.t0 + st.offset + Math.floor((performance.now() - 0) / 1000) * 0;
  const nowTs = () => Math.floor(Date.now() / 1000) + st.offset;
  const mine = () => st.me;
  const bal = (m, a) => m.get(L(a)) || 0n;
  const add = (m, a, v) => m.set(L(a), bal(m, a) + v);
  const mineBlock = () => { st.head += 1n; st.ts.set(st.head, nowTs() - (seeding ? Number((st.head - 5_000_000n)) * 0 : 0)); return st.head; };
  st.ts.set(st.head, nowTs());
  const tsOf = (b) => st.ts.get(b) ?? nowTs() - Number(st.head - b) * 12;
  let seeding = false;

  // ---------- proyectos ----------
  function init(list) {
    if (st.seeded) { for (const p of list) if (!st.proj.has(L(p.address))) mk(p); return; }
    st.seeded = true;
    for (const p of list) mk(p);
    add(st.usdc, accts.investor.address, 8000n * U); add(st.usdc, accts.creator.address, 250n * U);
    for (const b of BOTS) add(st.usdc, b, 100000n * U);
    seedHistory(list);
  }
  function mk(p) {
    const q = p.q, a = L(p.address);
    st.proj.set(a, { q, addr: p.address, exists: false, raised: 0n, contrib: new Map(), claimed: new Set(), settled: new Set(), voted: new Map(), tok: new Map(), state: 0, succeeded: false, poolAfterFees: 0n, released: 0n, ms: 0, voteEnd: 0, yes: 0n, no: 0n, deadline: 0, round: 0, retrying: false, refundPool: 0n,
      pool: null, lpUnlock: 0, liqUsdc: 0n, supply: 0n, platTok: 0n, bought: [], fin: [], swaps: [], poolAddr: null });
  }
  const P = (addr) => st.proj.get(L(addr));
  function buy(pr, who, amt) {
    if (!pr.exists) pr.exists = true;
    amt = BigInt(amt); if (amt <= 0n) throw new Error("Amount is zero.");
    if (pr.raised + amt > pr.q.hardcap) amt = pr.q.hardcap - pr.raised;
    if (bal(st.usdc, who) < amt) throw new Error("Not enough USDC.");
    add(st.usdc, who, -amt); pr.raised += amt; add(pr.contrib, who, amt);
    const b = mineBlock(); pr.bought.push({ args: { buyer: who, usdcAmount: amt }, blockNumber: b });
  }
  function finalize(pr) {
    if (pr.state !== 0) throw new Error("Already closed.");
    const ended = nowTs() >= Number(pr.q.saleEnd) || pr.raised >= pr.q.hardcap;
    if (!ended) throw new Error("The raise hasn't ended.");
    const b = mineBlock();
    if (pr.raised < pr.q.softcap) { pr.state = 2; pr.succeeded = false; pr.refundPool = pr.raised; pr.fin.push({ args: { success: false }, blockNumber: b }); return; }
    pr.succeeded = true; pr.state = 1;
    const fee = pr.raised / 100n, after = pr.raised - fee; const liq = (after * BigInt(pr.q.liquidityBps)) / 10000n;
    pr.liqUsdc = liq; pr.poolAfterFees = after - liq; add(st.usdc, pr.q.platform, fee);
    pr.round = Number(pr.q.hardcap) / 1e6 / (Number(pr.q.saleTokens) / 1e18);
    const liqTok = BigInt(Math.floor((Number(liq) / 1e6 / pr.round) * 1e18));
    pr.rU = liq * 25n; pr.rT = liqTok * 25n; pr.poolAddr = "0x" + keccak256(toBytes("pool" + pr.addr)).slice(2, 42);
    pr.pool = pr.poolAddr; pr.lpUnlock = nowTs() + 365 * 86400;
    const sold = pr.q.saleTokens; pr.platTok = ((sold + pr.q.creatorTokens + liqTok) * 150n) / 10000n;
    pr.supply = sold + pr.q.creatorTokens + liqTok + pr.platTok; add(pr.tok, pr.q.platform, pr.platTok);
    const init = (pr.poolAfterFees * BigInt(pr.q.initialBps)) / 10000n; pr.released = init; add(st.usdc, pr.q.creator, init);
    pr.deadline = nowTs() + Number(pr.q.milestonePeriod); pr.fin.push({ args: { success: true }, blockNumber: b });
  }
  const sqrtOf = (pr) => { // sqrtPriceX96 tal que usdcPerToken() = rU/rT
    const usdc0 = L(CONFIG.usdc) < L(pr.addr), tokPerUsdc = (Number(pr.rT) / 1e18) / (Number(pr.rU) / 1e6);
    const raw = usdc0 ? tokPerUsdc * 1e12 : 1e-12 / tokPerUsdc;
    return BigInt(Math.floor(Math.sqrt(raw) * 2 ** 96));
  };
  function quote(pr, tokenIn, amtIn) {
    const buyTok = L(tokenIn) === L(CONFIG.usdc), fee = (amtIn * 997n) / 1000n;
    if (buyTok) { const out = (pr.rT * fee) / (pr.rU + fee); if (out >= pr.rT) throw new Error("Not enough liquidity"); return out; }
    const out = (pr.rU * fee) / (pr.rT + fee); if (out >= pr.rU) throw new Error("Not enough liquidity"); return out;
  }
  function swap(pr, who, tokenIn, amtIn, minOut) {
    const buyTok = L(tokenIn) === L(CONFIG.usdc), out = quote(pr, tokenIn, amtIn);
    if (out < minOut) throw new Error("Too little received (slippage)");
    if (buyTok) { if (bal(st.usdc, who) < amtIn) throw new Error("Not enough USDC."); add(st.usdc, who, -amtIn); add(pr.tok, who, out); pr.rU += amtIn; pr.rT -= out; }
    else { if (bal(pr.tok, who) < amtIn) throw new Error("Not enough tokens."); add(pr.tok, who, -amtIn); add(st.usdc, who, out); pr.rT += amtIn; pr.rU -= out; }
    const usdc0 = L(CONFIG.usdc) < L(pr.addr), a0 = usdc0 ? (buyTok ? amtIn : -out) : (buyTok ? -out : amtIn), a1 = usdc0 ? (buyTok ? -out : amtIn) : (buyTok ? amtIn : -out);
    if (seeding) st.head += 50n; const b = mineBlock(); pr.swaps.push({ args: { sender: who, recipient: who, amount0: a0, amount1: a1, sqrtPriceX96: sqrtOf(pr) }, blockNumber: b });
    return out;
  }
  function seedHistory(list) {
    seeding = true; const bots = BOTS.map((x) => x);
    const fund = (pr, tot) => { const per = tot / 4n; for (let i = 0; i < 4; i++) buy(pr, bots[i], per); };
    const by = (id) => list.find((p) => p.id.startsWith(id));
    for (const [id, share] of [["atlas", 1n], ["lumen", 1n]]) { const p = by(id); if (!p) continue; const pr = P(p.address); fund(pr, pr.q.hardcap); finalize(pr);
      for (const b of bots.slice(0, 4)) { const m = pr.contrib.get(L(b)) || 0n; const tk = (m * pr.q.saleTokens) / pr.q.hardcap; add(pr.tok, b, tk); pr.claimed.add(L(b)); }
      const sx = Number(new URLSearchParams(location.search).get("stress") || 0) ? 9 : 1, n = (id === "atlas" ? 46 : 20) * sx, gain = id === "atlas" ? 1.2 : 0.35;
      for (let i = 0; i < n; i++) { const target = pr.round * (1 + gain * (i / n) + rnd(-0.12, 0.12)), price = Number(pr.rU) / 1e6 / (Number(pr.rT) / 1e18), who = bots[i % 4];
        try { if (price < target) swap(pr, who, CONFIG.usdc, BigInt(Math.floor(rnd(3, 16) * 1e6)), 0n); else { const have = bal(pr.tok, who); if (have > 0n) swap(pr, who, pr.addr, (have * BigInt(Math.floor(rnd(2, 9)))) / 100n, 0n); } } catch {} }
    }
    const k = by("kite"); if (k) { const pr = P(k.address); buy(pr, bots[0], 1_000_000n); buy(pr, bots[1], 800_000n); }
    seeding = false; const T = nowTs(); for (const bk of [...st.ts.keys()]) st.ts.set(bk, T - Number(st.head - bk) * 12);
  }
  // robots que operan en vivo
  function tick() {
    const live = [...st.proj.values()].filter((p) => p.succeeded && p.rU > 0n); if (!live.length) return;
    const pr = live[Math.random() < 0.7 ? 0 : live.length - 1], who = BOTS[Math.floor(Math.random() * 4)], price = Number(pr.rU) / 1e6 / (Number(pr.rT) / 1e18), sell = Math.random() < (price > pr.round * (pr.q.name.startsWith('Atlas') ? 2.6 : 1.5) ? 0.7 : 0.4);
    st.offset += 40;
    try { if (!sell) swap(pr, who, CONFIG.usdc, BigInt(Math.floor(rnd(1, 6) * 1e6)), 0n); else { const have = bal(pr.tok, who); if (have > 0n) swap(pr, who, pr.addr, (have * BigInt(Math.floor(rnd(1, 4)))) / 100n, 0n); else swap(pr, who, CONFIG.usdc, 3_000_000n, 0n); } } catch {}
  }
  setInterval(tick, 4500);

  // ---------- lecturas ----------
  const getRead = (addr, fn, args = []) => {
    const a = L(addr);
    if (a === L(CONFIG.usdc)) { if (fn === "balanceOf") { for (const q of st.proj.values()) if (q.poolAddr && L(q.poolAddr) === L(args[0])) return q.rU; return bal(st.usdc, args[0]); } if (fn === "allowance") return 2n ** 255n; if (fn === "decimals") return 6; if (fn === "symbol") return "USDC"; }
    const pr = P(addr);
    if (pr) {
      switch (fn) {
        case "pool": return pr.pool || Z; case "lpUnlock": return BigInt(pr.lpUnlock); case "liquidityUsdc": return pr.liqUsdc; case "state": return pr.state; case "totalRaised": return pr.raised; case "poolAfterFees": return pr.poolAfterFees;
        case "usdcReleased": return pr.released; case "milestonesDone": return pr.ms; case "voteEnd": return BigInt(pr.voteEnd); case "votesYes": return pr.yes; case "votesNo": return pr.no; case "deadline": return BigInt(pr.deadline);
        case "succeeded": return pr.succeeded; case "refundPool": return pr.refundPool; case "voteRound": return BigInt(pr.vr || 0); case "retrying": return pr.retrying;
        case "contributed": return bal(pr.contrib, args[0]); case "claimedTokens": return pr.claimed.has(L(args[0])); case "settled": return pr.settled.has(L(args[0])); case "voted": return !!pr.voted.get(`${args[0]}:${L(args[1])}`);
        case "balanceOf": return bal(pr.tok, args[0]) + (L(args[0]) === L(pr.poolAddr || "x") ? pr.rT || 0n : 0n); case "totalSupply": return pr.supply; case "allowance": return 2n ** 255n; case "symbol": return pr.q.symbol; case "name": return pr.q.name;
      }
    }
    for (const q of st.proj.values()) if (q.poolAddr && L(q.poolAddr) === a) { if (fn === "slot0") return [sqrtOf(q), 0, 0, 0, 0, 0, true]; }
    throw new Error("demo: unsupported read " + fn);
  };
  const pub = {
    async getBlock(a = {}) { if (a.blockNumber === undefined) return { timestamp: BigInt(nowTs()), number: st.head }; return { timestamp: BigInt(tsOf(a.blockNumber)), number: a.blockNumber }; },
    async getBlockNumber() { return st.head; },
    async getCode({ address }) { const p = P(address); return p?.exists ? "0x6001" : "0x"; },
    async readContract({ address, functionName, args }) { return getRead(address, functionName, args); },
    async multicall({ contracts }) { return contracts.map((c) => { try { return { status: "success", result: getRead(c.address, c.functionName, c.args) }; } catch (e) { return { status: "failure", error: e }; } }); },
    async simulateContract({ address, functionName, args }) {
      const [{ tokenIn, tokenOut, amountIn }] = args; const pr = [...st.proj.values()].find((p) => p.poolAddr && (L(p.addr) === L(tokenIn) || L(p.addr) === L(tokenOut)));
      return { result: [quote(pr, tokenIn, amountIn), 0n, 0, 0n] };
    },
    async getContractEvents({ address, eventName }) {
      const p = P(address); if (p) return eventName === "Bought" ? p.bought : eventName === "Finalized" ? p.fin : [];
      for (const q of st.proj.values()) if (q.poolAddr && L(q.poolAddr) === L(address)) return q.swaps; return [];
    },
    async waitForTransactionReceipt() { return { status: "success" }; },
  };

  // ---------- escrituras (vía eth_sendTransaction) ----------
  const hash = () => "0x" + [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
  function sendTx({ to, data, from }) {
    const me = from; const target = L(to);
    if (target === L(CONFIG.deployer)) { const pr = [...st.proj.values()].find((p) => !p.exists && data && data.length > 100); if (pr) pr.pending = true; return; }
    if (target === L(CONFIG.usdc)) return; // approve
    if (target === L(CONFIG.swapRouter)) { const { args } = decodeFunctionData({ abi: ROUTER_ABI, data }); const [{ tokenIn, tokenOut, amountIn, amountOutMinimum }] = args;
      const pr = [...st.proj.values()].find((p) => p.poolAddr && (L(p.addr) === L(tokenIn) || L(p.addr) === L(tokenOut))); swap(pr, me, tokenIn, amountIn, amountOutMinimum); return; }
    const pr = P(to); if (!pr) return; const { functionName: fn, args } = decodeFunctionData({ abi: ABI, data });
    switch (fn) {
      case "buy": buy(pr, me, args[0]); break;
      case "finalize": finalize(pr); break;
      case "claimTokens": { const m = bal(pr.contrib, me); add(pr.tok, me, (m * pr.q.saleTokens) / pr.q.hardcap); pr.claimed.add(L(me)); mineBlock(); break; }
      case "refund": { const m = bal(pr.contrib, me); const back = pr.raised ? (pr.refundPool * m) / pr.raised : 0n; add(st.usdc, me, back); pr.settled.add(L(me)); mineBlock(); break; }
      case "requestRelease": { if (L(me) !== L(pr.q.creator)) throw new Error("Only the creator."); pr.vr = (pr.vr || 0) + 1; pr.voteEnd = nowTs() + 7 * 86400; pr.yes = 0n; pr.no = 0n; mineBlock(); break; }
      case "vote": { const m = bal(pr.contrib, me); if (m <= 0n) throw new Error("Only backers can vote."); const k = `${BigInt(pr.vr || 0)}:${L(me)}`; if (pr.voted.get(k)) throw new Error("Already voted."); pr.voted.set(k, true); if (args[0]) pr.yes += m; else pr.no += m; mineBlock(); break; }
      case "closeVote": { if (!pr.voteEnd || nowTs() < pr.voteEnd) throw new Error("Voting is still open."); pr.voteEnd = 0;
        if (pr.no > pr.yes) { if (!pr.retrying) { pr.retrying = true; pr.deadline = nowTs() + 14 * 86400; } else { pr.state = 2; pr.refundPool = pr.poolAfterFees - pr.released; } }
        else { pr.retrying = false; pr.ms += 1; pr.deadline = nowTs() + Number(pr.q.milestonePeriod); const step = (pr.poolAfterFees * BigInt(10000 - pr.q.initialBps)) / BigInt(10000 * pr.q.milestones); pr.released += step; add(st.usdc, pr.q.creator, step); if (pr.ms >= pr.q.milestones) pr.state = 3; }
        mineBlock(); break; }
      case "abandon": pr.state = 2; pr.refundPool = pr.poolAfterFees - pr.released; mineBlock(); break;
    }
  }
  const eth = {
    on() {}, removeListener() {},
    async request({ method, params = [] }) {
      switch (method) {
        case "eth_accounts": return st.me ? [st.me] : [];
        case "eth_requestAccounts": st.me = accts[st.role].address; return [st.me];
        case "eth_chainId": return "0x" + CONFIG.chainId.toString(16);
        case "wallet_switchEthereumChain": return null;
        case "personal_sign": { const acc = accts[st.role]; const msg = params[0]; const text = /^0x/.test(msg) ? new TextDecoder().decode(Uint8Array.from(msg.slice(2).match(/.{2}/g).map((h) => parseInt(h, 16)))) : msg; return acc.signMessage({ message: text }); }
        case "eth_sendTransaction": { const tx = params[0]; await new Promise((r) => setTimeout(r, 600)); sendTx({ ...tx, from: st.me }); return hash(); }
        default: throw new Error("demo: unsupported " + method);
      }
    },
  };

  // ---------- servidor simulado ----------
  const realFetch = window.fetch.bind(window);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  window.fetch = async (url, opt = {}) => {
    const u = String(url);
    if (u.includes("projects.json")) { const r = await (await realFetch(url, opt)).json(); r.forEach((p) => (p.params.creator = accts.creator.address)); return json(r); }
    if (!u.includes("./api/") && !u.includes("/api/")) return realFetch(url, opt);
    const body = opt.body ? JSON.parse(opt.body) : {}, a = st.api;
    if (u.includes("/api/projects")) return json({ projects: a.subs, qa: a.qa, updates: a.updates });
    if (u.includes("/api/profile")) { if (opt.method === "POST") { a.profiles[L(body.address)] = { address: L(body.address), name: body.name, photo: body.photo || "", signature: body.signature }; return json({ ok: true }); } return json({ profiles: Object.values(a.profiles) }); }
    if (u.includes("/api/qa")) { (a.qa[body.id] ||= []).push({ id: body.id, kind: body.kind, text: body.text, ts: body.ts, qts: body.qts, author: body.author, signature: body.signature }); return json({ ok: true }); }
    if (u.includes("/api/update")) { (a.updates[body.id] ||= []).push({ id: body.id, text: body.text, ts: body.ts, signature: body.signature }); return json({ ok: true }); }
    if (u.includes("/api/submit")) { a.subs.push({ project: body.project, signature: body.signature, at: Date.now(), decision: null, updates: [] }); return json({ ok: true, id: body.project.id }); }
    if (u.includes("/api/decide")) { const s = a.subs.find((x) => x.project.id === body.id); if (s) s.decision = body; return json({ ok: true }); }
    if (u.includes("/api/reviews")) return json({ reviews: Object.fromEntries(a.subs.map((s) => [s.project.id, { riesgo: "bajo", resumen: "Revisión simulada (demo).", senales: [], preguntas: [] }])) });
    return json({ ok: true });
  };

  return {
    pub, eth, init, accts, st,
    setRole(r) { st.role = r; st.me = accts[r].address; },
    forward(days) { st.offset += days * 86400; mineBlock(); },
    tick,
  };
}
