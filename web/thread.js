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
const gifOk = (u) => /^data:image\/(gif|webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(u) || /^https:\/\/[^\s"'<>]{6,300}$/.test(u);
const MAXGIF = 350 * 1024;
const load = (k) => { try { return JSON.parse(localStorage.getItem("hf-th-" + k) || "null"); } catch { return null; } };
const save = (k, v) => { v = v.slice(-120); for (let i = 0; i <= v.length; i++) { try { localStorage.setItem("hf-th-" + k, JSON.stringify(v)); return; } catch { const x = v.find((m) => m.g && m.g.startsWith("data:")); if (!x) return; delete x.g; if (!x.t) x.t = "GIF"; } } };
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const dAva = (s, z) => `<span class="ava" style="width:${z}px;height:${z}px;background:conic-gradient(from ${hue(s)}deg, hsl(${hue(s)} 70% 55%), hsl(${(hue(s) + 140) % 360} 65% 45%), hsl(${hue(s)} 70% 55%))"></span>`;
const ago = (t) => { const s = Math.max(1, nowS() - t); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };
const bot = (i) => { const n = BOTS[i % BOTS.length]; return { n, a: n }; };
const pick = (key, i) => { const au = REG.get(key)?.authors?.() || []; if (au.length) { const x = au[i % au.length]; return { n: x.n, a: x.a }; } return bot(i); };
function seed(key) {
  let m = load(key); if (m) return m;
  const L = LINES[lang()], t0 = nowS(); m = [];
  for (let i = 0; i < 6; i++) { const b = pick(key, Math.floor(Math.random() * 8)); m.push({ id: "s" + i + Math.random().toString(36).slice(2, 6), n: b.n, a: b.a, t: L[Math.floor(Math.random() * L.length)], ts: t0 - (6 - i) * 260 - Math.floor(Math.random() * 120), r: i % 2 ? { "🔥": 1 + Math.floor(Math.random() * 4) } : {} }); }
  const px = REG.get(key)?.price?.(); if (px && m.length > 4) { const mk = (i, x, h, f, r, tx) => { if (m[i]) { m[i].call = { x, h, p0: px * f, ...(r ? { res: r } : {}) }; m[i].t = tx; m[i].ts -= 3600; } }; mk(1, 1.5, 7200, 0.55, "hit", "esto se va a 1.5x"); mk(2, 5, 3600, 0.9, "miss", "5x en una hora, confíen"); mk(3, 2, 86400, 0.9, "", "mi meta: 2x hoy"); }
  m.forEach((x, i) => { x.v = 40 + Math.floor(Math.random() * 900); if (i >= 3 && Math.random() < 0.55) { const tg = m.slice(0, i).filter((y) => !y.re); if (tg.length) x.re = tg[Math.floor(Math.random() * tg.length)].id; } });
  save(key, m); return m;
}
const msgHtml = (m, byId, ctx, me) => {
  const rep = m.re && byId[m.re], tag = ctx.tag?.(m) || "", mine = me && m.a && String(m.a).toLowerCase() === String(me.a).toLowerCase();
  const rx = Object.entries(m.r || {}).filter(([, n]) => n > 0).map(([e, n]) => `<button type="button" class="th-rx on" data-thr="${e}" data-id="${m.id}">${e} <b>${n}</b></button>`).join("");
  return `<li class="th-m${mine ? " me" : ""}" data-id="${m.id}">${(ctx.avatar || dAva)(m.a || m.n, 34)}<div class="th-b"><div class="th-h"><b>${esc(m.n)}</b>${tag}<small>${ago(m.ts)}</small></div>${rep ? `<div class="th-q"><i>${esc(rep.n)}</i> ${rep.g && !rep.t ? "GIF" : esc(rep.t.slice(0, 70))}</div>` : ""}${m.g ? `<div class="th-gifw"><img src="${esc(m.g)}" alt="GIF" loading="lazy" referrerpolicy="no-referrer"></div>${m.t ? `<p>${esc(m.t)}</p>` : ""}` : `<p>${esc(m.t)}</p>`}<div class="th-a">${rx}<button type="button" class="th-rx add" data-thr="🔥" data-id="${m.id}" aria-label="React">+🔥</button><button type="button" class="th-re" data-thre="${m.id}">${T("Reply", "Responder")}</button></div></div></li>`;
};
const evHtml = (e) => `<li class="th-e ${e.buy ? "b" : "s"}"><i></i><span><b>${esc(e.n)}</b> ${e.buy ? T("bought", "compró") : T("sold", "vendió")} <em>$${e.usd}</em></span><small>${ago(e.ts)}</small></li>`;
const slug = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const hms = (ts) => { const d = new Date(ts * 1000); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, "0")).join(":"); };
const fmtH = (h) => (h >= 604800 ? Math.round(h / 604800) + " d" : h >= 86400 ? Math.round(h / 3600) + " h" : Math.round(h / 3600) + " h");
export function callHtml(m, st) {
  const c = m.call, res = st?.res || "open", lab = res === "hit" ? T("HIT", "ACERTÓ") : res === "miss" ? T("MISSED", "FALLÓ") : T("LIVE", "EN CURSO");
  return `<div class="xp-call ${res}"><div class="xc-r"><span class="xc-k">${T("CALL", "LLAMADA")}</span><b>${c.x}x</b><span class="xc-h">${fmtH(c.h)}</span><em class="xc-s">${lab}</em></div><div class="xc-b"><u style="width:${Math.min(100, Math.max(2, st?.pct || 0)).toFixed(0)}%"></u></div><div class="xc-f"><small>${T("Entry", "Entrada")} ${st?.p0 || ""}</small><small>${res === "open" ? `${st?.left || ""} ${T("left", "restante")}` : res === "hit" ? T("target reached", "meta cumplida") : T("time ran out", "se acabó el plazo")}</small></div></div>`;
}
const IC = { re: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg>', lk: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.8l8.8-8.8a5.2 5.2 0 0 0 0-7.4z"/></svg>', sh: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>', ey: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>' };
function xpHtml(key, m, ctx, me, kids, isReply, i) {
  const tag = ctx.tag?.(m) || "", mine = me && m.a && String(m.a).toLowerCase() === String(me.a).toLowerCase(), fol = !!ctx.isFol?.(m.a);
  const likes = (m.r && m.r["♥"]) || 0; let liked = false; try { liked = localStorage.getItem("hf-thmy-" + key + m.id + "♥") === "1"; } catch {}
  const others = Object.entries(m.r || {}).filter(([e, n]) => e !== "♥" && n > 0).map(([e, n]) => `<button type="button" class="th-rx on" data-thr="${e}" data-id="${m.id}">${e} <b>${n}</b></button>`).join("");
  const body = m.g ? `<div class="th-gifw"><img src="${esc(m.g)}" alt="GIF" loading="lazy" referrerpolicy="no-referrer"></div>${m.t ? `<p>${esc(m.t)}</p>` : ""}` : `<p>${esc(m.t)}</p>`;
  return `<article class="xp${isReply ? " rp" : ""}${mine ? " me" : ""}" data-id="${m.id}" style="--i:${i || 0}"><div class="xp-l"><span class="xp-av">${(ctx.avatar || dAva)(m.a || m.n, isReply ? 30 : 42)}${!mine && !isReply && m.a && ctx.toggleFol ? `<button type="button" class="xp-fb${fol ? " on" : ""}" data-xpf="${esc(m.a)}" aria-label="${fol ? T("Following", "Siguiendo") : T("Follow", "Seguir")}">${fol ? "✓" : "+"}</button>` : ""}</span>${kids ? '<i class="xp-line"></i>' : ""}</div>
    <div class="xp-r"><div class="xp-h"><span class="xp-n"><b>${esc(m.n)}</b>${ctx.rank?.(m) || ""}${tag}</span></div><div class="xp-m"><span class="xp-hd">@${slug(m.n)}</span><span class="xp-t">${hms(m.ts)}</span></div>
    ${body}${m.call ? callHtml(m, ctx.callState?.(m)) : ""}${(!isReply && m.pos && ctx.card?.(m)) || ""}${others ? `<div class="xp-o">${others}</div>` : ""}
    <div class="xp-a"><button type="button" data-thre="${m.id}" aria-label="${T("Reply", "Responder")}">${IC.re}<b>${kids ? kids.n : ""}</b></button><button type="button" data-xl="${m.id}" class="${liked ? "on" : ""}" aria-label="Like">${IC.lk}<b>${likes || ""}</b></button><button type="button" data-xs="${m.id}" aria-label="${T("Share", "Compartir")}">${IC.sh}</button>${m.v ? `<span class="xp-v">${IC.ey}${m.v}</span>` : ""}</div>${kids ? kids.h : ""}</div></article>`;
}
function xListHtml(key, ctx, msgs, me) {
  const tops = msgs.filter((m) => !m.re || !msgs.some((y) => y.id === m.re)).sort((a, b) => b.ts - a.ts).slice(0, 40);
  if (!tops.length) return `<p class="th-empty">${T("Be the first to post.", "Sé el primero en publicar.")}</p>`;
  return `<div class="xp-l-wrap">${tops.map((m, i) => { const ks = msgs.filter((y) => y.re === m.id).sort((a, b) => a.ts - b.ts); const kids = ks.length ? { n: ks.length, h: `<div class="xp-kids">${ks.map((k) => xpHtml(key, k, ctx, me, null, true, 0)).join("")}</div>` } : null; return xpHtml(key, m, ctx, me, kids, false, i); }).join("")}</div>`;
}
function listHtml(key) {
  const ctx = REG.get(key), msgs = load(key) || [], me = ctx.me?.(), byId = Object.fromEntries(msgs.map((m) => [m.id, m]));
  if (ctx.x) { const out = xListHtml(key, ctx, msgs, me); if (msgs.some((x) => x._d)) { msgs.forEach((x) => delete x._d); save(key, msgs); } return out; }
  const items = msgs.map((m) => ({ ts: m.ts, h: msgHtml(m, byId, ctx, me) })).concat((ctx.events?.() || []).map((e) => ({ ts: e.ts, h: evHtml(e) }))).sort((a, b) => b.ts - a.ts).slice(0, 60);
  return items.length ? `<ul class="th-l">${items.map((x) => x.h).join("")}</ul>` : `<p class="th-empty">${T("Be the first to write.", "Sé el primero en escribir.")}</p>`;
}
function ensureCalls(key) {
  const px = REG.get(key)?.price?.(); if (!DEMO || !px) return; const m = load(key) || []; if (m.length < 5 || m.some((x) => x.call)) return;
  const mk = (i, x, h, f, r, tx) => { if (m[i]) { m[i].call = { x, h, p0: px * f, ...(r ? { res: r } : {}) }; m[i].t = tx; m[i].ts -= 3600; } };
  mk(1, 1.5, 7200, 0.55, "hit", "esto se va a 1.5x"); mk(2, 5, 3600, 0.9, "miss", "5x en una hora, confíen"); mk(3, 2, 86400, 0.9, "", "mi meta: 2x hoy"); if (m[0]) m[0].pos = true; if (m[4]) m[4].pos = true; save(key, m);
}
export function threadHtml(key, ctx) {
  REG.set(key, ctx); if (DEMO || ctx.seed) seed(key); ensureCalls(key);
  const me = ctx.me?.(), n = (load(key) || []).length;
  const lockH = `<a class="th-lock" href="${ctx.lockHref || "#/"}"><b>${T("Only holders can post", "Solo los holders pueden publicar")}</b><small>${T("Buy", "Compra")} ${esc(ctx.sym || "")} ${T("to join the conversation. Everyone can read and react.", "para entrar a la conversación. Todos pueden leer y reaccionar.")}</small></a>`;
  const fabI = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>', locked = me && ctx.canPost && !ctx.canPost();
  const fab = !ctx.x || !me ? "" : locked ? `<a class="th-fab" href="${ctx.lockHref || "#/"}">${fabI}<span>${T("Post", "Publicar")}</span></a>` : `<button type="button" class="th-fab" data-thfab>${fabI}<span>${T("Post", "Publicar")}</span></button><i class="th-bd" data-thx></i>`;
  const comp = locked ? (ctx.x ? "" : lockH) : me ? `<form class="th-f" data-thf>${ctx.x ? `<div class="th-hd"><b>${T("New post", "Nueva publicación")}</b><button type="button" data-thx aria-label="${T("Close", "Cerrar")}">✕</button></div>` : ""}<div class="th-rp" hidden></div>${ctx.x ? '<div class="th-cmd" hidden></div>' : ""}<div class="th-row">${(ctx.avatar || dAva)(me.a, 34)}${ctx.x ? '<span class="th-pr">&gt;</span>' : ""}<textarea rows="1" maxlength="200" placeholder="${ctx.x ? T("Write, or type / for commands", "Escribe o usa / para comandos") : T("Write something…", "Escribe algo…")}" aria-label="${T("Message", "Mensaje")}"></textarea><button class="th-s" type="submit" aria-label="${T("Send", "Enviar")}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>${ctx.x ? '<div class="th-cc" hidden></div><div class="th-er" hidden></div>' : ""}<div class="th-em">${ctx.x ? `<button type="button" class="th-sl" data-thsl aria-label="${T("Commands", "Comandos")}">/</button>` : ""}<button type="button" class="th-gif" data-thg>GIF</button>${EMOJI.map((e) => `<button type="button" data-the="${e}">${e}</button>`).join("")}<span class="th-c">0/200</span></div><div class="th-gp" hidden><label class="th-up"><input type="file" accept="image/gif,image/webp,image/png,image/jpeg" data-thgf>${T("Upload from your gallery", "Subir desde tu galería")}<small>${T("Up to 350 KB", "Hasta 350 KB")}</small></label><div class="th-ln"><input type="url" placeholder="${T("Or paste a GIF link (https)", "O pega el enlace de un GIF (https)")}" data-thgu><button type="button" data-thgl>${T("Add", "Añadir")}</button></div></div></form>`
    : `<button type="button" class="th-con" data-thc>${T("Connect your wallet to join the thread", "Conecta tu wallet para escribir en el hilo")}</button>`;
  return `<div class="th${ctx.x ? " th-x th-in" : ""}" data-th="${esc(key)}"><div class="th-top"><b>${ctx.x ? T("Posts", "Publicaciones") : T("Thread", "Hilo")}</b><small>${n} ${T("messages", "mensajes")}</small></div>${comp}<div class="th-list">${listHtml(key)}</div>${fab}</div>`;
}
const refresh = (root) => { const key = root.dataset.th; if (!REG.has(key)) return; setTimeout(() => root.classList.remove("th-in"), 900); root.querySelector(".th-list").innerHTML = listHtml(key); const s = root.querySelector(".th-top small"); if (s) s.textContent = `${(load(key) || []).length} ${T("messages", "mensajes")}`; };

const CMDS = () => [
  { c: "/call", a: "/call 2x 24h ", d: T("Make a call: target and deadline", "Haz una llamada: meta y plazo"), s: "/call 2x 24h" },
  { c: "/pos", a: "/pos ", d: T("Show my position as proof", "Muestra mi posición como prueba"), s: "proof" },
  { c: "/pnl", a: "/pnl ", d: T("Share my profit", "Comparte mi ganancia"), s: "pnl" },
  { c: "/entry", a: "/entry ", d: T("Share my entry price", "Comparte mi precio de entrada"), s: "entry" },
  { c: "/alert", a: "/alert ", d: T("Price alert, e.g. /alert 0.002", "Alerta de precio, ej. /alert 0.002"), s: "/alert 0.002" },
  { c: "/gif", a: "/gif", d: T("Add a GIF", "Agrega un GIF"), s: "gif" },
];
function cmdUpdate(root, ta) {
  const box = root.querySelector(".th-cmd"), cc = root.querySelector(".th-cc"), er = root.querySelector(".th-er"); if (!box) return; if (er) er.hidden = true;
  const v = ta.value;
  if (v.startsWith("/") && !/\s/.test(v)) { const l = CMDS().filter((c) => c.c.startsWith(v.toLowerCase())); box.hidden = !l.length; box.innerHTML = l.map((c) => `<button type="button" data-cmd="${c.c}"><b>${c.c}</b><span>${c.d}</span><kbd>${c.s}</kbd></button>`).join(""); } else box.hidden = true;
  const mc = v.match(/^\/call\b\s*(?:(\d+(?:\.\d+)?)x)?\s*(?:(\d+[hd]))?/i);
  if (mc) { const cx = mc[1] ? mc[1] + "x" : "", ch = (mc[2] || "").toLowerCase();
    cc.hidden = false; cc.innerHTML = `<div>${["1.5x", "2x", "5x", "10x"].map((x) => `<button type="button" data-qx="${x}" class="${cx === x ? "on" : ""}">${x}</button>`).join("")}</div><div>${["1h", "24h", "7d"].map((x) => `<button type="button" data-qh="${x}" class="${ch === x ? "on" : ""}">${x}</button>`).join("")}</div>`; } else if (cc) cc.hidden = true;
}
function cmdPick(root, patch) {
  const ta = root.querySelector("textarea"), m = ta.value.match(/^\/call\s*(?:(\d+(?:\.\d+)?)x)?\s*(?:(\d+[hd]))?\s*([\s\S]*)$/i); const cur = { x: m && m[1] ? m[1] + "x" : "2x", h: m && m[2] ? m[2].toLowerCase() : "24h", rest: m ? m[3] : "" };
  const n = { ...cur, ...patch }; ta.value = `/call ${n.x} ${n.h} ${n.rest}`; ta.focus(); ta.dispatchEvent(new Event("input", { bubbles: true }));
}
function postGif(root, src) {
  const key = root.dataset.th, ctx = REG.get(key), me = ctx.me?.(); if (!me || !gifOk(src)) return false;
  const ta = root.querySelector("textarea"), cap = (ta?.value || "").trim().slice(0, 200), m = load(key) || [];
  m.push({ id: "m" + nowS() + Math.random().toString(36).slice(2, 6), n: me.n, a: me.a, t: cap, g: src, ts: nowS(), r: {}, re: root.dataset.re || undefined }); save(key, m);
  if (ta) { ta.value = ""; ta.style.height = ""; } root.classList.remove("cmp"); root.dataset.re = ""; const rp = root.querySelector(".th-rp"); if (rp) rp.hidden = true; const gp = root.querySelector(".th-gp"); if (gp) gp.hidden = true; refresh(root); return true;
}
function post(root, text) {
  const key = root.dataset.th, ctx = REG.get(key), me = ctx.me?.(); if (!me) return false; const er = root.querySelector(".th-er");
  const say = (msg, ok) => { if (er) { er.textContent = msg; er.hidden = false; er.classList.toggle("ok", !!ok); } return !!ok; };
  let txt = text.trim(), call, pos; const m0 = txt.match(/^\/(\w+)\s*([\s\S]*)$/);
  if (m0) { const c = m0[1].toLowerCase(), rest = m0[2].trim();
    if (c === "call") { const mm = rest.match(/^(\d+(?:\.\d+)?)x\s+(\d+)(h|d)\b\s*([\s\S]*)$/i); if (!mm) return say(T("Use: /call 2x 24h your message", "Usa: /call 2x 24h tu mensaje"));
      const x = Number(mm[1]), h = Number(mm[2]) * (mm[3].toLowerCase() === "d" ? 86400 : 3600); if (!(x > 1 && x <= 100 && h >= 3600 && h <= 30 * 86400)) return say(T("Target from 1.1x to 100x, time from 1 h to 30 d", "Meta de 1.1x a 100x y plazo de 1 h a 30 d"));
      if (!ctx.price) return false; call = { x, h, p0: ctx.price() }; txt = mm[4].trim() || `${x}x · ${fmtH(h)}`; }
    else if (c === "pos" || c === "pnl" || c === "entry") { const st = ctx.myStats?.(); if (!st) return say(T("You have no position in this token yet.", "Todavía no tienes posición en este token.")); pos = true;
      txt = c === "pos" ? (rest || T("My position", "Mi posición")) : c === "pnl" ? `${rest ? rest + " · " : ""}${T("Profit", "Ganancia")} ${st.pnl} (${st.pct})` : `${rest ? rest + " · " : ""}${T("Entry", "Entrada")} ${st.avg}`; }
    else if (c === "alert") { const v = parseFloat(rest.replace("$", "")); if (!(v > 0)) return say(T("Use: /alert 0.002", "Usa: /alert 0.002")); ctx.setAlert?.(v); return say(T("Price alert set at $", "Alerta de precio en $") + v, true); }
    else if (c === "gif") { root.querySelector(".th-gp")?.removeAttribute("hidden"); return true; }
    else return say(T("Unknown command. Type / to see them.", "Comando desconocido. Escribe / para verlos.")); }
  if (!txt) return false;
  const m = load(key) || []; m.push({ id: "m" + nowS() + Math.random().toString(36).slice(2, 6), n: me.n, a: me.a, t: txt.slice(0, 200), ts: nowS(), r: {}, re: root.dataset.re || undefined, call, pos }); save(key, m);
  root.dataset.re = ""; const rp = root.querySelector(".th-rp"); if (rp) rp.hidden = true; const bx = root.querySelector(".th-cmd"); if (bx) bx.hidden = true; const cc = root.querySelector(".th-cc"); if (cc) cc.hidden = true; if (er) er.hidden = true; refresh(root); return true;
}
function reactTo(root, id, emoji) {
  const key = root.dataset.th, m = load(key) || [], x = m.find((y) => y.id === id); if (!x) return; const mk = "hf-thmy-" + key + x.id + emoji; let had = false; try { had = localStorage.getItem(mk) === "1"; } catch {}
  x.r = x.r || {}; x.r[emoji] = Math.max(0, (x.r[emoji] || 0) + (had ? -1 : 1)); try { had ? localStorage.removeItem(mk) : localStorage.setItem(mk, "1"); } catch {} save(key, m); refresh(root);
}
function replyTo(root, id) {
  const key = root.dataset.th, x = (load(key) || []).find((y) => y.id === id); if (!x) return; root.dataset.re = x.re || x.id; const rp = root.querySelector(".th-rp");
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
  document.addEventListener("submit", (e) => { const f = e.target.closest("[data-thf]"); if (!f) return; e.preventDefault(); const root = f.closest(".th"), ta = f.querySelector("textarea"); if (post(root, ta.value)) { ta.value = ""; ta.style.height = ""; f.querySelector(".th-c").textContent = "0/200"; } });
  document.addEventListener("change", (e) => { const fi = e.target.closest("[data-thgf]"); if (!fi) return; const f = fi.files[0]; fi.value = ""; if (!f) return; const root = fi.closest(".th");
    if (f.size > MAXGIF) { alert(T("That GIF is over 350 KB. Pick a lighter one or paste a link.", "Ese GIF pesa más de 350 KB. Elige uno más liviano o pega un enlace.")); return; }
    const rd = new FileReader(); rd.onload = () => postGif(root, String(rd.result)); rd.readAsDataURL(f); });
  document.addEventListener("input", (e) => { const ta = e.target.closest(".th-f textarea"); if (!ta) return; cmdUpdate(ta.closest(".th"), ta); ta.style.height = "auto"; ta.style.height = Math.min(110, ta.scrollHeight) + "px"; ta.closest(".th-f").querySelector(".th-c").textContent = ta.value.length + "/200"; });
  document.addEventListener("keydown", (e) => { const ta = e.target.closest?.(".th-f textarea"); if (ta && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const bx = ta.closest("form").querySelector(".th-cmd"); if (bx && !bx.hidden && /^\/\w*$/.test(ta.value.trim())) { bx.querySelector("[data-cmd]")?.click(); return; } ta.closest("form").requestSubmit(); } });
  document.addEventListener("click", (e) => {
    const root = e.target.closest(".th"); if (!root) return;
    if (e.target.closest("[data-thfab]")) { root.classList.add("cmp"); setTimeout(() => root.querySelector(".th-f textarea")?.focus(), 80); return; }
    if (e.target.closest("[data-thx]")) { root.classList.remove("cmp"); return; }
    const xl = e.target.closest("[data-xl]"); if (xl) { reactTo(root, xl.dataset.xl, "♥"); return; }
    const xf = e.target.closest("[data-xpf]"); if (xf) { REG.get(root.dataset.th)?.toggleFol?.(xf.dataset.xpf); refresh(root); return; }
    if (e.target.closest("[data-xs]")) { try { navigator.clipboard?.writeText(location.href); } catch {} return; }
    const cm = e.target.closest("[data-cmd]"); if (cm) { const c = CMDS().find((x) => x.c === cm.dataset.cmd), ta = root.querySelector("textarea"); if (c.c === "/gif") { ta.value = ""; root.querySelector(".th-gp").hidden = false; root.querySelector(".th-cmd").hidden = true; } else { ta.value = c.a; ta.focus(); ta.dispatchEvent(new Event("input", { bubbles: true })); } return; }
    const qx = e.target.closest("[data-qx]"); if (qx) { cmdPick(root, { x: qx.dataset.qx }); return; }
    const qh = e.target.closest("[data-qh]"); if (qh) { cmdPick(root, { h: qh.dataset.qh }); return; }
    if (e.target.closest("[data-thsl]")) { const ta = root.querySelector("textarea"); if (!ta.value.startsWith("/")) ta.value = "/" + ta.value.replace(/^\//, ""); ta.focus(); ta.dispatchEvent(new Event("input", { bubbles: true })); return; }
    if (e.target.closest("[data-thg]")) { const gp = root.querySelector(".th-gp"); gp.hidden = !gp.hidden; return; }
    if (e.target.closest("[data-thgl]")) { const u = root.querySelector("[data-thgu]"); if (!postGif(root, u.value.trim())) u.setCustomValidity?.("https"); u.value = ""; return; }
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
    const li = e.target.closest(".th-m, .xp:not(.rp)"); if (!li || e.target.closest("button, a, textarea")) return; sx = e.clientX; sy = e.clientY; stop(); lp = setTimeout(() => { lp = null; li.dataset.lp = "1"; openMenu(li); }, 420);
  });
  document.addEventListener("pointermove", (e) => { if (lp && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) stop(); });
  document.addEventListener("pointerup", (e) => { stop(); const li = e.target.closest(".th-m, .xp:not(.rp)"); if (!li || e.target.closest("button, a") || li.dataset.lp) { if (li) delete li.dataset.lp; return; }
    const n = Date.now(); if (lastTap.id === li.dataset.id && n - lastTap.t < 320) { reactTo(li.closest(".th"), li.dataset.id, "🔥"); lastTap = { id: "", t: 0 }; } else lastTap = { id: li.dataset.id, t: n }; });
  document.addEventListener("pointercancel", stop); document.addEventListener("scroll", () => { stop(); }, true);
  document.addEventListener("contextmenu", (e) => { const li = e.target.closest(".th-m, .xp:not(.rp)"); if (li) { e.preventDefault(); stop(); openMenu(li); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  // en modo demo la conversación sigue viva
  setInterval(() => { if (!DEMO) return; document.querySelectorAll(".th").forEach((root) => { const key = root.dataset.th; if (!REG.has(key) || !root.isConnected || MENU || Math.random() > 0.45) return; const L = LINES[lang()], b = pick(key, Math.floor(Math.random() * 8)), m = load(key) || [], me = REG.get(key).me?.(); m.push({ id: "b" + nowS() + Math.random().toString(36).slice(2, 5), n: b.n, a: b.a, t: L[Math.floor(Math.random() * L.length)], ts: nowS(), r: {} }); save(key, m); if (!root.querySelector("textarea:focus")) refresh(root); }); }, 7000);
  setInterval(() => document.querySelectorAll(".th").forEach((r) => { if (REG.has(r.dataset.th) && !MENU && !r.querySelector("textarea:focus")) refresh(r); }), 15000);
}

export function threadPreview(key) {
  if (DEMO) seed(key);
  const m = (load(key) || []).filter((x) => x.t && !x.g && !String(x.t).startsWith("[")); const x = m[m.length - 1];
  const who = []; for (let k = m.length - 1; k >= 0 && who.length < 3; k--) if (!who.includes(m[k].a || m[k].n)) who.push(m[k].a || m[k].n);
  return x ? { n: x.n, t: x.t, ts: x.ts, c: m.length, who } : null;
}
