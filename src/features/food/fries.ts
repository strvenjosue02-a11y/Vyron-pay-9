import * as THREE from "three";
import { fbm, noise3, normalMapFrom, principled, presets, ramp, rng, scatterOnMesh, stack, tileable } from "@/lib/forja";

export type Fry = { mesh: THREE.Mesh; base: THREE.Vector3; rot: THREE.Euler; delay: number; lift: number };

/** One fry: rounded-square extrusion along Y with bend, twist, organic wobble and baked colour. */
function fryGeometry(length: number, seed: number) {
  const r = rng(seed);
  const w = 0.12 + r() * 0.03;
  const shape = new THREE.Shape();
  const h = w / 2, k = 0.022;
  shape.moveTo(-h + k, -h);
  shape.lineTo(h - k, -h); shape.quadraticCurveTo(h, -h, h, -h + k);
  shape.lineTo(h, h - k); shape.quadraticCurveTo(h, h, h - k, h);
  shape.lineTo(-h + k, h); shape.quadraticCurveTo(-h, h, -h, h - k);
  shape.lineTo(-h, -h + k); shape.quadraticCurveTo(-h, -h, -h + k, -h);
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, steps: 28, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.012, bevelSegments: 2, curveSegments: 3 });
  g.rotateX(-Math.PI / 2); // extrude along +Y
  g.translate(0, 0, 0);
  const tone = r();
  const golden = ramp([[0, "#7a3c0e"], [0.3, "#b86f22"], [0.6, "#dca04a"], [1, "#f0cf7e"]]);
  return stack(g)
    .weld()
    .bend((r() - 0.5) * 0.5, length)
    .twist((r() - 0.5) * 0.6)
    .displace((p) => fbm(p.x * 9 + seed, p.y * 5, p.z * 9) - 0.5, 0.006)
    .paint(
      (p, n) => {
        const t = p.y / length;
        const tip = Math.max(0, 1 - Math.min(t, 1 - t) * 9); // darker cut ends
        const corner = Math.pow(Math.abs(n.x * n.z) * 2, 2) * 0.35; // crispier edges
        const blotch = fbm(p.x * 14 + seed, p.y * 10, p.z * 14);
        return 0.55 + tone * 0.25 + (blotch - 0.5) * 0.5 - tip * 0.55 - corner;
      },
      golden,
    )
    .uvBox(2)
    .done();
}

/** Classic fry carton: tapered rounded box with a scalloped front and back. */
function cartonGeometry() {
  const H = 1.25;
  const g = new THREE.CylinderGeometry(0.62, 0.46, H, 96, 24, true, Math.PI);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i);
    const y = p.getY(i);
    const a = Math.atan2(z, x);
    const rad = Math.hypot(x, z);
    // circle → rounded square (superellipse), flattened front-to-back
    const c = Math.cos(a), s = Math.sin(a);
    const sq = 1 / Math.pow(Math.pow(Math.abs(c), 5) + Math.pow(Math.abs(s), 5), 1 / 5);
    x = c * rad * sq * 1.05;
    z = s * rad * sq * 0.62;
    // Scallop: the front and back rims dip in a smooth arc.
    const t = (y + H / 2) / H;
    const front = Math.pow(Math.abs(s), 3);
    const dip = front * Math.pow(Math.cos(c * Math.PI * 0.5), 2) * 0.28 * Math.pow(t, 6);
    p.setXYZ(i, x, y - dip, z);
  }
  g.translate(0, H / 2, 0);
  g.computeVertexNormals();
  return g;
}

function cartonTexture() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b5121b";
  g.fillRect(0, 0, 1024, 512);
  // Paper fibres
  const img = g.getImageData(0, 0, 1024, 512);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 1024; x++) {
      const n = (noise3(x * 0.6, y * 0.04, 1) - 0.5) * 18 + (noise3(x * 0.05, y * 0.05, 4) - 0.5) * 14;
      const i = (y * 1024 + x) * 4;
      img.data[i] += n; img.data[i + 1] += n * 0.4; img.data[i + 2] += n * 0.4;
    }
  g.putImageData(img, 0, 0);
  // Gold pinstripes and wordmark, centred on the front (u = 0.5 with thetaStart = π).
  g.fillStyle = "#e7b54a";
  g.fillRect(0, 392, 1024, 6);
  g.fillRect(0, 406, 1024, 2);
  g.fillStyle = "#fbe9c6";
  g.textAlign = "center";
  g.font = "700 64px 'Playfair Display SC', Georgia, serif";
  g.fillText("VYRON", 512, 330);
  g.font = "500 22px 'Karla Variable', sans-serif";
  g.fillText("PAPAS · DOBLE FRITURA", 512, 365);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildFries() {
  const disposables: { dispose(): void }[] = [];
  const group = new THREE.Group();

  // Micro-normal shared by all fries: starchy pitted surface.
  const fryNormal = normalMapFrom(tileable((x, y, z) => fbm(x, y, z, 4), 24), 256, 3);
  const fryMat = principled({ ...presets.fry, normalMap: fryNormal, normalScale: 0.25 });
  disposables.push(fryNormal, fryMat);

  const cartonTex = cartonTexture();
  const paperNormal = normalMapFrom(tileable((x, y, z) => noise3(x * 0.4, y * 6, z), 40), 256, 1.2);
  const cartonMat = principled({ ...presets.paper, map: cartonTex, normalMap: paperNormal, normalScale: 0.12, side: THREE.DoubleSide, coat: 0.15, coatRoughness: 0.6 });
  disposables.push(cartonTex, paperNormal, cartonMat);

  const cartonGeo = cartonGeometry();
  const carton = new THREE.Mesh(cartonGeo, cartonMat);
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55).rotateX(-Math.PI / 2), cartonMat);
  bottom.position.y = 0.01;
  disposables.push(cartonGeo, bottom.geometry);
  group.add(carton, bottom);

  // Salt crystals (shared instanced geometry per fry).
  const saltGeo = new THREE.BoxGeometry(0.014, 0.014, 0.014);
  const saltMat = principled({ baseColor: "#ffffff", roughness: 0.15, transmission: 0.6, thickness: 0.01, ior: 1.54, specular: 1 });
  disposables.push(saltGeo, saltMat);

  const fries: Fry[] = [];
  const rand = rng(42);
  const cols = 7, rows = 5;
  let k = 0;
  for (let rI = 0; rI < rows; rI++)
    for (let cI = 0; cI < cols; cI++) {
      if ((rI === 0 || rI === rows - 1) && (cI === 0 || cI === cols - 1)) continue; // round the bundle
      const len = 0.95 + rand() * 0.4;
      const geo = fryGeometry(len, 100 + k);
      disposables.push(geo);
      const mesh = new THREE.Mesh(geo, fryMat);
      // Stay inside the carton footprint (it narrows to ±0.48 × ±0.28 at the base).
      const x = (cI - (cols - 1) / 2) * 0.108 + (rand() - 0.5) * 0.03;
      const z = (rI - (rows - 1) / 2) * 0.075 + (rand() - 0.5) * 0.02;
      const base = new THREE.Vector3(x, 0.12 + rand() * 0.14, z);
      // Lean outward like a real bundle, but never through the walls.
      const rot = new THREE.Euler(z * 0.55 + (rand() - 0.5) * 0.08, rand() * Math.PI, -x * 0.4 + (rand() - 0.5) * 0.08);
      mesh.position.copy(base);
      mesh.rotation.copy(rot);
      const salt = new THREE.InstancedMesh(saltGeo, saltMat, 7);
      scatterOnMesh(new THREE.Mesh(geo), {
        count: 7, seed: 9 + k, scale: [0.6, 1.2], filter: (p) => p.y > len * 0.45,
      }).forEach((m, i) => salt.setMatrixAt(i, m));
      mesh.add(salt);
      group.add(mesh);
      fries.push({ mesh, base, rot, delay: rand() * 0.35, lift: 0.22 + rand() * 0.35 });
      k++;
    }

  return {
    group,
    fries,
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

