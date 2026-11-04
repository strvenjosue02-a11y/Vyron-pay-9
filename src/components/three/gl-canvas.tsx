import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, SMAA, SSAO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import studio from "@pmndrs/assets/hdri/studio.exr.js";

/**
 * Decode the bundled studio EXR in memory. Avoids fetch() of a data: URI,
 * which strict CSPs (embedded/sandboxed pages) block.
 */
function useStudioHDRI() {
  const tex = useMemo(() => {
    const b64 = studio.slice(studio.indexOf(",") + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const loader = new EXRLoader();
    const d = loader.parse(bytes.buffer) as unknown as { data: Uint16Array | Float32Array; width: number; height: number; format: THREE.PixelFormat; type: THREE.TextureDataType };
    const t = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.flipY = false;
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

type Props = Omit<CanvasProps, "gl" | "frameloop" | "dpr" | "flat"> & {
  children: ReactNode;
  /** Page colour behind the scene; the backdrop glow is drawn on top of it. */
  background?: string;
  glow?: string;
};

/** Radial "stage light" behind the subject, rendered in-scene so post-processing sees it. */
function StudioEnvironment() {
  const map = useStudioHDRI();
  return (
    <Environment map={map} environmentIntensity={0.32} resolution={256}>
      {/* Softboxes: big key from the front-right, warm strip rim, soft warm fill. */}
      <Lightformer form="rect" intensity={1.6} color="#fff4e6" position={[3, 4, 5]} scale={[6, 4, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={2.4} color="#ffb070" position={[-5, 2, -4]} scale={[2, 8, 1]} target={[0, 0, 0]} />
      <Lightformer form="circle" intensity={0.45} color="#ffe9d6" position={[-4, -1, 4]} scale={3} target={[0, 0, 0]} />
    </Environment>
  );
}

function Backdrop({ background, glow }: { background: string; glow: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(128, 118, 0, 128, 128, 128);
    r.addColorStop(0, glow);
    r.addColorStop(1, background);
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [background, glow]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 0, -12]} renderOrder={-1}>
      <planeGeometry args={[60, 60]} />
      <meshBasicMaterial map={tex} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/**
 * WebGL 2 canvas for product / food scenes: studio HDRI (bundled, no network)
 * plus softbox Lightformers, SSAO (desktop tier), SMAA, a restrained
 * bloom, Neutral tone mapping (keeps reds/yellows honest) and a vignette.
 * Quality steps down automatically on slow devices; rendering pauses
 * off-screen.
 */
export default function GLCanvas({ children, background = "#15110e", glow = "#4a2a14", ...props }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [tier, setTier] = useState<"high" | "low">(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches ? "low" : "high",
  );
  const [dpr, setDpr] = useState(tier === "high" ? 1.75 : 1.5);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        flat
        dpr={[1, dpr]}
        frameloop={visible ? "always" : "never"}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        {...props}
      >
        <PerformanceMonitor
          onDecline={() => {
            setTier("low");
            setDpr(1);
          }}
          onIncline={() => setDpr((d) => Math.min(d + 0.25, 1.75))}
        />
        <color attach="background" args={[background]} />
        <Backdrop background={background} glow={glow} />
        <StudioEnvironment />
        {children}
        <EffectComposer multisampling={0} enableNormalPass={tier === "high"}>
          {/* N8AO crashes on three 0.187 (old multi-render-target API) → postprocessing's SSAO, desktop tier only. */}
          {tier === "high" ? (
            <SSAO samples={16} radius={0.08} intensity={18} luminanceInfluence={0.5} bias={0.025} worldDistanceThreshold={2} worldDistanceFalloff={1} worldProximityThreshold={0.4} worldProximityFalloff={0.3} />
          ) : (
            <></>
          )}
          <Bloom mipmapBlur luminanceThreshold={1} intensity={0.15} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          {/* Food-photography grade: Neutral is honest but flat — restore appetite. */}
          <HueSaturation saturation={0.16} />
          <BrightnessContrast contrast={0.1} />
          <Vignette offset={0.3} darkness={0.55} />
          <SMAA />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
