/**
 * Forja · modifiers — a non-destructive-style modifier stack for
 * THREE.BufferGeometry, modelled on Blender's modifier concepts
 * (Displace, Simple Deform bend/twist/taper, Laplacian Smooth, Cast, Weld).
 *
 *   const geo = stack(new THREE.LatheGeometry(pts, 96))
 *     .weld()
 *     .displace((p) => fbm(p.x * 4, p.y * 4, p.z * 4) - 0.5, 0.05)
 *     .smooth(2, 0.4)
 *     .done();
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type Field = (p: THREE.Vector3, n: THREE.Vector3, i: number) => number;

export class Stack {
  constructor(public geo: THREE.BufferGeometry) {}

  private get pos() {
    return this.geo.attributes.position as THREE.BufferAttribute;
  }

  /** Weld: merge coincident vertices so displacement and normals have no seams (drops UVs). */
  weld(tolerance = 1e-4) {
    const g = this.geo.clone();
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    this.geo.dispose();
    this.geo = mergeVertices(g, tolerance);
    g.dispose();
    this.geo.computeVertexNormals();
    return this;
  }

  /** Displace along the vertex normal by `field(p) * strength` (Blender Displace, direction = normal). */
  displace(field: Field, strength: number) {
    this.geo.computeVertexNormals();
    const p = this.pos;
    const nrm = this.geo.attributes.normal as THREE.BufferAttribute;
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      n.fromBufferAttribute(nrm, i);
      const d = field(v, n, i) * strength;
      p.setXYZ(i, v.x + n.x * d, v.y + n.y * d, v.z + n.z * d);
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
    return this;
  }

  /** Arbitrary per-vertex position function (Geometry Nodes "Set Position"). */
  map(fn: (p: THREE.Vector3, i: number) => void) {
    const p = this.pos;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      fn(v, i);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
    return this;
  }

  /** Simple Deform · Bend around Z, along the Y axis. `angle` in radians over `length`. */
  bend(angle: number, length: number) {
    if (Math.abs(angle) < 1e-5) return this;
    const r = length / angle;
    return this.map((v) => {
      const theta = (v.y / length) * angle;
      const x = v.x;
      v.x = r - (r - x) * Math.cos(theta);
      v.y = (r - x) * Math.sin(theta);
    });
  }

  /** Simple Deform · Twist around Y. */
  twist(anglePerUnit: number) {
    return this.map((v) => {
      const a = v.y * anglePerUnit;
      const c = Math.cos(a), s = Math.sin(a);
      const x = v.x * c - v.z * s;
      v.z = v.x * s + v.z * c;
      v.x = x;
    });
  }

  /** Simple Deform · Taper: scale XZ linearly along Y from `bottom` to `top`. */
  taper(bottom: number, top: number, minY: number, maxY: number) {
    return this.map((v) => {
      const t = (v.y - minY) / (maxY - minY);
      const k = bottom + (top - bottom) * t;
      v.x *= k;
      v.z *= k;
    });
  }

  /**
   * Laplacian smooth (Blender Smooth / Laplacian Smooth, umbrella operator):
   * move each vertex toward the average of its neighbours by `factor`.
   * Needs an indexed, welded mesh.
   */
  smooth(iterations = 1, factor = 0.5) {
    const index = this.geo.index;
    if (!index) return this;
    const p = this.pos;
    const n = p.count;
    const neighbours: number[][] = Array.from({ length: n }, () => []);
    const idx = index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      neighbours[a].push(b, c);
      neighbours[b].push(a, c);
      neighbours[c].push(a, b);
    }
    const tmp = new Float32Array(n * 3);
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < n; i++) {
        const nb = neighbours[i];
        let sx = 0, sy = 0, sz = 0;
        for (const j of nb) { sx += p.getX(j); sy += p.getY(j); sz += p.getZ(j); }
        const k = nb.length || 1;
        tmp[i * 3] = p.getX(i) + (sx / k - p.getX(i)) * factor;
        tmp[i * 3 + 1] = p.getY(i) + (sy / k - p.getY(i)) * factor;
        tmp[i * 3 + 2] = p.getZ(i) + (sz / k - p.getZ(i)) * factor;
      }
      (p.array as Float32Array).set(tmp);
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
    return this;
  }

  /** Cast toward a sphere of the mesh's mean radius (Blender Cast, type Sphere). */
  cast(factor: number) {
    this.geo.computeBoundingSphere();
    const r = this.geo.boundingSphere!.radius;
    const c = this.geo.boundingSphere!.center;
    return this.map((v) => {
      const d = v.clone().sub(c);
      const len = d.length() || 1;
      v.copy(c).add(d.multiplyScalar(1 + ((r * 0.8) / len - 1) * factor));
    });
  }

  /**
   * Vertex colours from a field — Blender's "Color Attribute" painted by a
   * procedural texture. `palette(t)` maps the field value to RGB (linear).
   */
  paint(field: Field, palette: (t: number) => [number, number, number]) {
    this.geo.computeVertexNormals();
    const p = this.pos;
    const nrm = this.geo.attributes.normal as THREE.BufferAttribute;
    const colors = new Float32Array(p.count * 3);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      n.fromBufferAttribute(nrm, i);
      const [r, g, b] = palette(field(v, n, i));
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    }
    this.geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return this;
  }

  /**
   * Box-projected UVs (Blender "Box" texture projection): each vertex takes the
   * two coordinates of the plane facing its dominant normal axis. Needed after
   * `weld()` when a normal map is used. Seams are hidden by noisy textures.
   */
  uvBox(scale = 1) {
    this.geo.computeVertexNormals();
    const p = this.pos;
    const n = this.geo.attributes.normal as THREE.BufferAttribute;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      const x = p.getX(i) * scale, y = p.getY(i) * scale, z = p.getZ(i) * scale;
      const [u, v] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y];
      uv[i * 2] = u; uv[i * 2 + 1] = v;
    }
    this.geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return this;
  }

  done() {
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    return this.geo;
  }
}

export const stack = (geo: THREE.BufferGeometry) => new Stack(geo);

/** sRGB hex → linear RGB triple for vertex colours. */
export function linear(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/** Multi-stop gradient in linear space (Blender ColorRamp, linear interpolation). */
export function ramp(stops: [number, string][]) {
  const cols = stops.map(([t, h]) => [t, linear(h)] as const);
  return (t: number): [number, number, number] => {
    const x = Math.min(1, Math.max(0, t));
    for (let i = 1; i < cols.length; i++) {
      const [t1, c1] = cols[i];
      const [t0, c0] = cols[i - 1];
      if (x <= t1) {
        const k = (x - t0) / (t1 - t0 || 1);
        return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
      }
    }
    return cols[cols.length - 1][1] as [number, number, number];
  };
}
