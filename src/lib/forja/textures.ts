/**
 * Forja · textures — procedural canvas textures, including normal maps baked
 * from a height field with a Sobel filter (like Blender's Bump → Normal bake).
 * Normal maps give far crisper micro-detail than `bumpMap` and are cheap.
 */
import * as THREE from "three";

export type HeightFn = (u: number, v: number) => number; // returns ~[0,1], u/v in [0,1]

function toTexture(canvas: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  return t;
}

/** Bake a tangent-space normal map from a tileable height function. */
export function normalMapFrom(height: HeightFn, size = 512, strength = 2) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) h[y * size + x] = height(x / size, y / size);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // Sobel gradients.
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = -dy * strength;
      const nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, false);
}

/** Paint an sRGB colour (or grayscale) map pixel by pixel. */
export function paintMap(size: number, fn: (u: number, v: number) => [number, number, number], srgb = true) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size, y / size);
      const i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, srgb);
}

/** Tileable 2D value via 4D-torus trick: sample 3D noise on a torus so u/v wrap seamlessly. */
export function tileable(fn: (x: number, y: number, z: number) => number, freq: number): HeightFn {
  const R = freq / (2 * Math.PI);
  return (u, v) => {
    const a = u * Math.PI * 2, b = v * Math.PI * 2;
    // Two circles combined into 3D coords (approximation of a 4D torus, seamless in u and v).
    return fn(Math.cos(a) * R + Math.cos(b) * R * 0.37, Math.sin(a) * R + 11.3, Math.sin(b) * R + Math.cos(b) * 0.21 * R);
  };
}
