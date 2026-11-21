// Objetos 3D (renderizados en Blender) para celular: huevo que eclosiona (ronda) y bóveda sellada (seguridad).
const cache = {};
const blobOf = (src) => (cache[src] ||= fetch(src).then((r) => r.blob()).then((b) => URL.createObjectURL(b)).catch(() => src));
const feed = (v) => { const s = v.dataset.src; if (!s || v.dataset.ok) return Promise.resolve(); v.dataset.ok = "1"; return blobOf(s).then((u) => { v.src = u; return new Promise((ok) => (v.readyState >= 1 ? ok() : v.addEventListener("loadedmetadata", ok, { once: true }))); }); };
const EGG_FILL = 2.0;   // segundos de video que cubren 0–100 % de la ronda (frames 0–59 a 30 fps)
const EGG_END = 3.0;    // fin del video (90 frames)
export const eggHtml = (p) => `<div class="egg3" data-egg="${Math.max(0, Math.min(1, p || 0)).toFixed(3)}"><video muted playsinline preload="auto" disablepictureinpicture data-src="assets/egg.mp4"></video></div>`;
export function eggBind(root, p, hatched) {
  const el = (root || document).querySelector(".egg3"), v = el?.querySelector("video"); if (!v) return;
  const t = (hatched ? EGG_FILL : Math.min(0.97, p) * EGG_FILL);
  const go = () => { try { if (hatched && !el.dataset.done) { el.dataset.done = "1"; v.currentTime = EGG_FILL; v.play().catch(() => {}); } else if (!hatched) v.currentTime = t; } catch {} };
  feed(v).then(go);
  el.dataset.egg = String(p);
}
export const vaultHtml = (title, sub) => `<div class="vlt3"><video muted playsinline preload="auto" disablepictureinpicture data-src="assets/vault.mp4"></video><div><b>${title}</b><small>${sub}</small></div></div>`;
export function vaultBind(root) {
  (root || document).querySelectorAll(".vlt3:not([data-b])").forEach((el) => { el.dataset.b = "1"; const v = el.querySelector("video");
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && !el.dataset.p) { el.dataset.p = "1"; io.disconnect(); feed(v).then(() => { v.currentTime = 0; v.play().catch(() => {}); }); } }, { threshold: 0.5 }); io.observe(el); });
}
