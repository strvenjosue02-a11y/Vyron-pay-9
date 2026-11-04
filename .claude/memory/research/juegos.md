# Juegos 3D en la web con R3F

(2026-11-04, 3d-researcher). Fuentes: `npm view` de cada paquete, README de ecctrl 2.0.2 (tarball npm), drei 10.7.9 (`core/useAnimations.js`, `web/KeyboardControls.js`), licencias en los repos de KayKit/Quaternius/Khronos.

## Stack recomendado
- `@react-three/rapier@2.2.0` (Rapier WASM `@dimforge/rapier3d-compat@0.19.2` embebido, sin descargas externas). Física en CPU → **funciona igual con WebGPURenderer**.
- `ecctrl@2.0.2` (pmndrs): controladores de personaje (ShapeCast), vehículos, drones, gravedad custom, controles táctiles, estado de animación. Peers: drei >=10.7, fiber >=9.4, rapier >=2.2, **leva >=0.10.1** (obligatorio instalar leva), three >=0.184. Sin ShaderMaterial → compatible WebGPU (no probado en ejecución).
- Alternativa sin Rapier: `bvhecctrl@0.0.18` (colisiones por three-mesh-bvh, más ligero; versión 0.0.x = inestable).
- drei: `KeyboardControls`, `useAnimations`, `useGLTF`, `Detailed`, `Instances`, `PerformanceMonitor`.

## Patrón mínimo (ecctrl, del README oficial)
```tsx
import { KeyboardControls } from '@react-three/drei';
import { Physics, RigidBody } from '@react-three/rapier';
import { Ecctrl } from 'ecctrl';
const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] }, { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] }, { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] }, { name: 'run', keys: ['Shift'] },
];
<Physics /* timeStep="vary" o 1/60 fijo */>
  <KeyboardControls map={keyboardMap}>
    <Ecctrl><CharacterModel /></Ecctrl>
  </KeyboardControls>
  <RigidBody type="fixed" colliders="trimesh"><Level /></RigidBody>
</Physics>
```
Estados de animación: `ecctrl/animation` → `useEcctrlAnimationStore` con `IDLE | WALK | RUN | JUMP_START | JUMP_IDLE | JUMP_FALL | JUMP_LAND`; mapear a clips y `action.reset().fadeIn(0.15).play()` / `fadeOut(0.15)`.

## Rapier: reglas prácticas
- Colisionadores simples (`CuboidCollider`, `BallCollider`, `CapsuleCollider`) para cuerpos dinámicos; `colliders="trimesh"` solo para suelo/nivel **fijo**; `"hull"` para dinámicos con forma.
- Mallas visuales detalladas + colisionador simplificado separado.
- `<Physics debug>` en desarrollo.
- `RigidBody` con `ccd` para proyectiles rápidos. `sensor` + `onIntersectionEnter` para triggers.
- Pausar con `<Physics paused>` cuando la pestaña o el canvas no están visibles.
- Leer/escribir posiciones en `useFrame` mediante refs (`rb.current.translation()`, `setLinvel`, `applyImpulse`), nunca con estado React por frame.

## Animación de personajes
```tsx
const { scene, animations } = useGLTF('/models/character.glb');
const { actions, mixer } = useAnimations(animations, group);
useEffect(() => { actions.Idle?.reset().fadeIn(0.2).play(); return () => { actions.Idle?.fadeOut(0.2); }; }, [actions]);
// Reutilizar el mismo glb varias veces: clonar con SkeletonUtils.clone (three/addons/utils/SkeletonUtils.js) o drei <Clone>; un scene.clone() normal rompe el skinning.
```
- Clips de otro archivo con el mismo esqueleto: `useGLTF('/anims.glb').animations` y pasarlos a `useAnimations` (mismos nombres de hueso).

## Fuentes de personajes y animaciones sin API key (CC0 salvo indicación)
- **KayKit** (Kay Lousberg, CC0, `LICENSE.txt` de cada repo): `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0` (Knight, Barbarian, Mage, Rogue…), `KayKit-Character-Pack-Skeletons-1.0`. Animaciones: **132 clips** en el rig `Rig_Medium` — copia en `NoLimitNexus/game-models/library/animations/Rig_Medium_{General,MovementBasic,MovementAdvanced,CombatMelee,CombatRanged,Tools,Simulation,Special}.glb` (README del repo dice CC0, licencia en `licenses/kaykit-character-animations.txt`). Es lo más parecido a "Mixamo sin cuenta".
- **Quaternius** (CC0) vía `trebeljahr/quaternius-showcase/public/glb/`: `modular_men/`, `modular_women/` (personajes animados), `animals_pack/` (animales animados), `dinosaurs_pack/`, `easy_enemies_pack/`, `platformer_game_pack/`, `rpg_items_pack/`, `nature_pack/` (150), `cyberpunk_pack/`.
- three.js `examples/models/gltf/RobotExpressive/RobotExpressive.glb` — Quaternius, CC0 (README), con clips (Idle, Walking, Running, Jump, Dance, Wave, Punch… según el ejemplo `webgl_animation_skinning_morph`; lista exacta no verificada) + morphs faciales.
- Khronos `Fox` (Survey/Walk/Run) — CC0 + CC-BY-4.0 (atribuir a tomkranis y AsoboStudio/scurest).
- Mixamo (Adobe): requiere cuenta/login, no automatizable aquí; `Soldier.glb`, `Xbot.glb`, `Michelle.glb` de three.js vienen de Mixamo → solo prototipos.
- Retargeting a otros esqueletos: `SkeletonUtils.retargetClip` (three addons) o herramientas como `nirholas/retarget` (Apache-2.0, no evaluada).

## Juegos de referencia (código abierto, no evaluados a fondo)
- `pmndrs/ecctrl` (demo ecctrl.app), `pmndrs/BVHEcctrl`.
- `ryan-j-parker/r3f-game` (R3F + Rapier, 11★), `NafisRayan/Third-Person-Shooter-Game-R3F` (MIT), `suislanchez/threejs-fps-starter`.

## Rendimiento en juegos
- Niveles con `gltf-transform optimize --instance --join`; colisión con malla simplificada.
- Controles táctiles: ecctrl incluye "Touch Input"; respetar `touch-action: none` en el canvas (ver skill `mobile-native`).
- 60 fps objetivo; `PerformanceMonitor` para bajar DPR/sombras.
