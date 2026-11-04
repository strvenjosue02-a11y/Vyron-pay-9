# Realismo en Three.js (WebGPU con fallback WebGL2)

(2026-11-04, 3d-researcher). Fuentes: código de three 0.187 (`node_modules/three/src`), R3F 9.8 (`dist/events-*.esm.js`), glTF KHR extensions (Khronos sample assets como referencia). Los valores PBR son **puntos de partida empíricos** (no medidos con espectrofotómetro); ajustarlos con la luz real de la escena.

## 1. Orden de prioridades (lo que más suma)
1. **Iluminación por imagen (IBL)** correcta → `scene.environment`. Sin IBL, el PBR parece plástico.
2. **Tone mapping + sRGB** correctos.
3. **Microdetalle de superficie**: roughness variable (mapa o ruido) + normal/bump. Un roughness uniforme delata lo CG.
4. **Sombras de contacto / AO** para "asentar" objetos.
5. Formas imperfectas (ruido en vértices, asimetría).
6. Post: AO, bloom suave, TAA/SMAA. Grano/viñeta muy leves.

## 2. Gestión de color
- R3F 9 por defecto: `outputColorSpace = SRGBColorSpace` y `toneMapping = ACESFilmicToneMapping` (salvo `flat`/`linear`). Verificado en `@react-three/fiber/dist/events-*.esm.js` l.1744-1752.
- Texturas de color (`map`, `emissiveMap`, `sheenColorMap`): `texture.colorSpace = THREE.SRGBColorSpace`. Datos (normal, roughness, metalness, AO): dejar `NoColorSpace`/lineal. `useGLTF` ya lo hace bien.
- Colores en JSX (`color="#c8833a"`) se interpretan como sRGB y se convierten a lineal (ColorManagement activo por defecto).

## 3. Tone mapping (constantes en `three/src/constants.js`)
| Opción | Cuándo |
|---|---|
| `ACESFilmicToneMapping` (4) | Default de R3F. Contraste "cine", **satura y desplaza** colores vivos (rojos→naranja, amarillos quemados). Malo para comida/producto con color de marca. |
| `AgXToneMapping` (6) | Highlights suaves y naturales, mejor con HDRIs intensos; algo desaturado → subir `toneMappingExposure` ~1.1–1.3. |
| `NeutralToneMapping` (7) | Khronos PBR Neutral: **conserva el color base** (recomendado e-commerce/comida/producto). |
- Recomendación para comida y producto: `NeutralToneMapping`, `exposure 1.0–1.2`. Para escenas dramáticas/juegos: AgX.
- En R3F: `<Canvas gl={...} onCreated={({gl}) => { gl.toneMapping = THREE.NeutralToneMapping }}>` o pasarlo en el renderer. Con `RenderPipeline` el tone mapping lo aplica `renderOutput()` al final (no duplicar).

## 4. Iluminación
### a) IBL sin red (preferido)
```tsx
// WebGPU: PMREMGenerator debe venir de three/webgpu y requiere renderer.init() (ya hecho en scene-canvas)
import * as THREE from 'three/webgpu';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
function StudioEnv() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl as unknown as THREE.WebGPURenderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.8;
    return () => { scene.environment = null; env.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}
```
(`fromScene` lanza error si el backend no está inicializado — ver `renderers/common/extras/PMREMGenerator.js:118`.)
### b) HDRI autohospedado
`<Environment files={suspend(import('@pmndrs/assets/hdri/studio.exr')).default} environmentIntensity={0.8} />` o `files="/hdri/studio_small_03_1k.hdr"` (de pmndrs/drei-assets). 1k basta para reflejos difusos; para fondos visibles usar 2k+ o un fondo propio desenfocado (`backgroundBlurriness`).
### c) Estudio / softbox
- **Tres puntos**: key (DirectionalLight o SpotLight, 45° lateral-alto, intensidad 2–3, con sombra), fill (opuesta, 0.3–0.5× key, sin sombra), rim/back (detrás-arriba, 1–2×, separa silueta; clave en comida para brillos de grasa).
- **Softbox real**: `RectAreaLight` (solo afecta a Standard/Physical; sin sombras). En WebGL requiere `RectAreaLightUniformsLib.init()`; en WebGPU `RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())` (ambos en `three/addons/lights/`; `setLTC` verificado en `src/nodes/lighting/RectAreaLightNode.js:124`).
- **Lightformers** (drei): rectángulos emisivos dentro de `<Environment>` → reflejos de estudio nítidos en metal/vidrio/salsas. En WebGPU **no verificado** (usa WebGLCubeRenderTarget).
- Intensidades: three usa unidades físicas (`useLegacyLights` eliminado). Con IBL a 1.0, una DirectionalLight de 1.5–3 es razonable.

## 5. Sombras
- `<Canvas shadows>` en R3F pone `PCFSoftShadowMap`, que **fue eliminado en r186**: WebGPU/WebGL avisan y usan `PCFShadowMap` (verificado `Renderer.js:1031`, `ShadowNode.js:117`). Usar `shadows="percentage"` (PCF) o `shadows="variance"` (VSM; todos los receptores también proyectan).
- DirectionalLight: ajustar la cámara de sombra al objeto (`shadow.camera.left/right/top/bottom` ±2), `shadow.mapSize 1024` (2048 desktop), `shadow.bias -0.0005`, `shadow.normalBias 0.02` contra acné. `shadow.radius` suaviza en PCF.
- Sombra de suelo barata compatible con WebGPU: plano con `ShadowMaterial` (`opacity 0.25–0.4`), o textura de sombra horneada (radial gradient en canvas) bajo el objeto. `ContactShadows`/`AccumulativeShadows` de drei = solo WebGL.
- En escenas estáticas: `<BakeShadows />` (drei) o `renderer.shadowMap.autoUpdate = false`.

## 6. AO y post-proceso
- WebGPU: `RenderPipeline` + `pass(scene, camera)` + `GTAONode` (AO), `BloomNode` (umbral alto ~0.9, intensidad 0.2–0.4), `SMAANode`/`TRAANode`. Ejemplos en `.claude/skills/webgpu-threejs-tsl/examples/post-processing.js`.
- WebGL: `@react-three/postprocessing` + `N8AO` (mejor AO WebGL) — no mezclar con WebGPURenderer.
- AO horneado (`aoMap`, requiere `uv`/`uv1`) es siempre más barato que SSAO en móvil.

## 7. Parámetros PBR por material (MeshPhysicalMaterial / MeshStandardMaterial)
| Material | color (sRGB) | roughness | metalness | Extras |
|---|---|---|---|---|
| Pan brioche (corteza) | #b5651d → #e0a050 (gradiente hacia la base) | 0.55–0.7 (+ruido) | 0 | `clearcoat 0.15–0.3, clearcoatRoughness 0.4` (brillo de huevo/mantequilla); `sheen 0.2` miga; bump fino |
| Miga de pan (corte) | #f1dcb0 | 0.9 | 0 | bump poroso alto (worley), sin clearcoat |
| Carne a la parrilla | #4a2a1a base, char #1a0f0a, jugos #6b2d1a | 0.45–0.6 (zonas grasas 0.3) | 0 | `clearcoat 0.3–0.5, clearcoatRoughness 0.3` (grasa); bump alto; marcas de parrilla en mapa |
| Queso cheddar fundido | #f2a516 | 0.3–0.4 | 0 | `transmission 0.0–0.1, thickness 0.2`, `sheen 0.1`; SSS ideal (MeshSSSNodeMaterial, thicknessColor naranja) |
| Lechuga | #6aa832 (bordes #a6d65a, nervios claros) | 0.4–0.5 | 0 | `clearcoat 0.4` (humedad), `side: DoubleSide`, `transmission 0.1–0.2` o SSS verde para contraluz |
| Tomate (piel) | #c8231b | 0.25–0.35 | 0 | `clearcoat 0.6–0.8, clearcoatRoughness 0.1` |
| Tomate (corte/pulpa) | #e0412e, semillas #e8c46a | 0.2 | 0 | `transmission 0.15, thickness 0.5, ior 1.35` gel; SSS |
| Cebolla | #f3e7f0 / morada #8a3b6b | 0.3 | 0 | `transmission 0.3, thickness 0.3`, `iridescence` muy leve no necesario |
| Rebozado / frito (papas, pollo) | #c9862d → #e8b04a | 0.5–0.65 | 0 | `clearcoat 0.25–0.4, clearcoatRoughness 0.35` (aceite); bump alta frecuencia; sal = puntos claros |
| Tela (sofá, terciopelo) | según diseño | 0.8–1.0 | 0 | `sheen 0.5–1, sheenRoughness 0.3–0.8, sheenColor` más claro que el color; normal map de tejido |
| Cuero | #5a3a24 | 0.4–0.6 | 0 | `clearcoat 0.2`, normal de poro |
| Madera barnizada | textura | 0.3–0.5 | 0 | `clearcoat 0.5–1, clearcoatRoughness 0.05–0.2` |
| Madera cruda | textura | 0.7–0.9 | 0 | bump de veta |
| Piel humana | #e0ac8a (variar) | 0.45–0.6 | 0 | `MeshSSSNodeMaterial` (WebGPU) o `sheen 0.1–0.25 sheenColor rojizo` (truco WebGL); `specularIntensity 0.5`; mapas de poros |
| Pelaje | — | 0.8 | 0 | geometría por capas (shells) o pelo instanciado; `sheen` simula aterciopelado |
| Vidrio | #ffffff | 0–0.05 | 0 | `transmission 1, thickness 0.5–2, ior 1.5, attenuationColor/Distance` para tinte; `dispersion 0.1–0.3` (WebGPU/WebGL) |
| Metal pulido (acero) | #c0c0c0 | 0.1–0.25 | 1 | `anisotropy` para cepillado |
| Oro | #ffc35a | 0.15–0.3 | 1 | |
| Cerámica/plato | #f7f5f0 | 0.1–0.2 | 0 | `clearcoat 1, clearcoatRoughness 0.05` |
| Plástico | color | 0.3–0.6 | 0 | `specularIntensity 0.5` |
Regla: metalness es 0 o 1 (no intermedios salvo transiciones). Ningún material real tiene roughness 0 exacto.

Notas:
- `transmission` cuesta una pasada extra de render (la escena opaca se renderiza a textura). Limitar en móvil a 1–2 objetos o simular con opacity.
- `sheen`, `clearcoat`, `transmission`, `iridescence`, `anisotropy`, `dispersion` existen en `MeshPhysicalMaterial` y se mapean a `MeshPhysicalNodeMaterial` en WebGPU.
- SSS real: solo `MeshSSSNodeMaterial` (WebGPU, también en su backend WebGL2). Con WebGLRenderer puro no hay SSS integrado.

## 8. Composición "foto de producto"
- Cámara: FOV 25–35° (teleobjetivo) aplana y "vende" el objeto; altura ligeramente sobre el objeto.
- Fondo: degradado suave o color plano, nunca HDRI nítido detrás de comida.
- Profundidad de campo leve (DepthOfFieldNode) con foco en el elemento principal.
