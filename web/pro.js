// Gráfico de trading "pro" (SVG puro, sin librerías): velas rosa (sube) / violeta (baja), volumen, promedios MA7/MA25,
// cruz con precio exacto, dibujar líneas de tendencia, vista línea/velas y pantalla completa.
const UP = "#ff2e88", DN = "#a855f7";
const fmt = (x) => (x >= 0.01 ? x.toLocaleString("en-US", { maximumFractionDigits: 4 }) : x.toPrecision(3));
const ma = (cs, n) => cs.map((_, i) => (i + 1 < n ? null : cs.slice(i + 1 - n, i + 1).reduce((a, c) => a + c.c, 0) / n));

export function mountChart(el, { id, getData, periods, period, onPeriod, labels = {}, fsTarget }) {
  const L = { candles: "Candles", line: "Line", ma: "MA", draw: "Draw", clear: "Clear", full: "Full screen", exit: "Exit", vol: "Vol", ...labels };
  const key = `hf-lines-${id}`;
  let lines = []; try { lines = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
  const st = { mode: "candle", ma: true, draw: false, pending: null, hover: null, period };
  el.classList.add("cp");
  el.innerHTML = `<div class="cp-bar">
      <div class="cp-per" role="tablist">${periods.map((k) => `<button type="button" data-per="${k}" aria-selected="${k === period}">${k}</button>`).join("")}</div>
      <div class="cp-tools">
        <button type="button" data-t="mode" title="${L.line}">${L.candles}</button>
        <button type="button" data-t="ma" aria-pressed="true">${L.ma}</button>
        <button type="button" data-t="draw" aria-pressed="false" title="${L.draw}">✎ ${L.draw}</button>
        <button type="button" data-t="clear" title="${L.clear}">⌫</button>
        <button type="button" data-t="full" title="${L.full}" class="cp-full">⛶</button>
      </div></div>
    <div class="cp-info" aria-live="polite"></div>
    <div class="cp-svg"></div>`;
  const box = el.querySelector(".cp-svg"), info = el.querySelector(".cp-info");
  const save = () => { try { localStorage.setItem(key, JSON.stringify(lines)); } catch {} };

  function render() {
    const d = getData(st.period), cs = d.candles; if (!cs.length) { box.innerHTML = ""; return; }
    const W = Math.max(300, box.clientWidth || el.clientWidth || 600), H = Math.max(240, box.clientHeight || 380);
    const AX = 66, BX = 22, VH = Math.round(H * 0.17), PH = H - BX - VH - 6, cw = (W - AX) / cs.length;
    const hi = Math.max(...cs.map((c) => c.h), d.round) * 1.02, lo = Math.min(...cs.map((c) => c.l), d.round) * 0.98;
    const T = 12, y = (v) => T + (PH - T) * (1 - (v - lo) / (hi - lo || 1)), inv = (py) => lo + (1 - (py - T) / (PH - T)) * (hi - lo), xc = (i) => i * cw + cw / 2;
    const vmax = Math.max(...cs.map((c) => c.v), 1e-9);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => lo + (hi - lo) * k);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="cp-chart" role="img" aria-label="Price chart">
      <defs><linearGradient id="cpA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${UP}" stop-opacity=".28"/><stop offset="1" stop-color="${UP}" stop-opacity="0"/></linearGradient>
        <filter id="cpG" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    s += ticks.map((t) => `<line x1="0" x2="${W - AX}" y1="${y(t)}" y2="${y(t)}" class="cp-grid"/><text x="${W - AX + 8}" y="${y(t) + 4}" class="cp-ax">${fmt(t)}</text>`).join("");
    const every = Math.max(1, Math.round(cs.length / 6));
    s += cs.map((c, i) => (i % every === 0 ? `<line x1="${xc(i)}" x2="${xc(i)}" y1="0" y2="${PH}" class="cp-grid v"/><text x="${xc(i)}" y="${H - 6}" class="cp-ax t">${tlabel(c.t, st.period)}</text>` : "")).join("");
    // volumen
    s += cs.map((c, i) => c.v ? `<rect x="${i * cw + cw * 0.18}" y="${H - BX - (c.v / vmax) * VH}" width="${cw * 0.64}" height="${(c.v / vmax) * VH}" fill="${c.c >= c.o ? UP : DN}" opacity=".35"/>` : "").join("");
    // precio de la ronda
    s += `<line x1="0" x2="${W - AX}" y1="${y(d.round)}" y2="${y(d.round)}" class="cp-round"/>`;
    if (st.mode === "line") {
      const pts = cs.map((c, i) => `${i ? "L" : "M"}${xc(i).toFixed(1)} ${y(c.c).toFixed(1)}`).join(" ");
      s += `<path d="${pts} L${xc(cs.length - 1)} ${PH} L${xc(0)} ${PH}Z" fill="url(#cpA)"/><path d="${pts}" class="cp-line" filter="url(#cpG)"/>`;
    } else {
      s += cs.map((c, i) => { const up = c.c >= c.o, col = up ? UP : DN, top = y(Math.max(c.o, c.c)), bh = Math.max(1.5, Math.abs(y(c.o) - y(c.c)));
        return `<line x1="${xc(i)}" x2="${xc(i)}" y1="${y(c.h)}" y2="${y(c.l)}" stroke="${col}" stroke-width="1.2"/><rect x="${xc(i) - cw * 0.33}" y="${top}" width="${cw * 0.66}" height="${bh}" fill="${col}" rx="1" ${up ? 'filter="url(#cpG)"' : ""}/>`; }).join("");
    }
    if (st.ma) for (const [n, cls] of [[7, "m7"], [25, "m25"]]) { const m = ma(cs, n), pts = m.map((v, i) => (v == null ? "" : `${m[i - 1] == null ? "M" : "L"}${xc(i).toFixed(1)} ${y(v).toFixed(1)}`)).join(" "); if (pts.trim()) s += `<path d="${pts}" class="cp-ma ${cls}"/>`; }
    // líneas dibujadas (en coordenadas de vela y precio)
    s += lines.map((l) => `<line x1="${xc(l[0])}" y1="${y(l[1])}" x2="${xc(l[2])}" y2="${y(l[3])}" class="cp-draw"/><circle cx="${xc(l[0])}" cy="${y(l[1])}" r="3" class="cp-dot"/><circle cx="${xc(l[2])}" cy="${y(l[3])}" r="3" class="cp-dot"/>`).join("");
    if (st.pending) s += `<circle cx="${xc(st.pending[0])}" cy="${y(st.pending[1])}" r="4" class="cp-dot on"/>`;
    // precio actual
    const last = cs[cs.length - 1], lup = last.c >= (cs[cs.length - 2]?.c ?? last.o);
    s += `<line x1="0" x2="${W - AX}" y1="${y(last.c)}" y2="${y(last.c)}" class="cp-now" stroke="${lup ? UP : DN}"/><rect x="${W - AX + 2}" y="${y(last.c) - 10}" width="${AX - 4}" height="20" rx="4" fill="${lup ? UP : DN}"/><text x="${W - AX + 8}" y="${y(last.c) + 4}" class="cp-tag">${fmt(last.c)}</text>`;
    // cruz
    if (st.hover) { const { i, py } = st.hover, c = cs[i];
      if (c) s += `<line x1="${xc(i)}" x2="${xc(i)}" y1="0" y2="${H - BX}" class="cp-x"/><line x1="0" x2="${W - AX}" y1="${py}" y2="${py}" class="cp-x"/><rect x="${W - AX + 2}" y="${py - 10}" width="${AX - 4}" height="20" rx="4" class="cp-xtag"/><text x="${W - AX + 8}" y="${py + 4}" class="cp-tag">${fmt(inv(py))}</text>`; }
    s += `<rect x="0" y="0" width="${W - AX}" height="${H - BX}" fill="transparent" class="cp-hit" style="cursor:${st.draw ? "crosshair" : "default"}"/></svg>`;
    box.innerHTML = s;
    const c = cs[st.hover?.i ?? cs.length - 1], chg = c.o ? ((c.c - c.o) / c.o) * 100 : 0;
    info.innerHTML = `<span>O <b>${fmt(c.o)}</b></span><span>H <b>${fmt(c.h)}</b></span><span>L <b>${fmt(c.l)}</b></span><span>C <b class="${c.c >= c.o ? "u" : "d"}">${fmt(c.c)}</b></span><span class="${chg >= 0 ? "u" : "d"}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</span><span>${L.vol} <b>$${c.v.toLocaleString("en-US", { maximumFractionDigits: 0 })}</b></span>${st.ma ? `<span class="m7">MA7</span><span class="m25">MA25</span>` : ""}${st.draw ? `<span class="cp-hint">${st.pending ? "2/2" : "1/2"} ✎</span>` : ""}`;
    const hit = box.querySelector(".cp-hit");
    const at = (e) => { const r = box.querySelector("svg").getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H; return { i: Math.max(0, Math.min(cs.length - 1, Math.floor(px / cw))), fi: px / cw - 0.5, py: Math.max(0, Math.min(PH, py)) }; };
    hit.onpointermove = (e) => { const a = at(e); if (!st.hover || st.hover.i !== a.i || Math.abs(st.hover.py - a.py) > 2) { st.hover = a; render(); } };
    hit.onpointerleave = () => { st.hover = null; render(); };
    hit.onpointerdown = (e) => { if (!st.draw) return; const a = at(e), pt = [a.fi, inv(a.py)];
      if (!st.pending) st.pending = pt; else { lines.push([...st.pending, ...pt]); st.pending = null; save(); }
      render(); };
  }
  function tlabel(t, per) { if (!t) return ""; const d = new Date(t * 1000);
    return per === "1D" || per === "1W" || per === "All" ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }); }
  el.querySelector(".cp-bar").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.per) { st.period = b.dataset.per; el.querySelectorAll("[data-per]").forEach((x) => x.setAttribute("aria-selected", x === b)); onPeriod?.(st.period); render(); return; }
    const t = b.dataset.t;
    if (t === "mode") { st.mode = st.mode === "candle" ? "line" : "candle"; b.textContent = st.mode === "candle" ? L.candles : L.line; }
    if (t === "ma") { st.ma = !st.ma; b.setAttribute("aria-pressed", st.ma); }
    if (t === "draw") { st.draw = !st.draw; st.pending = null; b.setAttribute("aria-pressed", st.draw); }
    if (t === "clear") { lines = []; st.pending = null; save(); }
    if (t === "full") { const tg = fsTarget || el, cls = fsTarget ? "t-fs" : "cp-fs", on = !tg.classList.contains(cls); tg.classList.toggle(cls, on); document.body.classList.toggle("cp-lock", on); b.textContent = on ? "✕" : "⛶"; b.title = on ? L.exit : L.full;
      try { if (on && tg.requestFullscreen) tg.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen(); } catch {} }
    render();
  };
  const onFs = () => { const tg = fsTarget || el, cls = fsTarget ? "t-fs" : "cp-fs"; if (!document.fullscreenElement && tg.classList.contains(cls)) { tg.classList.remove(cls); document.body.classList.remove("cp-lock"); const b = el.querySelector(".cp-full"); b.textContent = "⛶"; } setTimeout(render, 50); };
  document.addEventListener("fullscreenchange", onFs);
  const ro = new ResizeObserver(() => render()); ro.observe(box);
  render();
  return { update: render, destroy: () => { ro.disconnect(); document.removeEventListener("fullscreenchange", onFs); document.body.classList.remove("cp-lock"); } };
}
