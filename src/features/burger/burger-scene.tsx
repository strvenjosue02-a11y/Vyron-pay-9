import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import GLCanvas from "@/components/three/gl-canvas";
import { layers } from "./data";
import {
  bottomBunGeometry, cheeseGeometry, lettuceGeometry, pattyGeometry, sesameMatrices, topBunGeometry,
} from "./geometry";
import { bunTexture, pattyBump, pattyTexture, pickleSliceTexture, tomatoSliceTexture } from "./textures";

export type ScrollState = { progress: number; active: number };

const GAP = 0.62; // extra space between layers when fully exploded

function useBurgerAssets() {
  const assets = useMemo(() => {
    const geo = {
      topBun: topBunGeometry(),
      bottomBun: bottomBunGeometry(),
      patty: pattyGeometry(),
      cheese: cheeseGeometry(),
      lettuce: lettuceGeometry(),
      tomato: new THREE.CylinderGeometry(0.5, 0.5, 0.09, 48),
      pickle: new THREE.CylinderGeometry(0.27, 0.27, 0.045, 32),
      onion: new THREE.TorusGeometry(0.42, 0.035, 12, 64),
      seed: new THREE.SphereGeometry(0.036, 8, 6).scale(1, 0.42, 2.1),
    };
    const tex = {
      topBun: bunTexture(0, 0.14, true),
      bottomBun: bunTexture(0.8, 1, false),
      patty: pattyTexture(),
      pattyBump: pattyBump(),
      tomato: tomatoSliceTexture(),
      pickle: pickleSliceTexture(),
    };
    const mat = {
      topBun: new THREE.MeshPhysicalMaterial({ map: tex.topBun, roughness: 0.4, clearcoat: 0.55, clearcoatRoughness: 0.35, sheen: 0.25, sheenColor: new THREE.Color("#ffcf8a"), sheenRoughness: 0.6 }),
      bottomBun: new THREE.MeshPhysicalMaterial({ map: tex.bottomBun, roughness: 0.66, sheen: 0.15, sheenColor: new THREE.Color("#ffd9a0"), specularIntensity: 0.6 }),
      patty: new THREE.MeshPhysicalMaterial({ map: tex.patty, bumpMap: tex.pattyBump, bumpScale: 3, roughness: 0.78, clearcoat: 0.12, clearcoatRoughness: 0.5, specularIntensity: 0.5 }),
      cheese: new THREE.MeshPhysicalMaterial({ color: "#e98a0e", roughness: 0.5, clearcoat: 0.1, clearcoatRoughness: 0.3, specularIntensity: 0.6, side: THREE.DoubleSide }),
      lettuce: new THREE.MeshPhysicalMaterial({ color: "#3d8a1f", roughness: 0.58, clearcoat: 0.18, clearcoatRoughness: 0.35, sheen: 0.2, sheenColor: new THREE.Color("#a8e070"), side: THREE.DoubleSide }),
      tomatoSide: new THREE.MeshPhysicalMaterial({ color: "#b3170c", roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
      tomatoCap: new THREE.MeshPhysicalMaterial({ map: tex.tomato, color: "#e8d0cc", roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.08 }),
      pickle: new THREE.MeshPhysicalMaterial({ color: "#5f7a1e", roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
      onion: new THREE.MeshPhysicalMaterial({ color: "#efd9ec", roughness: 0.3, clearcoat: 0.6, transmission: 0.25, thickness: 0.05 }),
      seed: new THREE.MeshStandardMaterial({ color: "#efdcae", roughness: 0.5 }),
      pickleCap: new THREE.MeshPhysicalMaterial({ map: tex.pickle, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    };
    return { geo, tex, mat };
  }, []);

  useEffect(
    () => () => {
      for (const g of Object.values(assets.geo)) g.dispose();
      for (const t of Object.values(assets.tex)) t.dispose();
      for (const m of Object.values(assets.mat)) m.dispose();
    },
    [assets],
  );
  return assets;
}

function Burger({ state, still }: { state: ScrollState; still: boolean }) {
  const { geo, mat } = useBurgerAssets();
  const root = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Group>(null);
  const layerRefs = useRef<(THREE.Group | null)[]>([]);
  const seeds = useRef<THREE.InstancedMesh>(null);
  const eased = useRef(0);
  const { camera, size } = useThree();

  const bases = useMemo(() => {
    let y = 0;
    return layers.map((l) => {
      const b = y;
      y += l.height;
      return b;
    });
  }, []);
  const assembledHeight = bases[bases.length - 1] + layers[layers.length - 1].height;

  useLayoutEffect(() => {
    const m = seeds.current;
    if (!m) return;
    sesameMatrices(m.count).forEach((mx, i) => m.setMatrixAt(i, mx));
    m.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((frame, delta) => {
    const target = still ? 0 : state.progress;
    // Critically-damped follow: smooth even when scroll input is steppy.
    eased.current = THREE.MathUtils.damp(eased.current, target, 6, delta);
    const p = eased.current;
    const explode = THREE.MathUtils.smoothstep(p, 0.04, 0.85);

    let top = 0;
    layerRefs.current.forEach((g, i) => {
      if (!g) return;
      const y = bases[i] + explode * GAP * i;
      g.position.y = y;
      const isActive = !still && state.active === i && explode > 0.5;
      g.position.z = THREE.MathUtils.damp(g.position.z, isActive ? 0.35 : 0, 8, delta);
      top = y + layers[i].height;
    });

    const g = root.current!;
    g.position.y = -top / 2 + 0.1;
    const idle = still ? 0 : frame.clock.elapsedTime * 0.12;
    g.rotation.y = idle + p * Math.PI * 0.9;
    g.rotation.x = THREE.MathUtils.lerp(0.18, 0.05, explode);

    if (shadow.current) {
      shadow.current.position.y = g.position.y - 0.02;
      const s = 1 - explode * 0.15;
      shadow.current.scale.setScalar(s);
    }

    // Fit the burger to any aspect ratio: width on phones, height when exploded.
    const cam = camera as THREE.PerspectiveCamera;
    const halfV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const aspect = size.width / size.height;
    const fitW = 1.45 / (halfV * aspect);
    const fitH = (top * 0.62 + 0.4) / halfV;
    const dist = Math.max(fitW, fitH, 4.6);
    cam.position.set(0, dist * 0.22, dist);
    cam.lookAt(0, 0, 0);
  });

  const parts = [
    <mesh key="bb" geometry={geo.bottomBun} material={mat.bottomBun} />,
    <mesh key="pa" geometry={geo.patty} material={mat.patty} position-y={0.15} />,
    <mesh key="ch" geometry={geo.cheese} material={mat.cheese} position-y={0.015} />,
    <group key="on">
      {[[0.35, 0.2], [-0.4, 0.3], [0.05, -0.45]].map(([x, z], i) => (
        <mesh key={i} geometry={geo.onion} material={mat.onion} position={[x, 0.03, z]} rotation-x={Math.PI / 2} scale={1 - i * 0.18} />
      ))}
    </group>,
    <group key="pi">
      {[[0.55, -0.2], [-0.5, -0.35], [-0.1, 0.55]].map(([x, z], i) => (
        <mesh key={i} geometry={geo.pickle} material={[mat.pickle, mat.pickleCap, mat.pickleCap]} position={[x, 0.025, z]} rotation-z={0.06 * (i - 1)} />
      ))}
    </group>,
    <group key="to">
      {[[0.48, 0.05], [-0.28, 0.42], [-0.26, -0.44]].map(([x, z], i) => (
        <mesh key={i} geometry={geo.tomato} material={[mat.tomatoSide, mat.tomatoCap, mat.tomatoCap]} position={[x, 0.045, z]} rotation-y={i * 1.3} />
      ))}
    </group>,
    <mesh key="le" geometry={geo.lettuce} material={mat.lettuce} position-y={0.06} />,
    <group key="tb">
      <mesh geometry={geo.topBun} material={mat.topBun} />
      <instancedMesh ref={seeds} args={[geo.seed, mat.seed, 110]} />
    </group>,
  ];

  return (
    <>
      <group ref={shadow}>
        <ContactShadows opacity={0.75} scale={5} blur={2.4} far={2.5} resolution={512} color="#1a0c04" />
      </group>
      <group ref={root} userData={{ assembledHeight }}>
        {parts.map((part, i) => (
          <group key={layers[i].id} ref={(el) => void (layerRefs.current[i] = el)}>
            {part}
          </group>
        ))}
      </group>
    </>
  );
}

export default function BurgerScene({ state, still = false }: { state: ScrollState; still?: boolean }) {
  return (
    <GLCanvas camera={{ position: [0, 1.4, 6], fov: 32 }}>
      <directionalLight position={[3, 5, 4]} intensity={1.05} color="#fff0dc" />
      <directionalLight position={[-4, 2, -3]} intensity={1.8} color="#ff9b54" />
      <Burger state={state} still={still} />
    </GLCanvas>
  );
}
