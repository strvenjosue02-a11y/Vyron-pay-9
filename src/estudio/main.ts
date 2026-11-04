/**
 * Estudio 3D — visor de los modelos generados (Tripo3D → gltf-transform).
 * Three.js puro (WebGL2), sin framework: carga GLB con meshopt, luz de estudio local
 * (RoomEnvironment), sombra suave, órbita táctil y modos de inspección (textura / arcilla / malla).
 */
import "./estudio.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

type Item = { id: string; name: string; category: string };
const ITEMS: Item[] = [
  { id: "burger-bacon", name: "Smash Bacon", category: "Hamburguesa" },
  { id: "burger-papas", name: "Clásica + papas", category: "Hamburguesa con papas" },
  { id: "pollo-papas", name: "Tenders + papas", category: "Pollo con papas" },
  { id: "papas", name: "Papas de la casa", category: "Papas" },
  { id: "nachos", name: "Nachos supremos", category: "Nachos" },
  { id: "batido-fresa", name: "Batido de fresa", category: "Batido" },
  { id: "batido-chocolate", name: "Batido de chocolate", category: "Batido" },
  { id: "batido-oreo", name: "Batido cookies & cream", category: "Batido" },
];
const thumbs = import.meta.glob<string>("./thumbs/*.webp", { eager: true, import: "default" });
const thumb = (id: string) => thumbs[`./thumbs/${id}.webp`];

// ---------------------------------------------------------------- DOM
const app = document.getElementById("app")!;
app.innerHTML = `
  <header class="top">
    <span class="brand">VYRON<b>·</b> Estudio 3D</span>
    <span id="summary" class="muted"></span>
  </header>
  <main class="layout">
    <section class="viewer" aria-label="Visor 3D">
      <canvas id="c" aria-label="Modelo 3D, arrastra para girar"></canvas>
      <div id="pending" class="pending" hidden>
        <img id="pending-img" alt="" />
        <p class="pending-title">Modelo pendiente</p>
        <p id="pending-text" class="muted"></p>
      </div>
      <div id="loading" class="loading" hidden><span></span></div>
      <div class="hud">
        <div>
          <p id="cat" class="eyebrow"></p>
          <h1 id="name"></h1>
          <p id="stats" class="stats"></p>
        </div>
        <div class="modes" role="radiogroup" aria-label="Modo de vista">
          <button role="radio" data-mode="tex" aria-checked="true">Textura</button>
          <button role="radio" data-mode="clay" aria-checked="false">Arcilla</button>
          <button role="radio" data-mode="wire" aria-checked="false">Malla</button>
        </div>
      </div>
    </section>
    <aside class="side">
      <ol id="list" class="list"></ol>
      <label class="drop" id="drop">
        <input id="file" type="file" accept=".glb,model/gltf-binary" />
        <span><b>Probar un .glb</b><br /><span class="muted">Arrástralo aquí o tócalo para elegirlo</span></span>
      </label>
    </aside>
  </main>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $("c") as HTMLCanvasElement;

// ---------------------------------------------------------------- escena
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping; // honesto con rojos y amarillos de comida
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0f0d0c");
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;

const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.9;
controls.enablePan = false;
controls.addEventListener("start", () => (controls.autoRotate = false));

const key = new THREE.DirectionalLight("#fff1e0", 2.2);
key.position.set(2.5, 4, 3);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.radius = 6;
key.shadow.bias = -0.0004;
scene.add(key, new THREE.HemisphereLight("#fff6ec", "#2a1a10", 0.35));
const rim = new THREE.DirectionalLight("#ffb072", 1.4);
rim.position.set(-3, 2, -3);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

let current: THREE.Object3D | null = null;
const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
const clay = new THREE.MeshStandardMaterial({ color: "#d8d2ca", roughness: 0.75 });
const wire = new THREE.MeshBasicMaterial({ color: "#ff7a3c", wireframe: true });
let mode: "tex" | "clay" | "wire" = "tex";

function applyMode() {
  current?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (!originals.has(m)) originals.set(m, m.material);
    m.material = mode === "tex" ? originals.get(m)! : mode === "clay" ? clay : wire;
  });
}

function frame(obj: THREE.Object3D) {
  // Normaliza: altura 1, apoyado en el suelo, centrado; la cámara encaja por ancho y alto.
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = 1 / Math.max(size.y, size.x * 0.8, size.z * 0.8);
  obj.scale.multiplyScalar(s);
  box.setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  box.setFromObject(obj);
  const sz = box.getSize(new THREE.Vector3());
  const r = sz.length() / 2;
  const fit = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect) * 1.05;
  camera.position.set(0, sz.y * 0.55 + fit * 0.28, fit);
  controls.target.set(0, sz.y * 0.45, 0);
  controls.update();
}

function stats(obj: THREE.Object3D, bytes?: number) {
  let tris = 0, textures = new Set<THREE.Texture>();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) for (const v of Object.values(mat)) if (v instanceof THREE.Texture) textures.add(v);
  });
  const mb = bytes ? ` · ${(bytes / 1048576).toFixed(1)} MB` : "";
  return `${Math.round(tris).toLocaleString("es-MX")} triángulos · ${textures.size} texturas${mb}`;
}

function show(obj: THREE.Object3D, bytes?: number) {
  if (current) {
    scene.remove(current);
    current.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mats = originals.get(m) ?? m.material;
      for (const mat of Array.isArray(mats) ? mats : [mats]) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
    originals.clear();
  }
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  current = obj;
  scene.add(obj);
  frame(obj);
  applyMode();
  controls.autoRotate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("stats").textContent = stats(obj, bytes);
  $("pending").hidden = true;
  canvas.style.visibility = "visible";
}

// ---------------------------------------------------------------- datos
let available = new Set<string>();
async function loadManifest() {
  try {
    const r = await fetch("models/manifest.json", { cache: "no-store" });
    if (r.ok) available = new Set((await r.json()).models as string[]);
  } catch { /* sin modelos publicados todavía */ }
  $("summary").textContent = `${available.size} de ${ITEMS.length} modelos listos`;
}

const list = $("list");
function renderList(active: string) {
  list.innerHTML = ITEMS.map((it, i) => `
    <li><button data-id="${it.id}" aria-current="${it.id === active}" class="row">
      <img src="${thumb(it.id)}" alt="" width="56" height="56" loading="${i < 4 ? "eager" : "lazy"}" />
      <span class="row-text"><span class="row-name">${it.name}</span><span class="muted small">${it.category}</span></span>
      <span class="pill ${available.has(it.id) ? "ok" : ""}">${available.has(it.id) ? "Listo" : "Pendiente"}</span>
    </button></li>`).join("");
}

let token = 0;
async function select(id: string) {
  const it = ITEMS.find((x) => x.id === id)!;
  renderList(id);
  $("cat").textContent = it.category;
  $("name").textContent = it.name;
  const mine = ++token;
  if (!available.has(id)) {
    if (current) { scene.remove(current); current = null; }
    canvas.style.visibility = "hidden";
    ($("pending-img") as HTMLImageElement).src = thumb(id);
    $("pending-text").textContent = "Esta es la foto ya preparada (recorte limpio, centrada). Su modelo GLB aparecerá aquí en cuanto Tripo3D lo genere.";
    $("pending").hidden = false;
    $("stats").textContent = "Sin modelo todavía";
    return;
  }
  $("loading").hidden = false;
  try {
    const r = await fetch(`models/${id}.glb`);
    const buf = await r.arrayBuffer();
    const gltf = await loader.parseAsync(buf, "");
    if (mine === token) show(gltf.scene, buf.byteLength);
  } catch (e) {
    $("stats").textContent = "No se pudo cargar el modelo: " + (e as Error).message;
  } finally {
    $("loading").hidden = true;
  }
}

list.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-id]");
  if (b) select(b.dataset.id!);
});

document.querySelectorAll<HTMLButtonElement>(".modes button").forEach((b) =>
  b.addEventListener("click", () => {
    mode = b.dataset.mode as typeof mode;
    document.querySelectorAll(".modes button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    applyMode();
  }),
);

async function openFile(f: File) {
  $("loading").hidden = false;
  try {
    const buf = await f.arrayBuffer();
    const gltf = await loader.parseAsync(buf, "");
    $("cat").textContent = "Archivo local";
    $("name").textContent = f.name.replace(/\.glb$/i, "");
    show(gltf.scene, buf.byteLength);
  } catch (e) {
    $("stats").textContent = "Ese archivo no es un GLB válido: " + (e as Error).message;
  } finally {
    $("loading").hidden = true;
  }
}
($("file") as HTMLInputElement).addEventListener("change", (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) openFile(f);
});
const drop = $("drop");
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  const f = (e as DragEvent).dataTransfer?.files?.[0];
  if (f) openFile(f);
});

// ---------------------------------------------------------------- bucle
function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
  if (current) frame(current);
}
new ResizeObserver(resize).observe(canvas);

let visible = true;
document.addEventListener("visibilitychange", () => (visible = !document.hidden));
renderer.setAnimationLoop(() => {
  if (!visible || !current) return;
  controls.update();
  renderer.render(scene, camera);
});

loadManifest().then(() => select(ITEMS.find((i) => available.has(i.id))?.id ?? ITEMS[0].id));
