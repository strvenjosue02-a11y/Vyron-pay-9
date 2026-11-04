# Librerías y herramientas 3D (versiones verificadas con `npm view`, 2026-11-04)

(2026-11-04, 3d-researcher). Compatibilidad WebGPU deducida leyendo el código de cada paquete (`npm pack` + grep) y de three 0.187 en `node_modules`.

## Regla clave de compatibilidad
`WebGPURenderer` solo traduce a NodeMaterial estos materiales clásicos: Basic, Lambert, Phong, Standard, Physical, Toon, Normal, Matcap, LineBasic, LineDashed, Points, Sprite, Shadow (`three/src/renderers/webgpu/nodes/StandardNodeLibrary.js`). **`ShaderMaterial`, `RawShaderMaterial` y `onBeforeCompile` no funcionan** en WebGPU (tampoco en su backend WebGL2). Todo lo que dependa de eso es "solo WebGLRenderer".

## Tabla

| Paquete | Versión | Peer / notas | WebGPURenderer |
|---|---|---|---|
| three | 0.187.0 | instalado | — |
| @react-three/fiber | 9.8.2 | react >=19 <19.4 | sí (`gl` async, ya en scene-canvas) |
| @react-three/drei | 10.7.9 | | parcial (ver abajo) |
| three-stdlib | 2.36.1 | dependencia de drei; loaders GLTF/Draco/Meshopt/RGBE/EXR | sí (CPU) |
| gltfjsx | 6.5.3 (CLI `gltfjsx`) | usa @gltf-transform 4.1 internamente | n/a (build) |
| @gltf-transform/cli / functions | 4.5.1 (CLI `gltf-transform`) | | n/a (build) |
| meshoptimizer | 1.3.0 | simplificación/compresión | decoder en `three/examples/jsm/libs/meshopt_decoder.module.js` y en three-stdlib |
| three-mesh-bvh | 0.9.18 (mod. 2026-11-03) | three >=0.159 | sí; trae además `src/webgpu/` con BVH en WGSL/TSL |
| @react-three/rapier | 2.2.0 | fiber ^9.0.4, three >=0.159; usa @dimforge/rapier3d-compat 0.19.2 (WASM embebido) | sí (física en CPU/WASM, independiente del renderer) |
| @dimforge/rapier3d-compat | 0.21.0 (última) | rapier de r3f fija 0.19.2 | — |
| ecctrl | 2.0.2 | drei >=10.7, fiber >=9.4, rapier >=2.2, **leva >=0.10.1**, three >=0.184 | sí (no usa ShaderMaterial; grep = 0) |
| bvhecctrl | 0.0.18 | controlador sin rapier, con BVH | probable (no verificado) |
| @react-three/uikit / @pmndrs/uikit | 1.0.78 | | **no**: usa ShaderMaterial (9 coincidencias) |
| leva | 0.10.1 | react 18/19 | sí (DOM) |
| r3f-perf | 7.2.3 | | **no**: usa `getContext()`, `EXT_disjoint_timer_query_webgl2`. Con WebGPU usar `renderer.info` o stats-gl (dep. de drei) |
| @react-three/postprocessing | 3.2.2 | postprocessing ^6.36, fiber >=9.7 | **no** (EffectComposer WebGL) |
| postprocessing | 6.39.6 | three >=0.168 **<0.188** (romperá al subir three) | **no** |
| n8ao | 2.0.1 | postprocessing >=6.30 | **no** → usar `GTAONode`/`SSAONode` de three/tsl |
| realism-effects | 1.1.2 | postprocessing >=6.30.1; sin mantenimiento reciente (no verificado) | **no** → usar `SSGINode`, `SSRNode`, `TRAANode` |
| three-custom-shader-material | 6.4.0 | basado en onBeforeCompile (65 coincidencias) | **no** → en WebGPU usar NodeMaterial + TSL (`positionNode`, `colorNode`) |
| three-gpu-pathtracer | 0.0.28 | three >=0.187, three-mesh-bvh >=0.9.17 | WebGL (para renders fijos/hero, no tiempo real) |
| @pmndrs/assets | 1.7.0 (CC0) | HDRIs/modelos base64 | n/a |
| @takram/three-clouds | 0.7.6 | requiere postprocessing | **no** |

## drei con WebGPU (grep de `ShaderMaterial|onBeforeCompile` en `node_modules/@react-three/drei/core`)
- OK (0 coincidencias, lógica JS/escena): `Environment` (archivos), `Lightformer`, `Float`, `Bvh`, `PerformanceMonitor`, `AdaptiveDpr`, `Center`, `Bounds`, `Stage`*, `BakeShadows`, `useGLTF`/`Gltf`, `useAnimations`, `Instances`, `Detailed`, `KeyboardControls`, `ScrollControls`, `useTexture`, `Clone`.
- **Solo WebGL**: `ContactShadows` (ShaderMaterial blur + onBeforeCompile), `AccumulativeShadows`/`RandomizedLight`, `MeshTransmissionMaterial`, `MeshReflectorMaterial`, `MeshRefractionMaterial`, `MeshDistortMaterial`, `MeshWobbleMaterial`, `Outlines`, `Sparkles`, `Stars`, `Cloud`, `SoftShadows`, `Caustics`.
- `Environment` con hijos (`<Lightformer>`) usa `WebGLCubeRenderTarget` + `CubeCamera` → **no verificado** en WebGPU; probar. Alternativa segura: `RoomEnvironment` + `PMREMGenerator` de `three/webgpu`.
- *`Stage` usa ContactShadows/AccumulativeShadows por defecto → pasar `shadows={false}` o `"contact"` no sirve en WebGPU.
- `useGLTF` usa por defecto Draco desde `https://www.gstatic.com/draco/versioned/decoders/1.5.5/` (bloqueado aquí y dependencia externa) → pasar ruta local: `useGLTF(url, '/draco/')` copiando `node_modules/three/examples/jsm/libs/draco/` a `public/draco/`, o mejor comprimir con **meshopt** (decoder empaquetado, sin archivos externos).
- `<Environment preset="...">` descarga de `raw.githack.com` (bloqueado) → usar `files=` local o `@pmndrs/assets`.

## Equivalentes WebGPU nativos (three 0.187, `three/tsl` y `three/addons/tsl/display/*`)
`RenderPipeline` (antes `PostProcessing`, renombrado r183; `PostProcessing` sigue como wrapper con aviso), `pass()`, `BloomNode`, `GTAONode` (AO), `SSAONode`, `SSGINode`, `SSRNode`, `SSSNode` (sombras de contacto en espacio pantalla), `DepthOfFieldNode`, `TRAANode`, `SMAANode`, `FXAANode`, `Lut3DNode`, `FilmNode`, `GodraysNode`, `OutlineNode`, `DenoiseNode`, `MotionBlur`. Materiales: `MeshPhysicalNodeMaterial`, `MeshSSSNodeMaterial` (piel/cera: `thicknessColorNode`, `thicknessDistortionNode`=0.1, `thicknessAmbientNode`=0, `thicknessAttenuationNode`=0.1, `thicknessPowerNode`=2). Ruido TSL: `mx_noise_float`, `mx_fractal_noise_float`, `mx_worley_noise_float`, `mx_heighttonormal`, `triplanarTexture`.

## Herramientas de pipeline
```bash
# optimizar (defaults leídos de packages/cli/src/cli.ts: --compress meshopt, --texture-compress auto, --texture-size 2048)
npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024
# KTX2 (--texture-compress ktx2 / comandos etc1s, uastc) requiere el binario `ktx` de KTX-Software instalado (no disponible aquí)
npx gltfjsx out.glb --types --transform --resolution 1024 --instance   # genera componente TSX
```
`gltfjsx --transform` aplica draco + resize webp por defecto (opciones: `-R` resolución, `-S` simplify, `-i` instancing, `-t` tipos TS, `-s` sombras).

Fuentes: `npm view <pkg> version peerDependencies dependencies`; tarballs en scratchpad `research/npm/`; `donmccurdy/glTF-Transform` `packages/cli/src/cli.ts`; README de ecctrl 2.0.2.
