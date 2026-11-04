# Comida realista procedural en Three.js / R3F (sin modelos descargados)

(2026-11-04, 3d-researcher). Responde al pedido de `web-builder` en HANDOFF.
APIs verificadas en three 0.187: `LatheGeometry(points, segments)`, `CylinderGeometry`, `IcosahedronGeometry`, `RoundedBoxGeometry(w,h,d,segments,radius)` (`three/addons/geometries/RoundedBoxGeometry.js`), `SimplexNoise.noise3d` (`three/addons/math/SimplexNoise.js`), `mergeVertices` (`three/addons/utils/BufferGeometryUtils.js`), `MeshPhysicalMaterial` (`sheen`, `clearcoat`, `transmission`, `thickness`) — todas se traducen a NodeMaterial en WebGPU. **El código de abajo no se ha ejecutado en este repo** (es una receta): web-builder debe probarlo y anotar en LESSONS lo que falle.
Valores de material: ver tabla en `realismo.md` §7. Tone mapping recomendado: `NeutralToneMapping` (no satura el rojo del tomate ni quema el queso).

## 0. Utilidades comunes
```ts
// src/components/three/food/noise.ts
import * as THREE from 'three/webgpu';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const simplex = new SimplexNoise(); // acepta un PRNG: new SimplexNoise({ random: mulberry32(7) }) para resultados estables

export function fbm(x: number, y: number, z: number, oct = 4, lac = 2, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * simplex.noise3d(x * f, y * f, z * f); n += a; a *= gain; f *= lac; }
  return s / n; // ~[-1,1]
}

/** Desplaza cada vértice a lo largo de su normal con fn(pos). Usa la POSICIÓN como semilla →
 *  los vértices duplicados de costuras reciben el mismo valor y no se abren grietas. */
export function displaceAlongNormal(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3) => number) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
    p.addScaledVector(n, fn(p));
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  return smoothNormals(geo);
}

/** Recalcula normales suaves soldando costuras (hay que quitar uv/normal antes de mergeVertices). */
export function smoothNormals(geo: THREE.BufferGeometry, keepUV = false) {
  let g = geo;
  if (!keepUV) { g = geo.clone(); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-4); }
  g.computeVertexNormals();
  return g;
}

/** Textura de canvas reutilizable (map / bump / roughness). Libera con tex.dispose() al desmontar. */
export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
```
Todo se construye en `useMemo` y se libera en `useEffect(() => () => { geo.dispose(); mat.dispose(); tex.dispose() }, [])`. R3F libera automáticamente geometrías/materiales declarados como JSX, pero **no** los que pasas por prop `geometry={...}` creados a mano → disponer manualmente.

## 1. Pan (bun) — LatheGeometry + ruido + sésamo instanciado
```tsx
function bunProfile(r = 1, h = 0.75, steps = 24) {
  // Cúpula: de la base (r, 0) al polo (0, h). Superelipse → hombros redondeados como un pan real.
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = t * Math.PI / 2;
    const x = r * Math.pow(Math.cos(a), 0.6), y = h * Math.pow(Math.sin(a), 0.9);
    pts.push(new THREE.Vector2(Math.max(x, 1e-4), y));
  }
  pts.unshift(new THREE.Vector2(r * 0.97, -0.04)); // pequeño reborde inferior
  pts.unshift(new THREE.Vector2(1e-4, -0.04));     // cierra la base
  return pts;
}
export function useBunTop() {
  return useMemo(() => {
    const g = new THREE.LatheGeometry(bunProfile(), 96);
    // bultos de baja frecuencia (forma irregular) + microgranulado
    return displaceAlongNormal(g, p => 0.035 * fbm(p.x * 1.5, p.y * 1.5, p.z * 1.5, 3) + 0.004 * simplex.noise3d(p.x * 25, p.y * 25, p.z * 25));
  }, []);
}
// Base del pan: mismo perfil con h≈0.35, rotado 180° en X, o un cilindro achatado con bordes redondeados.
```
Material corteza: `<meshPhysicalMaterial color="#c47a2c" roughness={0.6} clearcoat={0.25} clearcoatRoughness={0.45} sheen={0.2} sheenColor="#f0c890" vertexColors />`.
Gradiente tostado: añade `color` por vértice: más oscuro arriba (`#a85d1e`), más claro cerca de la base (`#e6b26a`), con `geo.setAttribute('color', ...)` usando `p.y / h` + ruido.

**Sésamo (InstancedMesh, ~120–200 semillas, 1 draw call):**
```tsx
function Sesame({ count = 160, r = 1, h = 0.75 }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 8, 6).scale(0.028, 0.012, 0.016), []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), spin = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const a = Math.acos(1 - Math.random() * 0.85); // ángulo desde el polo; concentra semillas arriba
      const th = Math.random() * Math.PI * 2;
      const rad = r * Math.pow(Math.sin(a), 0.6), y = h * Math.pow(Math.cos(a), 0.9); // mismo perfil que bunProfile
      p.set(Math.cos(th) * rad, y + 0.008, Math.sin(th) * rad);
      n.set(p.x / (r * r), p.y / (h * h), p.z / (r * r)).normalize(); // normal de elipsoide ≈ normal del pan
      q.setFromUnitVectors(up, n).multiply(spin.setFromAxisAngle(up, Math.random() * Math.PI));
      m.compose(p, q, s.setScalar(0.8 + Math.random() * 0.4));
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [count, r, h]);
  return <instancedMesh ref={ref} args={[geo, undefined, count]} castShadow>
    <meshStandardMaterial color="#f3e2b8" roughness={0.45} />
  </instancedMesh>;
}
```
Más preciso: `MeshSurfaceSampler` (`three/addons/math/MeshSurfaceSampler.js`) sobre la malla del pan con `setWeightAttribute` para evitar la base; da posición + normal exactas.

## 2. Carne (patty) — cilindro desplazado + textura de "char" en canvas
```tsx
export function usePatty(r = 1.05, h = 0.28) {
  return useMemo(() => {
    const g = new THREE.CylinderGeometry(r, r * 0.98, h, 96, 6, false);
    const pos = g.attributes.position, p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const ang = Math.atan2(p.z, p.x), rad = Math.hypot(p.x, p.z);
      // borde irregular (contorno no circular) + abombado central
      const edge = 1 + 0.06 * fbm(Math.cos(ang) * 2, Math.sin(ang) * 2, p.y * 3, 3);
      const k = rad > 1e-3 ? edge : 1;
      p.x *= k; p.z *= k;
      p.y += (1 - (rad / r) ** 2) * 0.03 * Math.sign(p.y);               // abomba arriba/abajo
      p.y += 0.02 * fbm(p.x * 4, p.y * 4, p.z * 4, 4);                     // textura carne picada
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    return smoothNormals(g, true); // conserva uv para el char
  }, [r, h]);
}
export function charTexture(size = 512) {
  return canvasTexture(size, (ctx, s) => {
    ctx.fillStyle = '#5a321e'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i++) {                       // grumos de carne picada
      const x = Math.random() * s, y = Math.random() * s, rr = Math.random() * 3 + 0.5;
      const l = 15 + Math.random() * 25;
      ctx.fillStyle = `hsl(${18 + Math.random() * 10}, 45%, ${l}%)`;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.55;                                // zonas quemadas
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = '#140a06';
      ctx.beginPath(); ctx.arc(Math.random() * s, Math.random() * s, Math.random() * 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#120804'; ctx.lineWidth = s * 0.025; // marcas de parrilla (opcional)
    for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(0, (k * s) / 6); ctx.lineTo(s, (k * s) / 6 - s * 0.1); ctx.stroke(); }
  });
}
// <mesh geometry={patty}><meshPhysicalMaterial map={char} bumpMap={char} bumpScale={2} roughness={0.55} clearcoat={0.35} clearcoatRoughness={0.3} /></mesh>
```
La tapa del CylinderGeometry tiene UV circulares y el lateral UV cilíndricas → la misma textura vale para ambas. Para el lateral se puede usar un segundo material (grupos 0 = lateral, 1 = tapa sup., 2 = tapa inf.: `material={[side, top, bottom]}`).

## 3. Queso fundido — plano drapeado
```tsx
export function useCheese(size = 2.0, pattyR = 1.0, seg = 48) {
  return useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    g.rotateY(Math.PI / 8); // esquinas no alineadas con la cámara
    const pos = g.attributes.position, p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const d = Math.hypot(p.x, p.z);
      const over = Math.max(0, d - pattyR * 0.92);                 // parte que cuelga fuera de la carne
      p.y -= over * over * 1.6 + over * 0.15;                       // caída parabólica
      p.y += 0.006 * simplex.noise3d(p.x * 6, 0, p.z * 6);          // ondulación
      // las esquinas "gotean": se estiran hacia abajo
      p.x *= 1 - over * 0.12; p.z *= 1 - over * 0.12;
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    return g;
  }, [size, pattyR, seg]);
}
// <mesh geometry={cheese} position-y={0.15}><meshPhysicalMaterial color="#f2a516" roughness={0.35} sheen={0.15} sheenColor="#ffd27a" side={THREE.DoubleSide} transmission={0.05} thickness={0.2} /></mesh>
```
Grosor: duplicar la malla 0.012 más abajo, o usar `THREE.ExtrudeGeometry` de un cuadrado y deformar igual. En WebGPU, `MeshSSSNodeMaterial` con `thicknessColorNode = color('#ff9a1a')` da el brillo translúcido del queso al contraluz.

## 4. Lechuga — anillo ondulado con borde rizado
```tsx
export function useLettuce(rIn = 0.0, rOut = 1.35, seg = 160) {
  return useMemo(() => {
    const g = new THREE.RingGeometry(Math.max(rIn, 0.01), rOut, seg, 10).rotateX(-Math.PI / 2);
    const pos = g.attributes.position, p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const d = Math.hypot(p.x, p.z), t = d / rOut, a = Math.atan2(p.z, p.x);
      // ruffle: frecuencia alta + amplitud que crece hacia el borde (t^2.5)
      const ruffle = Math.sin(a * 22 + simplex.noise3d(p.x * 2, 0, p.z * 2) * 3) * 0.07 * t ** 2.5;
      const droop = -0.12 * t ** 2;                                  // cae por el peso
      p.y = ruffle + droop + 0.03 * fbm(p.x * 3, 1, p.z * 3, 3);
      const edge = 1 + 0.08 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, 0, 3); // contorno irregular
      p.x *= edge; p.z *= edge;
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    return g;
  }, [rIn, rOut, seg]);
}
// 2–3 hojas apiladas con rotación distinta. Material: color="#6aa832" roughness={0.45} clearcoat={0.4} clearcoatRoughness={0.2} side={DoubleSide}
// + mapa de nervios (canvas: líneas radiales claras #c8e89a sobre verde) como map y bumpMap.
```

## 5. Rodaja de tomate — cilindro fino + textura radial
```tsx
export function tomatoSliceTexture(size = 512) {
  return canvasTexture(size, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#c21d14'; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();     // piel
    ctx.fillStyle = '#e2432f'; ctx.beginPath(); ctx.arc(c, c, c * 0.92, 0, Math.PI * 2); ctx.fill(); // pared
    const lobes = 5;
    for (let k = 0; k < lobes; k++) {                                   // cámaras con gel y semillas
      const a = (k / lobes) * Math.PI * 2;
      ctx.save(); ctx.translate(c + Math.cos(a) * c * 0.48, c + Math.sin(a) * c * 0.48); ctx.rotate(a);
      ctx.fillStyle = '#f0765a'; ctx.beginPath(); ctx.ellipse(0, 0, c * 0.3, c * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#efd27a';
      for (let j = 0; j < 9; j++) { ctx.beginPath(); ctx.ellipse((Math.random() - 0.5) * c * 0.4, (Math.random() - 0.5) * c * 0.25, 5, 3, Math.random() * 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.fillStyle = '#e85a42'; ctx.beginPath(); ctx.arc(c, c, c * 0.18, 0, Math.PI * 2); ctx.fill(); // núcleo
  });
}
// <mesh><cylinderGeometry args={[0.6, 0.6, 0.07, 64]} />
//   {[side, top, top].map(...)}  side: color #b81a12 roughness 0.3 clearcoat 0.7 ; top: map={tex} roughness 0.2 transmission 0.12 thickness 0.4 ior 1.35
```

## 6. Aros de cebolla
`<torusGeometry args={[r, 0.035, 12, 64]} />` escalado `scale-y={0.6}`, 3–4 aros concéntricos (r = 0.25, 0.38, 0.5, 0.62) con ligera inclinación aleatoria. Material: `color="#f1e4ee" roughness={0.3} transmission={0.3} thickness={0.2}`; morada `#8b3b6e` hacia fuera. Rebozados (onion rings fritos): mismo toro + `displaceAlongNormal` con fbm alta frecuencia (ver pollo).

## 7. Papas fritas — RoundedBox instanciado
```tsx
function Fries({ count = 36 }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(() => new RoundedBoxGeometry(0.07, 1, 0.07, 2, 0.012), []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D(), col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.32;
      o.position.set(Math.cos(a) * r, 0.25 + Math.random() * 0.25, Math.sin(a) * r * 0.6);
      o.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
      o.scale.set(1, 0.6 + Math.random() * 0.6, 1);           // longitudes distintas
      o.updateMatrix(); ref.current.setMatrixAt(i, o.matrix);
      ref.current.setColorAt(i, col.set('#e9b44c').offsetHSL((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.12)); // tostado variable
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [count]);
  return <instancedMesh ref={ref} args={[geo, undefined, count]} castShadow receiveShadow>
    <meshPhysicalMaterial roughness={0.55} clearcoat={0.3} clearcoatRoughness={0.4} bumpMap={grainTex} bumpScale={0.6} />
  </instancedMesh>;
}
```
Puntas más oscuras: textura vertical (canvas con degradado a marrón en los extremos v=0/v=1) como `map` multiplicado por `instanceColor`. Sal: InstancedMesh de cubitos 0.006 blancos sobre la superficie (opcional). Cucurucho: `LatheGeometry` o `CylinderGeometry(0.45, 0.32, 0.6, 32, 1, true)` rojo.

## 8. Pollo frito — esfera muy subdividida + ruido de alta frecuencia + colores por vértice
```tsx
export function useFriedChicken() {
  return useMemo(() => {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 40); // no indexada; 20*(41^2)=33620 tris (bajar a 24 en móvil ≈12.5k)
    g.scale(1.35, 0.85, 0.95);                                 // forma de muslo
    g = displaceAlongNormal(g, p => {
      const lumps = 0.18 * fbm(p.x * 1.2, p.y * 1.2, p.z * 1.2, 3);           // bultos grandes del rebozado
      const crisp = 0.045 * Math.abs(fbm(p.x * 9, p.y * 9, p.z * 9, 4, 2.1));   // "ridged": crujiente
      const crumbs = 0.012 * simplex.noise3d(p.x * 40, p.y * 40, p.z * 40);
      return lumps + crisp + crumbs;
    });
    // color por vértice: huecos (desplazamiento bajo) más oscuros, picos dorados
    const pos = g.attributes.position, colors = new Float32Array(pos.count * 3);
    const gold = new THREE.Color('#d9952f'), dark = new THREE.Color('#7a3e12'), c = new THREE.Color(), p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const t = THREE.MathUtils.clamp(0.5 + 1.8 * fbm(p.x * 9, p.y * 9, p.z * 9, 3), 0, 1);
      c.copy(dark).lerp(gold, t).toArray(colors, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);
}
// <mesh geometry={chicken}><meshPhysicalMaterial vertexColors roughness={0.6} clearcoat={0.35} clearcoatRoughness={0.35} /></mesh>
// Hueso: <capsuleGeometry args={[0.12, 0.9, 6, 16]} /> color "#efe6d2" roughness 0.5 + esfera en la punta, saliendo por un extremo.
```
- MEJORA (WebGPU): mover el desplazamiento a GPU con TSL (`material.positionNode = positionLocal.add(normalLocal.mul(mx_fractal_noise_float(positionLocal.mul(9), 4)))`) y la normal con `mx_heighttonormal`/bump TSL: geometría base mucho más ligera y detalle "infinito". No disponible con WebGLRenderer puro (no aplica aquí: el fallback de WebGPURenderer a WebGL2 sí ejecuta TSL). **No probado**.
- Alternativa barata en móvil: icosaedro detail 12 + `bumpMap` de canvas con ruido (requiere UV: usar `SphereGeometry` en lugar de icosaedro, que sí tiene UV).

## 9. Platos elegantes
Plato: `LatheGeometry` con perfil (borde levantado) + `meshPhysicalMaterial color="#f7f5f0" roughness={0.12} clearcoat={1}`. Salsas: `CircleGeometry` desplazado con ruido + `roughness 0.1, clearcoat 1` (brillo húmedo). Gotas: esferas achatadas instanciadas. Hierbas: planos pequeños instanciados con `side: DoubleSide`.

## 10. Ensamblar la hamburguesa + "exploded view" con scroll
Alturas típicas (radio pan = 1): base 0.0 → carne 0.32 → queso 0.47 → tomate 0.52 → lechuga 0.58 → cebolla 0.62 → tapa 0.66. Presupuesto total: **< 60 k triángulos** y ≤ 10 draw calls (ver `rendimiento-movil.md`).

Patrón recomendado con el stack del repo (GSAP ScrollTrigger + Lenis fuera del canvas, sin re-render de React):
```tsx
const progress = { current: 0 };   // ref compartida, no estado
// En el componente DOM:
useGSAP(() => {
  ScrollTrigger.create({ trigger: sectionRef.current, start: 'top top', end: '+=150%', pin: true, scrub: true,
    onUpdate: s => { progress.current = s.progress; } });
});
// En la escena:
const LAYERS = [ { ref: baseRef, y: 0, spread: 0 }, { ref: pattyRef, y: 0.32, spread: 1 }, /* ... */ { ref: topRef, y: 0.66, spread: 6 } ];
useFrame((_, dt) => {
  const e = reduced ? 1 : progress.current;           // prefers-reduced-motion → estado final estático
  for (const l of LAYERS) {
    const target = l.y + l.spread * 0.45 * easeInOutCubic(e);
    l.ref.current.position.y = THREE.MathUtils.damp(l.ref.current.position.y, target, 8, dt); // suavizado sin saltos
  }
  group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, e * Math.PI * 0.5, 6, dt);
});
```
- Alternativa solo R3F: `<ScrollControls pages={3}>` + `useScroll().range(from, len)` por capa (drei `web/ScrollControls.js`). Choca con Lenis (doble scroll) → elegir uno.
- Con `frameloop="demand"` llamar `invalidate()` desde `onUpdate` del ScrollTrigger.
- Mostrar etiquetas por capa con `<Html>` de drei o DOM superpuesto que aparece con `motion` cuando `progress` pasa umbrales.
- `prefers-reduced-motion`: sin pin/scrub; mostrar la vista explotada estática (o una imagen) y sin rotación.

## Fuentes
- Código de three 0.187 en `node_modules/three` (geometrías, SimplexNoise, BufferGeometryUtils, MeshPhysicalMaterial, MaterialXNodes).
- Valores visuales: referencia de los modelos PBR de Khronos (`IridescentDishWithOlives`, `Avocado`) y fotografía de comida; empíricos, ajustar.
