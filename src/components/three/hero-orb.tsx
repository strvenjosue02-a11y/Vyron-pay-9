import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import SceneCanvas from "./scene-canvas";

function Orb() {
  const mesh = useRef<Mesh>(null);
  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    m.rotation.y += delta * 0.15;
    // Gentle pointer parallax, eased toward the target each frame.
    m.rotation.x += (state.pointer.y * 0.3 - m.rotation.x) * 0.05;
    m.position.x += (state.pointer.x * 0.25 - m.position.x) * 0.05;
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1.4, 24]} />
      <meshPhysicalMaterial
        color="#7c6cff"
        metalness={0.35}
        roughness={0.15}
        clearcoat={1}
        iridescence={1}
        iridescenceIOR={1.4}
      />
    </mesh>
  );
}

/** Default export so it can be React.lazy()-loaded off the critical path. */
export default function HeroOrb() {
  return (
    <SceneCanvas camera={{ position: [0, 0, 9], fov: 40 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} />
      <pointLight position={[-4, -2, 2]} intensity={30} color="#22d3ee" />
      <Orb />
    </SceneCanvas>
  );
}
