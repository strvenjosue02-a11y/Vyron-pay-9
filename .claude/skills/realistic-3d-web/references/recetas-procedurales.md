# Recetas procedurales

Convenciones del repo (copiadas de `src/features/burger/`): geometrías como **funciones puras**
(`geometry.ts`) que devuelven `BufferGeometry`; texturas con `canvasTexture(size, paint, srgb)` y
ruido determinista `noise3`/`fbm` (`textures.ts`, valores en [0,1], sin dependencias); todo se crea
en un `useMemo` (`useXAssets`) y se libera en `useEffect(() => () => dispose…)`. Importa `three` o
`three/webgpu` según el renderer de la página (ver SKILL.md §2).

Evidencia: burger completo [probado]; pollo frito y papas [probado en lab, 2026-11-04, WebGL2];
resto [sin probar] (derivado de `research/comida-procedural.md`).

## Utilidades

```ts
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm, noise3 } from "@/features/burger/textures"; // o copia: hash + value noise, ~20 líneas

/** Suelda costuras para normales suaves. Quita uv/normal antes o mergeVertices no une nada. */
export function weld(geo: THREE.BufferGeometry) {
  let g = geo.clone();
  g.deleteAttribute("uv"); g.deleteAttribute("normal");
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  return g;
}

/** Desplaza a lo largo de normales SUAVES. Llamar sobre geometría ya soldada (weld). */
export function displace(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3) => number) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
    p.addScaledVector(n, fn(p)); pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}
```
**Corrección probada** a `research/comida-procedural.md` §0: su `displaceAlongNormal` llama
`computeVertexNormals()` sobre un `IcosahedronGeometry` (no indexado) **antes** de soldar → cada
copia de un vértice recibe la normal de su cara, se desplaza distinto y salen miles de pinholes
oscuros. Orden correcto: `weld` → `displace`. Además baja de 97 148 a 16 812 vértices (mismos 33 620 tris).

## Patrón lathe (pan, plato, vaso, jarrón, cúpula, columna)
`lathe(points)` de `geometry.ts`: `SplineCurve(points).getSpacedPoints(48)` → UV v ≈ distancia a lo
largo del perfil (el mapa de color se pinta como gradiente vertical), polos con x = 0, y
`wobble(geo, radial, vertical, freq, seed)` para irregularidad orgánica (salta r≈0 para no abrir el polo).
- Pan: perfil `TOP_BUN` (9 puntos) + `wobble(0.05, 0.05, 1.6)` [probado].
- Plato: `[V(0,0), V(0.9,0), V(1.0,0.04), V(1.25,0.12), V(1.3,0.13), V(1.28,0.1), V(0.95,0.02), V(0,0.02)]` (borde levantado) [sin probar].
- Jarrón/columna: mismo patrón con más puntos; sin wobble en arquitectura (o 0.005).

## Discos irregulares (carne, galleta, roca plana)
`pattyGeometry()`: `CylinderGeometry(r, r, h, 128, 12)` y por vértice: hombros redondeados
`1 - 0.09·|t|^4`, borde fbm en ángulo `(fbm(cos·2.5, t·0.8, sin·2.5)-0.5)·0.14`, migas de alta
frecuencia y abombado solo en tapas [probado]. Tapas: UV circulares; lateral: UV cilíndricas.

## Láminas drapeadas (queso, mantel, tela sobre mueble)
`cheeseGeometry()`: `PlaneGeometry(2,2,56,56)` horizontal, `sag = (d-0.98)^1.3·1.25` fuera del
soporte, `pull` hacia dentro para redondear esquinas, ondulación `noise3` [probado]. Mantel: misma
idea con el borde de la mesa como umbral y caída lineal mayor [sin probar].

## Hojas (lechuga, pétalos)
`lettuceGeometry()`: `RingGeometry(0.001, 1.3, 160, 12)` con volantes de dos frecuencias
(`sin(a·13)` + `sin(a·29)`, amplitud ∝ t²) y lóbulos de ruido; `side: DoubleSide` [probado].

## Instancias sobre superficie (sésamo, sal, remaches, hojas)
`sesameMatrices(count)`: muestrea el `SplineCurve` del perfil (posición + normal 2D girada en Y),
PRNG Park–Miller determinista, `Matrix4.compose` → `instancedMesh.setMatrixAt` [probado, 110 inst.].
Para mallas arbitrarias: `MeshSurfaceSampler` (`three/examples/jsm/math/MeshSurfaceSampler.js`) [sin probar].

## Pollo frito [probado en lab]
```ts
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
const simplex = new SimplexNoise();
const sfbm = (x: number, y: number, z: number, oct = 4) => { let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * simplex.noise3d(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2; } return s / n; };

export function friedChickenGeometry(detail = 40) { // 40 ≈ 33.6k tris; 24 en móvil ≈ 12.5k
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.scale(1.35, 0.85, 0.95);
  g = displace(weld(g), (p) =>
    0.18 * sfbm(p.x * 1.2, p.y * 1.2, p.z * 1.2, 3)          // bultos del rebozado
    + 0.045 * Math.abs(sfbm(p.x * 9, p.y * 9, p.z * 9))      // crujiente (ridged)
    + 0.012 * simplex.noise3d(p.x * 40, p.y * 40, p.z * 40)); // migas
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const gold = new THREE.Color("#d9952f"), dark = new THREE.Color("#7a3e12"), c = new THREE.Color(), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    c.copy(dark).lerp(gold, THREE.MathUtils.clamp(0.5 + 1.8 * sfbm(p.x * 9, p.y * 9, p.z * 9, 3), 0, 1)).toArray(col, i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}
// material: MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.35 })
```
Hueso (`CapsuleGeometry(0.12, 0.9)`, `#efe6d2`) [sin probar]. MEJORA posible (WebGPURenderer):
desplazamiento en GPU con TSL `positionNode` + `mx_fractal_noise_float` [sin probar].

## Papas fritas [probado en lab]
`RoundedBoxGeometry(0.07, 1, 0.07, 2, 0.012)` en `InstancedMesh` de 36, `setColorAt` con
`#e9b44c` ±`offsetHSL(±0.01, 0, ±0.06)`, PRNG determinista. Cucurucho:
`CylinderGeometry(0.45, 0.32, 0.6, 32, 1, true)` rojo, `DoubleSide`, centrado en y=0.15.
**Corrección probada**: con `y = 0.25 + rand·0.25` (receta original) las papas largas asoman por
debajo del cucurucho; usar `y = 0.5 + rand·0.2` (base de la papa ≥ fondo del cono).
Puntas oscuras con mapa de degradado vertical, sal con cubitos instanciados [sin probar].

## Rodaja de tomate / cebolla / pepinillo [probado en burger]
Cilindro fino con materiales por grupo `[lateral, tapa, tapa]`; tapa con `tomatoSliceTexture()`
(anillo de piel, 5 cámaras con semillas). Cebolla: `TorusGeometry(0.42, 0.035, 12, 64)` girado.

## Sombra de contacto barata [probado]
`PlaneGeometry(3.4,3.4)` horizontal + `MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })`
(degradado radial negro 0.75→0); escala/posición en `useFrame`. Funciona con cualquier renderer.

## Muebles y arquitectura [sin probar — primitivas sugeridas]
| Objeto | Primitiva | Notas |
|---|---|---|
| Mesa/estante | `RoundedBoxGeometry(w,h,d,3,r≈0.01)` para tablero y patas | bordes redondeados = reflejos creíbles; madera de `examples/textures/hardwood2_*` |
| Silla tapizada | RoundedBox con radio grande + `displace` leve (cojín) | `sheen` tela |
| Sofá | RoundedBox por pieza (asiento, respaldo, brazos) | mejor glTF Khronos `GlamVelvetSofa` |
| Lámpara | `lathe` (pantalla) + `CylinderGeometry` (vástago) | pantalla `transmission` 0.3 o emisiva |
| Pared con hueco | `Shape` + `holes` → `ExtrudeGeometry({ depth, bevelEnabled: false })` | ventanas/puertas |
| Moldura/perfil | `ExtrudeGeometry` con `extrudePath` (curva) | cornisas, marcos |
| Columna | `lathe` con perfil de basa/fuste/capitel | |
| Edificio low-poly | Box por planta + InstancedMesh de ventanas | o Quaternius/KayKit CC0 |
| Suelo | `PlaneGeometry` + textura repetida (`RepeatWrapping`, `repeat.set`) | |
