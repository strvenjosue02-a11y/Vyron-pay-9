import { useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, extend, type CanvasProps } from "@react-three/fiber";
import * as THREE from "three/webgpu";

// Register WebGPU-capable classes (node materials etc.) as JSX elements.
extend(THREE as unknown as Parameters<typeof extend>[0]);

type SceneCanvasProps = Omit<CanvasProps, "gl" | "frameloop"> & { children: ReactNode };

/**
 * R3F canvas on Three's WebGPURenderer. When the browser has no WebGPU the
 * renderer transparently uses its WebGL 2 backend. Rendering pauses while the
 * canvas is off-screen or the tab is hidden, and DPR is capped for mobile.
 */
export default function SceneCanvas({ children, ...props }: SceneCanvasProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

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
        dpr={[1, 1.75]}
        frameloop={visible ? "always" : "never"}
        gl={async (glProps) => {
          const renderer = new THREE.WebGPURenderer({
            ...(glProps as ConstructorParameters<typeof THREE.WebGPURenderer>[0]),
            antialias: true,
            alpha: true,
          });
          await renderer.init();
          return renderer;
        }}
        {...props}
      >
        {children}
      </Canvas>
    </div>
  );
}
