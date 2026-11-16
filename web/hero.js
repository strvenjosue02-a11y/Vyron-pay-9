// Portada "escultura en vitrina": el scroll controla la animación del logo 3D (secuencia de imágenes en un canvas).
const FRAMES = 35;
const src = (i) => `./assets/seq/s_${String(i).padStart(4, "0")}.webp`;
const cache = [];
let loading = false;

function preload(onFirst) {
  if (loading) { if (cache[1]?.complete) onFirst(); return; }
  loading = true;
  // primero el cuadro inicial y el final (para mostrar algo de inmediato), luego el resto
  const order = [1, FRAMES, ...Array.from({ length: FRAMES - 2 }, (_, k) => k + 2)];
  order.forEach((i, n) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src(i);
    if (n === 0) img.onload = onFirst;
    cache[i] = img;
  });
}

export function mountHero(root) {
  const sec = root.querySelector(".vitrina");
  if (!sec) return () => {};
  const canvas = sec.querySelector("canvas"), ctx = canvas.getContext("2d");
  const beatA = sec.querySelectorAll("[data-beat=a]"), beatB = sec.querySelectorAll("[data-beat=b]"), cue = sec.querySelector("[data-beat=cue]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let last = -1, raf = 0;

  const size = () => {
    const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d); last = -1;
  };
  const draw = (i) => {
    const img = cache[i];
    if (!img || !img.complete || !img.naturalWidth) return false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return true;
  };
  const ease = (x) => Math.min(1, Math.max(0, x));
  const frame = () => {
    raf = 0;
    const r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight;
    const p = reduce ? 1 : ease(-r.top / Math.max(1, span));
    const i = Math.max(1, Math.min(FRAMES, Math.round(1 + p * (FRAMES - 1))));
    if (i !== last && draw(i)) last = i;
    const a = 1 - ease((p - 0.28) / 0.17), b = ease((p - 0.52) / 0.2);
    beatA.forEach((el) => { el.style.opacity = a; el.style.transform = `translateY(${(1 - a) * -12}px)`; });
    beatB.forEach((el) => { el.style.opacity = b; el.style.transform = `translateY(${(1 - b) * 16}px)`; });
    if (cue) cue.style.opacity = 1 - ease(p / 0.08);
    // al aparecer el título, la escultura sube y se achica para dejarle lugar
    const narrow = innerWidth < 600;
    canvas.style.transform = `translateY(${-b * (narrow ? 6 : 13)}svh) scale(${1 - b * (narrow ? 0.12 : 0.3)})`;
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
  size();
  preload(() => { last = -1; frame(); });
  frame();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { size(); frame(); });
  return () => removeEventListener("scroll", onScroll);
}
