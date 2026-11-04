# Conocimiento verificado

## Entorno
- Red: GitHub (git clone, raw.githubusercontent.com) y registro npm accesibles. Bloqueados: polyhaven, ambientcg, kenney, quaternius, threejs.org, jsdelivr, huggingface, registros shadcn. (2026-11-04, web-builder)
- También bloqueados: raw.githack.com (presets de `<Environment preset>` de drei) y www.gstatic.com (decoder Draco por defecto de `useGLTF`). `gh api repos/...` devuelve 403; `gh api -X GET search/repositories` sí funciona. (2026-11-04, 3d-researcher, probado con curl/gh)
- Sin API keys: 21st.dev eliminado. (2026-11-04, web-builder)

## Stack instalado
- three 0.187, @react-three/fiber 9.8, drei 10.7, postprocessing 6.39, motion 14.9, gsap 3.15 (+SplitText gratis), lenis 1.3. (2026-11-04, web-builder)
- WebGPURenderer de `three/webgpu` cae solo a WebGL2 si no hay WebGPU (probado en headless Chromium, src/components/three/scene-canvas.tsx). (2026-11-04, web-builder)
- `postprocessing@6.39.6` declara peer `three >=0.168 <0.188`: subir three a 0.188 lo rompe. (2026-11-04, 3d-researcher, `npm view postprocessing peerDependencies`)

## Compatibilidad WebGPU
- WebGPURenderer solo convierte Basic/Lambert/Phong/Standard/Physical/Toon/Normal/Matcap/Line*/Points/Sprite/Shadow a NodeMaterial; `ShaderMaterial`/`onBeforeCompile` no funcionan. (2026-11-04, 3d-researcher, `three/src/renderers/webgpu/nodes/StandardNodeLibrary.js`)
- Solo WebGL (no usar con nuestro renderer): drei `ContactShadows`, `AccumulativeShadows`, `MeshTransmissionMaterial`, `MeshReflectorMaterial`, `Outlines`, `Sparkles`, `Stars`; `@react-three/postprocessing`, `postprocessing`, `n8ao`, `realism-effects`, `three-custom-shader-material`, `@react-three/uikit`, `r3f-perf`. (2026-11-04, 3d-researcher, grep en tarballs/node_modules) → detalle en `research/librerias.md`.
- Post-proceso WebGPU: `RenderPipeline` (renombrado de `PostProcessing` en r183) + nodos `GTAONode`, `BloomNode`, `SSRNode`, `SSGINode`, `TRAANode`, `SMAANode`, `DepthOfFieldNode` en `three/addons/tsl/display/`. (2026-11-04, 3d-researcher, node_modules/three)
- Piel/cera/queso con SSS: `MeshSSSNodeMaterial` (solo vía WebGPURenderer). (2026-11-04, 3d-researcher, `src/materials/nodes/MeshSSSNodeMaterial.js`)
- `PMREMGenerator` debe importarse de `three/webgpu` y usarse tras `await renderer.init()`; con `RoomEnvironment` da IBL de estudio sin descargas. (2026-11-04, 3d-researcher, `renderers/common/extras/PMREMGenerator.js:118`)
- RectAreaLight en WebGPU: `RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())`. (2026-11-04, 3d-researcher, `src/nodes/lighting/RectAreaLightNode.js:124`)
- Física (`@react-three/rapier` 2.2.0, ecctrl 2.0.2) y `three-mesh-bvh` 0.9.18 son independientes del renderer. (2026-11-04, 3d-researcher, `npm view` + grep)

## Color y luz
- R3F 9 por defecto: `outputColorSpace=SRGB`, `toneMapping=ACESFilmic`. Para comida/producto usar `NeutralToneMapping` (conserva el color base); AgX para escenas dramáticas. (2026-11-04, 3d-researcher, fiber `dist/events-*.esm.js` l.1744-1752) → `research/realismo.md`.
- `<Canvas shadows>` usa `PCFSoftShadowMap`, eliminado en r186 (cae a PCF con warning): usar `shadows="percentage"` o `"variance"`. (2026-11-04, 3d-researcher, `three/src/renderers/common/Renderer.js:1031`)

## Fuentes de assets (sin API key, raw GitHub probado 200)
- HDRIs CC0 autohospedados por npm: `@pmndrs/assets@1.7.0` (`hdri/studio.exr`, `city`, `warehouse`, `sunset`… 130–420 KB base64); `<Environment files={...}>` acepta `data:application/exr`. (2026-11-04, 3d-researcher, tarball + drei `useEnvironment.js`)
- Modelos PBR realistas: KhronosGroup/glTF-Sample-Assets `Models/<X>/glTF-Binary/<X>.glb` (CC0: Avocado, BarramundiFish, SheenChair, ClearcoatWicker, ScatteringSkull; CC-BY-4.0: GlamVelvetSofa, IridescentDishWithOlives, SheenWoodLeatherSofa, Fox…). (2026-11-04, 3d-researcher, `metadata.json` de cada modelo)
- Low-poly CC0: pmndrs/market-assets `files/models/<nombre>/model.gltf` (Kenney food: burger, fries, meat-patty, tomato-slice…; `license:1`=CC0) y Quaternius en trebeljahr/quaternius-showcase `public/glb/<pack>/` (animales animados, muebles, edificios, personajes). (2026-11-04, 3d-researcher) → `research/fuentes-assets.md`.
- Manos rigged MIT: `@webxr-input-profiles/assets` `dist/profiles/generic-hand/{left,right}.glb`. (2026-11-04, 3d-researcher, tarball npm)
- Animaciones CC0 tipo Mixamo sin cuenta: KayKit `Rig_Medium` (132 clips) en NoLimitNexus/game-models `library/animations/`. (2026-11-04, 3d-researcher, README del repo) → `research/juegos.md`.
- No existe modelo libre de pollo frito encontrado → procedural (`research/comida-procedural.md`). (2026-11-04, 3d-researcher)

## Pipeline y rendimiento
- `@gltf-transform/cli` 4.5.1 `optimize` usa por defecto `--compress meshopt --texture-compress auto --texture-size 2048`; KTX2 requiere el binario `ktx` (no disponible aquí). (2026-11-04, 3d-researcher, `packages/cli/src/cli.ts`)
- MEJORA: preferir meshopt a Draco: el decoder meshopt va empaquetado en drei/three-stdlib; Draco exige alojar wasm (`three/examples/jsm/libs/draco/` → `public/draco/`). (2026-11-04, 3d-researcher, drei `core/Gltf.js`)
- `KTX2Loader.detectSupport()` acepta WebGPURenderer; transcoder en `three/examples/jsm/libs/basis/`. (2026-11-04, 3d-researcher, `KTX2Loader.js:239`)
- gltfjsx 6.5.3: `npx gltfjsx m.glb --types --transform --instance`. (2026-11-04, 3d-researcher, README npm)
