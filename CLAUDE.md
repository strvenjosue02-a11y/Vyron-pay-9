# Vyron Pay 9 — reglas para Claude

## Regla obligatoria: stack de diseño y animación para toda web

Para **cualquier web, página, landing o componente** que se pida en este proyecto, usa siempre
este stack. El objetivo es calibre de estudio (Awwwards / Linear / Vercel), nunca plantilla genérica.

### 1. Diseño primero (antes de escribir código)
- **`ui-ux-pro-max`** — genera el design system (estilo, paleta, tipografía, guías UX) para el
  producto y respétalo en todo el código.
- **`frontend-design`** — elige una dirección estética clara y distintiva; evita el look "AI slop".
- **`emil-design-eng`** + **`apple-design`** — detalles de pulido: sombras, bordes, estados, tipografía.

### 2. Componentes (antes de escribirlos desde cero)
Busca primero en los registros configurados en `components.json` (MCP `shadcn` en `.mcp.json`):
`@magicui`, `@react-bits`, `@animate-ui`, `@aceternity`, `@motion-primitives`, `@cult-ui`,
además del registro base de shadcn/ui. Adapta el componente al design system; no lo pegues tal cual.
No se usan servicios que pidan API key salvo que sea imprescindible (21st.dev fue retirado).

### 3. Animación — qué herramienta para qué
| Necesidad | Herramienta | Skills de referencia |
|---|---|---|
| Micro-interacciones, entradas/salidas, layout, gestos (React) | **Motion** (`motion/react`) | `animate`, `motion-design` |
| Timelines complejos, texto (SplitText), scroll pinneado/scrub | **GSAP** + `@gsap/react` (`useGSAP`) | `gsap-*` |
| Scroll suave | **Lenis** (`SmoothScroll`, ya sincronizado con ScrollTrigger) | — |
| 3D, fondos interactivos, shaders | **Three.js** vía **React Three Fiber** + `drei` + `postprocessing` | `webgpu-threejs-tsl` |

- 3D: usa `src/components/three/scene-canvas.tsx` (WebGPURenderer → cae solo a **WebGL 2**).
- Tokens de curvas y duraciones: `src/lib/motion.ts` y `@theme` en `src/index.css`. No inventes curvas nuevas.
- Utilidades listas: `Reveal`, `SplitHeading`, `SmoothScroll` en `src/components/motion/`.

### 4. 3D realista (modelos, comida, muebles, edificios, humanos, animales)
- Lee primero `.claude/memory/KNOWLEDGE.md`, `LESSONS.md` y `.claude/memory/research/` y la skill `realistic-3d-web`.
- Sin descargas posibles → modelado procedural (ver `src/features/burger/` como referencia: Lathe,
  ruido fbm, texturas canvas, PBR con MeshPhysicalMaterial, iluminación RoomEnvironment local).
- Con modelos glTF → optimizar (gltf-transform: meshopt/draco + texturas KTX2/webp) y cargar diferido.
- Encaja la cámara al aspecto del dispositivo; nunca dejes el modelo cortado en móvil.

### 5. Equipo de agentes y memoria colectiva
- `3d-researcher` (`.claude/agents/`) aprende y escribe hallazgos verificados en `.claude/memory/`.
- `web-builder` traduce la memoria en skills, componentes y webs, y confirma o corrige lo aprendido.
- Todo agente (y tú) lee la memoria al empezar y la actualiza al terminar: errores → `LESSONS.md`,
  hechos probados → `KNOWLEDGE.md`, pedidos entre agentes → `HANDOFF.md`. Mejora lo existente en
  vez de duplicarlo.

### 6. Revisión obligatoria antes de entregar
- `review-animations` sobre todo lo animado y `animation-performance` si hay algo pesado.
- `mobile-native` para el acabado en móvil; `break-ui` con datos extremos.
- `npm run build` sin errores y captura en escritorio (1280px) y móvil (390px).

### Requisitos de calidad que siempre aplican
- Respeta `prefers-reduced-motion`: reduce o desactiva movimiento y 3D en ese caso.
- Anima solo `transform`, `opacity` (y `filter` con moderación); nada de animaciones en acciones de teclado.
- Three.js siempre con `React.lazy()` / import dinámico: nunca en el bundle inicial. Libera recursos al desmontar.
- Rendimiento móvil: `dpr` limitado, render pausado fuera de pantalla, el 3D nunca tapa la legibilidad del texto.
