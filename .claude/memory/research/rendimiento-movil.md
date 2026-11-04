# Rendimiento 3D en móvil

(2026-11-04, 3d-researcher). Fuentes: código de drei 10.7.9 (`PerformanceMonitor.d.ts`, `AdaptiveDpr.js`, `Gltf.js`), three 0.187 (`KTX2Loader.js`, `libs/`), glTF-Transform CLI (`packages/cli/src/cli.ts`), y `src/components/three/scene-canvas.tsx`. Los presupuestos numéricos son **orientativos de la industria** (no medidos en este repo).

## Presupuestos orientativos (móvil gama media)
| Recurso | Héroe de landing | Escena/juego |
|---|---|---|
| Triángulos visibles | 50–100 k | 100–300 k |
| Draw calls | < 50 | < 100–150 |
| Texturas | 1024² (máx. 2048² para el héroe) | atlas 1024–2048² |
| VRAM texturas | < 64 MB | < 150 MB |
| Peso descarga 3D | < 2–3 MB (gzip/br) | por niveles, lazy |
| Luces con sombra | 1 | 1–2 |
- Una RGBA 2048² sin comprimir = 16 MB de VRAM (+33 % con mipmaps) aunque el JPG pese 300 KB. KTX2/Basis se queda comprimida en GPU (~4–8× menos VRAM).

## Pipeline de assets
1. `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024` (meshopt es el default del CLI 4.5.1).
   - **meshopt > draco aquí**: el decoder meshopt viene dentro de three-stdlib/drei (`MeshoptDecoder`), no necesita archivos wasm externos; Draco por defecto en `useGLTF` apunta a gstatic.com (bloqueado y dependencia externa).
   - Si se usa Draco: copiar `node_modules/three/examples/jsm/libs/draco/` → `public/draco/` y `useGLTF(url, '/draco/')`.
2. KTX2: `--texture-compress ktx2` necesita el binario `ktx` (KTX-Software) instalado → no disponible en este entorno. Runtime: `KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer)` copiando `three/examples/jsm/libs/basis/` a `public/basis/`. `detectSupport` admite WebGPURenderer (usa `renderer.hasFeature('texture-compression-astc'|'etc2'|'bc')`, verificado en `KTX2Loader.js:239`).
3. `--simplify` (meshoptimizer) para LOD; `--instance` crea `EXT_mesh_gpu_instancing`; `--flatten --join` reduce draw calls.
4. `npx gltfjsx out.glb --types --instance` → componente TSX con geometrías compartidas.
5. Avocado de Khronos pesa 8,1 MB por texturas: siempre pasar por este pipeline.

## Runtime (R3F)
- **DPR**: `dpr={[1, 1.75]}` ya en scene-canvas. En móvil, 1.5 suele bastar; `<AdaptiveDpr pixelated />` baja DPR cuando `performance.current` cae (se activa con `performance={{ min: 0.5 }}` en Canvas y movimientos/`regress()`).
- **PerformanceMonitor** (drei): `<PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={3} onFallback={() => setLowQuality(true)} />` — props verificadas: `iterations, ms, threshold, step, factor, flipflops, bounds, onIncline, onDecline, onChange, onFallback`. Usar `factor` (0–1) para escalar calidad de forma continua.
- **frameloop**: escena estática (producto) → `frameloop="demand"` + `invalidate()` al interactuar/scroll. scene-canvas actualmente usa `"always"`/`"never"` según visibilidad (IntersectionObserver) — bien para escenas animadas.
- Pausar fuera de pantalla (ya hecho) y en `document.hidden`.
- **Instancing**: `InstancedMesh` o drei `<Instances>`/`<Merged>` para todo lo que se repite (sésamo, papas, árboles, sillas). 1 draw call por material.
- **LOD**: drei `<Detailed distances={[0, 10, 25]}>`.
- **BVH**: drei `<Bvh firstHitOnly>` acelera raycast de puntero en mallas densas (three-mesh-bvh).
- Sombras: 1 DirectionalLight, `mapSize 1024`, cámara de sombra ajustada; estáticas → `<BakeShadows />`.
- Evitar en móvil: `transmission` en varios objetos (pasada extra), SSR/SSGI, AO en pantalla a resolución completa (bajar resolución del nodo), bloom multipasada grande.
- Materiales: compartir instancias de material; `MeshStandardMaterial` es más barato que `MeshPhysicalMaterial` (clearcoat/sheen/transmission añaden coste).
- Texturas procedurales de canvas: 512² en móvil, 1024² en desktop.
- Liberar todo al desmontar (`geometry.dispose()`, `material.dispose()`, `texture.dispose()`, `renderer.dispose()`); R3F lo hace para objetos declarados en JSX.
- Carga diferida: `React.lazy` del canvas (ver LESSONS: no usar `manualChunks` con three).
- `prefers-reduced-motion`: sin auto-rotación, sin scroll-scrub; render en demanda.

## Medir
- WebGPU: `renderer.info.render.{calls,triangles}` y `renderer.info.memory`. `r3f-perf` **no** sirve con WebGPURenderer (usa APIs WebGL). `stats-gl` (dependencia de drei) — compatibilidad WebGPU no verificada.
- Probar en dispositivo real; headless Chromium no tiene WebGPU real (cae a WebGL2).
