import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import GLCanvas from "@/components/three/gl-canvas";
import { buildFries } from "./fries";
import type { ShowcaseState } from "./showcase";

function Fries({ state, still }: { state: ShowcaseState; still: boolean }) {
  const built = useMemo(() => buildFries(), []);
  useEffect(() => () => built.dispose(), [built]);
  const root = useRef<THREE.Group>(null);
  const eased = useRef(0);
  const { camera, size } = useThree();

  useFrame((f, dt) => {
    eased.current = THREE.MathUtils.damp(eased.current, still ? 0.6 : state.progress, 5, dt);
    const p = eased.current;
    // Fries rise out of the carton in a staggered wave, then settle slightly.
    for (const fr of built.fries) {
      const t = THREE.MathUtils.smoothstep(p, 0.1 + fr.delay, 0.55 + fr.delay);
      const settle = THREE.MathUtils.smoothstep(p, 0.75, 1) * 0.25;
      fr.mesh.position.y = fr.base.y + fr.lift * (t - settle * t);
      fr.mesh.rotation.x = fr.rot.x * (1 + t * 0.6);
      fr.mesh.rotation.z = fr.rot.z * (1 + t * 0.6);
    }
    const g = root.current!;
    const idle = still ? 0 : Math.sin(f.clock.elapsedTime * 0.5) * 0.05;
    g.rotation.y = -0.6 + p * 1.2 + idle;
    g.rotation.x = 0.08 - p * 0.06;

    const cam = camera as THREE.PerspectiveCamera;
    const half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const aspect = size.width / size.height;
    const dist = Math.max(1.05 / (half * aspect), 1.85 / half) * (1.08 - p * 0.12);
    cam.position.set(0, 1.25 + dist * 0.18, dist);
    cam.lookAt(0, 0.72, 0);
  });

  return (
    <group ref={root}>
      <primitive object={built.group} />
      <ContactShadows opacity={0.8} scale={4} blur={2.2} far={2} resolution={512} color="#1a0c04" />
    </group>
  );
}

export default function FriesScene({ state, still = false }: { state: ShowcaseState; still?: boolean }) {
  return (
    <GLCanvas camera={{ position: [0, 1.6, 5], fov: 30 }} glow="#5a3410">
      <directionalLight position={[3, 5, 4]} intensity={1.8} color="#fff0dc" />
      <directionalLight position={[-4, 3, -3]} intensity={2} color="#ffb060" />
      <Fries state={state} still={still} />
    </GLCanvas>
  );
}
