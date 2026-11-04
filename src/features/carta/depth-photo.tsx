import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { cx as cn } from "./cx";

/**
 * Foto real con profundidad (Calco: recorte IS-Net + Depth Anything V2).
 * Un quad WebGL2 desplaza cada píxel según su profundidad → la comida "gira" unos
 * grados con el dedo o el scroll. Siempre hay un <picture> debajo (LCP, fallback,
 * reduced-motion). El canvas solo dibuja mientras el muelle se mueve.
 */
export type DepthHandle = { setTilt(x: number, y: number): void };

type Props = {
  avif: string;
  webp?: string;
  depth: string;
  width: number;
  height: number;
  alt: string;
  priority?: boolean;
  strength?: number;
  interactive?: boolean;
  /** Arrancar WebGL al montar (p. ej. dentro de una hoja abierta por el usuario). */
  eager?: boolean;
  className?: string;
  sizes?: string;
};

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * .5 + .5; uv.y = 1. - uv.y; gl_Position = vec4(p, 0., 1.); }`;

// Parallax con 6 pasos de búsqueda: los píxeles cercanos tapan a los lejanos en vez de estirarse.
const FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D c, d; uniform vec2 t; uniform float s;
void main(){
  vec2 off = t * s;
  vec2 q = uv;
  for (int i = 0; i < 6; i++) {
    float h = texture(d, q).r;
    q = uv - off * (h - .45);
  }
  vec4 col = texture(c, q);
  o = vec4(col.rgb * col.a, col.a);
}`;

function supportsWebGL2() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export const DepthPhoto = forwardRef<DepthHandle, Props>(function DepthPhoto(
  { avif, webp, depth, width, height, alt, priority, strength = 0.035, interactive = true, eager = false, className, sizes },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const api = useRef<{ target: [number, number]; kick(): void } | null>(null);

  useImperativeHandle(ref, () => ({
    setTilt(x, y) {
      if (!api.current) return;
      api.current.target = [x, y];
      api.current.kick();
    },
  }));

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !supportsWebGL2() || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // El efecto solo importa cuando hay interacción: crear el contexto, compilar y subir
    // texturas en la carga bloquearía el hilo principal (TBT/INP). Se arranca con el primer
    // toque o scroll; hasta entonces se ve el <picture>, idéntico en reposo.
    let teardown: (() => void) | undefined;
    let started = false;
    let idle = 0;
    const start = () => {
      if (started) return;
      started = true;
      events.forEach((e) => removeEventListener(e, start));
      // Fuera del gesto que lo dispara: el primer scroll/toque responde sin esperar al GL.
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
      idle = ric(() => { teardown = init(cv); }, { timeout: 600 }) as number;
    };
    const events = ["pointerdown", "scroll", "wheel", "keydown"] as const;
    if (eager) start();
    else events.forEach((e) => addEventListener(e, start, { passive: true, once: true }));
    return () => {
      events.forEach((e) => removeEventListener(e, start));
      (window.cancelIdleCallback ?? clearTimeout)(idle);
      teardown?.();
    };
  }, [avif, depth, strength, interactive, eager]);

  function init(cv: HTMLCanvasElement) {
    const gl = cv.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return;
    let disposed = false;
    let raf = 0;

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uT = gl.getUniformLocation(prog, "t");
    gl.uniform1f(gl.getUniformLocation(prog, "s"), strength);
    gl.uniform1i(gl.getUniformLocation(prog, "c"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "d"), 1);

    const tex = (unit: number, source: TexImageSource) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      return t;
    };

    // Muelle críticamente amortiguado (Apple: damping 1.0, response ~0.4 s).
    const k = 70, c = 2 * Math.sqrt(k);
    const pos: [number, number] = [0, 0], vel: [number, number] = [0, 0];
    let last = 0;
    const state = { target: [0, 0] as [number, number], kick: () => {} };

    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      gl.viewport(0, 0, cv.width, cv.height);
    };

    const draw = () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uT, pos[0], pos[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const step = (now: number) => {
      const dt = Math.min(0.032, (now - (last || now)) / 1000);
      last = now;
      let moving = false;
      for (const i of [0, 1] as const) {
        const a = -k * (pos[i] - state.target[i]) - c * vel[i];
        vel[i] += a * dt;
        pos[i] += vel[i] * dt;
        if (Math.abs(pos[i] - state.target[i]) > 1e-4 || Math.abs(vel[i]) > 1e-3) moving = true;
      }
      draw();
      raf = moving ? requestAnimationFrame(step) : 0;
      if (!moving) last = 0;
    };
    state.kick = () => { if (!raf) raf = requestAnimationFrame(step); };
    api.current = state;

    const colorImg = new Image();
    const depthImg = new Image();
    colorImg.decoding = depthImg.decoding = "async";
    colorImg.src = img.current?.currentSrc || avif;
    depthImg.src = depth;
    Promise.all([colorImg.decode(), depthImg.decode()]).then(() => {
      if (disposed) return;
      tex(0, colorImg);
      tex(1, depthImg);
      resize();
      draw();
      cv.dataset.ready = "1";
    }).catch(() => {});

    const ro = new ResizeObserver(() => { resize(); draw(); });
    ro.observe(cv);

    // Arrastre horizontal = inclinación 1:1; el scroll vertical sigue siendo nativo (touch-action: pan-y).
    let dragging = false, x0 = 0, y0 = 0;
    const down = (e: PointerEvent) => { dragging = true; x0 = e.clientX; y0 = e.clientY; };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const r = cv.getBoundingClientRect();
      state.target = [Math.max(-1, Math.min(1, ((e.clientX - x0) / r.width) * 2.2)), Math.max(-1, Math.min(1, ((e.clientY - y0) / r.height) * 1.2))];
      state.kick();
    };
    const up = () => { if (!dragging) return; dragging = false; state.target = [0, 0]; state.kick(); };
    const host = cv.parentElement!;
    if (interactive) {
      host.addEventListener("pointerdown", down);
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      api.current = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }

  return (
    <div className={cn("depth-photo relative", className)} style={{ aspectRatio: `${width} / ${height}` }}>
      <picture>
        <source srcSet={avif} type="image/avif" />
        {webp && <source srcSet={webp} type="image/webp" />}
        <img
          ref={img}
          src={webp ?? avif}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          decoding={priority ? "sync" : "async"}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className="block h-full w-full object-contain"
          draggable={false}
        />
      </picture>
      <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300 data-[ready='1']:opacity-100" />
    </div>
  );
});
