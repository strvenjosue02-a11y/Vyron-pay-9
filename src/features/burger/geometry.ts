import * as THREE from "three";
import { fbm, noise3 } from "./textures";

const V = (x: number, y: number) => new THREE.Vector2(x, y);

/** Lathe from a smooth spline, sampled by arc length so UV v ≈ distance along the profile. */
function lathe(points: THREE.Vector2[], segments = 96, samples = 48) {
  const curve = new THREE.SplineCurve(points);
  const pts = curve.getSpacedPoints(samples);
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  return new THREE.LatheGeometry(pts, segments);
}

/** Organic wobble so nothing looks machine-turned. */
function wobble(geo: THREE.BufferGeometry, radial: number, vertical: number, freq: number, seed: number) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const n = fbm(x * freq + seed, y * freq, z * freq) - 0.5;
    const k = 1 + n * radial;
    p.setXYZ(i, x * k, y + n * vertical * (r / 1.2), z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// Starts at the bottom centre (cut face) and ends at the crown.
const TOP_BUN = [V(0, 0), V(0.9, 0), V(1.12, 0.03), V(1.2, 0.14), V(1.14, 0.34), V(0.95, 0.58), V(0.62, 0.78), V(0.28, 0.87), V(0, 0.89)];

export function topBunGeometry() {
  const g = lathe(TOP_BUN);
  return wobble(g, 0.05, 0.05, 1.6, 3);
}

export function bottomBunGeometry() {
  // Crust underneath and around, crumb face on top.
  const g = lathe([V(0, 0), V(0.85, 0), V(1.08, 0.04), V(1.16, 0.17), V(1.12, 0.3), V(1.0, 0.36), V(0.6, 0.37), V(0, 0.37)]);
  return wobble(g, 0.04, 0.02, 1.8, 11);
}

export function pattyGeometry() {
  const H = 0.3;
  const g = new THREE.CylinderGeometry(1.12, 1.14, H, 128, 12, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const t = y / (H / 2); // -1 bottom … 1 top
    const ca = Math.cos(a), sa = Math.sin(a);
    // Rounded shoulders instead of a hard coin edge.
    const shoulder = 1 - 0.09 * Math.pow(Math.abs(t), 4);
    // Irregular smash edge, varying with height so it never reads as stacked discs.
    const edge = (fbm(ca * 2.5 + 3, t * 0.8, sa * 2.5) - 0.5) * 0.14;
    const crumble = (fbm(ca * 9, t * 3, sa * 9) - 0.5) * 0.035;
    const isSide = r > 1.05;
    const nr = isSide ? (r + edge + crumble) * shoulder : r * (1 + edge * 0.6 * (r / 1.12));
    const bump = (fbm(x * 3.5, y * 3.5 + 9, z * 3.5) - 0.5) * 0.05;
    const k = r > 1e-4 ? nr / r : 1;
    p.setXYZ(i, x * k, y + (isSide ? 0 : bump), z * k);
  }
  g.computeVertexNormals();
  return g;
}

export function cheeseGeometry() {
  const g = new THREE.PlaneGeometry(2.0, 2.0, 56, 56);
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI / 4 + 0.15);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const d = Math.hypot(x, z);
    // Melted drape: flat over the patty, sagging past its edge.
    // Soften the square corners so the slice reads as melted, not as paper.
    const sag = d > 0.98 ? Math.pow(d - 0.98, 1.3) * 1.25 : 0;
    const ripple = (noise3(x * 3, 0, z * 3) - 0.5) * 0.03;
    const pull = d > 0.98 ? 1 - (d - 0.98) * 0.32 : 1;
    p.setXYZ(i, x * pull, -sag + ripple, z * pull);
  }
  g.computeVertexNormals();
  return g;
}

export function lettuceGeometry() {
  const g = new THREE.RingGeometry(0.001, 1.3, 160, 12);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const t = r / 1.3;
    // Ruffled leaf edge: several frequencies so it doesn't look like a gear.
    const ruffle = (Math.sin(a * 13 + r * 4) * 0.6 + Math.sin(a * 29 + 1.3) * 0.4) * 0.09 * t * t;
    const lobe = 1 + (noise3(Math.cos(a) * 2, Math.sin(a) * 2, 5) - 0.5) * 0.18 * t;
    p.setXYZ(i, x * lobe, ruffle - t * t * 0.08, z * lobe);
  }
  g.computeVertexNormals();
  return g;
}

/** Sesame seeds placed on the real crown profile, as matrices for an InstancedMesh. */
export function sesameMatrices(count: number) {
  const curve = new THREE.SplineCurve(TOP_BUN);
  const out: THREE.Matrix4[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const twist = new THREE.Quaternion();
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    // u ∈ [0.55, 0.98]: from the upper shoulder to just before the crown centre,
    // weighted toward larger radii so density per area stays roughly even.
    const u = 0.98 - Math.sqrt(rand()) * 0.43;
    const pt = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const phi = rand() * Math.PI * 2;
    const c = Math.cos(phi), s = Math.sin(phi);
    // Profile normal (pointing out of the bun) rotated around Y.
    const n2 = new THREE.Vector2(tan.y, -tan.x);
    if (n2.y < 0) n2.negate();
    const normal = new THREE.Vector3(n2.x * c, n2.y, n2.x * s).normalize();
    const pos = new THREE.Vector3(pt.x * c, pt.y, pt.x * s).addScaledVector(normal, 0.008);
    q.setFromUnitVectors(up, normal);
    twist.setFromAxisAngle(up, rand() * Math.PI);
    q.multiply(twist);
    out.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
  }
  return out;
}
