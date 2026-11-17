// Hilo: conversación de cada token / ronda. Burbujas con foto, respuestas, reacciones, etiquetas (Creador, Holder),
// operaciones intercaladas y un cuadro para escribir que siempre está a mano.
// Los mensajes se guardan en este navegador; con servidor se envían a /api/thread (pendiente de conectar).
const lang = () => { try { return localStorage.getItem("hf-lang") === "es" ? "es" : "en"; } catch { return "en"; } };
const T = (en, es) => (lang() === "es" ? es : en);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nowS = () => Math.floor(Date.now() / 1000);
const REG = new Map(); // key -> ctx
const DEMO = (() => { try { return new URLSearchParams(location.search).has("demo"); } catch { return false; } })();
const EMOJI = ["🔥", "🚀", "💎", "😂"];
const BOTS = ["Lobo-3141", "Zorro-8802", "Halcon-4253", "Tigre-1177", "Cobra-1237", "Puma-5120", "Buho-9034", "Lince-2820"];
const LINES = {
  en: ["lfg 🚀", "bought more, this is going up", "who else is holding?", "chart looks clean", "just aped in", "liquidity is locked, I'm calm", "taking some profit here", "dip = gift", "🔥🔥🔥", "this one is different", "still early", "need a pullback first"],
  es: ["vamos 🚀", "compré más, esto va para arriba", "¿quién más está dentro?", "el gráfico se ve limpio", "acabo de entrar", "la liquidez está bloqueada, estoy tranquilo", "tomando algo de ganancia", "la caída es un regalo 🙌", "🔥🔥🔥", "este es distinto", "todavía es temprano", "falta un retroceso primero"],
};
const load = (k) => { try { return JSON.parse(localStorage.getItem("hf-th-" + k) || "null"); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem("hf-th-" + k, JSON.stringify(v.slice(-120))); } catch {} };
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const dAva = (s, z) => `<span class="ava" style="width:${z}px;height:${z}px;background:conic-gradient(from ${hue(s)}deg, hsl(${hue(s)} 70% 55%), hsl(${(hue(s) + 140) % 360} 65% 45%), hsl(${hue(s)} 70% 55%))"></span>`;
const ago = (t) => { const s = Math.max(1, nowS() - t); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };
const bot = (i) => { const n = BOTS[i % BOTS.length]; return { n, a: n }; };
function seed(key) {
  let m = load(key); if (m) return m;
  const L = LINES[lang()], t0 = nowS(); m = [];
  for (let i = 0; i < 6; i++) { const b = bot(Math.floor(Math.random() * 8)); m.push({ id: "s" + i + Math.random().toString(36).slice(2, 6), n: b.n, a: b.a, t: L[Math.floor(Math.random() * L.length)], ts: t0 - (6 - i) * 260 - Math.floor(Math.random() * 120), r: i % 2 ? { "🔥": 1 + Math.floor(Math.random() * 4) } : {} }); }
  save(key, m); return m;
}
const msgHtml = (m, byId, ctx, me) => {
  const rep = m.re && byId[m.re], tag = ctx.tag?.(m) || "", mine = me && m.a && String(m.a).toLowerCase() === String(me.a).toLowerCase();
  const rx = Object.entries(m.r || {}).filter(([, n]) => n > 0).map(([e, n]) => `<button type="button" class="th-rx on" data-thr="${e}" data-id="${m.id}">${e} <b>${n}</b></button>`).join("");
  return `<li class="th-m${mine ? " me" : ""}" data-id="${m.id}">${(ctx.avatar || dAva)(m.a || m.n, 34)}<div class="th-b"><div class="th-h"><b>${esc(m.n)}</b>${tag}<small>${ago(m.ts)}</small></div>${rep ? `<div class="th-q"><i>${esc(rep.n)}</i> ${esc(rep.t.slice(0, 70))}</div>` : ""}<p>${esc(m.t)}</p><div class="th-a">${rx}<button type="button" class="th-rx add" data-thr="🔥" data-id="${m.id}" aria-label="React">+🔥</button><button type="button" class="th-re" data-thre="${m.id}">${T("Reply", "Responder")}</button></div></div></li>`;
};
const evHtml = (e) => `<li class="th-e ${e.buy ? "b" : "s"}"><i></i><span><b>${esc(e.n)}</b> ${e.buy ? T("bought", "compró") : T("sold", "vendió")} <em>$${e.usd}</em></span><small>${ago(e.ts)}</small></li>`;
function listHtml(key) {
  const ctx = REG.get(key), msgs = load(key) || [], me = ctx.me?.(), byId = Object.fromEntries(msgs.map((m) => [m.id, m]));
  const items = msgs.map((m) => ({ ts: m.ts, h: msgHtml(m, byId, ctx, me) })).concat((ctx.events?.() || []).map((e) => ({ ts: e.ts, h: evHtml(e) }))).sort((a, b) => b.ts - a.ts).slice(0, 60);
  return items.length ? `<ul class="th-l">${items.map((x) => x.h).join("")}</ul>` : `<p class="th-empty">${T("Be the first to write.", "Sé el primero en escribir.")}</p>`;
}
export function threadHtml(key, ctx) {
  REG.set(key, ctx); if (DEMO || ctx.seed) seed(key);
  const me = ctx.me?.(), n = (load(key) || []).length;
  const comp = me ? `<form class="th-f" data-thf><div class="th-rp" hidden></div><div class="th-row">${(ctx.avatar || dAva)(me.a, 34)}<textarea rows="1" maxlength="200" placeholder="${T("Write something…", "Escribe algo…")}" aria-label="${T("Message", "Mensaje")}"></textarea><button class="th-s" type="submit" aria-label="${T("Send", "Enviar")}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div><div class="th-em">${EMOJI.map((e) => `<button type="button" data-the="${e}">${e}</button>`).join("")}<span class="th-c">0/200</span></div></form>`
    : `<button type="button" class="th-con" data-thc>${T("Connect your wallet to join the thread", "Conecta tu wallet para escribir en el hilo")}</button>`;
  return `<div class="th" data-th="${esc(key)}"><div class="th-top"><b>${T("Thread", "Hilo")}</b><small>${n} ${T("messages", "mensajes")}</small></div>${comp}<div class="th-list">${listHtml(key)}</div></div>`;
}
const refresh = (root) => { const key = root.dataset.th; if (!REG.has(key)) return; root.querySelector(".th-list").innerHTML = listHtml(key); const s = root.querySelector(".th-top small"); if (s) s.textContent = `${(load(key) || []).length} ${T("messages", "mensajes")}`; };
function post(root, text) {
  const key = root.dataset.th, ctx = REG.get(key), me = ctx.me?.(); if (!me || !text.trim()) return;
  const m = load(key) || []; m.push({ id: "m" + nowS() + Math.random().toString(36).slice(2, 6), n: me.n, a: me.a, t: text.trim().slice(0, 200), ts: nowS(), r: {}, re: root.dataset.re || undefined }); save(key, m);
  root.dataset.re = ""; const rp = root.querySelector(".th-rp"); if (rp) rp.hidden = true; refresh(root);
}
function reactTo(root, id, emoji) {
  const key = root.dataset.th, m = load(key) || [], x = m.find((y) => y.id === id); if (!x) return; const mk = "hf-thmy-" + key + x.id + emoji; let had = false; try { had = localStorage.getItem(mk) === "1"; } catch {}
  x.r = x.r || {}; x.r[emoji] = Math.max(0, (x.r[emoji] || 0) + (had ? -1 : 1)); try { had ? localStorage.removeItem(mk) : localStorage.setItem(mk, "1"); } catch {} save(key, m); refresh(root);
}
function replyTo(root, id) {
  const key = root.dataset.th, x = (load(key) || []).find((y) => y.id === id); if (!x) return; root.dataset.re = x.id; const rp = root.querySelector(".th-rp");
  if (rp) { rp.hidden = false; rp.innerHTML = `${T("Replying to", "Respondiendo a")} <b>${esc(x.n)}</b> <button type="button" data-thx aria-label="${T("Cancel", "Cancelar")}">✕</button>`; } root.querySelector("textarea")?.focus();
}
let MENU = null;
function closeMenu() { MENU?.remove(); MENU = null; document.querySelectorAll(".th-m.sel").forEach((x) => x.classList.remove("sel")); }
function openMenu(li) {
  closeMenu(); const root = li.closest(".th"), id = li.dataset.id, r = li.getBoundingClientRect(); li.classList.add("sel"); try { navigator.vibrate?.(12); } catch {}
  const mn = document.createElement("div"); mn.className = "th-menu"; mn.innerHTML = `<div class="th-mr">${["🔥", "🚀", "💎", "😂", "❤️"].map((e) => `<button type="button" data-mr="${e}">${e}</button>`).join("")}</div><button type="button" class="th-mi" data-mrep>${T("Reply", "Responder")}</button><button type="button" class="th-mi" data-mcp>${T("Copy text", "Copiar texto")}</button>`;
  document.body.appendChild(mn); const h = mn.offsetHeight, w = mn.offsetWidth; let top = r.top - h - 8; if (top < 70) top = Math.min(innerHeight - h - 12, r.bottom + 8); mn.style.top = top + "px"; mn.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.left + 10)) + "px"; MENU = mn;
  mn.onclick = (e) => { const em = e.target.closest("[data-mr]"); if (em) { reactTo(root, id, em.dataset.mr); closeMenu(); return; } if (e.target.closest("[data-mrep]")) { replyTo(root, id); closeMenu(); return; }
    if (e.target.closest("[data-mcp]")) { const x = (load(root.dataset.th) || []).find((y) => y.id === id); navigator.clipboard?.writeText(x?.t || ""); closeMenu(); } };
}
if (!window.__thInit) {
  window.__thInit = 1;
  document.addEventListener("submit", (e) => { const f = e.target.closest("[data-thf]"); if (!f) return; e.preventDefault(); const root = f.closest(".th"), ta = f.querySelector("textarea"); post(root, ta.value); ta.value = ""; ta.style.height = ""; f.querySelector(".th-c").textContent = "0/200"; });
  document.addEventListener("input", (e) => { const ta = e.target.closest(".th-f textarea"); if (!ta) return; ta.style.height = "auto"; ta.style.height = Math.min(110, ta.scrollHeight) + "px"; ta.closest(".th-f").querySelector(".th-c").textContent = ta.value.length + "/200"; });
  document.addEventListener("keydown", (e) => { const ta = e.target.closest?.(".th-f textarea"); if (ta && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ta.closest("form").requestSubmit(); } });
  document.addEventListener("click", (e) => {
    const root = e.target.closest(".th"); if (!root) return;
    if (e.target.closest("[data-thc]")) { document.getElementById("connect")?.click(); return; }
    const em = e.target.closest("[data-the]"); if (em) { const ta = root.querySelector("textarea"); ta.value = (ta.value + em.dataset.the).slice(0, 200); ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus(); return; }
    const rx = e.target.closest("[data-thr]"); if (rx) { reactTo(root, rx.dataset.id, rx.dataset.thr); return; }
    const re = e.target.closest("[data-thre]"); if (re) { replyTo(root, re.dataset.thre); return; }
    if (e.target.closest("[data-thx]")) { root.dataset.re = ""; root.querySelector(".th-rp").hidden = true; }
  });
  let lp = null, sx = 0, sy = 0, lastTap = { id: "", t: 0 };
  const stop = () => { clearTimeout(lp); lp = null; };
  document.addEventListener("pointerdown", (e) => {
    if (MENU && !e.target.closest(".th-menu")) closeMenu();
    const li = e.target.closest(".th-m"); if (!li || e.target.closest("button, a, textarea")) return; sx = e.clientX; sy = e.clientY; stop(); lp = setTimeout(() => { lp = null; li.dataset.lp = "1"; openMenu(li); }, 420);
  });
  document.addEventListener("pointermove", (e) => { if (lp && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) stop(); });
  document.addEventListener("pointerup", (e) => { stop(); const li = e.target.closest(".th-m"); if (!li || e.target.closest("button, a") || li.dataset.lp) { if (li) delete li.dataset.lp; return; }
    const n = Date.now(); if (lastTap.id === li.dataset.id && n - lastTap.t < 320) { reactTo(li.closest(".th"), li.dataset.id, "🔥"); lastTap = { id: "", t: 0 }; } else lastTap = { id: li.dataset.id, t: n }; });
  document.addEventListener("pointercancel", stop); document.addEventListener("scroll", () => { stop(); }, true);
  document.addEventListener("contextmenu", (e) => { const li = e.target.closest(".th-m"); if (li) { e.preventDefault(); stop(); openMenu(li); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  // en modo demo la conversación sigue viva
  setInterval(() => { if (!DEMO) return; document.querySelectorAll(".th").forEach((root) => { const key = root.dataset.th; if (!REG.has(key) || !root.isConnected || MENU || Math.random() > 0.45) return; const L = LINES[lang()], b = bot(Math.floor(Math.random() * 8)), m = load(key) || [], me = REG.get(key).me?.(); m.push({ id: "b" + nowS() + Math.random().toString(36).slice(2, 5), n: b.n, a: b.a, t: L[Math.floor(Math.random() * L.length)], ts: nowS(), r: {} }); save(key, m); if (!root.querySelector("textarea:focus")) refresh(root); }); }, 7000);
  setInterval(() => document.querySelectorAll(".th").forEach((r) => { if (REG.has(r.dataset.th) && !MENU && !r.querySelector("textarea:focus")) refresh(r); }), 15000);
}
