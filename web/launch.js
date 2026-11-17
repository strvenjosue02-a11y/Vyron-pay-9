// "Launches": lanzamientos rápidos con todo o nada. Prototipo de interfaz sobre datos simulados (sin contrato todavía).
// Una ronda se llena con USDC; mientras no se llene, cada quien puede sacar su dinero. Al llenarse, el dinero pasa a un pool y el token se opera.
import { mountChart } from "./pro.js";

const GOALS = [100, 500, 2000];
const now = () => Date.now() / 1000;
const rnd = (a, b) => a + Math.random() * (b - a);
const lang = () => { try { return localStorage.getItem("hf-lang") === "es" ? "es" : "en"; } catch { return "en"; } };
const T = (en, es) => (lang() === "es" ? es : en);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usd = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e4 ? (v / 1e3).toFixed(1) + "K" : v.toLocaleString("en-US", { maximumFractionDigits: 2 }));
const fmtP = (x) => (x >= 0.01 ? "$" + x.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "$" + x.toPrecision(3));
const ago = (t) => { const s = Math.max(1, Math.round(now() - t)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`; };
const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

const me = { usdc: 500, dep: {}, tok: {} };
const L = [];
let uid = 1;
function mk(name, sym, goal, raised, img, live = false) {
  const l = { id: "l" + uid++, name, sym, goal, raised: live ? goal : raised, img, status: live ? "live" : "open", last: now() - rnd(5, 600), creator: Math.round(rnd(0, 8)), comments: [], ticks: [], rU: 0, rT: 0, p0: goal / 1_000_000 };
  l.comments = [["anon" + Math.floor(rnd(1000, 9999)), T("lfg", "vamos"), now() - rnd(60, 3000)], ["anon" + Math.floor(rnd(1000, 9999)), T("filling fast", "se está llenando"), now() - rnd(10, 500)]];
  if (live) goLive(l, true);
  L.push(l); return l;
}
function goLive(l, seed = false) {
  l.status = "live"; l.raised = l.goal; l.rU = l.goal; l.rT = l.goal / l.p0 * 0.95; l.liveAt = now();
  if (seed) { let t = now() - 3 * 3600; for (let i = 0; i < 60; i++) { t += 180; trade(l, Math.random() < 0.58 ? "buy" : "sell", rnd(2, 14) * (l.goal / 500), t, true); } }
}
function price(l) { return l.rU / l.rT; }
function trade(l, side, usdc, t = now(), silent = false) {
  const fee = 0.997;
  if (side === "buy") { const out = (l.rT * usdc * fee) / (l.rU + usdc * fee); l.rU += usdc; l.rT -= out; l.ticks.push({ t, p: price(l), v: usdc }); return out; }
  const tokens = usdc, out = (l.rU * tokens * fee) / (l.rT + tokens * fee); l.rT += tokens; l.rU -= out; l.ticks.push({ t, p: price(l), v: out }); return out;
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

let timer = null, chart = null, cur = "";
function tick() {
  if (!location.hash.startsWith("#/lc") && !["", "#", "#/"].includes(location.hash)) { if (cur) stopLaunches(); return; }
  const open = L.filter((l) => l.status === "open");
  if (open.length) { const l = open[Math.floor(Math.random() * open.length)], add = Math.min(l.goal - l.raised, rnd(4, 30) * (l.goal / 500 + 0.4)); l.raised += add; l.last = now(); if (l.raised >= l.goal - 0.01) goLive(l); }
  const live = L.filter((l) => l.status === "live"); if (live.length) { const l = live[Math.floor(Math.random() * live.length)]; if (Math.random() < 0.55) trade(l, "buy", rnd(1, 9) * (l.goal / 500)); else trade(l, "sell", (l.rT * rnd(0.002, 0.012))); l.last = now(); }
  if (Math.random() < 0.06 && L.length < 14) { const n = ["Dog Wif Hat", "Taco Moon", "Pixel Ghost", "Sad Duck", "Neon Frog"][Math.floor(Math.random() * 5)] + " " + Math.floor(rnd(1, 99)); mk(n, n.replace(/[^A-Z]/gi, "").slice(0, 5).toUpperCase(), GOALS[Math.floor(Math.random() * 3)], 0, ""); }
  if (cur === "list") view(); else if (cur) liveUpdate();
}
const art = (l, cls = "") => (l.img ? `<img class="${cls}" src="${esc(l.img)}" alt="">` : `<div class="lc-ph ${cls}" style="--h:${hue(l.name)}"><b>${esc(l.sym.slice(0, 2))}</b></div>`);
const bar = (l) => `<div class="meter"><b style="width:${Math.min(100, (l.raised / l.goal) * 100)}%"></b></div>`;

function listHtml() {
  const f = window.__lcf || "all", rows = L.filter((l) => (f === "all" || (f === "live" ? l.status === "live" : l.status === "open")) && (!window.__lcq || (l.name + " " + l.sym).toLowerCase().includes(window.__lcq.toLowerCase()))).sort((a, b) => b.last - a.last);
  return `<div class="page-h"><h1>${T("Launches", "Lanzamientos")}</h1><p>${T("Rounds fill in minutes. If one doesn't fill, take your money out. When it fills, trading opens.", "Las rondas se llenan en minutos. Si no se llena, sacas tu dinero. Al llenarse, se abre el mercado.")}</p></div>
  <div class="cat-bar"><div class="cat-tabs">${[["all", T("Active", "Activos")], ["open", T("Filling", "Llenándose")], ["live", T("Live", "En vivo")]].map(([k, t]) => `<button type="button" data-lcf="${k}" aria-selected="${f === k}">${t}</button>`).join("")}</div><a class="btn btn-ember btn-sm" href="#/lc/new">${T("Launch", "Lanzar")}</a></div>
  <label class="cat-search lc-sq"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="lc-q" type="search" placeholder="${T("Search by name or ticker", "Buscar por nombre o ticker")}" value="${esc(window.__lcq || "")}" autocomplete="off"></label>
  <div class="deck">${rows.map((l) => { const live = l.status === "live", ch = live && l.ticks.length ? (price(l) / l.p0 - 1) * 100 : 0;
    return `<a class="pcard" href="#/lc/${l.id}"><div class="pc-img">${art(l)}<span class="pc-tick">${esc(l.sym)}</span>${live ? `<span class="lc-live">${T("LIVE", "EN VIVO")}</span>` : ""}</div>
      <div class="pc-body"><h3>${esc(l.name)}</h3>${live ? `<div class="lc-px"><b>${fmtP(price(l))}</b><em class="${ch >= 0 ? "u" : "d"}">${ch >= 0 ? "+" : ""}${ch.toFixed(0)}%</em></div>` : bar(l)}
      <dl class="pc-stats"><div><dt>${live ? T("Pool", "Pool") : T("Raised", "Recaudado")}</dt><dd>$${usd(live ? l.rU : l.raised)}</dd></div><div><dt>${T("Goal", "Meta")}</dt><dd>$${usd(l.goal)}</dd></div><div><dt>${T("Activity", "Actividad")}</dt><dd>${ago(l.last)}</dd></div></dl></div></a>`; }).join("")}</div>`;
}
function pageHtml(l) {
  const live = l.status === "live", mine = me.dep[l.id] || 0, tk = me.tok[l.id] || 0, left = l.goal - l.raised;
  return `<a class="back" href="#/lc">${T("All launches", "Todos los lanzamientos")}</a>
  <div class="lc-pg"><div class="lc-hero">${art(l)}<div class="lc-hero-t"><span class="pc-tick">${esc(l.sym)}</span><h1>${esc(l.name)}</h1></div></div>
  <div class="lc-side" id="lc-side">${live ? liveHtml(l, tk) : openHtml(l, mine, left)}</div>
  <div class="lc-main">${live ? `<div class="tx-chart" id="lc-chart"></div>` : `<div class="lc-note">${T("Everyone gets the same price. The moment the goal is reached the round closes, all the money goes into a locked pool and trading opens.", "Todos reciben el mismo precio. En cuanto se llega a la meta, la ronda se cierra, todo el dinero pasa a un pool bloqueado y se abre el mercado.")}</div><div class="lc-lock"><span>${T("Chart and trading open when the round fills", "El gráfico y el trading se abren cuando se llene")}</span></div>`}
    ${l.creator ? `<p class="lc-dev">${T("Creator put in", "El creador metió")} <b>${l.creator}%</b> ${T("of the goal", "de la meta")}.</p>` : ""}
    <h3 class="lc-h">${T("Thread", "Hilo")}</h3><ul class="lc-cm" id="lc-cm">${cmHtml(l)}</ul>
    <div class="lc-cin"><input id="lc-ci" maxlength="140" placeholder="${T("Write something…", "Escribe algo…")}"><button class="btn btn-line btn-sm" id="lc-cs">${T("Post", "Publicar")}</button></div></div></div>`;
}
const cmHtml = (l) => l.comments.slice().sort((a, b) => b[2] - a[2]).map((c) => `<li><b>${esc(c[0])}</b><span>${esc(c[1])}</span><em>${ago(c[2])}</em></li>`).join("");
function openHtml(l, mine, left) {
  return `<div class="lc-big"><b>$${usd(l.raised)}</b><span>${T("of", "de")} $${usd(l.goal)}</span></div>${bar(l)}<p class="lc-left">${T("$" + usd(left) + " left to fill", "Faltan $" + usd(left) + " para llenarse")}</p>
  <label class="lc-lab">${T("Put in (USDC)", "Meter (USDC)")}</label><div class="field-amt cy-field"><input id="lc-amt" type="number" inputmode="decimal" placeholder="0"><span class="u">USDC</span></div>
  <div class="tx-q tx-amts">${[5, 10, 25, 50, 100].map((v) => `<button type="button" data-lcq="${v}">$${v}</button>`).join("")}<button type="button" data-lcq="max">Max</button></div>
  <p class="lc-prev" id="lc-prev"></p><button class="btn btn-ember btn-block" id="lc-in">${T("Put in", "Meter")}</button><p class="lc-bal">${T("Balance", "Saldo")} $${usd(me.usdc)}</p>
  ${mine > 0 ? `<div class="lc-mine"><span>${T("You put in", "Pusiste")} <b>$${usd(mine)}</b></span><button class="btn btn-line btn-sm" id="lc-out">${T("Take my money out", "Sacar mi dinero")}</button></div>` : ""}`;
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
  <form class="lc-form" id="lc-f"><label class="cover-pick" id="lc-cov"><input id="lc-img" type="file" accept="image/png,image/jpeg,image/webp"><span>${T("Add an image (optional)", "Agrega una imagen (opcional)")}</span></label>
  <div class="two"><div class="f"><label>${T("Name", "Nombre")}</label><input id="lc-n" maxlength="24" placeholder="Rocket Frog"></div><div class="f"><label>${T("Ticker", "Símbolo")}</label><input id="lc-s" maxlength="6" placeholder="RFROG" style="text-transform:uppercase"></div></div>
  <div class="f"><label>${T("Goal", "Meta")}</label><div class="chips">${GOALS.map((g, i) => `<label><input type="radio" name="lc-g" value="${g}" ${i === 1 ? "checked" : ""}><span>$${g}</span></label>`).join("")}</div><small>${T("Everyone gets the same price. If it doesn't fill, everyone takes their money out.", "Todos reciben el mismo precio. Si no se llena, cada quien saca su dinero.")}</small></div>
  <div class="f"><label>${T("You put in first (optional)", "Metes tú primero (opcional)")}</label><div class="chips">${[0, 10, 25, 50].map((v, i) => `<label><input type="radio" name="lc-c" value="${v}" ${i === 0 ? "checked" : ""}><span>${v ? "$" + v : T("None", "Nada")}</span></label>`).join("")}</div><small>${T("Shown publicly on the page.", "Se muestra públicamente en la página.")}</small></div>
  <ul class="lc-rules"><li>${T("Your tokens: 5% of supply, released over 8 weeks.", "Tus tokens: 5% del total, liberados en 8 semanas.")}</li><li>${T("The pool is locked forever. Nobody can take it out.", "El pool queda bloqueado para siempre. Nadie lo puede sacar.")}</li><li>${T("Launch fee: $1.", "Comisión por lanzar: $1.")}</li></ul>
  <button class="btn btn-ember btn-block" type="submit">${T("Launch", "Lanzar")}</button></form>`;
}
let root = null, img = "";
function view() {
  const h = location.hash; cur = "";
  if (h === "#/lc/new") { cur = "new"; root.innerHTML = newHtml(); bindNew(); return; }
  const m = h.match(/^#\/lc\/(l\d+)/);
  if (m) { const l = L.find((x) => x.id === m[1]); if (!l) { location.hash = "#/lc"; return; } cur = l.id; root.innerHTML = pageHtml(l); bindPage(l); return; }
  cur = "list"; const sy = scrollY; root.innerHTML = listHtml(); scrollTo(0, sy);
  root.querySelectorAll("[data-lcf]").forEach((b) => (b.onclick = () => { window.__lcf = b.dataset.lcf; view(); }));
  const sq = root.querySelector("#lc-q"); if (sq) sq.oninput = () => { window.__lcq = sq.value; const pos = sq.selectionStart; view(); const n = root.querySelector("#lc-q"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
}
function liveUpdate() {
  const l = L.find((x) => x.id === cur); if (!l) return; const side = document.getElementById("lc-side"); if (!side) return;
  const a = document.getElementById("lc-amt")?.value;
  if (l.status === "live" && !document.getElementById("lc-buy")) { view(); return; }
  if (l.status === "open") { side.innerHTML = openHtml(l, me.dep[l.id] || 0, l.goal - l.raised); bindSide(l); if (a) document.getElementById("lc-amt").value = a; }
  else { const pl = side.querySelector(".lc-big"); if (pl) { const ch = (price(l) / l.p0 - 1) * 100; pl.innerHTML = `<b>${fmtP(price(l))}</b><span class="${ch >= 0 ? "u" : "d"}">${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%</span>`; } chart?.update(); }
  document.getElementById("lc-cm") && (document.getElementById("lc-cm").innerHTML = cmHtml(l));
}
function bindSide(l) {
  const amt = () => document.getElementById("lc-amt"), q = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
  const prev = () => { const el = document.getElementById("lc-prev"); if (!el) return; const v = parseFloat(amt()?.value) || 0;
    el.innerHTML = v ? T(`With $${usd(v)} you get <b>${usd(v / l.p0)} ${esc(l.sym)}</b> at ${fmtP(l.p0)} each`, `Con $${usd(v)} recibes <b>${usd(v / l.p0)} ${esc(l.sym)}</b> a ${fmtP(l.p0)} cada uno`) : T(`Launch price ${fmtP(l.p0)} · same for everyone`, `Precio de salida ${fmtP(l.p0)} · igual para todos`); };
  if (amt()) amt().oninput = prev; prev();
  root.querySelectorAll("[data-lcq]").forEach((b) => (b.onclick = () => { amt().value = b.dataset.lcq === "max" ? Math.floor(me.usdc) : b.dataset.lcq; prev(); }));
  q("lc-in", () => { const v = Math.min(parseFloat(amt().value) || 0, me.usdc, l.goal - l.raised); if (v <= 0) return; me.usdc -= v; me.dep[l.id] = (me.dep[l.id] || 0) + v; l.raised += v; l.last = now(); if (l.raised >= l.goal - 0.01) { me.tok[l.id] = me.dep[l.id] / l.p0; goLive(l); for (const o of L) if (o.status === "live" && o !== l) {} } view(); });
  q("lc-out", () => { const v = me.dep[l.id] || 0; me.usdc += v; l.raised -= v; me.dep[l.id] = 0; view(); });
  q("lc-buy", () => { const v = Math.min(parseFloat(amt().value) || 0, me.usdc); if (v <= 0) return; me.usdc -= v; me.tok[l.id] = (me.tok[l.id] || 0) + trade(l, "buy", v); l.last = now(); view(); });
  q("lc-sell", () => { const t = me.tok[l.id] || 0; if (t <= 0) return; me.usdc += trade(l, "sell", t); me.tok[l.id] = 0; l.last = now(); view(); });
}
function bindPage(l) {
  bindSide(l);
  const post = () => { const i = document.getElementById("lc-ci"), v = i.value.trim(); if (!v) return; l.comments.push(["you", v, now()]); l.last = now(); i.value = ""; document.getElementById("lc-cm").innerHTML = cmHtml(l); };
  document.getElementById("lc-cs").onclick = post; document.getElementById("lc-ci").onkeydown = (e) => e.key === "Enter" && post();
  if (l.status === "live") { const es = lang() === "es"; chart = mountChart(document.getElementById("lc-chart"), { id: "lc-" + l.id, periods: ["1m", "5m"], period: "1m", onPeriod: () => {},
    getData: (per) => ({ candles: candles(l, per === "1m" ? 60 : 300), round: l.p0, supply: 1_000_000, marks: [] }), labels: es ? { cap: "Valor total", price: "Precio", candles: "Velas", line: "Línea", ma: "Promedios", draw: "Línea", clear: "Borrar", full: "Pantalla completa" } : {} }); }
}
function bindNew() {
  const f = document.getElementById("lc-f"); img = "";
  document.getElementById("lc-img").onchange = (e) => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => { img = r.result; const c = document.getElementById("lc-cov"); c.style.backgroundImage = `url(${img})`; c.classList.add("has"); }; r.readAsDataURL(file); };
  f.onsubmit = (e) => { e.preventDefault(); const name = document.getElementById("lc-n").value.trim(), sym = document.getElementById("lc-s").value.trim().toUpperCase();
    if (name.length < 2 || sym.length < 2) return alert(T("Add a name and a ticker.", "Agrega un nombre y un símbolo.")); if (L.some((x) => x.sym === sym)) return alert(T("That ticker already exists.", "Ese símbolo ya existe."));
    const goal = Number(f.querySelector('[name="lc-g"]:checked').value), first = Number(f.querySelector('[name="lc-c"]:checked').value);
    const l = mk(name, sym, goal, Math.min(first, goal), img); l.creator = Math.round((first / goal) * 100); me.usdc -= 1; l.last = now(); location.hash = "#/lc/" + l.id; };
}
export function showLaunches(el) {
  root = el; if (!timer) timer = setInterval(tick, 2500);
  if (!window.__lcLang) { window.__lcLang = 1; document.addEventListener("click", (e) => { if (e.target.closest("[data-lang]") && location.hash.startsWith("#/lc")) setTimeout(view, 80); }); }
  view();
}
export function launchRows(q = "") {
  q = q.trim().toLowerCase();
  return L.filter((l) => l.status === "live" && (!q || l.name.toLowerCase().includes(q) || l.sym.toLowerCase().includes(q))).sort((a, b) => b.last - a.last).map((l) => { const ch = l.ticks.length ? (price(l) / l.p0 - 1) * 100 : 0, up = ch >= 0;
    return `<a class="mk-row" href="#/lc/${l.id}"><span class="mk-tok"><span class="mk-mark">${art(l)}</span><span><b>${esc(l.sym)} <i class="mk-new">${T("NEW", "NUEVO")}</i></b><small>${esc(l.name)}</small></span></span><span class="mk-p">${fmtP(price(l))}</span><span class="${up ? "u" : "d"}">${up ? "+" : ""}${ch.toFixed(2)}%</span><span>$${usd(l.rU)}</span><span>$${usd(l.rU * 0.4)}</span><span></span></a>`; }).join("");
}
export const stopLaunches = () => { cur = ""; chart?.destroy(); chart = null; };
