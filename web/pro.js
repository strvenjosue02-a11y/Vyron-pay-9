// Gráfico de trading con TradingView Lightweight Charts (librería oficial, gratis y abierta).
// Velas rosa (sube) / violeta (baja), volumen, promedios MA7/MA25, cruz, línea horizontal, marcas de tus operaciones,
// cambio Precio <-> Valor total, vista Velas/Línea y pantalla completa.
import { createChart, CrosshairMode } from "https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.mjs";

const UP = "#3ddc97", DN = "#ff5d5d";
const fmtN = (x, cap) => {
  if (cap && x >= 1000) return x >= 1e9 ? (x / 1e9).toFixed(2) + "B" : x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : (x / 1e3).toFixed(1) + "K";
  if (x >= 0.01) return x.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (x >= 1e-4) return x.toPrecision(3);
  if (!(x > 0)) return "0";
  const z = Math.floor(-Math.log10(x)), m = (x * Math.pow(10, z + 1)).toPrecision(3).replace(".", "").slice(0, 3);
  return z > 4 ? `0.0${String(z).replace(/\d/g, (d) => "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089"[d])}${m}` : x.toFixed(z + 3);
};
const maOf = (cs, n) => cs.map((c, i) => (i + 1 < n ? null : { time: c.time, value: cs.slice(i + 1 - n, i + 1).reduce((a, k) => a + k.close, 0) / n })).filter(Boolean);

const emaOf = (v, n) => { const k = 2 / (n + 1), out = []; let e = null; v.forEach((x, i) => { e = e == null ? x : x * k + e * (1 - k); out.push(e); }); return out; };
const rsiOf = (c, n = 14) => { const out = []; let g = 0, l = 0; for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1]; const up = Math.max(d, 0), dn = Math.max(-d, 0); if (i <= n) { g += up / n; l += dn / n; } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; } if (i >= n) out.push([i, l === 0 ? 100 : 100 - 100 / (1 + g / l)]); } return out; };
const PHONE = () => matchMedia("(max-width: 900px)").matches;
export function mountChart(el, { id, getData, periods, period, onPeriod, labels = {}, fsTarget, onFace, onLine, mode: modeOpt }) {
  const L = { candles: "Candles", line: "Line", ma: "MA", draw: "Line", clear: "Clear", full: "Full screen", exit: "Exit", vol: "Vol", price: "Price", cap: "Market cap", ...labels };
  const key = `hf-hl-${id}`;
  let hl = []; try { hl = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
  const st = { flow: (() => { try { return localStorage.getItem("hf-flow") === "1"; } catch { return false; } })(), ind: null, heat: (() => { try { return localStorage.getItem("hf-heat") !== "0"; } catch { return true; } })(), faces: (() => { try { return localStorage.getItem("hf-faces") !== "0"; } catch { return true; } })(), cap: false, mode: modeOpt || (PHONE() ? "line" : "candle"), ma: !matchMedia("(max-width: 900px)").matches, draw: false, period, k: 1, last: null };
  el.classList.add("cp");
  el.innerHTML = `<div class="cp-bar">
      <div class="cp-per" role="tablist">${periods.map((k) => `<button type="button" data-per="${k}" aria-selected="${k === period}">${k}</button>`).join("")}</div>
      <div class="cp-tools">
        <button type="button" data-t="unit" title="Price / Market cap">${L.price}</button>
        <button type="button" data-t="mode">${L.candles}</button>
        <button type="button" data-t="ma" aria-pressed="${st.ma}">${L.ma}</button>
        <button type="button" data-t="faces" aria-pressed="${st.faces}">${L.faces || "Faces"}</button>
        <button type="button" data-t="heat" aria-pressed="${st.heat}">${L.heat || "Heat"}</button>
        <button type="button" data-t="flow" aria-pressed="${st.flow}">${L.flow || "Flow"}</button>
        <button type="button" data-t="rsi" aria-pressed="false">RSI</button><button type="button" data-t="macd" aria-pressed="false">MACD</button>
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
    layout: { background: { type: "solid", color: "transparent" }, textColor: "#8d8f95", fontSize: 12, fontFamily: "JetBrains Mono, ui-monospace, monospace" },
    grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,.035)" } },
    watermark: { visible: false, text: "", fontSize: 120, horzAlign: "center", vertAlign: "center", color: "rgba(255,255,255,.035)", fontFamily: "Space Grotesk, sans-serif", fontStyle: "bold" },
    crosshair: { mode: PHONE() ? CrosshairMode.Magnet : CrosshairMode.Normal, vertLine: { visible: !PHONE(), labelVisible: !PHONE(), color: "rgba(255,255,255,.28)", style: 2, width: 1, labelBackgroundColor: "#1c1c20" }, horzLine: { visible: !PHONE(), labelVisible: !PHONE(), color: "rgba(255,255,255,.28)", style: 2, width: 1, labelBackgroundColor: "#1c1c20" } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.26 } },
    timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 10, barSpacing: 11, minBarSpacing: 2 },
    localization: { priceFormatter: (p) => fmtN(p, st.cap) },
  });
  const candle = chart.addCandlestickSeries({ priceLineStyle: PHONE() ? 0 : 2, priceLineColor: "rgba(61,220,151,.45)", upColor: UP, downColor: DN, borderVisible: false, wickUpColor: UP + "cc", wickDownColor: DN + "cc", priceFormat: pf });
  const line = chart.addAreaSeries({ lineColor: UP, topColor: "rgba(61,220,151,.22)", bottomColor: "rgba(61,220,151,0)", lineWidth: 2, visible: false, priceFormat: pf });
  const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false });
  chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  const mo = { lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: pf };
  const m7 = chart.addLineSeries({ ...mo, color: "rgba(255,255,255,.75)" }), m25 = chart.addLineSeries({ ...mo, color: "rgba(255,255,255,.3)" });
  const indLine = chart.addLineSeries({ priceScaleId: "ind", color: "#f4f4f1", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true, visible: false, priceFormat: { type: "price", precision: 2, minMove: 0.01 } });
  const indSig = chart.addLineSeries({ priceScaleId: "ind", color: "rgba(255,255,255,.4)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, visible: false, priceFormat: { type: "price", precision: 2, minMove: 0.01 } });
  const indHist = chart.addHistogramSeries({ priceScaleId: "ind", priceLineVisible: false, lastValueVisible: false, visible: false, priceFormat: { type: "price", precision: 2, minMove: 0.01 } });
  const indLines = [];
  function applyInd() {
    const on = !!st.ind; indLines.splice(0).forEach((r) => indLine.removePriceLine(r));
    candle.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: on ? 0.4 : 0.26 } }); chart.priceScale("vol").applyOptions({ scaleMargins: { top: on ? 0.58 : 0.82, bottom: on ? 0.28 : 0 } });
    chart.priceScale("ind").applyOptions({ scaleMargins: { top: 0.74, bottom: 0.03 }, borderVisible: false });
    indLine.applyOptions({ visible: on }); indSig.applyOptions({ visible: st.ind === "macd" }); indHist.applyOptions({ visible: st.ind === "macd" });
    if (!on || !data.length) { indLine.setData([]); indSig.setData([]); indHist.setData([]); return; }
    const cl = data.map((c) => c.close);
    if (st.ind === "rsi") { const r = rsiOf(cl); indLine.setData(r.map(([i, v]) => ({ time: data[i].time, value: v }))); indSig.setData([]); indHist.setData([]);
      [70, 30].forEach((p2) => indLines.push(indLine.createPriceLine({ price: p2, color: "rgba(255,255,255,.18)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "" }))); }
    else { const e12 = emaOf(cl, 12), e26 = emaOf(cl, 26), m = e12.map((v, i) => v - e26[i]), sg = emaOf(m, 9); indLine.setData(data.map((c, i) => ({ time: c.time, value: m[i] }))); indSig.setData(data.map((c, i) => ({ time: c.time, value: sg[i] })));
      indHist.setData(data.map((c, i) => ({ time: c.time, value: m[i] - sg[i], color: m[i] - sg[i] >= 0 ? UP + "88" : DN + "88" }))); }
  }
  let roundLine = null, hlRefs = [], first = true, data = [], lnRefs = [], faces = [], lines = [], allTr = [], heat = [];
  const fog = document.createElement("div"); fog.className = "cp-fog";
  const tip = document.createElement("div"); tip.className = "cp-tip"; box.appendChild(tip);
  const bucket = (time) => { if (!data.length || time == null) return []; const i = data.findIndex((c) => c.time === time), step = data.length > 1 ? data[Math.min(i + 1, data.length - 1)].time - data[Math.max(i, 0)].time || data[1].time - data[0].time : 300; const end = i >= 0 && i < data.length - 1 ? data[i + 1].time : time + Math.abs(step || 300); return allTr.filter((t) => t.t >= time && t.t < end); };
  box.style.position = "relative";
  const fl = document.createElement("canvas"); fl.className = "cp-flow"; box.appendChild(fl);
  box.appendChild(fog); const ov = document.createElement("div"); ov.className = "cp-ov"; box.appendChild(ov);
  candle.applyOptions({ autoscaleInfoProvider: (orig) => { const r = orig(); if (!r || !lines.length) return r; const ks = st.k || 1; lines.forEach((l) => { const v = l.price * ks; r.priceRange.minValue = Math.min(r.priceRange.minValue, v); r.priceRange.maxValue = Math.max(r.priceRange.maxValue, v); }); return r; } });
  function placeFog() {
    if (!st.heat || !heat.length) { fog.innerHTML = ""; return; } const k = st.k;
    fog.innerHTML = heat.map((h) => { const y1 = candle.priceToCoordinate(h.hi * k), y2 = candle.priceToCoordinate(h.lo * k); if (y1 == null || y2 == null) return ""; const top = Math.min(y1, y2), ht = Math.max(2, Math.abs(y2 - y1) + 1);
      return `<i class="${h.win ? "g" : h.now ? "n" : "r"}" style="top:${top}px;height:${ht}px;opacity:${(0.05 + h.v * 0.3).toFixed(2)}"></i>`; }).join("");
  }
  function drawFlow() {
    const on = st.flow; fl.style.display = on ? "block" : "none"; candle.applyOptions({ visible: on ? false : st.mode === "candle" }); vol.applyOptions({ visible: !on && !PHONE() });
    if (!on) return; const W = box.clientWidth, H = box.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2); if (!W || !H) return;
    if (fl.width !== W * dpr || fl.height !== H * dpr) { fl.width = W * dpr; fl.height = H * dpr; fl.style.width = W + "px"; fl.style.height = H + "px"; }
    const g = fl.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); const ts = chart.timeScale(), k = st.k, times = data.map((c) => c.time);
    const snap = (t) => { let r = times[0]; for (const x of times) { if (x <= t) r = x; else break; } return r; }, rightEdge = W - 64;
    const t0 = data.length ? data[0].time : 0, pts = allTr.filter((t) => t.price && t.t >= t0).map((t) => ({ x: ts.timeToCoordinate(snap(t.t)), y: candle.priceToCoordinate(t.price * k), t })).filter((p) => p.x != null && p.y != null && p.x > 0 && p.x < rightEdge);
    // curva de dinero neto (abajo): cuánto dinero ha entrado menos el que salió
    let cum = 0; const net = pts.map((p) => { cum += p.t.buy ? p.t.usd : -p.t.usd; return { x: p.x, v: cum }; });
    if (net.length > 1) { const mn = Math.min(0, ...net.map((n) => n.v)), mx = Math.max(1e-9, ...net.map((n) => n.v)), y0 = H - 28, h = H * 0.22, Y = (v) => y0 - ((v - mn) / (mx - mn || 1)) * h, zero = Y(0), up = net[net.length - 1].v >= 0, col = up ? "61,220,151" : "255,93,93";
      const gr = g.createLinearGradient(0, y0 - h, 0, y0); gr.addColorStop(0, `rgba(${col},.30)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.beginPath(); net.forEach((n, i) => (i ? g.lineTo(n.x, Y(n.v)) : g.moveTo(n.x, Y(n.v)))); g.lineTo(net[net.length - 1].x, zero); g.lineTo(net[0].x, zero); g.closePath(); g.fillStyle = gr; g.fill();
      g.beginPath(); net.forEach((n, i) => (i ? g.lineTo(n.x, Y(n.v)) : g.moveTo(n.x, Y(n.v)))); g.strokeStyle = `rgb(${col})`; g.lineWidth = 2; g.stroke(); g.setLineDash([4, 6]); g.strokeStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.moveTo(0, zero); g.lineTo(rightEdge, zero); g.stroke(); g.setLineDash([]);
      g.fillStyle = "rgba(255,255,255,.55)"; g.font = "12px 'Space Grotesk', sans-serif"; g.fillText(L.net || "Net money in", rightEdge - 150, y0 - h - 8); }
    // línea fina del precio
    g.beginPath(); data.forEach((c, i) => { const x = ts.timeToCoordinate(c.time), y = candle.priceToCoordinate(c.close); if (x == null || y == null) return; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = 1.5; g.stroke();
    // burbujas: tamaño = dinero, verde = compra, rojo = venta
    const mxUsd = Math.max(1e-9, ...pts.map((p) => p.t.usd)); const rad = (u) => 4 + Math.sqrt(u / mxUsd) * 24;
    pts.sort((a, b) => b.t.usd - a.t.usd).forEach((p) => { const r = rad(p.t.usd), col = p.t.buy ? "61,220,151" : "255,93,93", gr = g.createRadialGradient(p.x, p.y, r * 0.1, p.x, p.y, r);
      gr.addColorStop(0, `rgba(${col},.55)`); gr.addColorStop(1, `rgba(${col},.10)`); g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fillStyle = gr; g.fill(); g.lineWidth = 1.5; g.strokeStyle = `rgba(${col},.9)`; g.stroke(); });
    const last = data[data.length - 1]; if (last) { const x = ts.timeToCoordinate(last.time), y = candle.priceToCoordinate(last.close); if (x != null && y != null) { g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } }
  }
  let dead = false;
  function place() {
    if (dead) return; placeFog(); drawFlow(); if (!data.length) return; const ts = chart.timeScale(), times = data.map((c) => c.time), snap = (t) => { let r = times[0]; for (const x of times) { if (x <= t) r = x; else break; } return r; }, k = st.k;
    const stack = {}; ov.querySelectorAll("[data-fi]").forEach((n) => { const f = faces[Number(n.dataset.fi)], x = ts.timeToCoordinate(snap(f.t)), y = candle.priceToCoordinate(f.price * k);
      if (x == null || y == null) { n.style.display = "none"; return; } const key = Math.round(x / 22) + (f.buy ? "b" : "s"), o = stack[key] || 0; stack[key] = o + 1; n.style.display = ""; n.style.left = x - 15 + "px"; const late = times.indexOf(snap(f.t)) >= times.length - 2 ? 22 : 0; n.style.top = y + (f.buy ? 12 + late + o * 30 : -42 - late - o * 30) + "px"; });
    ov.querySelectorAll("[data-li]").forEach((n) => { if (n.dataset.drag === "1" && n.classList.contains("drag")) return; const l = lines[Number(n.dataset.li)], y = candle.priceToCoordinate(l.price * k); if (y == null) { n.style.display = "none"; return; } n.style.display = ""; n.style.top = y - 13 + "px"; });
  }
  function drawOv() {
    const times = data.map((c) => c.time), snap = (t) => { let r = times[0]; for (const x of times) { if (x <= t) r = x; else break; } return r; }, groups = new Map();
    if (st.faces) faces.forEach((f, i) => { const k = snap(f.t) + (f.buy ? "b" : "s"); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
    ov.innerHTML = [...groups.values()].map((ix) => { const f = faces[ix[0]]; return `<button type="button" class="cp-face ${f.buy ? "b" : "s"}${f.whale ? " w" : ""}" data-fi="${ix[0]}" title="${ix.length > 1 ? ix.length + " traders" : (f.name || "")}">${f.html}${ix.length > 1 ? `<b class="cp-more">+${ix.length - 1}</b>` : ""}</button>`; }).join("") + lines.map((l, i) => `<div class="cp-ln ${l.drag ? "dr" : ""}" data-li="${i}" style="--c:${l.color}">${l.drag ? "<i></i>" : ""}<span>${l.title}</span></div>`).join("");
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
    chart.applyOptions({ watermark: { text: d.symbol || "" } });
    candle.setData(data); applyInd(); line.setData(data.map((c) => ({ time: c.time, value: c.close })));
    vol.setData((d.candles || []).filter((c) => c.t).map((c) => ({ time: c.t, value: c.v, color: (c.c >= c.o ? UP : DN) + "38" })));
    const ma7 = maOf(data, 7), ma25 = maOf(data, 25); m7.setData(st.ma ? ma7 : []); m25.setData(st.ma ? ma25 : []);
    vol.applyOptions({ visible: !st.flow && !PHONE() }); line.applyOptions({ lineWidth: PHONE() ? 3 : 2 });
    candle.applyOptions({ visible: st.mode === "candle" }); line.applyOptions({ visible: st.mode === "line" || (st.mode === "candle" && !st.flow), lineVisible: st.mode === "line", topColor: st.mode === "line" ? "rgba(61,220,151,.22)" : (data.length && data[data.length - 1].close >= data[0].open ? "rgba(61,220,151,.20)" : "rgba(255,93,93,.20)"), bottomColor: "rgba(0,0,0,0)" });
    if (roundLine) candle.removePriceLine(roundLine);
    roundLine = d.round && !PHONE() ? candle.createPriceLine({ price: d.round * k, color: "rgba(255,255,255,.35)", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" }) : null;
    hlRefs.forEach((r) => candle.removePriceLine(r));
    hlRefs = hl.map((p) => candle.createPriceLine({ price: p * k, color: "#f4f4f1", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "" }));
    const times = data.map((c) => c.time), snap = (t) => { let r = times[0]; for (const x of times) { if (x <= t) r = x; else break; } return r; };
    const marks = (d.marks || []).map((m) => ({ time: snap(m.t), position: m.buy ? "belowBar" : "aboveBar", color: m.buy ? UP : DN, shape: "circle", size: 2, text: m.buy ? "+" : "−" })).sort((a, b) => a.time - b.time);
    candle.setMarkers(marks);
    allTr = d.trades || []; heat = d.heat || []; faces = d.faces || []; lines = d.lines || []; lnRefs.forEach((r) => candle.removePriceLine(r));
    lnRefs = lines.filter(() => !PHONE()).map((l) => candle.createPriceLine({ price: l.price * k, color: l.color, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" }));
    drawOv();
    st.last = data[data.length - 1]; showInfo(st.last);
    if (first) { chart.timeScale().fitContent(); first = false; }
  }
  chart.subscribeCrosshairMove((p) => {
    const tr = p.time && p.point ? bucket(p.time) : [];
    if (!tr.length || st.draw) tip.style.display = "none";
    else { const top = [...tr].sort((a, b) => b.usd - a.usd).slice(0, 4), bw = box.clientWidth; tip.innerHTML = `<b>${tr.length} ${tr.length === 1 ? "trade" : "trades"}</b>` + top.map((t) => `<div class="${t.buy ? "b" : "s"}">${t.html}<span>${t.name}</span><em>${t.buy ? "+" : "-"}$${t.usd.toFixed(2)}</em></div>`).join("") + (tr.length > 4 ? `<small>+${tr.length - 4}</small>` : "") + `<small>${L.tap || "Click to open profile"}</small>`;
      tip.style.display = "block"; const x = p.point.x + 18 > bw - 220 ? p.point.x - 230 : p.point.x + 18; tip.style.left = Math.max(6, x) + "px"; tip.style.top = Math.max(6, p.point.y - 20) + "px"; } const c = p.seriesData?.get(candle) || p.seriesData?.get(line); showInfo(c ? { open: c.open ?? c.value, high: c.high ?? c.value, low: c.low ?? c.value, close: c.close ?? c.value } : st.last); });
  chart.subscribeClick((p) => { if (!st.draw && p.time && onFace) { const tr = bucket(p.time); if (tr.length) { onFace([...tr].sort((a, b) => b.usd - a.usd)[0].who); return; } } if (!st.draw || !p.point) return; const price = candle.coordinateToPrice(p.point.y); if (price == null) return; hl.push(price / st.k); save(); render(); });

  el.querySelector(".cp-bar").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.per) { st.period = b.dataset.per; first = true; el.querySelectorAll("[data-per]").forEach((x) => x.setAttribute("aria-selected", x === b)); onPeriod?.(st.period); render(); return; }
    const t = b.dataset.t;
    if (t === "unit") { st.cap = !st.cap; b.textContent = st.cap ? L.cap : L.price; }
    if (t === "mode") { st.mode = st.mode === "candle" ? "line" : "candle"; b.textContent = st.mode === "candle" ? L.candles : L.line; }
    if (t === "ma") { st.ma = !st.ma; b.setAttribute("aria-pressed", st.ma); }
    if (t === "flow") { st.flow = !st.flow; b.setAttribute("aria-pressed", st.flow); try { localStorage.setItem("hf-flow", st.flow ? "1" : "0"); } catch {} }
    if (t === "rsi" || t === "macd") { st.ind = st.ind === t ? null : t; el.querySelectorAll("[data-t=rsi],[data-t=macd]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.t === st.ind)); applyInd(); }
    if (t === "heat") { st.heat = !st.heat; b.setAttribute("aria-pressed", st.heat); try { localStorage.setItem("hf-heat", st.heat ? "1" : "0"); } catch {} }
    if (t === "faces") { st.faces = !st.faces; b.setAttribute("aria-pressed", st.faces); try { localStorage.setItem("hf-faces", st.faces ? "1" : "0"); } catch {} }
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
  return { update: render, destroy: () => { dead = true; document.removeEventListener("fullscreenchange", onFs); document.body.classList.remove("cp-lock"); chart.remove(); } };
}
