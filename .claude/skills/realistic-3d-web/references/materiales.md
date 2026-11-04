# Materiales PBR por familia

Fuente: `.claude/memory/research/realismo.md` §7 (valores **empíricos de partida**, no medidos con
espectrofotómetro) + valores reales del burger (`src/features/burger/burger-scene.tsx`), que sí se
ven bien en capturas [probado]. Ajusta siempre con la luz real de la escena.

Reglas: metalness 0 o 1; roughness nunca 0 exacto; roughness variable (mapa/ruido) > uniforme;
`MeshStandardMaterial` cuando no necesites clearcoat/sheen/transmission (más barato).

## Comida

| Material | color (sRGB) | roughness | Extras | Evidencia |
|---|---|---|---|---|
| Pan (corona) | mapa de gradiente `#7e3f12`→`#e0b06a` sobre v del lathe | 0.4 | `clearcoat 0.55, clearcoatRoughness 0.35, sheen 0.25, sheenColor #ffcf8a` | [probado] burger |
| Pan (base, miga arriba) | mapa con banda de miga `#ead2a6` | 0.6 | `sheen 0.3, sheenColor #ffd9a0` | [probado] |
| Miga de pan (corte) | `#f1dcb0` | 0.9 | bump poroso, sin clearcoat | [sin probar] |
| Carne a la parrilla | mapa fbm `#4a2414` + char + grasa | 0.62 | `bumpMap` fbm, `bumpScale 2.5, clearcoat 0.45, clearcoatRoughness 0.35` | [probado] |
| Queso fundido | `#e88a12` | 0.38 | `clearcoat 0.35, side DoubleSide`; SSS ideal con `MeshSSSNodeMaterial` (solo WebGPURenderer) | [probado] / SSS [sin probar] |
| Lechuga | `#3f8f22` | 0.5 | `clearcoat 0.6, sheen 0.35 #a8e070, DoubleSide` | [probado] |
| Tomate piel | `#c41f12` | 0.25 | `clearcoat 1, clearcoatRoughness 0.1` | [probado] |
| Tomate corte | mapa radial (cámaras + semillas) | 0.3 | `clearcoat 1`; `transmission 0.15, ior 1.35` para gel | mapa [probado] / transmission [sin probar] |
| Pepinillo | `#7d8f2c` | 0.4 | `clearcoat 0.8` | [probado] |
| Cebolla | `#efd9ec` (morada `#8a3b6b`) | 0.3 | `clearcoat 0.6, transmission 0.25, thickness 0.05` | [probado] |
| Sésamo | `#efdcae` | 0.5 | Standard, instanciado | [probado] |
| Frito (papas, pollo) | colores por vértice/instancia `#7a3e12`→`#d9952f`; papas `#e9b44c` ±HSL | 0.55–0.6 | `clearcoat 0.3–0.35, clearcoatRoughness 0.35–0.4` | [probado] lab 2026-11-04 |
| Plato cerámico | `#f7f5f0` | 0.1–0.2 | `clearcoat 1, clearcoatRoughness 0.05` | [sin probar] |

## No comida (todo [sin probar] salvo nota)

| Material | color | roughness | metal | Extras |
|---|---|---|---|---|
| Terciopelo / tela | diseño | 0.8–1.0 | 0 | `sheen 0.5–1, sheenRoughness 0.3–0.8, sheenColor` más claro; normal de tejido. Referencia: Khronos `SheenChair`, `GlamVelvetSofa` |
| Cuero | `#5a3a24` | 0.4–0.6 | 0 | `clearcoat 0.2`, normal de poro |
| Madera barnizada | textura | 0.3–0.5 | 0 | `clearcoat 0.5–1, clearcoatRoughness 0.05–0.2`. Texturas: three.js `examples/textures/hardwood2_*` |
| Madera cruda | textura | 0.7–0.9 | 0 | bump de veta |
| Acero pulido | `#c0c0c0` | 0.1–0.25 | 1 | `anisotropy` para cepillado. Esfera metal r0.08 con IBL [probado] |
| Oro | `#ffc35a` | 0.15–0.3 | 1 | |
| Vidrio | `#ffffff` | 0–0.05 | 0 | `transmission 1, thickness 0.5–2, ior 1.5, attenuationColor/Distance`; `dispersion 0.1–0.3` |
| Plástico | color | 0.3–0.6 | 0 | `specularIntensity 0.5`; lacado: `clearcoat 1` [probado esfera roja] |
| Piel humana | `#e0ac8a` (variar) | 0.45–0.6 | 0 | `MeshSSSNodeMaterial` (WebGPURenderer: `thicknessColorNode`, distortion 0.1, attenuation 0.1, power 2) o truco WebGL `sheen 0.1–0.25` rojizo; `specularIntensity 0.5`. Referencia: `LeePerrySmith.glb` |
| Pelaje | — | 0.8 | 0 | shells por capas o pelo instanciado; `sheen` aterciopelado |

## IBL sin red

### RoomEnvironment (estudio genérico) [probado]
```tsx
import * as THREE from "three/webgpu"; // en WebGLRenderer: "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
function StudioEnvironment({ intensity = 0.45 }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl as unknown as THREE.WebGPURenderer); // tras renderer.init()
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room as unknown as THREE.Scene, 0.04);
    scene.environment = rt.texture; scene.environmentIntensity = intensity;
    return () => { scene.environment = null; rt.dispose(); pmrem.dispose();
      room.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); };
  }, [gl, scene, intensity]);
  return null;
}
```

### Softboxes a medida ("Lightformers" que funcionan con WebGPURenderer) [probado, backend WebGL2]
drei `<Environment><Lightformer/></Environment>` falla con WebGPURenderer (usa `WebGLCubeRenderTarget`
+ `CubeCamera` → esferas negras y `GL_INVALID_OPERATION: glFramebufferTexture2D`). Equivalente:
```tsx
function SoftboxEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const env = new THREE.Scene();
    env.background = new THREE.Color("#050505");
    const geo = new THREE.PlaneGeometry(1, 1);
    const add = (color: string, intensity: number, pos: [number, number, number], scale: [number, number, number]) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, toneMapped: false }));
      m.position.set(...pos); m.scale.set(...scale); m.lookAt(0, 0, 0); env.add(m);
    };
    add("#ffffff", 4, [0, 3, 2], [4, 1, 1]);   // key cenital
    add("#ff9b54", 2, [-4, 0, 0], [1, 4, 1]);  // tira cálida lateral
    add("#66aaff", 3, [4, 0, 0], [2, 2, 1]);   // acento frío
    const pmrem = new THREE.PMREMGenerator(gl as unknown as THREE.WebGPURenderer);
    const rt = pmrem.fromScene(env, 0.02);
    scene.environment = rt.texture;
    return () => { scene.environment = null; rt.dispose(); pmrem.dispose(); geo.dispose();
      env.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose()); };
  }, [gl, scene]);
  return null;
}
```
Resultado: reflejos rectangulares nítidos en metal y clearcoat (captura en el lab del 2026-11-04).
Con **WebGLRenderer** usa directamente drei `<Environment resolution={256}>` + `<Lightformer>` [sin probar aquí].

### HDRI autohospedado
`@pmndrs/assets` (CC0, EXR base64 130–420 KB): `<Environment files={suspend(import('@pmndrs/assets/hdri/studio.exr')).default} />`
[código; sin probar en ejecución]. Alternativa: `pmndrs/drei-assets/hdri/*_1k.hdr` en `public/hdri/`.
