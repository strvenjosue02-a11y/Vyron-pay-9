---
name: realistic-3d-web
description: Úsala cuando pidan 3D realista en la web con Three.js / React Three Fiber — producto, comida, muebles, edificios, humanos o partes del cuerpo, animales, escenas de héroe con scroll o juegos 3D pequeños. Decide entre cargar un glTF (fuentes sin API key, pipeline meshopt) o una receta procedural; elige renderer (WebGLRenderer vs WebGPURenderer con fallback WebGL2) y qué helpers de drei/postprocessing funcionan con cada uno; fija tone mapping, IBL, materiales PBR por familia, encuadre por aspecto, presupuestos móviles, 3D guiado por scroll y reduced-motion. No es para animación de UI 2D (usa `animate`) ni para shaders TSL a fondo (usa `webgpu-threejs-tsl`).
---

# 3D realista en la web (R3F + three 0.187)

Destilado de `.claude/memory/` (KNOWLEDGE, LESSONS, research/*). Etiquetas de evidencia:
**[probado]** = ejecutado en este repo (headless Chromium + SwiftShader, que **no tiene WebGPU**: lo
probado con WebGPURenderer corrió en su backend WebGL2); **[código]** = leído en el código fuente de
la librería; **[sin probar]** = receta/orientativo, verifica antes de confiar.

Antes de programar: lee `.claude/memory/LESSONS.md`. Al terminar: confirma en `KNOWLEDGE.md` o
anota el fallo en `LESSONS.md`.

## 1. Flujo de decisión

```
¿Hay un glTF con licencia válida para el objeto? (references/fuentes-assets.md)
├─ Sí → descargar de raw.githubusercontent.com o npm a public/models/
│       → npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024
│       → npx gltfjsx out.glb --types --instance  (componente TSX)
│       → useGLTF('/models/out.glb')  (meshopt: decoder incluido; NUNCA Draco con la ruta por defecto)
│       → clonar personajes con SkeletonUtils.clone / <Clone>, nunca scene.clone()
└─ No (o necesitas control total de forma/color, p. ej. comida "de marca", pollo frito)
        → receta procedural (references/recetas-procedurales.md):
          Lathe/Cylinder/Plane/Ring/Icosahedron + ruido en vértices + texturas canvas + InstancedMesh
¿Es un juego? → además references/juegos.md (rapier, ecctrl, animaciones).
```
Realista "de verdad" (escaneo, PBR con extensiones KHR) = Khronos glTF-Sample-Assets. Low-poly
estilizado = Kenney (pmndrs/market-assets), Quaternius, KayKit. Humanos realistas a medida
requieren Blender (MPFB2) → no disponible aquí.

## 2. Elegir renderer

| Necesitas… | Renderer |
|---|---|
| drei `Environment` (con `<Lightformer>` o `files`), `ContactShadows`, `AccumulativeShadows`, `MeshTransmissionMaterial`, `@react-three/postprocessing`/N8AO | **WebGLRenderer** (default de `<Canvas>`) |
| TSL/NodeMaterial, `MeshSSSNodeMaterial` (piel/queso), compute, `RenderPipeline` + nodos GTAO/Bloom/SSR | **WebGPURenderer** (`three/webgpu`; cae solo a WebGL2) — `src/components/three/scene-canvas.tsx` |

Estado del repo (2026-11-04): la sesión principal está pasando las escenas de comida a
**WebGLRenderer (WebGL2)**, así que allí sí están disponibles drei `Environment`/`ContactShadows` y
`@react-three/postprocessing`. La tabla de abajo aplica cuando uses `SceneCanvas` (WebGPURenderer).

### Compatibilidad con WebGPURenderer (también en su backend WebGL2)
Regla: solo convierte Basic/Lambert/Phong/Standard/Physical/Toon/Normal/Matcap/Line*/Points/Sprite/Shadow
a NodeMaterial. `ShaderMaterial`, `RawShaderMaterial` y `onBeforeCompile` **no renderizan** [código].

| No funciona con WebGPURenderer | Reemplazo |
|---|---|
| drei `<Environment>` con hijos `<Lightformer>` → esferas negras + 6× `GL_INVALID_OPERATION: glFramebufferTexture2D` [probado] | Planos `MeshBasicMaterial` (color × intensidad) en una `Scene` propia → `PMREMGenerator.fromScene(scene, 0.02)` de `three/webgpu` [probado] (código en references/materiales.md §IBL) |
| drei `<Environment preset>` (además baja de raw.githack.com, bloqueado) | `RoomEnvironment` + `PMREMGenerator` [probado] o EXR de `@pmndrs/assets` |
| `ContactShadows`, `AccumulativeShadows`, `SoftShadows` | Plano con textura radial de canvas (`shadowTexture()` del burger) [probado] o `ShadowMaterial` |
| `MeshTransmissionMaterial`, `MeshReflectorMaterial`, `MeshDistortMaterial`, `Outlines`, `Sparkles`, `Stars`, `Cloud`, `Caustics` | `MeshPhysicalMaterial` (`transmission`, `thickness`) / TSL |
| `@react-three/postprocessing`, `postprocessing`, `n8ao`, `realism-effects` | `RenderPipeline` + `GTAONode`, `BloomNode`, `SSRNode`, `SMAANode`, `TRAANode` (`three/addons/tsl/display/`) [código, sin probar] |
| `three-custom-shader-material`, `@react-three/uikit`, `r3f-perf` | NodeMaterial (`positionNode`, `colorNode`); `renderer.info` |

Funcionan con ambos [código]: `useGLTF`, `useAnimations`, `Float`, `Center`, `Bounds`, `Instances`,
`Detailed`, `PerformanceMonitor`, `AdaptiveDpr`, `BakeShadows`, `KeyboardControls`, `ScrollControls`,
`Clone`, `Bvh`; física rapier/ecctrl y three-mesh-bvh (CPU).

## 3. Color, tone mapping y luz

- R3F pone `SRGBColorSpace` + `ACESFilmicToneMapping` [código]. Con `gl` como función (el caso de
  `SceneCanvas`), R3F solo aplica ACES una vez al crear: cambiar `gl.toneMapping` en un
  `useLayoutEffect` de un hijo persiste [probado].
- **Comida/producto: `NeutralToneMapping`**. En el burger, ACES deja el pan pálido y lavado; Neutral
  da pan dorado, lechuga más verde y char de carne más profundo [probado, capturas 390×844]. Si los
  materiales se ajustaron bajo ACES, baja `toneMappingExposure` a ~0.85–0.9 con Neutral (a 1.0 la
  base del pan quedaba algo naranja). Escenas dramáticas/juegos: AgX (+exposición 1.1–1.3) [sin probar].
- Texturas de color → `SRGBColorSpace`; normal/roughness/AO → lineal.
- **IBL primero** (sin IBL el PBR parece plástico): `RoomEnvironment` + `PMREMGenerator` → `scene.environment`
  [probado en burger-scene.tsx]; `environmentIntensity` 0.4–0.8.
- Tres puntos: key 2–3 (45° lateral-alto), fill 0.3–0.5× key, rim 1–2× detrás (brillo de grasa en
  comida). Rim cálido (`#ff9b54`) funciona en comida [probado en el burger].
- Sombras: `<Canvas shadows="percentage">`, nunca `shadows` (=PCFSoft, eliminado en r186). Ojo:
  incluso sin `shadows`, R3F deja `PCFSoftShadowMap` en `shadowMap.type` y WebGPURenderer avisa
  "PCFSoftShadowMap has been removed" en consola [probado] — inofensivo, o pasa `shadows="percentage"`.
- Valores PBR por familia (comida, tela, madera, metal, vidrio, piel, pelaje): `references/materiales.md`.

| Familia | Tone mapping | Luz | Clave del material |
|---|---|---|---|
| Comida | Neutral, exp 0.85–1.0 | IBL estudio + key + rim cálido | clearcoat (grasa/humedad), roughness variable, bump |
| Producto/mueble | Neutral | IBL + softboxes (Lightformers/PMREM) | sheen en tela, clearcoat en barniz |
| Metal/vidrio | Neutral/AgX | IBL con contraste (planos emisivos) | metalness 0/1, roughness ≥0.05 |
| Piel/humano | Neutral | key suave + rim | SSS (WebGPU) o sheen rojizo (WebGL) |
| Juego/escena | AgX | sol + cielo | Standard > Physical por coste |

## 4. Encuadre por aspecto (cámara que se adapta)

Patrón del burger (`burger-scene.tsx`) [probado a 390×844]: en `useFrame`, calcula la distancia que hace caber el
ancho y el alto, y usa la mayor.
```ts
const halfV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
const aspect = size.width / size.height;
const fitW = halfWidth / (halfV * aspect);   // móvil vertical: manda el ancho
const fitH = halfHeight / halfV;             // objeto alto / explotado: manda el alto
const dist = Math.max(fitW, fitH, minDist);
cam.position.set(0, dist * 0.22, dist); cam.lookAt(0, 0, 0);
```
FOV 25–35° (teleobjetivo) para producto/comida. Con titular encima: objeto más lejos, máscara
radial u opacidad (LESSONS: legibilidad).

## 5. Presupuestos móviles (orientativos de la industria, no medidos aquí)

| Recurso | Héroe | Escena/juego |
|---|---|---|
| Triángulos | 50–100 k | 100–300 k |
| Draw calls | < 50 | < 100–150 |
| Texturas | 1024² (2048² solo el héroe) | atlas 1–2k |
| Descarga 3D | < 2–3 MB | lazy por niveles |
| Luces con sombra | 1 | 1–2 |

- `dpr={[1, 1.75]}` (ya en SceneCanvas), `frameloop` "never" fuera de pantalla (IntersectionObserver).
- InstancedMesh para todo lo repetido (sésamo 110 inst., papas 36 inst. = 1 draw call) [probado].
- Geometría procedural indexada: `mergeVertices` reduce vértices ~5.8× (pollo: 97 148 → 16 812) [probado].
- `transmission` = pasada extra: 1–2 objetos en móvil. Physical cuesta más que Standard.
- Canvas texturas 512² en móvil. `React.lazy` del canvas; nunca `manualChunks` con three (LESSONS).
- Liberar `geometry/material/texture.dispose()` de todo lo creado a mano (patrón `useBurgerAssets`).

## 6. 3D guiado por scroll

Estado **mutable** compartido, nunca estado React por frame:
```tsx
// DOM (burger-hero.tsx): ScrollTrigger escribe en un objeto estable
const state = useRef({ progress: 0, active: -1 }).current;
ScrollTrigger.create({ trigger, start: 'top top', end: 'bottom bottom',
  onUpdate: (s) => { state.progress = s.progress; } });
// Escena: suavizado crítico en useFrame
useFrame((_, dt) => {
  eased.current = THREE.MathUtils.damp(eased.current, still ? 0 : state.progress, 6, dt);
  const explode = THREE.MathUtils.smoothstep(eased.current, 0.04, 0.85);
  // posiciones/rotaciones de refs a partir de explode
});
```
- `setState` solo cuando cambia un umbral discreto (p. ej. etapa de la leyenda), comparando antes.
- Con `frameloop="demand"` llama `invalidate()` en `onUpdate`.
- `ScrollControls` de drei choca con Lenis → elegir uno.

## 7. Reduced motion

- `useReducedMotion()` → `still`: sin rotación idle, sin scrub, sin pin (sección de altura normal);
  pose final o inicial estática [probado en el burger].
- Considera `frameloop="demand"` y no montar el 3D si no aporta.
- Sin animaciones ligadas a teclado; anima solo transform/opacity en el DOM.

## 8. Never ship

| No hagas | Por qué | Haz |
|---|---|---|
| `<Environment preset>` | baja de raw.githack.com (CDN externo, bloqueado aquí) | `files` local / `@pmndrs/assets` / RoomEnvironment |
| drei `Environment`+`Lightformer` con WebGPURenderer | negro + GL_INVALID_OPERATION [probado] | PMREM de una escena de planos emisivos |
| `useGLTF` con Draco por defecto | decoder de gstatic.com | meshopt, o `useGLTF(url, '/draco/')` local |
| `ShaderMaterial`/`onBeforeCompile`/postprocessing con WebGPURenderer | no renderiza | NodeMaterial / RenderPipeline, o usa WebGLRenderer |
| `<Canvas shadows>` | PCFSoft eliminado en r186 | `shadows="percentage"` |
| Ruido indexado por vértice / `computeVertexNormals` antes de soldar | grietas (pinholes oscuros) [probado] | semilla = posición; `mergeVertices` (sin uv/normal) antes de desplazar |
| `scene.clone()` de un GLB con esqueleto | rompe skinning | `SkeletonUtils.clone` / `<Clone>` |
| Estado React en `useFrame`/scroll | re-render por frame | refs + `damp` |
| Roughness uniforme, metalness 0.5, roughness 0 | delata lo CG | ruido/mapas, metalness 0 o 1, roughness ≥0.05 |
| Texturas 4k sin comprimir en móvil | 64 MB+ de VRAM | 1024², webp/KTX2 |
| Subir three a 0.188 con `postprocessing` 6.39 | peer `<0.188` | esperar versión compatible |
| Assets Mixamo/Sponza/BrainStem en producción | licencias no libres | Quaternius/KayKit/Khronos CC0 |

## 9. Cómo probar aquí

Playwright + Chromium headless con `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
No hay WebGPU (`No available adapters` → backend WebGL2). Página temporal (`labs.html` +
`src/labs/*.tsx`) servida con `npx vite`, captura a 390×844 y 1280×800, recoge `console`
error/warning, y **borra los archivos temporales** al terminar.

## Referencias
- `references/materiales.md` — PBR por material + IBL sin red.
- `references/recetas-procedurales.md` — comida, muebles y arquitectura procedurales.
- `references/fuentes-assets.md` — fuentes sin API key, licencias y rutas.
- `references/juegos.md` — rapier, ecctrl, animación de personajes.
