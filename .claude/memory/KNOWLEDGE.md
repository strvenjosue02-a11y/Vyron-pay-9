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
- Solo WebGL (no usar con WebGPURenderer; sí en la página de comida con `WebGLRenderer`, ver sección WebGLRenderer): drei `ContactShadows`, `AccumulativeShadows`, `MeshTransmissionMaterial`, `MeshReflectorMaterial`, `Outlines`, `Sparkles`, `Stars`; `@react-three/postprocessing`, `postprocessing`, `n8ao`, `realism-effects`, `three-custom-shader-material`, `@react-three/uikit`, `r3f-perf`. (2026-11-04, 3d-researcher, grep en tarballs/node_modules) → detalle en `research/librerias.md`.
- Post-proceso WebGPU: `RenderPipeline` (renombrado de `PostProcessing` en r183) + nodos `GTAONode`, `BloomNode`, `SSRNode`, `SSGINode`, `TRAANode`, `SMAANode`, `DepthOfFieldNode` en `three/addons/tsl/display/`. (2026-11-04, 3d-researcher, node_modules/three)
- Piel/cera/queso con SSS: `MeshSSSNodeMaterial` (solo vía WebGPURenderer). (2026-11-04, 3d-researcher, `src/materials/nodes/MeshSSSNodeMaterial.js`)
- `PMREMGenerator` debe importarse de `three/webgpu` y usarse tras `await renderer.init()`; con `RoomEnvironment` da IBL de estudio sin descargas. (2026-11-04, 3d-researcher, `renderers/common/extras/PMREMGenerator.js:118`) Confirmado: probado en `src/features/burger/burger-scene.tsx` y en lab temporal, backend WebGL2 de WebGPURenderer, sin errores de consola. (2026-11-04, web-builder)
- drei `<Environment>` con hijos `<Lightformer>` **no funciona** con WebGPURenderer (backend WebGL2): env negro + 6× `GL_INVALID_OPERATION: glFramebufferTexture2D`. Equivalente que sí funciona: planos `MeshBasicMaterial` (color×intensidad, `toneMapped:false`) en una `Scene` propia → `PMREMGenerator.fromScene(scene, 0.02)` → `scene.environment` (reflejos de softbox nítidos en metal y clearcoat). Probado en lab temporal (src/labs/, borrado), headless Chromium sin WebGPU. Código en `.claude/skills/realistic-3d-web/references/materiales.md`. (2026-11-04, web-builder)
- RectAreaLight en WebGPU: `RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())`. (2026-11-04, 3d-researcher, `src/nodes/lighting/RectAreaLightNode.js:124`)
- Física (`@react-three/rapier` 2.2.0, ecctrl 2.0.2) y `three-mesh-bvh` 0.9.18 son independientes del renderer. (2026-11-04, 3d-researcher, `npm view` + grep)

## Color y luz
- R3F 9 por defecto: `outputColorSpace=SRGB`, `toneMapping=ACESFilmic`. Para comida/producto usar `NeutralToneMapping` (conserva el color base); AgX para escenas dramáticas. (2026-11-04, 3d-researcher, fiber `dist/events-*.esm.js` l.1744-1752) → `research/realismo.md`.
- Tone mapping en el burger (capturas 390×844, reduced-motion para pose fija, WebGL2): ACES deja el pan pálido/lavado; **Neutral se ve más apetitoso** (pan dorado, lechuga más verde, char más profundo); con materiales ajustados bajo ACES conviene Neutral + `toneMappingExposure ≈0.85–0.9` (a 1.0 la base del pan queda algo naranja). No aplicado al repo por cambio de plan (escenas pasan a WebGLRenderer). Con `gl` como función, R3F aplica ACES una sola vez al crear: fijar `gl.toneMapping` en un `useLayoutEffect` hijo persiste (fiber `events-*.esm.js` l.1751-1752). (2026-11-04, web-builder, capturas en scratchpad builder/tone-compare.png)
- Aunque no se pase `shadows`, WebGPURenderer avisa `PCFSoftShadowMap has been removed` en consola (R3F deja ese tipo por defecto): inofensivo. También `THREE.Clock: deprecated` viene de R3F. (2026-11-04, web-builder, consola headless)
- `<Canvas shadows>` usa `PCFSoftShadowMap`, eliminado en r186 (cae a PCF con warning): usar `shadows="percentage"` o `"variance"`. (2026-11-04, 3d-researcher, `three/src/renderers/common/Renderer.js:1031`)

## Modelado procedural (kit tipo Blender) → `research/blender.md`
- Defaults de modificadores de Blender están en `source/blender/makesdna/DNA_modifier_types.h` (inicializadores del struct; `DNA_modifier_defaults.h` ya no existe). Displace: strength 1, midlevel 0.5, dir normal; SimpleDeform: 45°; Smooth: fac 0.5; Laplacian: λ 0.01 + preservar volumen; Weld: 0.001. (2026-11-04, 3d-researcher, blender@5ace194)
- Displace de Blender: `p += n·(tex - midlevel)·strength·peso`. SimpleDeform reparte el ángulo sobre el rango del objeto: `k = factor/(hi-lo)`. (2026-11-04, 3d-researcher, `MOD_displace.cc:160-240`, `MOD_simpledeform.cc:340-350`)
- "Poisson Disk" de Distribute Points on Faces = puntos aleatorios a Density Max + eliminación greedy por radio con KD-tree (no Bridson). (2026-11-04, 3d-researcher, `node_geo_distribute_points_on_faces.cc:207-229`)
- Noise de Blender = Perlin mejorado con hash Jenkins lookup3, `snoise3 = 0.9820·perlin`; Detail 2 = 3 octavas; Musgrave se fusionó en Noise (4.1+). Voronoi usa hash PCG3D. (2026-11-04, 3d-researcher, `gpu_shader_material_noise.bsl.hh`, `gpu_shader_common_hash.bsl.hh`)
- Principled → three: `specularIntensity = 2·Specular IOR Level`; Coat Roughness default 0.03; Subsurface Radius×Scale = camino libre medio en metros (default 5/1/0.5 mm). WebGLRenderer no tiene SSS: fingir con sheen, translucidez onBeforeCompile o transmission+attenuation. (2026-11-04, 3d-researcher, `node_shader_bsdf_principled.cc`, `cycles/kernel/svm/closure.h:363-370`, `lights_physical_fragment.glsl.js:61`)
- three 0.187 trae `MarchingCubes`, `RoundedBoxGeometry`, `MeshSurfaceSampler`, `ImprovedNoise`, `DecalGeometry`, `SimplifyModifier`, `toCreasedNormals`. npm: `three-subdivide@1.1.5` (MIT, Loop, no Catmull-Clark), `three-bvh-csg@0.0.18` (MIT, booleanos). (2026-11-04, 3d-researcher, node_modules + `npm view`)

## WebGLRenderer (página de comida)
- `@react-three/postprocessing@3.2.2` (deps n8ao ^2.0.0) + `postprocessing@6.39.6` + `n8ao@2.0.1` compatibles con three 0.187; exporta `N8AO, SMAA, Bloom, ToneMapping, Vignette, DepthOfField`. `EffectComposer` (multisampling 4, HalfFloat) fuerza `gl.toneMapping = NoToneMapping` → añadir `<ToneMapping mode={ToneMappingMode.NEUTRAL}/>` (NEUTRAL=8). (2026-11-04, 3d-researcher, `dist/index.js:365,486`, `postprocessing/build/index.js:8238`)
- drei `Environment` con hijos (`Lightformer`) + `files` → cubemap HalfFloat de 256 px, `frames 1`, con el HDRI como fondo del portal. `MeshTransmissionMaterial` usa chunks presentes en 0.187 (compilación no probada). (2026-11-04, 3d-researcher, drei `core/Environment.js:86-158`)

## Fuentes de assets (sin API key, raw GitHub probado 200)
- HDRIs CC0 autohospedados por npm: `@pmndrs/assets@1.7.0` (`hdri/studio.exr`, `city`, `warehouse`, `sunset`… 130–420 KB base64); `<Environment files={...}>` acepta `data:application/exr`. (2026-11-04, 3d-researcher, tarball + drei `useEnvironment.js`)
- Modelos PBR realistas: KhronosGroup/glTF-Sample-Assets `Models/<X>/glTF-Binary/<X>.glb` (CC0: Avocado, BarramundiFish, SheenChair, ClearcoatWicker, ScatteringSkull; CC-BY-4.0: GlamVelvetSofa, IridescentDishWithOlives, SheenWoodLeatherSofa, Fox…). (2026-11-04, 3d-researcher, `metadata.json` de cada modelo)
- Low-poly CC0: pmndrs/market-assets `files/models/<nombre>/model.gltf` (Kenney food: burger, fries, meat-patty, tomato-slice…; `license:1`=CC0) y Quaternius en trebeljahr/quaternius-showcase `public/glb/<pack>/` (animales animados, muebles, edificios, personajes). (2026-11-04, 3d-researcher) → `research/fuentes-assets.md`.
- Manos rigged MIT: `@webxr-input-profiles/assets` `dist/profiles/generic-hand/{left,right}.glb`. (2026-11-04, 3d-researcher, tarball npm)
- Animaciones CC0 tipo Mixamo sin cuenta: KayKit `Rig_Medium` (132 clips) en NoLimitNexus/game-models `library/animations/`. (2026-11-04, 3d-researcher, README del repo) → `research/juegos.md`.
- No existe modelo libre de pollo frito encontrado → procedural (`research/comida-procedural.md`). (2026-11-04, 3d-researcher)
- Recetas de pollo frito (§8, con el orden corregido weld→displace) y papas (§7, con altura corregida) renderizan bien con WebGPURenderer/WebGL2: probado en lab temporal (borrado). Pollo detail 40 = 33 620 tris; soldado: 16 812 vértices (vs 97 148 sin soldar). Papas: 36 instancias = 1 draw call. Recetas finales en `.claude/skills/realistic-3d-web/references/recetas-procedurales.md`. (2026-11-04, web-builder)

## Pipeline y rendimiento
- `@gltf-transform/cli` 4.5.1 `optimize` usa por defecto `--compress meshopt --texture-compress auto --texture-size 2048`; KTX2 requiere el binario `ktx` (no disponible aquí). (2026-11-04, 3d-researcher, `packages/cli/src/cli.ts`)
- MEJORA: preferir meshopt a Draco: el decoder meshopt va empaquetado en drei/three-stdlib; Draco exige alojar wasm (`three/examples/jsm/libs/draco/` → `public/draco/`). (2026-11-04, 3d-researcher, drei `core/Gltf.js`)
- `KTX2Loader.detectSupport()` acepta WebGPURenderer; transcoder en `three/examples/jsm/libs/basis/`. (2026-11-04, 3d-researcher, `KTX2Loader.js:239`)
- gltfjsx 6.5.3: `npx gltfjsx m.glb --types --transform --instance`. (2026-11-04, 3d-researcher, README npm)

## Forja (nuestro kit tipo Blender) — src/lib/forja/
- `stack(geo).weld().bend().twist().taper().displace().smooth().cast().paint().uvBox().done()` — modificadores al estilo Blender reimplementados sin código GPL (ver research/blender.md). (2026-11-04, web-builder)
- `noise3/fbm/ridged/voronoi/rng` (Noise, Musgrave, Ridged, Voronoi), `scatterOnMesh` (Distribute Points + Instance on Points alineado a la normal), `normalMapFrom(height)` (normal map por Sobel), `principled()` (Principled BSDF → MeshPhysicalMaterial) con presets `friedBatter`, `fry`, `paper`, `bone`. (2026-11-04, web-builder)
- Probado en src/features/food/: papas (extrusión redondeada + bend/twist + color por vértice + sal instanciada + cartucho superelipse con festón) y pollo frito (lathe + ridged/fbm displace con smoothstep hacia el hueso, crestas oscuras por color de vértice, papel de cuadros arrugado, migas instanciadas). (2026-11-04, web-builder)

## Render de comida WebGL2 (src/components/three/gl-canvas.tsx)
- HDRI studio de @pmndrs/assets decodificado en memoria + 3 Lightformers (key cálida, rim naranja, fill cálido), `environmentIntensity` 0.32. (2026-11-04, web-builder)
- Cadena: SSAO (solo nivel alto) → Bloom (umbral 1, 0.15) → ToneMapping NEUTRAL → HueSaturation +0.16 → BrightnessContrast +0.1 → Vignette → SMAA. `flat` en el Canvas para que el ToneMapping del composer mande. (2026-11-04, web-builder)
- PerformanceMonitor baja dpr y desactiva SSAO en dispositivos lentos; un capítulo 3D solo se monta a ±1 viewport (≤2 contextos WebGL vivos). (2026-11-04, web-builder)
- Build de un solo archivo (`npm run build:artifact`, vite-plugin-singlefile) ≈2.3 MB; probado bajo CSP estricta sin errores. (2026-11-04, web-builder)

## Skills instaladas (vendorizadas en .claude/skills/, 2026-11-04)
Copias de solo lectura; licencia upstream en `.claude/skills/LICENSE-<nombre>`. Revisadas: sin prompt-injection ni exfiltración.
- `impeccable` → pbakaus/impeccable@695cea5 (Apache-2.0, + NOTICE.md). Solo SKILL.md + reference/; **sin scripts/** (el lanzador descarga un binario de GitHub Releases). Usar siempre la ruta "Launcher unavailable"; `live/generate/hooks/pin/doctor` no disponibles.
- `taste-skill` (name: design-taste-frontend) → Leonxlnx/taste-skill@12af471 (MIT). Incluye scripts Node locales (draw/lint/inspect/scenes necesitan Chrome headless; assets.mjs consulta Openverse/Wikimedia/Met/AIC/NASA/archive.org sin API key — pueden no ser alcanzables aquí). Guarda historial en `~/.taste-skill/`.
- `threejs-{fundamentals,geometry,materials,lighting,textures,loaders,animation,interaction,shaders,postprocessing,performance,asset-pipeline,react-three-fiber}` → CloudAI-X/threejs-skills@0e18186 (MIT). Apuntan a three r186 / R3F 9.8.
- `web-quality-audit`, `performance`, `core-web-vitals`, `accessibility`, `seo`, `best-practices` → addyosmani/web-quality-skills@afa8da9 (MIT). `analyze.sh` es de solo lectura (requiere jq).
- `atdd`, `atdd-team`, `atdd-mutate` → swingerman/engineer@f5216e2 (MIT). Parcial: citan agentes/scripts del plugin (`pipeline-builder`, `spec-guardian`, `dae_gherkin.py`, `${CLAUDE_PLUGIN_ROOT}`) que no se vendorizaron.
- `sharp-edges`, `differential-review`, `fp-check` → trailofbits/skills@711af09 (CC-BY-SA-4.0). Los agentes del plugin (`differential-review:adversarial-modeler`, agentes de deep-verification de fp-check) no están; usar los .md de metodología.
- No instaladas: Motion ai-kit (motiondivision/ai-kit, sin LICENSE), Shadcnblocks-Skill (API key de pago + script que lee secretos de 1Password), Trail of Bits semgrep/codeql/semgrep-rule-*/supply-chain (herramientas o APIs no alcanzables), insecure-defaults y audit-context-building (dependen del tool Workflow/comandos del plugin). No existen repos canónicos para Web Performance Kit, dotLottie, Paper Shaders ni Spline skills.

## Herramientas locales (probado 2026-11-04, web-builder)
- `tools/calco/calco.py`: IS-Net (rembg, GitHub release) + Depth Anything V2 Small ONNX (fabio-sim, GitHub release) en onnxruntime CPU; recorte+profundidad+GLB relieve en ~5 s para 410×200. Probado con captura del usuario.
- `tools/blender/`: bpy 5.2.3 (PyPI, rueda cp313) funciona headless; Cycles CPU + OIDN, 540² a 24 muestras ≈17 s con la hamburguesa clásica completa (incluye construcción de escena).
