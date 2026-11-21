// "Launches": lanzamientos rápidos con todo o nada. Prototipo de interfaz sobre datos simulados (sin contrato todavía).
// Una ronda se llena con USDC; mientras no se llene, cada quien puede sacar su dinero. Al llenarse, el dinero pasa a un pool y el token se opera.
import { mountChart } from "./pro.js";
import { threadHtml } from "./thread.js";

const GOALS = [100, 500, 2000];
const now = () => Date.now() / 1000;
const rnd = (a, b) => a + Math.random() * (b - a);
const lang = () => { try { return localStorage.getItem("hf-lang") === "es" ? "es" : "en"; } catch { return "en"; } };
const T = (en, es) => (lang() === "es" ? es : en);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usd = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e4 ? (v / 1e3).toFixed(1) + "K" : v.toLocaleString("en-US", { maximumFractionDigits: 2 }));
const SUBN = (n) => String(n).replace(/\d/g, (d) => "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089"[d]);
const tinyP = (x) => { if (!(x > 0)) return "0"; const z = Math.floor(-Math.log10(x)); const m = (x * Math.pow(10, z + 1)).toPrecision(3).replace(".", "").slice(0, 3); return z > 4 ? `0.0${SUBN(z)}${m}` : x.toFixed(z + 3); };
const fmtP = (x) => (x >= 0.01 ? "$" + x.toLocaleString("en-US", { maximumFractionDigits: 4 }) : x >= 1e-4 ? "$" + x.toPrecision(3) : "$" + tinyP(x));
const born = (l) => l.born ?? (l.dl ? l.dl - 24 * 3600 : l.last);
const ago = (t) => { const s = Math.max(1, Math.round(now() - t)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`; };
const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

const me = { usdc: 500, dep: {}, tok: {} };
export const lcChainLive = () => L.filter((x) => x.chain && x.cs?.state === "live");
const saveRec = (r) => { try { const a = JSON.parse(localStorage.getItem("hf-lcs") || "[]"); if (!a.some((x) => x.address === r.address)) { a.push(r); localStorage.setItem("hf-lcs", JSON.stringify(a)); } } catch {} };
function addChainRec(r) { if (L.some((x) => x.chain === r.address)) return null; const l = mk(r.name, r.symbol, r.goal, 0, r.img || ""); l.chain = r.address; l.creator = 0; l.comments = []; return l; }
export async function loadChainLaunches() {
  let recs = []; try { recs = JSON.parse(localStorage.getItem("hf-lcs") || "[]"); } catch {}
  try { const r = await fetch("/api/launches"); if (r.ok) recs = [...recs, ...((await r.json()).launches || [])]; } catch {}
  const added = recs.map(addChainRec).filter(Boolean); await Promise.all(added.map((l) => syncChain(l).catch(() => {})));
}
const clock = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; };
const isExp = (l) => l.status === "open" && l.dl && now() > l.dl;
const mineOf = (l) => (l.chain ? Number(l.cs?.mine ?? 0n) / 1e6 : me.dep[l.id] || 0);
async function syncChain(l) {
  if (!l.chain || !CTX) return;
  const C = await import("./lcchain.js"), s = await C.readLaunch(CTX.pub, l.chain, CTX.account || undefined); l.cs = s; l.raised = Number(s.raised) / 1e6; l.dl = s.deadline; l.goal = Number(s.goal) / 1e6;
  if (CTX.account) { const { erc20Abi } = await import("viem"); l.cbal = Number(await CTX.pub.readContract({ address: CTX.CONFIG.usdc, abi: erc20Abi, functionName: "balanceOf", args: [CTX.account] })) / 1e6; }
}
let CTX = null; // { CONFIG, pub, wallet, account } cuando hay wallet real conectada: entonces Lanzar despliega el contrato de verdad
export const setLaunchChain = (c) => { CTX = c; };
const L = [];
let uid = 1;
function mk(name, sym, goal, raised, img, live = false) {
  const l = { dl: now() + 24 * 3600 - (live ? 0 : rnd(1800, 20 * 3600)), id: "l" + uid++, name, sym, goal, raised: live ? goal : raised, img, status: live ? "live" : "open", last: now() - rnd(5, 600), creator: Math.round(rnd(0, 8)), comments: [], ticks: [], rU: 0, rT: 0, p0: goal / 1_000_000 };
  l.comments = [["anon" + Math.floor(rnd(1000, 9999)), T("lfg", "vamos"), now() - rnd(60, 3000)], ["anon" + Math.floor(rnd(1000, 9999)), T("filling fast", "se está llenando"), now() - rnd(10, 500)]];
  if (live) { l.born = now() - rnd(3600, 20 * 3600); goLive(l, true); }
  L.push(l); return l;
}
function goLive(l, seed = false) {
  if (!seed && (me.dep?.[l.id] || 0) > 0) window.dispatchEvent(new CustomEvent("hf-notify", { detail: { kind: "round", text: T(`${l.name} filled. Trading is open.`, `${l.name} se llenó. Ya puedes tradear.`) } }));
  l.status = "live"; l.raised = l.goal; l.rU = l.goal; l.rT = l.goal / l.p0 * 0.95; l.liveAt = now();
  if (seed) { let t = now() - 3 * 3600; for (let i = 0; i < 60; i++) { t += 180; trade(l, Math.random() < 0.58 ? "buy" : "sell", rnd(2, 14) * (l.goal / 500), t, true); } }
}
function price(l) { return l.rU / l.rT; }
const BOTW = Array.from({ length: 9 }, (_, i) => "0x" + (0xa1 + i * 7).toString(16).padStart(2, "0").repeat(20));
function trade(l, side, usdc, t = now(), silent = false, who = null) {
  const fee = 0.997; who = who || BOTW[Math.floor(Math.random() * BOTW.length)];
  if (side === "buy") { const out = (l.rT * usdc * fee) / (l.rU + usdc * fee); l.rU += usdc; l.rT -= out; l.ticks.push({ t, p: price(l), v: usdc, b: true, k: out, w: who }); return out; }
  const tokens = usdc, out = (l.rU * tokens * fee) / (l.rT + tokens * fee); l.rT += tokens; l.rU -= out; l.ticks.push({ t, p: price(l), v: out, b: false, k: tokens, w: who }); return out;
}
export const lcLive = () => L.filter((x) => x.status === "live");
export const lcGet = (id) => L.find((x) => x.id === id);
export const lcMeBal = () => me;
export function lcQuote(l, side, v) {
  const fee = 0.997, p0 = l.rU / l.rT;
  if (side === "buy") { const out = (l.rT * v * fee) / (l.rU + v * fee); return { out, imp: Math.abs(v / out - p0) / p0 * 100 }; }
  const out = (l.rU * v * fee) / (l.rT + v * fee); return { out, imp: Math.abs(out / v - p0) / p0 * 100 };
}
export function lcSwap(l, side, v, who) {
  if (side === "buy") { me.usdc -= v; me.tok[l.id] = (me.tok[l.id] || 0) + trade(l, "buy", v, now(), false, who); } else { me.tok[l.id] = Math.max(0, (me.tok[l.id] || 0) - v); me.usdc += trade(l, "sell", v, now(), false, who); }
  l.last = now();
}
function candles(l, step) {
  const tk = l.ticks; if (!tk.length) return []; const out = []; let last = l.p0;
  for (let b = Math.floor(tk[0].t / step) * step; b <= now(); b += step) {
    const inB = tk.filter((x) => x.t >= b && x.t < b + step), pr = inB.map((x) => x.p), c = pr.length ? pr[pr.length - 1] : last;
    out.push({ t: Math.floor(b), o: last, h: Math.max(last, c, ...pr), l: Math.min(last, c, ...pr), c, v: inB.reduce((a, x) => a + x.v, 0) }); last = c;
  }
  return out.slice(-200);
}
mk("Lumen", "LUMN", 500, 430, "./assets/covers/lumen.webp");
mk("Atlas", "ATLS", 2000, 1180, "./assets/covers/atlas.webp");
mk("Kite", "KITE", 100, 62, "./assets/covers/kite.webp");
mk("Nova Cat", "NCAT", 500, 40, "");
mk("Rocket Frog", "RFROG", 100, 0, "", true);
mk("Moon Bread", "BREAD", 500, 0, "", true);
{ const sn = Number(new URLSearchParams(location.search).get("stress") || 0);
  if (sn) { const A = ["Moon", "Pepe", "Doge", "Turbo", "Neon", "Giga", "Pixel", "Ninja", "Cosmic", "Wojak", "Shiba", "Hyper", "Lunar", "Chad", "Rocket", "Panda", "Cyber", "Alpha", "Mega", "Zen"], B = ["Cat", "Frog", "Bread", "Coin", "Dog", "Bear", "Bull", "Ghost", "Duck", "Fish", "Wolf", "Fox", "Banana", "Pizza", "Robot", "Tiger"];
    for (let i = 0; i < sn; i++) { const nm = A[Math.floor(rnd(0, A.length))] + " " + B[Math.floor(rnd(0, B.length))], g = [100, 500, 2000][Math.floor(rnd(0, 3))]; mk(nm, (nm.replace(" ", "").slice(0, 3) + nm.split(" ")[1].slice(0, 2)).toUpperCase().slice(0, 5), g, Math.round(g * rnd(0.05, 0.95)), "", i % 3 !== 0); } } }

let timer = null, chart = null, cur = "";
function tick() {
  if (!location.hash.startsWith("#/lc") && !location.hash.startsWith("#/trade/lc-") && !location.hash.startsWith("#/market") && !["", "#", "#/"].includes(location.hash)) { if (cur) stopLaunches(); return; }
  const open = L.filter((l) => l.status === "open" && !l.chain);
  if (open.length) { const l = open[Math.floor(Math.random() * open.length)], add = Math.min(l.goal - l.raised, rnd(4, 30) * (l.goal / 500 + 0.4)); l.raised += add; l.last = now(); if (l.raised >= l.goal - 0.01) goLive(l); }
  const live = L.filter((l) => l.status === "live" && !l.chain); if (live.length) { const l = live[Math.floor(Math.random() * live.length)]; if (Math.random() < 0.55) trade(l, "buy", rnd(1, 9) * (l.goal / 500)); else trade(l, "sell", (l.rT * rnd(0.002, 0.012))); l.last = now(); }
  if (Math.random() < 0.06 && L.length < 14) { const n = ["Dog Wif Hat", "Taco Moon", "Pixel Ghost", "Sad Duck", "Neon Frog"][Math.floor(Math.random() * 5)] + " " + Math.floor(rnd(1, 99)); mk(n, n.replace(/[^A-Z]/gi, "").slice(0, 5).toUpperCase(), GOALS[Math.floor(Math.random() * 3)], 0, ""); }
  if (cur === "list") view(); else if (cur && cur !== "new") { const cl = L.find((x) => x.id === cur); if (cl?.chain) syncChain(cl).then(liveUpdate).catch(() => {}); else liveUpdate(); }
}
const art = (l, cls = "") => (l.img ? `<img class="${cls}" src="${esc(l.img)}" alt="">` : `<div class="lc-ph ${cls}" style="--h:${hue(l.name)}"><b>${esc(l.sym.slice(0, 2))}</b></div>`);
const bar = (l) => `<div class="meter"><b style="width:${Math.min(100, (l.raised / l.goal) * 100)}%"></b></div>`;

function listHtml() {
  const f = window.__lcf || "new", rows = L.filter((l) => (f === "new" || (f === "live" ? l.status === "live" : l.status === "open")) && (!window.__lcq || (l.name + " " + l.sym).toLowerCase().includes(window.__lcq.toLowerCase()))).sort((a, b) => f === "new" ? born(b) - born(a) : b.last - a.last);
  return `<div class="page-h"><h1>${T("Launches", "Lanzamientos")}</h1><p>${T("Rounds fill in minutes. If one doesn't fill, take your money out. When it fills, trading opens.", "Las rondas se llenan en minutos. Si no se llena, sacas tu dinero. Al llenarse, se abre el mercado.")}</p></div>
  <div class="lc-go"><a class="lc-new" href="#/lc/new">+ ${T("Create a token", "Crear un token")}</a><a class="lc-bk" href="#/">${T("Back to communities", "Volver a comunidades")} ›</a></div>
  <div class="cat-bar"><div class="cat-tabs">${[["new", T("Recent", "Recientes")], ["open", T("Filling", "Llenándose")], ["live", T("Live", "En vivo")]].map(([k, t]) => `<button type="button" data-lcf="${k}" aria-selected="${f === k}">${t}</button>`).join("")}</div></div>
  <label class="cat-search lc-sq"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="lc-q" type="search" placeholder="${T("Search by name or ticker", "Buscar por nombre o ticker")}" value="${esc(window.__lcq || "")}" autocomplete="off"></label>
  ${f === "new" && !window.__lcq ? trendHtml() : ""}
  <div class="deck">${rows.map((l, ix) => { const live = l.status === "live", ch = live && l.ticks.length ? (price(l) / l.p0 - 1) * 100 : 0, cover = ix === 0 && f === "new" && !window.__lcq;
    return `<a class="pcard${cover ? " cover" : ""}" href="${live ? "#/trade/lc-" + l.id : "#/lc/" + l.id}"><div class="pc-img">${art(l)}<span class="pc-tick">${esc(l.sym)}</span>${now() - born(l) < 3600 ? `<span class="pc-new">${T("NEW", "NUEVO")}</span>` : ""}<span class="pc-age">${T("", "hace ")}${ago(born(l))}${T(" ago", "")}</span>${live ? `<span class="lc-live">${T("LIVE", "EN VIVO")}</span>` : ""}<div class="pc-ov"><h3>${esc(l.name)}</h3></div></div>
      <div class="pc-body">${live ? `<div class="lc-px"><b>${fmtP(price(l))}</b><em class="${ch >= 0 ? "u" : "d"}">${ch >= 0 ? "+" : ""}${ch.toFixed(0)}%</em></div>` : bar(l)}
      <dl class="pc-stats"><div><dt>${live ? T("Pool", "Pool") : T("Raised", "Recaudado")}</dt><dd>$${usd(live ? l.rU : l.raised)}</dd></div><div><dt>${T("Goal", "Meta")}</dt><dd>$${usd(l.goal)}</dd></div><div><dt>${live ? T("Activity", "Actividad") : T("Time left", "Tiempo")}</dt><dd>${live ? ago(l.last) : isExp(l) ? T("Expired", "Expiró") : clock(l.dl - now())}</dd></div></dl></div></a>`; }).join("")}</div>`;
}
function pageHtml(l) {
  const live = l.status === "live", mine = mineOf(l), tk = me.tok[l.id] || 0, left = l.goal - l.raised;
  return `<a class="back" href="#/lc">${T("All launches", "Todos los lanzamientos")}</a>
  <div class="lc-pg"><div class="lc-hero">${art(l)}<div class="lc-hero-t"><span class="pc-tick">${esc(l.sym)}</span><h1>${esc(l.name)}</h1></div></div>
  <div class="lc-side" id="lc-side">${l.chain && l.cs?.state === "live" ? liveChainHtml(l) : live ? liveHtml(l, tk) : openHtml(l, mine, left)}</div>
  <div class="lc-main">${live ? `<div class="tx-chart" id="lc-chart"></div>` : `<div class="lc-note">${T("Everyone gets the same price. The moment the goal is reached the round closes, all the money goes into a locked pool and trading opens.", "Todos reciben el mismo precio. En cuanto se llega a la meta, la ronda se cierra, todo el dinero pasa a un pool bloqueado y se abre el mercado.")}</div><div class="lc-lock"><span>${T("Chart and trading open when the round fills", "El gráfico y el trading se abren cuando se llene")}</span></div>`}
    ${l.creator ? `<p class="lc-dev">${T("Creator put in", "El creador metió")} <b>${l.creator}%</b> ${T("of the goal", "de la meta")}.</p>` : ""}
    ${threadHtml("rnd-" + l.id, { me: () => window.__hfMe?.() || null, avatar: window.__hfAva, seed: true })}</div></div>`;
}
const cmHtml = (l) => l.comments.slice().sort((a, b) => b[2] - a[2]).map((c) => `<li><b>${esc(c[0])}</b><span>${esc(c[1])}</span><em>${ago(c[2])}</em></li>`).join("");
function openHtml(l, mine, left) {
  const bal = l.chain ? l.cbal ?? 0 : me.usdc, exp = isExp(l) || l.cs?.expired || l.cs?.state === "refund";
  const clk = exp ? `<p class="lc-clock exp" id="lc-clock">${l.cs?.state === "refund" ? T("This round was cancelled. Take your money back.", "Esta ronda se canceló. Recupera tu dinero.") : T("This round expired without filling. Take your money back.", "Esta ronda expiró sin llenarse. Recupera tu dinero.")}</p>` : `<p class="lc-clock" id="lc-clock"><span>${T("Time left", "Tiempo restante")}</span><b>${clock(l.dl - now())}</b><small>${T("If it doesn't fill in time, everyone gets their money back.", "Si no se llena a tiempo, todos recuperan su dinero.")}</small></p>`;
  const addr = l.chain ? `<p class="lc-addr"><button type="button" data-copy="${l.chain}">${l.chain.slice(0, 6)}…${l.chain.slice(-4)}</button><span>${T("token address (it exists from now on)", "dirección del token (existe desde ya)")}</span></p>` : "";
  return `<div class="lc-big"><b>$${usd(l.raised)}</b><span>${T("of", "de")} $${usd(l.goal)}</span></div>${bar(l)}<p class="lc-left">${exp ? "" : T("$" + usd(left) + " left to fill", "Faltan $" + usd(left) + " para llenarse")}</p>${clk}
  ${exp ? "" : `<label class="lc-lab">${T("Put in (USDC)", "Meter (USDC)")}</label><div class="field-amt cy-field"><input id="lc-amt" type="number" inputmode="decimal" placeholder="0"><span class="u">USDC</span></div>
  <div class="tx-q tx-amts">${[5, 10, 25, 50, 100].map((v) => `<button type="button" data-lcq="${v}">$${v}</button>`).join("")}<button type="button" data-lcq="max">Max</button></div>
  <p class="lc-prev" id="lc-prev"></p><button class="btn btn-ember btn-block" id="lc-in">${T("Put in", "Meter")}</button>`}<p class="lc-bal">${T("Balance", "Saldo")} $${usd(bal)}</p>${addr}
  ${mine > 0 ? `<div class="lc-mine"><span>${T("You put in", "Pusiste")} <b>$${usd(mine)}</b></span><button class="btn btn-line btn-sm" id="${exp ? "lc-rec" : "lc-out"}">${exp ? T("Recover my money", "Recuperar mi dinero") : T("Take my money out", "Sacar mi dinero")}</button></div>` : ""}`;
}
function liveChainHtml(l) {
  const s = l.cs, mine = mineOf(l), C = CTX?.CONFIG;
  return `<div class="lc-big"><b>${T("Market open", "Mercado abierto")}</b></div><p class="lc-left">${T("The round filled. The pool is locked forever.", "La ronda se llenó. El pool queda bloqueado para siempre.")}</p>
  <p class="lc-addr"><button type="button" data-copy="${l.chain}">${l.chain.slice(0, 6)}…${l.chain.slice(-4)}</button><span>${T("token", "token")}</span></p>
  ${C ? `<a class="btn btn-ember btn-block" href="#/trade/lcx-${l.id}">${T("Trade it", "Operarlo")}</a><a class="btn btn-line btn-block" style="margin-top:10px" href="${C.explorer}/address/${s.pool}" target="_blank" rel="noopener">${T("See the pool", "Ver el pool")}</a>` : ""}
  ${mine > 0 ? `<button class="btn btn-ember btn-block" id="lc-claim" style="margin-top:12px">${T("Claim my tokens", "Reclamar mis tokens")}</button>` : `<p class="lc-bal">${T("Nothing left to claim.", "No tienes tokens por reclamar.")}</p>`}`;
}
function liveHtml(l, tk) {
  const ch = (price(l) / l.p0 - 1) * 100;
  return `<div class="lc-big"><b>${fmtP(price(l))}</b><span class="${ch >= 0 ? "u" : "d"}">${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%</span></div><p class="lc-left">${T("Pool", "Pool")} $${usd(l.rU)} · ${T("locked forever", "bloqueado para siempre")}</p>
  <label class="lc-lab">${T("Amount (USDC)", "Monto (USDC)")}</label><div class="field-amt cy-field"><input id="lc-amt" type="number" inputmode="decimal" placeholder="0"><span class="u">USDC</span></div>
  <div class="tx-q tx-amts">${[5, 10, 25, 50, 100].map((v) => `<button type="button" data-lcq="${v}">$${v}</button>`).join("")}<button type="button" data-lcq="max">Max</button></div>
  <div class="lc-2"><button class="btn btn-ember" id="lc-buy">${T("Buy", "Comprar")}</button><button class="btn btn-line" id="lc-sell">${T("Sell all", "Vender todo")}</button></div>
  <p class="lc-bal">${T("Balance", "Saldo")} $${usd(me.usdc)} · ${tk ? usd(tk) + " " + esc(l.sym) + " ≈ $" + usd(tk * price(l)) : T("no tokens yet", "sin tokens")}</p>`;
}
function newHtml() {
  return `<a class="back" href="#/lc">${T("All launches", "Todos los lanzamientos")}</a><div class="page-h"><h1>${T("Launch", "Lanzar")}</h1><p>${T("One step. No review. Pick a goal and share it.", "Un solo paso. Sin revisión. Elige una meta y compártelo.")}</p></div>
  <form class="lc-form" id="lc-f"><label class="pic" id="lc-cov"><input id="lc-img" type="file" accept="image/*"><i class="pic-c"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></i><span><b>${T("Token photo", "Foto del token")}</b><small>${T("Tap to choose from your gallery", "Toca para elegir de tu galería")}</small></span></label>
  <div class="two"><div class="f"><label>${T("Name", "Nombre")}</label><input id="lc-n" maxlength="24" placeholder="Rocket Frog"></div><div class="f"><label>${T("Ticker", "Símbolo")}</label><input id="lc-s" maxlength="6" placeholder="RFROG" style="text-transform:uppercase"></div></div>
  <div class="f"><label>${T("Goal", "Meta")}</label><div class="chips">${GOALS.map((g, i) => `<label><input type="radio" name="lc-g" value="${g}" ${i === 1 ? "checked" : ""}><span>$${g}</span></label>`).join("")}</div><small>${T("Everyone gets the same price. If it doesn't fill, everyone takes their money out.", "Todos reciben el mismo precio. Si no se llena, cada quien saca su dinero.")}</small></div>
  <div class="f"><label>${T("You put in first (optional)", "Metes tú primero (opcional)")}</label><div class="chips">${[0, 10, 25, 50].map((v, i) => `<label><input type="radio" name="lc-c" value="${v}" ${i === 0 ? "checked" : ""}><span>${v ? "$" + v : T("None", "Nada")}</span></label>`).join("")}</div><small>${T("Shown publicly on the page.", "Se muestra públicamente en la página.")}</small></div>
  <div class="two"><div class="f"><label>${T("Your share of tokens", "Tu parte de los tokens")}</label><div class="chips">${[0, 5, 10].map((v) => `<label><input type="radio" name="lc-p" value="${v}" ${v === 5 ? "checked" : ""}><span>${v}%</span></label>`).join("")}</div></div><div class="f"><label>${T("Released over", "Se liberan en")}</label><div class="chips">${[4, 8, 12].map((v) => `<label><input type="radio" name="lc-w" value="${v}" ${v === 8 ? "checked" : ""}><span>${v} ${T("wk", "sem")}</span></label>`).join("")}</div></div></div>
  <ul class="lc-rules"><li>${T("Your tokens are released little by little, so you can't dump them on day one.", "Tus tokens se liberan poco a poco: no puedes venderlos todos el primer día.")}</li><li>${T("The pool is locked forever. Nobody can take it out.", "El pool queda bloqueado para siempre. Nadie lo puede sacar.")}</li><li>${T("Launch fee: $1.", "Comisión por lanzar: $1.")}</li></ul>
  <button class="btn btn-ember btn-block" type="submit">${T("Launch", "Lanzar")}</button></form>`;
}
let root = null, img = "";
function view() {
  const h = location.hash; cur = "";
  if (h === "#/lc/new") { cur = "new"; root.innerHTML = newHtml(); bindNew(); return; }
  const m = h.match(/^#\/lc\/(l\d+)/);
  if (m) { const l = L.find((x) => x.id === m[1]); if (!l) { location.hash = "#/lc"; return; } if (l.status === "live") { location.hash = "#/trade/lc-" + l.id; return; } cur = l.id; root.innerHTML = pageHtml(l); bindPage(l); if (l.chain) syncChain(l).then(() => { if (cur === l.id) { root.innerHTML = pageHtml(l); bindPage(l); } }).catch(() => {}); return; }
  cur = "list"; const sy = scrollY; root.innerHTML = listHtml(); scrollTo(0, sy);
  root.querySelectorAll("[data-lcf]").forEach((b) => (b.onclick = () => { window.__lcf = b.dataset.lcf; view(); }));
  const sq = root.querySelector("#lc-q"); if (sq) sq.oninput = () => { window.__lcq = sq.value; const pos = sq.selectionStart; view(); const n = root.querySelector("#lc-q"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
}
function liveUpdate() {
  const l = L.find((x) => x.id === cur); if (!l) return; const side = document.getElementById("lc-side"); if (!side) return;
  const a = document.getElementById("lc-amt")?.value;
  if (l.status === "live" && !document.getElementById("lc-buy")) { view(); return; }
  if (l.chain && l.cs?.state === "live") { if (!document.getElementById("lc-claim") && mineOf(l) > 0 || !side.querySelector(".lc-big")) { side.innerHTML = liveChainHtml(l); bindSide(l); } else if (mineOf(l) === 0 && document.getElementById("lc-claim")) { side.innerHTML = liveChainHtml(l); bindSide(l); } }
  else if (l.status === "open") { side.innerHTML = openHtml(l, mineOf(l), l.goal - l.raised); bindSide(l); if (a) document.getElementById("lc-amt").value = a; }
  else { const pl = side.querySelector(".lc-big"); if (pl) { const ch = (price(l) / l.p0 - 1) * 100; pl.innerHTML = `<b>${fmtP(price(l))}</b><span class="${ch >= 0 ? "u" : "d"}">${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%</span>`; } chart?.update(); }
  document.getElementById("lc-cm") && (document.getElementById("lc-cm").innerHTML = cmHtml(l));
}
function bindSide(l) {
  const amt = () => document.getElementById("lc-amt"), q = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
  const prev = () => { const el = document.getElementById("lc-prev"); if (!el) return; const v = parseFloat(amt()?.value) || 0;
    el.innerHTML = v ? T(`With $${usd(v)} you get <b>${usd(v / l.p0)} ${esc(l.sym)}</b> at ${fmtP(l.p0)} each`, `Con $${usd(v)} recibes <b>${usd(v / l.p0)} ${esc(l.sym)}</b> a ${fmtP(l.p0)} cada uno`) : T(`Launch price ${fmtP(l.p0)} · same for everyone`, `Precio de salida ${fmtP(l.p0)} · igual para todos`); };
  if (amt()) amt().oninput = prev; prev();
  if (l.chain && CTX && CTX.wallet) return bindChain(l);
  root.querySelectorAll("[data-lcq]").forEach((b) => (b.onclick = () => { amt().value = b.dataset.lcq === "max" ? Math.floor(me.usdc) : b.dataset.lcq; prev(); }));
  q("lc-in", () => { const v = Math.min(parseFloat(amt().value) || 0, me.usdc, l.goal - l.raised); if (v <= 0) return; me.usdc -= v; me.dep[l.id] = (me.dep[l.id] || 0) + v; l.raised += v; l.last = now(); if (l.raised >= l.goal - 0.01) { me.tok[l.id] = me.dep[l.id] / l.p0; goLive(l); for (const o of L) if (o.status === "live" && o !== l) {} } view(); });
  q("lc-out", () => { const v = me.dep[l.id] || 0; me.usdc += v; l.raised -= v; me.dep[l.id] = 0; view(); });
  q("lc-buy", () => { const v = Math.min(parseFloat(amt().value) || 0, me.usdc); if (v <= 0) return; me.usdc -= v; me.tok[l.id] = (me.tok[l.id] || 0) + trade(l, "buy", v); l.last = now(); view(); });
  q("lc-sell", () => { const t = me.tok[l.id] || 0; if (t <= 0) return; me.usdc += trade(l, "sell", t); me.tok[l.id] = 0; l.last = now(); view(); });
}
function bindChain(l) {
  const amt = () => document.getElementById("lc-amt"), q = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
  root.querySelectorAll("[data-lcq]").forEach((b) => (b.onclick = () => { amt().value = b.dataset.lcq === "max" ? Math.floor(l.cbal || 0) : b.dataset.lcq; }));
  const run = async (fn, btn) => { try { if (btn) btn.disabled = true; const C = await import("./lcchain.js"); await fn(C); await syncChain(l); } catch (e) { alert(e.shortMessage || e.message); } if (cur === l.id) { root.innerHTML = pageHtml(l); bindPage(l); } };
  q("lc-in", (e) => run((C) => { const v = Math.min(parseFloat(amt().value) || 0, l.cbal || 0, l.goal - l.raised, l.goal / 4 - mineOf(l)); if (v <= 0) throw new Error(mineOf(l) >= l.goal / 4 ? T("You reached the 25% limit per wallet for this round.", "Llegaste al límite del 25% por billetera en esta ronda.") : T("Enter an amount.", "Escribe un monto.")); return C.deposit(CTX.CONFIG, CTX.pub, CTX.wallet, CTX.account, l.chain, v); }, e.target));
  q("lc-out", (e) => run((C) => C.withdraw(CTX.pub, CTX.wallet, CTX.account, l.chain), e.target));
  q("lc-rec", (e) => run((C) => C.withdraw(CTX.pub, CTX.wallet, CTX.account, l.chain), e.target));
  q("lc-claim", (e) => run((C) => C.claim(CTX.pub, CTX.wallet, CTX.account, l.chain), e.target));
  root.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.copy)));
}
function bindPage(l) {
  bindSide(l);
  if (l.status === "live") { const es = lang() === "es"; chart = mountChart(document.getElementById("lc-chart"), { id: "lc-" + l.id, periods: ["1m", "5m"], period: "1m", onPeriod: () => {},
    getData: (per) => ({ candles: candles(l, per === "1m" ? 60 : 300), round: l.p0, supply: 1_000_000, marks: [] }), labels: es ? { cap: "Valor total", price: "Precio", candles: "Velas", line: "Línea", ma: "Promedios", draw: "Línea", clear: "Borrar", full: "Pantalla completa" } : {} }); }
}
function bindNew() {
  const f = document.getElementById("lc-f"); img = "";
  document.getElementById("lc-img").onchange = (e) => { const file = e.target.files[0]; if (!file) return; const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const S2 = 512, k = Math.min(1, S2 / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
      img = cv.toDataURL("image/webp", 0.85); const c = document.getElementById("lc-cov"), ic = c.querySelector(".pic-c"); ic.style.backgroundImage = `url(${img})`; ic.innerHTML = ""; c.classList.add("has"); c.querySelector("small").textContent = T("Tap to change", "Toca para cambiarla"); }; im.src = r.result; }; r.readAsDataURL(file); };
  f.onsubmit = (e) => { e.preventDefault(); const name = document.getElementById("lc-n").value.trim(), sym = document.getElementById("lc-s").value.trim().toUpperCase();
    if (name.length < 2 || sym.length < 2) return alert(T("Add a name and a ticker.", "Agrega un nombre y un símbolo.")); if (L.some((x) => x.sym === sym)) return alert(T("That ticker already exists.", "Ese símbolo ya existe."));
    const goal = Number(f.querySelector('[name="lc-g"]:checked').value), first = Math.min(Number(f.querySelector('[name="lc-c"]:checked').value), Number(f.querySelector('[name="lc-g"]:checked').value) / 4), pct = Number(f.querySelector('[name="lc-p"]:checked').value), wks = Number(f.querySelector('[name="lc-w"]:checked').value);
    if (CTX && CTX.wallet && CTX.account) { const btn = f.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = T("Creating on the network…", "Creando en la red…");
      import("./lcchain.js").then(async (C) => { const p = C.launchParams(CTX.CONFIG, { name, symbol: sym, creator: CTX.account, goal, creatorPct: pct, vestingWeeks: wks }), fromBlock = Number(await CTX.pub.getBlockNumber()), addr = await C.ensureDeployed(CTX.CONFIG, CTX.pub, CTX.wallet, CTX.account, p); const rec = { address: addr, name, symbol: sym, creator: CTX.account, goal, creatorPct: pct, vestingWeeks: wks, fromBlock }; saveRec({ ...rec, img }); fetch("/api/launches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...rec, img: await thumb(img) }) }).catch(() => {});
        if (first > 0) await C.deposit(CTX.CONFIG, CTX.pub, CTX.wallet, CTX.account, addr, Math.min(first, goal));
        const l = mk(name, sym, goal, Math.min(first, goal), img); l.chain = addr; l.dl = now() + 24 * 3600; l.creator = Math.round((first / goal) * 100); location.hash = "#/lc/" + l.id; }).catch((e) => { btn.disabled = false; btn.textContent = T("Launch", "Lanzar"); alert(e.shortMessage || e.message); });
      return; }
    const l = mk(name, sym, goal, Math.min(first, goal), img); l.creator = Math.round((first / goal) * 100); me.usdc -= 1; l.last = now(); location.hash = "#/lc/" + l.id; };
}
export function showLaunches(el) {
  root = el; if (!timer) timer = setInterval(tick, 2500);
  if (!window.__lcLang) { window.__lcLang = 1; document.addEventListener("click", (e) => { if (e.target.closest("[data-lang]") && location.hash.startsWith("#/lc")) setTimeout(view, 80); }); }
  view();
}
export function launchItems(q = "") {
  q = q.trim().toLowerCase(); const t0 = now() - 86400;
  const sp = (l) => { const pts = [l.p0, ...l.ticks.map((x) => x.p)]; if (pts.length < 2) return ""; const lo = Math.min(...pts), hi = Math.max(...pts), W = 120, H = 36, d = pts.map((v, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * W).toFixed(1)} ${(H - ((v - lo) / (hi - lo || 1)) * H).toFixed(1)}`).join(" "), up = pts[pts.length - 1] >= pts[0];
    return `<svg class="spark" viewBox="-2 -4 ${W + 6} ${H + 8}" aria-hidden="true"><path class="${up ? "lsu" : "lsd"}" d="${d}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`; };
  return L.filter((l) => l.status === "live" && (!q || l.name.toLowerCase().includes(q) || l.sym.toLowerCase().includes(q))).map((l) => { const pr = price(l), chg = l.ticks.length ? (pr / l.p0 - 1) * 100 : 0;
    return { id: l.id, href: `#/lc/${l.id}`, sym: l.sym, name: l.name, mark: `<span class="mk-mark">${art(l)}</span>`, price: pr, chg, cap: pr * (l.goal / l.p0), liq: l.rU, vol: l.ticks.filter((x) => x.t > t0).reduce((a, x) => a + x.v, 0), spark: sp(l), isNew: true, idx: 1e6 + (l.liveAt || 0) }; });
}
export function launchRows(q = "") {
  q = q.trim().toLowerCase();
  return L.filter((l) => l.status === "live" && (!q || l.name.toLowerCase().includes(q) || l.sym.toLowerCase().includes(q))).sort((a, b) => b.last - a.last).map((l) => { const ch = l.ticks.length ? (price(l) / l.p0 - 1) * 100 : 0, up = ch >= 0;
    return `<a class="mk-row" href="#/lc/${l.id}"><span class="mk-tok"><span class="mk-mark">${art(l)}</span><span><b>${esc(l.sym)} <i class="mk-new">${T("NEW", "NUEVO")}</i></b><small>${esc(l.name)}</small></span></span><span class="mk-p">${fmtP(price(l))}</span><span class="${up ? "u" : "d"}">${up ? "+" : ""}${ch.toFixed(2)}%</span><span>$${usd(l.rU)}</span><span>$${usd(l.rU * 0.4)}</span><span></span></a>`; }).join("");
}
export const stopLaunches = () => { cur = ""; chart?.destroy(); chart = null; };

// miniatura 256px para el servidor (la foto grande se queda en el navegador del creador)
function thumb(src) { return new Promise((ok) => { if (!src) return ok(""); const im = new Image(); im.onload = () => { const k = Math.min(1, 256 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/webp", 0.8)); }; im.onerror = () => ok(""); im.src = src; }); }

// En tendencia: lo que más se mueve ahora (tokens en vivo) y las rondas que están por llenarse
function trendHtml() {
  const live = L.filter((l) => l.status === "live" && l.ticks.length).map((l) => ({ l, ch: (price(l) / l.p0 - 1) * 100 })).sort((a, b) => b.ch - a.ch).slice(0, 4);
  const near = L.filter((l) => l.status === "open" && !isExp(l) && l.raised / l.goal >= 0.5).sort((a, b) => b.raised / b.goal - a.raised / a.goal).slice(0, 3);
  const cards = live.map(({ l, ch }, i) => `<a class="tr-c" href="#/trade/lc-${l.id}"><span class="tr-r">${i + 1}</span><span class="tr-i">${art(l)}</span><span class="tr-n"><b>${esc(l.sym)}</b><small>${esc(l.name)}</small></span><span class="tr-v ${ch >= 0 ? "u" : "d"}">${ch >= 0 ? "+" : ""}${ch.toFixed(0)}%</span></a>`)
    .concat(near.map((l) => `<a class="tr-c" href="#/lc/${l.id}"><span class="tr-r">⏳</span><span class="tr-i">${art(l)}</span><span class="tr-n"><b>${esc(l.sym)}</b><small>${T("almost full", "casi llena")}</small></span><span class="tr-v">${Math.round((l.raised / l.goal) * 100)}%</span></a>`));
  return cards.length ? `<div class="tr"><h3 class="tr-h">${T("Trending now", "En tendencia")}</h3><div class="tr-row">${cards.join("")}</div></div>` : "";
}


// Inclinación 3D suave de las tarjetas (solo con mouse)
if (!window.__tiltInit) {
  window.__tiltInit = 1;
  const ok = () => matchMedia("(hover: hover) and (min-width: 901px)").matches;
  document.addEventListener("pointermove", (e) => { if (!ok()) return; const c = e.target.closest?.(".pcard"); document.querySelectorAll(".pcard.tilt").forEach((x) => { if (x !== c) { x.classList.remove("tilt"); x.style.removeProperty("--rx"); x.style.removeProperty("--ry"); } });
    if (!c) return; const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; c.classList.add("tilt");
    c.style.setProperty("--ry", ((px - 0.5) * 9).toFixed(2) + "deg"); c.style.setProperty("--rx", ((0.5 - py) * 7).toFixed(2) + "deg"); c.style.setProperty("--mx", (px * 100).toFixed(1) + "%"); c.style.setProperty("--my", (py * 100).toFixed(1) + "%"); });
}

export function nextClose() {
  const o = L.filter((x) => x.status === "open" && x.dl && x.dl > now()).sort((a, b) => a.dl - b.dl)[0];
  if (!o) return null; const top = L.filter((x) => x.status === "open" && !isExp(x)).sort((a, b) => b.raised / b.goal - a.raised / a.goal)[0];
  return { name: o.name, sym: o.sym, secs: Math.max(0, Math.floor(o.dl - now())), id: o.id, fillName: top?.name, fillSym: top?.sym, fillId: top?.id, fillGoal: top?.goal || 0, fillPct: top ? Math.round((top.raised / top.goal) * 100) : 0, fillRaised: top ? top.raised : 0 };
}
