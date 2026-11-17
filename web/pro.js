// Gráfico de trading con TradingView Lightweight Charts (librería oficial, gratis y abierta).
// Velas rosa (sube) / violeta (baja), volumen, promedios MA7/MA25, cruz, línea horizontal, marcas de tus operaciones,
// cambio Precio <-> Valor total, vista Velas/Línea y pantalla completa.
import { createChart, CrosshairMode } from "https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.mjs";

const UP = "#3ddc97", DN = "#ff5d5d";
const fmtN = (x, cap) => {
  if (cap && x >= 1000) return x >= 1e9 ? (x / 1e9).toFixed(2) + "B" : x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : (x / 1e3).toFixed(1) + "K";
  return x >= 0.01 ? x.toLocaleString("en-US", { maximumFractionDigits: 4 }) : x.toPrecision(3);
};
const maOf = (cs, n) => cs.map((c, i) => (i + 1 < n ? null : { time: c.time, value: cs.slice(i + 1 - n, i + 1).reduce((a, k) => a + k.close, 0) / n })).filter(Boolean);

export function mountChart(el, { id, getData, periods, period, onPeriod, labels = {}, fsTarget, onFace, onLine }) {
  const L = { candles: "Candles", line: "Line", ma: "MA", draw: "Line", clear: "Clear", full: "Full screen", exit: "Exit", vol: "Vol", price: "Price", cap: "Market cap", ...labels };
  const key = `hf-hl-${id}`;
  let hl = []; try { hl = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
  const st = { cap: false, mode: "candle", ma: !matchMedia("(max-width: 1000px)").matches, draw: false, period, k: 1, last: null };
  el.classList.add("cp");
  el.innerHTML = `<div class="cp-bar">
      <div class="cp-per" role="tablist">${periods.map((k) => `<button type="button" data-per="${k}" aria-selected="${k === period}">${k}</button>`).join("")}</div>
      <div class="cp-tools">
        <button type="button" data-t="unit" title="Price / Market cap">${L.price}</button>
        <button type="button" data-t="mode">${L.candles}</button>
        <button type="button" data-t="ma" aria-pressed="${st.ma}">${L.ma}</button>
        <button type="button" data-t="draw" aria-pressed="false">${L.draw}</button>
        <button type="button" data-t="clear" title="${L.clear}">⌫</button>
        <button type="button" data-t="full" title="${L.full}" class="cp-full">⛶</button>
      </div></div>
    <div class="cp-info" aria-live="polite"></div>
    <div class="cp-svg"></div>`;
  const box = el.querySelector(".cp-svg"), info = el.querySelector(".cp-info");
  const pf = { type: "custom", minMove: 1e-10, formatter: (p) => fmtN(p, st.cap) };
  const chart = createChart(box, {
    autoSize: true,
    layout: { background: { type: "solid", color: "transparent" }, textColor: "#8d8f95", fontSize: 12, fontFamily: "Inter Tight, system-ui, sans-serif" },
    grid: { vertLines: { color: "rgba(255,255,255,.04)" }, horzLines: { color: "rgba(255,255,255,.05)" } },
    crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "rgba(255,255,255,.35)", style: 3 }, horzLine: { color: "rgba(255,255,255,.35)", style: 3 } },
    rightPriceScale: { borderColor: "rgba(255,255,255,.08)", scaleMargins: { top: 0.08, bottom: 0.25 } },
    timeScale: { borderColor: "rgba(255,255,255,.08)", timeVisible: true, secondsVisible: false, rightOffset: 4 },
    localization: { priceFormatter: (p) => fmtN(p, st.cap) },
  });
  const candle = chart.addCandlestickSeries({ upColor: UP, downColor: DN, borderVisible: false, wickUpColor: UP, wickDownColor: DN, priceFormat: pf });
  const line = chart.addAreaSeries({ lineColor: UP, topColor: "rgba(61,220,151,.22)", bottomColor: "rgba(61,220,151,0)", lineWidth: 2, visible: false, priceFormat: pf });
  const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false });
  chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  const mo = { lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: pf };
  const m7 = chart.addLineSeries({ ...mo, color: "#e9e9ee" }), m25 = chart.addLineSeries({ ...mo, color: "#8d8f95" });
  let roundLine = null, hlRefs = [], first = true, data = [], lnRefs = [], faces = [], lines = [];
  box.style.position = "relative";
  const ov = document.createElement("div"); ov.className = "cp-ov"; box.appendChild(ov);
  candle.applyOptions({ autoscaleInfoProvider: (orig) => { const r = orig(); if (!r || !lines.length) return r; const ks = st.k || 1; lines.forEach((l) => { const v = l.price * ks; r.priceRange.minValue = Math.min(r.priceRange.minValue, v); r.priceRange.maxValue = Math.max(r.priceRange.maxValue, v); }); return r; } });
  function place() {
    if (!data.length) return; const ts = chart.timeScale(), times = data.map((c) => c.time), snap = (t) => { let r = times[0]; for (const x of times) { if (x <= t) r = x; else break; } return r; }, k = st.k;
    const stack = {}; ov.querySelectorAll("[data-fi]").forEach((n) => { const f = faces[Number(n.dataset.fi)], x = ts.timeToCoordinate(snap(f.t)), y = candle.priceToCoordinate(f.price * k);
      if (x == null || y == null) { n.style.display = "none"; return; } const key = Math.round(x / 22) + (f.buy ? "b" : "s"), o = stack[key] || 0; stack[key] = o + 1; n.style.display = ""; n.style.left = x - 15 + "px"; n.style.top = y + (f.buy ? 12 + o * 30 : -42 - o * 30) + "px"; });
    ov.querySelectorAll("[data-li]").forEach((n) => { if (n.dataset.drag === "1" && n.classList.contains("drag")) return; const l = lines[Number(n.dataset.li)], y = candle.priceToCoordinate(l.price * k); if (y == null) { n.style.display = "none"; return; } n.style.display = ""; n.style.top = y - 13 + "px"; });
  }
  function drawOv() {
    ov.innerHTML = faces.map((f, i) => `<button type="button" class="cp-face ${f.buy ? "b" : "s"}" data-fi="${i}" title="${f.name || ""}">${f.html}</button>`).join("") + lines.map((l, i) => `<div class="cp-ln ${l.drag ? "dr" : ""}" data-li="${i}" style="--c:${l.color}">${l.drag ? "<i></i>" : ""}<span>${l.title}</span></div>`).join("");
    place();
  }
  ov.addEventListener("click", (e) => { const b = e.target.closest("[data-fi]"); if (b && onFace) onFace(faces[Number(b.dataset.fi)].who); });
  ov.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".cp-ln.dr"); if (!h) return; e.preventDefault(); const i = Number(h.dataset.li), l = lines[i], rect = box.getBoundingClientRect(); h.classList.add("drag"); h.dataset.drag = "1"; h.setPointerCapture?.(e.pointerId);
    const mv = (ev) => { const y = Math.max(0, Math.min(rect.height - 30, ev.clientY - rect.top)); h.style.top = y - 13 + "px"; const pr = candle.coordinateToPrice(y); if (pr != null) h.querySelector("span").textContent = l.fmt ? l.fmt(pr / st.k) : (pr / st.k).toFixed(8); };
    const up = (ev) => { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.classList.remove("drag"); h.dataset.drag = "0"; const pr = candle.coordinateToPrice(Math.max(0, Math.min(rect.height - 30, ev.clientY - rect.top))); if (pr != null) onLine?.(l.id, pr / st.k); };
    h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up);
  });
  let rq = 0; const sched = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(place); };
  chart.timeScale().subscribeVisibleTimeRangeChange(sched); box.addEventListener("wheel", sched, { passive: true }); box.addEventListener("pointermove", sched, { passive: true });
  new ResizeObserver(sched).observe(box);
  const save = () => { try { localStorage.setItem(key, JSON.stringify(hl)); } catch {} };

  function showInfo(c) {
    if (!c) return;
    const chg = c.open ? ((c.close - c.open) / c.open) * 100 : 0, f = (x) => fmtN(x, st.cap), cls = c.close >= c.open ? "u" : "d";
    info.innerHTML = `<span>O <b>${f(c.open)}</b></span><span>H <b>${f(c.high)}</b></span><span>L <b>${f(c.low)}</b></span><span>C <b class="${cls}">${f(c.close)}</b></span><span class="${cls}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</span>${st.draw ? `<span class="cp-hint">✎</span>` : ""}`;
  }
  function render() {
    const d = getData(st.period); st.k = st.cap && d.supply ? d.supply : 1; const k = st.k;
    data = (d.candles || []).filter((c) => c.t).map((c) => ({ time: c.t, open: c.o * k, high: c.h * k, low: c.l * k, close: c.c * k }));
    if (!data.length) return;
    candle.setData(data); line.setData(data.map((c) => ({ time: c.time, value: c.close })));
    vol.setData((d.candles || []).filter((c) => c.t).map((c) => ({ time: c.t, value: c.v, color: (c.c >= c.o ? UP : DN) + "55" })));
    const ma7 = maOf(data, 7), ma25 = maOf(data, 25); m7.setData(st.ma ? ma7 : []); m25.setData(st.ma ? ma25 : []);
    candle.applyOptions({ visible: st.mode === "candle" }); line.applyOptions({ visible: st.mode === "line" });
    if (roundLine) candle.removePriceLine(roundLine);
    roundLine = d.round ? candle.createPriceLine({ price: d.round * k, color: "rgba(255,255,255,.35)", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" }) : null;
    hlRefs.forEach((r) => candle.removePriceLine(r));
    hlRefs = hl.map((p) => candle.createPriceLine({ price: p * k, color: "#ffd166", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "" }));
    const times = data.map((c) => c.time), snap = (t) => { let r = times[0]; for (const x of times) { if (x <= t) r = x; else break; } return r; };
    const marks = (d.marks || []).map((m) => ({ time: snap(m.t), position: m.buy ? "belowBar" : "aboveBar", color: m.buy ? UP : DN, shape: m.buy ? "arrowUp" : "arrowDown", text: m.buy ? "B" : "S" })).sort((a, b) => a.time - b.time);
    candle.setMarkers(marks);
    faces = d.faces || []; lines = d.lines || []; lnRefs.forEach((r) => candle.removePriceLine(r));
    lnRefs = lines.map((l) => candle.createPriceLine({ price: l.price * k, color: l.color, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" }));
    drawOv();
    st.last = data[data.length - 1]; showInfo(st.last);
    if (first) { chart.timeScale().fitContent(); first = false; }
  }
  chart.subscribeCrosshairMove((p) => { const c = p.seriesData?.get(candle) || p.seriesData?.get(line); showInfo(c ? { open: c.open ?? c.value, high: c.high ?? c.value, low: c.low ?? c.value, close: c.close ?? c.value } : st.last); });
  chart.subscribeClick((p) => { if (!st.draw || !p.point) return; const price = candle.coordinateToPrice(p.point.y); if (price == null) return; hl.push(price / st.k); save(); render(); });

  el.querySelector(".cp-bar").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.per) { st.period = b.dataset.per; first = true; el.querySelectorAll("[data-per]").forEach((x) => x.setAttribute("aria-selected", x === b)); onPeriod?.(st.period); render(); return; }
    const t = b.dataset.t;
    if (t === "unit") { st.cap = !st.cap; b.textContent = st.cap ? L.cap : L.price; }
    if (t === "mode") { st.mode = st.mode === "candle" ? "line" : "candle"; b.textContent = st.mode === "candle" ? L.candles : L.line; }
    if (t === "ma") { st.ma = !st.ma; b.setAttribute("aria-pressed", st.ma); }
    if (t === "draw") { st.draw = !st.draw; b.setAttribute("aria-pressed", st.draw); }
    if (t === "clear") { hl = []; save(); }
    if (t === "full") {
      const tg = fsTarget || el, cls = fsTarget ? "t-fs" : "cp-fs", on = !tg.classList.contains(cls);
      tg.classList.toggle(cls, on); document.body.classList.toggle("cp-lock", on); b.textContent = on ? "✕" : "⛶";
      try { if (on && tg.requestFullscreen) tg.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen(); } catch {}
    }
    render();
  };
  const onFs = () => { const tg = fsTarget || el, cls = fsTarget ? "t-fs" : "cp-fs"; if (!document.fullscreenElement && tg.classList.contains(cls)) { tg.classList.remove(cls); document.body.classList.remove("cp-lock"); el.querySelector(".cp-full").textContent = "⛶"; } };
  document.addEventListener("fullscreenchange", onFs);
  render();
  return { update: render, destroy: () => { document.removeEventListener("fullscreenchange", onFs); document.body.classList.remove("cp-lock"); chart.remove(); } };
}
