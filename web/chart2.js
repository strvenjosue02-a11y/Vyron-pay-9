// Gráfico limpio para celular (KLineChart, sin marcas de terceros). Normal: estático. Pantalla completa: interactivo + herramientas.
const SRC = "https://cdn.jsdelivr.net/npm/klinecharts@9.8.10/dist/umd/klinecharts.min.js";
let lib;
const load = () => (lib ||= window.klinecharts ? Promise.resolve(window.klinecharts) : new Promise((ok, no) => { const s = document.createElement("script"); s.src = SRC; s.onload = () => ok(window.klinecharts); s.onerror = no; document.head.appendChild(s); }));
const UP = "#3ddc97", DN = "#ff5d73", TX = "#6d6d76";
const styles = (area) => ({
  grid: { show: true, horizontal: { show: true, size: 1, color: "rgba(255,255,255,.045)", style: "solid" }, vertical: { show: false } },
  candle: { type: area ? "area" : "candle_solid", bar: { upColor: UP, downColor: DN, upBorderColor: UP, downBorderColor: DN, upWickColor: UP, downWickColor: DN, noChangeColor: "#888", noChangeBorderColor: "#888", noChangeWickColor: "#888" },
    area: { lineSize: 2, lineColor: UP, backgroundColor: [{ offset: 0, color: "rgba(61,220,151,.22)" }, { offset: 1, color: "rgba(61,220,151,0)" }] },
    priceMark: { show: true, high: { show: false }, low: { show: false }, last: { show: true, upColor: UP, downColor: DN, noChangeColor: "#888", line: { show: true, style: "dashed", dashedValue: [3, 4], size: 1 }, text: { show: true, size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 3, family: "Geist Mono, monospace" } } },
    tooltip: { showRule: "none" } },
  indicator: { tooltip: { showRule: "none" }, lastValueMark: { show: false } },
  xAxis: { show: true, axisLine: { show: false }, tickLine: { show: false }, tickText: { color: TX, size: 10, family: "Geist Mono, monospace" } },
  yAxis: { show: true, position: "right", inside: true, axisLine: { show: false }, tickLine: { show: false }, tickText: { color: TX, size: 10, family: "Geist Mono, monospace", marginStart: 6, marginEnd: 6 } },
  separator: { size: 1, color: "rgba(255,255,255,.06)" },
  crosshair: { show: true, horizontal: { show: true, line: { style: "dashed", color: "#555" }, text: { show: true, backgroundColor: "#222", color: "#ddd", size: 10 } }, vertical: { show: true, line: { style: "dashed", color: "#555" }, text: { show: true, backgroundColor: "#222", color: "#ddd", size: 10 } } },
  overlay: { line: { color: "#cfcfd6", size: 1.5 }, point: { color: "#fff", borderColor: "#fff", activeColor: "#fff", activeBorderColor: "#fff" } },
});
const fx = (v) => (v >= 1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(4) : v.toPrecision(3));
export function mountChart2(el, { getData, periods, period, onPeriod, onFace, interactive = false, onFull, es = false }) {
  let chart, per = period, area = false, dead = false, faceOn = true, d = null, raf = 0;
  el.classList.add("cz"); if (!interactive) el.classList.add("cz-st");
  el.innerHTML = `<div class="cz-c"></div><div class="cz-f"></div>${interactive ? "" : `<button type="button" class="cz-x" aria-label="${es ? "Pantalla completa" : "Full screen"}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>`}
  <div class="cz-p">${periods.map((k) => `<button type="button" data-p="${k}" aria-pressed="${k === per}">${k}</button>`).join("")}</div>`;
  const host = el.querySelector(".cz-c"), fl = el.querySelector(".cz-f");
  const place = () => { raf = 0; if (!chart || !d) return; fl.innerHTML = ""; if (!faceOn) return; const w = host.clientWidth, h = host.clientHeight;
    (d.faces || []).forEach((f) => { const ms = f.t * 1000; let c = null; for (const k of d.candles) if (k.t * 1000 <= ms) c = k; if (!c) return; const r = chart.convertToPixel({ timestamp: c.t * 1000, value: f.price }, { paneId: "candle_pane" }); if (!r || r.x == null || r.y == null || r.x < 10 || r.x > w - 10 || r.y < 10 || r.y > h - 30) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "cz-b " + (f.buy ? "b" : "s"); b.style.cssText = `left:${r.x}px;top:${r.y}px`; b.innerHTML = f.html; if (interactive) b.onclick = () => onFace?.(f.who); fl.appendChild(b); }); };
  const sched = () => { if (!raf) raf = requestAnimationFrame(place); };
  const data = () => (d.candles || []).map((c) => ({ timestamp: c.t * 1000, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v }));
  const paint = () => { d = getData(per); if (!chart || !d?.candles?.length) return; chart.applyNewData(data()); chart.setPriceVolumePrecision(fx(d.candles[d.candles.length - 1].c).split(".")[1]?.replace(/e.*/, "").length || 2, 0); sched(); };
  const ready = load().then((k) => { if (dead) return; chart = k.init(host, { styles: styles(false), locale: es ? "es-ES" : "en-US", timezone: "UTC", decimalFoldThreshold: 12 }); chart.setBarSpace?.(interactive ? 9 : 7); chart.setScrollEnabled(interactive); chart.setZoomEnabled(interactive);
    if (!interactive) chart.setStyles({ crosshair: { show: false } }); else chart.subscribeAction("onVisibleRangeChange", sched);
    chart.setOffsetRightDistance?.(36); paint(); new ResizeObserver(() => { chart?.resize(); sched(); }).observe(host); });
  el.querySelectorAll(".cz-p [data-p]").forEach((b) => (b.onclick = () => { per = b.dataset.p; onPeriod?.(per); el.querySelectorAll(".cz-p [data-p]").forEach((y) => y.setAttribute("aria-pressed", y === b)); paint(); }));
  el.querySelector(".cz-x")?.addEventListener("click", () => onFull?.());
  return { update: paint, chart: () => chart, destroy() { dead = true; try { window.klinecharts?.dispose(host); } catch {} },
    tool(k) { if (!chart) return; if (k === "type") { area = !area; chart.setStyles({ candle: { type: area ? "area" : "candle_solid" } }); return area; }
      if (k === "ma") { chart._ma ? (chart.removeIndicator("candle_pane", "MA"), (chart._ma = 0)) : (chart.createIndicator({ name: "MA", calcParams: [7, 25] }, true, { id: "candle_pane" }), (chart._ma = 1)); return !!chart._ma; }
      if (k === "rsi") { if (chart._rsi) { chart.removeIndicator(chart._rsi); chart._rsi = null; } else chart._rsi = chart.createIndicator("RSI", false, { height: 70 }); return !!chart._rsi; }
      if (k === "line") { chart.createOverlay("straightLine"); return true; }
      if (k === "clear") { chart.removeOverlay(); return true; }
      if (k === "faces") { faceOn = !faceOn; place(); return faceOn; } } };
}
