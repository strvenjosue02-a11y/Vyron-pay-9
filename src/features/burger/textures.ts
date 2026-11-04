import * as THREE from "three";

/** Small deterministic value noise — no deps, used for geometry and textures. */
function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
const smooth = (t: number) => t * t * (3 - 2 * t);
export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  );
}
export const fbm = (x: number, y: number, z: number) =>
  noise3(x, y, z) * 0.5 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.2;

type Painter = (ctx: CanvasRenderingContext2D, size: number) => void;

function canvasTexture(size: number, paint: Painter, srgb = true) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Per-pixel noise speckle over the current canvas. */
function speckle(ctx: CanvasRenderingContext2D, size: number, amount: number, scale: number, dark = true) {
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * scale, (y / size) * scale, 0.5) - 0.5;
      const i = (y * size + x) * 4;
      const k = 1 + n * amount * (dark ? 1 : -1);
      img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
    }
  ctx.putImageData(img, 0, 0);
}

/**
 * Bun colour along the lathe profile (v axis). `crumbFrom/crumbTo` is the cut
 * face (pale crumb); the rest is crust going from golden to deep brown.
 */
export function bunTexture(crumbFrom: number, crumbTo: number, topIsDark: boolean) {
  return canvasTexture(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    const crust = topIsDark
      ? // canvas top = v 1 = crown (deepest bake) → bottom edge lighter
        [[0, "#7e3f12"], [0.25, "#9b5520"], [0.55, "#bb7330"], [0.85, "#d49a52"], [1, "#e0b06a"]]
      : [[0, "#d7a258"], [0.4, "#c4823c"], [1, "#a2602a"]];
    for (const [o, c] of crust) g.addColorStop(o as number, c as string);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // Canvas y=0 is v=1 (flipY), so flip the crumb band.
    ctx.fillStyle = "#ead2a6";
    ctx.fillRect(0, (1 - crumbTo) * s, s, (crumbTo - crumbFrom) * s);
    speckle(ctx, s, 0.35, 24);
  });
}

export function pattyTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = "#4a2414";
    ctx.fillRect(0, 0, s, s);
    const img = ctx.getImageData(0, 0, s, s);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const n = fbm((x / s) * 18, (y / s) * 18, 1.3);
        const char = Math.max(0, n - 0.55) * 3; // crispy dark bits
        const fat = Math.max(0, 0.32 - n) * 2.2; // juicy lighter bits
        const i = (y * s + x) * 4;
        img.data[i] = 74 * (1 - char) + 120 * fat;
        img.data[i + 1] = 36 * (1 - char) + 62 * fat;
        img.data[i + 2] = 20 * (1 - char) + 30 * fat;
      }
    ctx.putImageData(img, 0, 0);
  });
}

/** Grayscale height map for bump — rough meat surface. */
export function pattyBump() {
  return canvasTexture(
    256,
    (ctx, s) => {
      const img = ctx.createImageData(s, s);
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          const v = fbm((x / s) * 30, (y / s) * 30, 7.1) * 255;
          const i = (y * s + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
    },
    false,
  );
}

/** Tomato cross-section: skin ring, flesh, seed chambers. */
export function tomatoSliceTexture() {
  return canvasTexture(256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = "#b8180f";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#e0361f";
    ctx.beginPath(); ctx.arc(c, c, c * 0.93, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * c * 0.48, c + Math.sin(a) * c * 0.48);
      ctx.rotate(a);
      ctx.fillStyle = "#f2a03a";
      ctx.beginPath(); ctx.ellipse(0, 0, c * 0.3, c * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f7d27a";
      for (let j = 0; j < 6; j++) {
        ctx.beginPath();
        ctx.ellipse((j - 2.5) * c * 0.08, Math.sin(j) * c * 0.05, c * 0.035, c * 0.02, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = "#f05a3a";
    ctx.beginPath(); ctx.arc(c, c, c * 0.16, 0, Math.PI * 2); ctx.fill();
    speckle(ctx, s, 0.15, 12, false);
  });
}

export function shadowTexture() {
  return canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(0,0,0,0.75)");
    g.addColorStop(0.55, "rgba(0,0,0,0.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Pickle cross-section: dark skin ring, translucent pale flesh, ring of seeds. */
export function pickleSliceTexture() {
  return canvasTexture(256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = "#3f5a12";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#9fae4a";
    ctx.beginPath(); ctx.arc(c, c, c * 0.88, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c4c878";
    ctx.beginPath(); ctx.arc(c, c, c * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e6e2b0";
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * c * 0.34, c + Math.sin(a) * c * 0.34);
      ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0, 0, c * 0.08, c * 0.04, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    speckle(ctx, s, 0.2, 10, false);
  });
}
