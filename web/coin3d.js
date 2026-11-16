// Moneda 3D del token (Three.js, se carga solo en la terminal de trading).
// Cara frontal y trasera con el logo del token, canto metálico rosa neón; gira sola y se puede girar con el dedo.
let THREE = null;

function faceTexture(T, logo, color, symbol) {
  return new Promise((resolve) => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(256, 220, 40, 256, 256, 256);
    g.addColorStop(0, "#2a1530"); g.addColorStop(1, "#0d0b12");
    x.fillStyle = g; x.beginPath(); x.arc(256, 256, 256, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#ff2e88"; x.lineWidth = 10; x.beginPath(); x.arc(256, 256, 236, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = "rgba(255,46,136,.35)"; x.lineWidth = 2; x.beginPath(); x.arc(256, 256, 214, 0, Math.PI * 2); x.stroke();
    const done = () => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; resolve(t); };
    if (!logo) {
      x.fillStyle = color || "#ff2e88"; x.font = "italic 600 150px 'Instrument Serif', Georgia, serif"; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(symbol || "", 256, 262); return done();
    }
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => { x.save(); x.beginPath(); x.arc(256, 256, 196, 0, Math.PI * 2); x.clip(); x.drawImage(im, 60, 60, 392, 392); x.restore(); done(); };
    im.onerror = done; im.src = logo;
  });
}

export async function mountCoin(el, { logo, color, symbol }) {
  if (!el) return () => {};
  if (!THREE) THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js");
  const T = THREE, w = el.clientWidth || 160, h = el.clientHeight || 160;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h); renderer.outputColorSpace = T.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(32, w / h, 0.1, 50); cam.position.set(0, 0, 4.2);
  scene.add(new T.AmbientLight(0xffffff, 0.55));
  const key = new T.DirectionalLight(0xffffff, 1.4); key.position.set(-2, 2, 3); scene.add(key);
  const pink = new T.PointLight(0xff2e88, 18, 10); pink.position.set(2.2, -0.6, 1.8); scene.add(pink);
  const cyan = new T.PointLight(0x3de0ff, 10, 10); cyan.position.set(-2.4, -1.4, -1.6); scene.add(cyan);
  const face = await faceTexture(T, logo, color, symbol);
  const edge = new T.MeshStandardMaterial({ color: 0xff2e88, metalness: 0.9, roughness: 0.25, emissive: 0x3a0820 });
  const front = new T.MeshStandardMaterial({ map: face, metalness: 0.35, roughness: 0.4 });
  const back = front.clone(); back.map = face.clone(); back.map.needsUpdate = true; back.map.center.set(0.5, 0.5); back.map.rotation = Math.PI;
  const coin = new T.Mesh(new T.CylinderGeometry(1, 1, 0.16, 96, 1), [edge, front, back]);
  coin.rotation.x = Math.PI / 2;
  const group = new T.Group(); group.add(coin); scene.add(group);
  // anillo de brillo
  const ring = new T.Mesh(new T.TorusGeometry(1.22, 0.012, 8, 128), new T.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.55 }));
  scene.add(ring);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let drag = null, vel = 0.012, run = true;
  el.style.touchAction = "pan-y";
  el.addEventListener("pointerdown", (e) => { drag = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", (e) => { if (drag === null) return; const d = (e.clientX - drag) * 0.012; group.rotation.y += d; vel = d; drag = e.clientX; });
  el.addEventListener("pointerup", () => { drag = null; });
  const tick = () => {
    if (!run) return;
    if (drag === null) { vel += ((reduce ? 0 : 0.012) - vel) * 0.03; group.rotation.y += vel; }
    group.position.y = reduce ? 0 : Math.sin(performance.now() / 900) * 0.04;
    ring.rotation.x = Math.PI / 2 + Math.sin(performance.now() / 1400) * 0.25;
    renderer.render(scene, cam);
    requestAnimationFrame(tick);
  };
  tick();
  return () => { run = false; renderer.dispose(); el.innerHTML = ""; };
}
