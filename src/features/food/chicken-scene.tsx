import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import GLCanvas from "@/components/three/gl-canvas";
import { buildChicken } from "./chicken";
import type { ShowcaseState } from "./showcase";

/** Damped "drop and settle": overshoots once like a piece landing on paper. */
const land = (t: number) => (t >= 1 ? 1 : 1 - Math.cos(t * Math.PI * 1.5) * Math.exp(-5 * t));

function Chicken({ state, still }: { state: ShowcaseState; still: boolean }) {
  const built = useMemo(() => buildChicken(), []);
  useEffect(() => () => built.dispose(), [built]);
  const root = useRef<THREE.Group>(null);
  const eased = useRef(0);
  const { camera, size } = useThree();

  useFrame((f, dt) => {
    eased.current = THREE.MathUtils.damp(eased.current, still ? 1 : state.progress, 5, dt);
    const p = eased.current;
    for (const pc of built.pieces) {
      const t = THREE.MathUtils.clamp((p - 0.08 - pc.delay) / 0.38, 0, 1);
      const k = land(t);
      pc.obj.position.y = pc.base.y + (1 - k) * 2.6;
      pc.obj.rotation.set(pc.rot.x + (1 - k) * 0.9, pc.rot.y + (1 - k) * 1.4, pc.rot.z);
      pc.obj.visible = t > 0;
    }
    const g = root.current!;
    g.rotation.y = 0.35 - p * 0.9 + (still ? 0 : Math.sin(f.clock.elapsedTime * 0.4) * 0.04);

    const cam = camera as THREE.PerspectiveCamera;
    const half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const aspect = size.width / size.height;
    const dist = Math.max(1.9 / (half * aspect), 2.2 / half) * (1.1 - THREE.MathUtils.smoothstep(p, 0.5, 1) * 0.22);
    cam.position.set(0, dist * 0.62, dist * 0.82);
    cam.lookAt(0, -0.25, 0.3);
  });

  return (
    <group ref={root}>
      <primitive object={built.group} />
      <ContactShadows position-y={0.005} opacity={0.7} scale={5} blur={1.8} far={1.2} resolution={512} color="#2a1206" />
    </group>
  );
}

export default function ChickenScene({ state, still = false }: { state: ShowcaseState; still?: boolean }) {
  return (
    <GLCanvas camera={{ position: [0, 3, 4], fov: 32 }} glow="#4e2a12">
      <directionalLight position={[2, 6, 3]} intensity={1.7} color="#fff1df" />
      <directionalLight position={[-4, 2.5, -3]} intensity={2.2} color="#ffa552" />
      <Chicken state={state} still={still} />
    </GLCanvas>
  );
}
