/**
 * Forja · scatter — Geometry Nodes "Distribute Points on Faces" (Poisson-disk
 * style rejection) + "Instance on Points" with align-to-normal and random
 * rotation/scale. Returns matrices for an InstancedMesh.
 */
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { rng } from "./noise";

export type ScatterOptions = {
  count: number;
  minDistance?: number;
  scale?: [number, number];
  seed?: number;
  /** Keep a sample only if this returns true (e.g. upper half only). */
  filter?: (p: THREE.Vector3, n: THREE.Vector3) => boolean;
  offset?: number;
};

export function scatterOnMesh(mesh: THREE.Mesh, o: ScatterOptions) {
  const sampler = new MeshSurfaceSampler(mesh).build();
  const rand = rng(o.seed ?? 3);
  (sampler as unknown as { setRandomGenerator(f: () => number): void }).setRandomGenerator(rand);
  const pts: THREE.Vector3[] = [];
  const out: THREE.Matrix4[] = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion(), spin = new THREE.Quaternion();
  const min2 = (o.minDistance ?? 0) ** 2;
  const [s0, s1] = o.scale ?? [1, 1];
  for (let tries = 0; out.length < o.count && tries < o.count * 40; tries++) {
    sampler.sample(p, n);
    if (o.filter && !o.filter(p, n)) continue;
    if (min2 > 0 && pts.some((x) => x.distanceToSquared(p) < min2)) continue;
    pts.push(p.clone());
    q.setFromUnitVectors(up, n);
    spin.setFromAxisAngle(up, rand() * Math.PI * 2);
    q.multiply(spin);
    const s = s0 + (s1 - s0) * rand();
    const pos = p.clone().addScaledVector(n, o.offset ?? 0);
    out.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(s, s, s)));
  }
  return out;
}
