/**
 * Forja · noise — procedural texture math in the spirit of Blender's Noise,
 * Voronoi and Musgrave texture nodes, re-implemented from the formulas (no
 * Blender source). Deterministic, allocation-free, usable on CPU for geometry
 * displacement and canvas textures.
 */

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10); // quintic, smoother than smoothstep
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Value noise in [0,1]. */
export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  );
}

/** Fractal Brownian motion (Musgrave fBm): `octaves` layers, `lacunarity` frequency step, `gain` amplitude step. */
export function fbm(x: number, y: number, z: number, octaves = 4, lacunarity = 2.03, gain = 0.5) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise3(x * freq, y * freq, z * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged multifractal — sharp creases, good for fried batter crags. */
export function ridged(x: number, y: number, z: number, octaves = 4) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x * freq, y * freq, z * freq) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

/**
 * Voronoi (Worley) F1/F2 distances, like Blender's Voronoi node.
 * Returns [f1, f2]; `f2 - f1` gives cell borders (cracks), `f1` gives blobs.
 */
export function voronoi(x: number, y: number, z: number): [number, number] {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let f1 = 9, f2 = 9;
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx, cy = yi + dy, cz = zi + dz;
        const px = cx + hash3(cx, cy, cz), py = cy + hash3(cy, cz, cx), pz = cz + hash3(cz, cx, cy);
        const d = Math.hypot(px - x, py - y, pz - z);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
  return [f1, f2];
}

/** Small seeded PRNG (Park–Miller) for reproducible scatter/variation. */
export function rng(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
