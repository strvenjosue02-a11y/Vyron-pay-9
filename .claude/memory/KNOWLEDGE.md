# Conocimiento verificado

## Entorno
- Red: GitHub (git clone, raw.githubusercontent.com) y registro npm accesibles. Bloqueados: polyhaven, ambientcg, kenney, quaternius, threejs.org, jsdelivr, huggingface, registros shadcn. (2026-11-04, web-builder)
- Sin API keys: 21st.dev eliminado. (2026-11-04, web-builder)

## Stack instalado
- three 0.187, @react-three/fiber 9.8, drei 10.7, postprocessing 6.39, motion 14.9, gsap 3.15 (+SplitText gratis), lenis 1.3. (2026-11-04, web-builder)
- WebGPURenderer de `three/webgpu` cae solo a WebGL2 si no hay WebGPU (probado en headless Chromium, src/components/three/scene-canvas.tsx). (2026-11-04, web-builder)

## Comida procedural (probado en src/features/burger/)
- Pan: `LatheGeometry` desde `SplineCurve.getSpacedPoints` (UV v ≈ longitud de arco) + wobble fbm; textura de degradado por v con banda de miga. MeshPhysical roughness 0.4, clearcoat 0.55, sheen 0.25. (2026-11-04, web-builder)
- Carne smash: Cylinder 128×12 con ruido (ángulo+altura) y hombros redondeados; mapa de color fbm (costra/grasa) + bumpMap fbm, bumpScale 2.5, clearcoat 0.45. (2026-11-04, web-builder)
- Queso fundido: Plane 2.0 rotado 45°, caída `(d-0.98)^1.3·1.25` fuera del radio de la carne y tirón hacia dentro; color #e88a12, DoubleSide. (2026-11-04, web-builder)
- Lechuga: RingGeometry (inner 0.001) con volantes de 2 frecuencias (13 y 29) × t²; #3f8f22, clearcoat 0.6, DoubleSide. (2026-11-04, web-builder)
- Tomate: Cylinder con material array [lado, tapa, tapa]; las tapas usan textura canvas de corte (cámaras de semillas). (2026-11-04, web-builder)
- Iluminación sin red: `RoomEnvironment` → `PMREMGenerator` de `three/webgpu`, `environmentIntensity` 0.45 + key cálida, contraluz naranja y relleno. Funciona en el backend WebGL2. (2026-11-04, web-builder)
- Despiece con scroll: ScrollTrigger (sin scrub, solo onUpdate) escribe progress en un objeto mutable; el `useFrame` lo suaviza con `MathUtils.damp(…, 6, delta)` → sin re-renders de React por frame. (2026-11-04, web-builder)
- Cámara que encaja en cualquier aspecto: `dist = max(anchoMedio/(tan(fov/2)·aspect), altoMedio/tan(fov/2))`. (2026-11-04, web-builder)
- Bundle: escena 3D lazy ≈450 kB gzip (three/webgpu completo); index ≈182 kB gzip. MEJORA pendiente: importar solo lo necesario. (2026-11-04, web-builder)
