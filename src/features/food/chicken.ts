import * as THREE from "three";
import { fbm, noise3, normalMapFrom, principled, presets, ramp, ridged, rng, stack, tileable } from "@/lib/forja";

const V = (x: number, y: number) => new THREE.Vector2(x, y);

function lathe(points: THREE.Vector2[], segments: number, samples: number) {
  const pts = new THREE.SplineCurve(points).getSpacedPoints(samples);
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  return new THREE.LatheGeometry(pts, segments);
}

/** Batter crust: ridged crags + fine fBm grit — Blender Displace with a Musgrave Ridged texture. */
const crust = (seed: number) => (p: THREE.Vector3) =>
  ridged(p.x * 5.2 + seed, p.y * 5.2, p.z * 5.2) * 0.6 + fbm(p.x * 17, p.y * 17 + seed, p.z * 17, 3) * 0.4 - 0.5;

const batterRamp = ramp([[0, "#3a1606"], [0.3, "#7a3a0e"], [0.55, "#b06a22"], [0.78, "#d79a48"], [1, "#eec27a"]]);

function drumstickGeometry(seed: number) {
  const meat = lathe([V(0, 0.5), V(0.11, 0.52), V(0.15, 0.72), V(0.27, 0.98), V(0.43, 1.3), V(0.52, 1.6), V(0.5, 1.86), V(0.37, 2.06), V(0.17, 2.16), V(0, 2.18)], 120, 90);
  const f = crust(seed);
  const s = rng(seed);
  const squash = 0.82 + s() * 0.1;
  return stack(meat)
    .weld()
    .map((v) => { v.z *= squash; v.x += Math.sin(v.y * 1.7 + seed) * 0.04; })
    .displace((p) => f(p) * THREE.MathUtils.smoothstep(p.y, 0.62, 0.95), 0.11)
    .smooth(1, 0.3)
    .paint((p) => f(p) * 0.9 + 0.5 + (noise3(p.x * 3, p.y * 3, p.z * 3 + seed) - 0.5) * 0.35, batterRamp)
    .uvBox(1.5)
    .done();
}

function boneGeometry() {
  return stack(lathe([V(0, -0.14), V(0.1, -0.13), V(0.15, -0.07), V(0.14, 0.02), V(0.08, 0.1), V(0.065, 0.3), V(0.07, 0.62), V(0, 0.64)], 48, 32))
    .weld()
    .map((v) => { if (v.y < 0.05) v.x *= 1 + Math.cos(Math.atan2(v.z, v.x) * 2) * 0.18; }) // two-lobed knuckle
    .done();
}

function tenderGeometry(seed: number) {
  const s = rng(seed);
  const len = 1.0 + s() * 0.3;
  const f = crust(seed);
  return stack(new THREE.CapsuleGeometry(0.21, len, 16, 64))
    .weld()
    .map((v) => { v.z *= 0.6; v.x *= 1 + Math.sin(v.y * 2.2 + seed) * 0.12; })
    .bend((s() - 0.5) * 0.7, len)
    .displace(f, 0.07)
    .smooth(1, 0.3)
    .paint((p) => f(p) * 0.9 + 0.52 + (noise3(p.x * 3 + seed, p.y * 3, p.z * 3) - 0.5) * 0.3, batterRamp)
    .uvBox(1.5)
    .done();
}

function ginghamTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4eee4";
  g.fillRect(0, 0, 1024, 1024);
  const n = 16, w = 1024 / n;
  g.fillStyle = "rgba(186, 26, 30, 0.55)";
  for (let i = 0; i < n; i += 2) {
    g.fillRect(i * w, 0, w, 1024);
    g.fillRect(0, i * w, 1024, w);
  }
  // Grease spots — translucent, darker, irregular.
  const r = rng(5);
  for (let k = 0; k < 7; k++) {
    const x = 200 + r() * 620, y = 200 + r() * 620, rad = 30 + r() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(160, 110, 40, 0.28)");
    gr.addColorStop(1, "rgba(160, 110, 40, 0)");
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  const img = g.getImageData(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1024; x++) {
      const v = (noise3(x * 0.3, y * 0.3, 2) - 0.5) * 14;
      const i = (y * 1024 + x) * 4;
      img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export type Piece = { obj: THREE.Object3D; base: THREE.Vector3; rot: THREE.Euler; delay: number };

export function buildChicken() {
  const disposables: { dispose(): void }[] = [];
  const group = new THREE.Group();

  const grit = normalMapFrom(tileable((x, y, z) => ridged(x, y, z, 3), 18), 256, 4);
  const batter = principled({ ...presets.friedBatter, normalMap: grit, normalScale: 0.45 });
  const bone = principled(presets.bone);
  disposables.push(grit, batter, bone);

  // Parchment with gingham print, slightly crumpled and curling at the edges.
  const paperTex = ginghamTexture();
  const paperGeo = new THREE.PlaneGeometry(4.2, 3.0, 96, 72).rotateX(-Math.PI / 2);
  stack(paperGeo).map((v) => {
    const edge = Math.max(Math.abs(v.x) / 2.1, Math.abs(v.z) / 1.5);
    v.y = (fbm(v.x * 1.6, 0, v.z * 1.6) - 0.5) * 0.06 + Math.pow(Math.max(0, edge - 0.75) / 0.25, 2) * 0.12;
  });
  const paper = new THREE.Mesh(paperGeo, principled({ ...presets.paper, baseColor: "#e9e1d3", map: paperTex, roughness: 0.86, side: THREE.DoubleSide }));
  paper.rotation.y = 0.12;
  disposables.push(paperTex, paperGeo, paper.material as THREE.Material);
  group.add(paper);

  const pieces: Piece[] = [];
  const boneGeo = boneGeometry();
  disposables.push(boneGeo);

  const layout: { kind: "drum" | "tender"; pos: [number, number, number]; rot: [number, number, number] }[] = [
    // Drumsticks side by side, bones out to the right like a plated basket.
    { kind: "drum", pos: [-0.25, 0.42, -0.42], rot: [0.06, 0.32, Math.PI / 2 + 0.06] },
    { kind: "drum", pos: [-0.05, 0.42, 0.42], rot: [-0.05, -0.22, Math.PI / 2 - 0.04] },
    { kind: "tender", pos: [0.95, 0.15, 0.25], rot: [Math.PI / 2, 0, 0.35] },
    { kind: "tender", pos: [-1.2, 0.15, 0.85], rot: [Math.PI / 2, 0, -0.9] },
  ];
  layout.forEach((l, i) => {
    let obj: THREE.Object3D;
    if (l.kind === "drum") {
      const g = drumstickGeometry(11 + i * 7);
      disposables.push(g);
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(g, batter), new THREE.Mesh(boneGeo, bone));
      grp.position.y = -1.3; // pivot at the meaty centre
      obj = new THREE.Group().add(grp);
    } else {
      const g = tenderGeometry(31 + i * 5);
      disposables.push(g);
      obj = new THREE.Mesh(g, batter);
    }
    const base = new THREE.Vector3(...l.pos);
    const rot = new THREE.Euler(...l.rot);
    obj.position.copy(base);
    obj.rotation.copy(rot);
    group.add(obj);
    pieces.push({ obj, base, rot, delay: i * 0.12 });
  });

  // Crumbs that fell off the crust.
  const crumbGeo = stack(new THREE.IcosahedronGeometry(0.035, 1)).weld().displace((p) => noise3(p.x * 40, p.y * 40, p.z * 40) - 0.5, 0.02).done();
  const crumbMat = principled({ baseColor: "#c08236", roughness: 0.55, coat: 0.2 });
  const crumbs = new THREE.InstancedMesh(crumbGeo, crumbMat, 46);
  const r = rng(77);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < crumbs.count; i++) {
    const a = r() * Math.PI * 2, d = 0.4 + r() * 1.3;
    e.set(r() * 6, r() * 6, r() * 6);
    const s = 0.5 + r() * 1.2;
    m.compose(new THREE.Vector3(Math.cos(a) * d * 1.2, 0.03, Math.sin(a) * d * 0.8), q.setFromEuler(e), new THREE.Vector3(s, s * 0.7, s));
    crumbs.setMatrixAt(i, m);
  }
  disposables.push(crumbGeo, crumbMat);
  group.add(crumbs);

  return { group, pieces, dispose: () => disposables.forEach((d) => d.dispose()) };
}
