# Juegos 3D pequeños con R3F

Fuente: `.claude/memory/research/juegos.md` (`npm view`, README de ecctrl 2.0.2, código de drei).
**Nada de esta página se ha ejecutado en el repo** (rapier/ecctrl no instalados) → [sin probar].

## Stack
- `@react-three/rapier@2.2.0` (WASM embebido, sin descargas). Física en CPU → independiente del
  renderer (vale con WebGL y WebGPURenderer) [código].
- `ecctrl@2.0.2`: personaje, vehículos, controles táctiles. Peer **obligatorio `leva >=0.10.1`**,
  three >=0.184, drei >=10.7, fiber >=9.4. Sin ShaderMaterial [código].
- drei: `KeyboardControls`, `useAnimations`, `useGLTF`, `Detailed`, `Instances`, `PerformanceMonitor`.

## Esqueleto
```tsx
import { KeyboardControls } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import { Ecctrl } from "ecctrl";
const keys = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] }, { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] }, { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] }, { name: "run", keys: ["Shift"] },
];
<Physics paused={!visible}>
  <KeyboardControls map={keys}>
    <Ecctrl><CharacterModel /></Ecctrl>
  </KeyboardControls>
  <RigidBody type="fixed" colliders="trimesh"><Level /></RigidBody>
</Physics>
```
Animación por estado: `useEcctrlAnimationStore` (`ecctrl/animation`) → `IDLE | WALK | RUN |
JUMP_START | JUMP_IDLE | JUMP_FALL | JUMP_LAND` → `action.reset().fadeIn(0.15).play()` / `fadeOut(0.15)`.

## Reglas Rapier
- Dinámicos: `CuboidCollider`/`BallCollider`/`CapsuleCollider` o `colliders="hull"`; `trimesh` solo fijo.
- Malla visual detallada + colisionador simplificado aparte. `<Physics debug>` en desarrollo.
- Proyectiles: `ccd`. Triggers: `sensor` + `onIntersectionEnter`.
- Lee/escribe por refs en `useFrame` (`translation()`, `setLinvel`, `applyImpulse`), nunca estado React.
- Pausa con `<Physics paused>` fuera de pantalla / pestaña oculta.

## Personajes
```tsx
const { scene, animations } = useGLTF("/models/character.glb");
const { actions } = useAnimations(animations, group);
useEffect(() => { actions.Idle?.reset().fadeIn(0.2).play(); return () => void actions.Idle?.fadeOut(0.2); }, [actions]);
```
- Varias copias: `SkeletonUtils.clone` o `<Clone>` (no `scene.clone()`).
- Clips de otro archivo con el mismo esqueleto: pásalos a `useAnimations`; otro esqueleto: `SkeletonUtils.retargetClip`.
- Fuentes CC0: KayKit (personajes + 132 clips `Rig_Medium`), Quaternius `modular_*`, `animals_pack`,
  `platformer_game_pack`; three.js `RobotExpressive.glb` (CC0). Khronos `Fox` (atribuir).

## Rendimiento y UX
- 60 fps; `PerformanceMonitor` baja DPR/sombras. Niveles con `gltf-transform optimize --instance --join`.
- Táctil: controles de ecctrl + `touch-action: none` en el canvas (skill `mobile-native`).
- Reduced motion: sin sacudidas de cámara ni head-bob; cámara suavizada.
