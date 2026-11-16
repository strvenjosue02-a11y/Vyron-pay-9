// Fondo vivo del inicio: velas, volumen y media móvil en movimiento, solo rosa/fresa.
export function startHeroBg(cv) {
  const ctx = cv.getContext("2d"), UP = "255,60,140", DN = "190,30,85";
  let W = 0, H = 0, raf = 0, last = 0, acc = 0, off = 0;
  const CW = 24, GAP = 9, STEP = CW + GAP, SPEED = 38;
  const cs = []; let px = 100;
  const mk = () => { const o = px, d = (Math.random() - 0.47) * 24, c = Math.max(30, Math.min(170, o + d)), hi = Math.max(o, c) + Math.random() * 12, lo = Math.min(o, c) - Math.random() * 12; px = c; return { o, c, hi, lo, v: 0.25 + Math.random() * 0.75, born: performance.now() }; };
  const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); while (cs.length < W / STEP + 4) cs.unshift(mk()); };
  size(); const ro = new ResizeObserver(size); ro.observe(cv);
  const Y = (p) => H * 0.85 - ((p - 30) / 140) * H * 0.72;
  function frame(t) {
    if (!cv.isConnected) { ro.disconnect(); return; }
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; off += SPEED * dt;
    if (off >= STEP) { off -= STEP; cs.shift(); cs.push(mk()); }
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,60,140,.07)"; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const y = (H / 6) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const n = cs.length, ma = []; let sum = 0;
    cs.forEach((k, i) => {
      const x = W - (n - i) * STEP + STEP - off, up = k.c >= k.o, col = up ? UP : DN, age = Math.min(1, (t - k.born) / 900);
      const pulse = 0.55 + 0.45 * Math.sin(t / 700 + i * 0.7), a = (0.35 + 0.4 * pulse) * (0.4 + 0.6 * (i / n));
      ctx.fillStyle = `rgba(${col},${0.12 * age})`; const vh = k.v * H * 0.16; ctx.fillRect(x - CW / 2, H - vh - 4, CW, vh);
      ctx.shadowColor = `rgba(${col},.9)`; ctx.shadowBlur = i > n - 6 ? 22 : 10 * pulse; ctx.strokeStyle = `rgba(${col},${a * age})`; ctx.fillStyle = up ? `rgba(${col},${a * age})` : `rgba(${col},${a * 0.5 * age})`;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, Y(k.hi)); ctx.lineTo(x, Y(k.lo)); ctx.stroke();
      const y1 = Y(Math.max(k.o, k.c)), y2 = Y(Math.min(k.o, k.c)); ctx.fillRect(x - CW / 2, y1, CW, Math.max(3, y2 - y1)); ctx.strokeRect(x - CW / 2, y1, CW, Math.max(3, y2 - y1)); ctx.shadowBlur = 0;
      sum += k.c; if (i >= 6) sum -= cs[i - 6].c; if (i >= 5) ma.push([x, Y(sum / 6)]);
    });
    ctx.strokeStyle = "rgba(255,150,200,.55)"; ctx.lineWidth = 2; ctx.shadowColor = "rgba(255,60,140,.9)"; ctx.shadowBlur = 14; ctx.beginPath(); ma.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.shadowBlur = 0;
    const lx = W - STEP, ly = Y(cs[n - 1].c); ctx.fillStyle = "rgba(255,60,140,.95)"; ctx.shadowColor = "rgba(255,60,140,1)"; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(lx, ly, 4 + 2 * Math.sin(t / 250), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(255,60,140,.35)"; ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); ctx.setLineDash([]);
    raf = requestAnimationFrame(frame);
  }
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) raf = requestAnimationFrame(frame); else frame(performance.now());
  return () => cancelAnimationFrame(raf);
}
