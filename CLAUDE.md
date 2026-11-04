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
además del registro base de shadcn/ui y el MCP `21st` (21st.dev). Adapta el componente al design
system; no lo pegues tal cual.

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

### 4. Revisión obligatoria antes de entregar
- `review-animations` sobre todo lo animado y `animation-performance` si hay algo pesado.
- `mobile-native` para el acabado en móvil; `break-ui` con datos extremos.
- `npm run build` sin errores y captura en escritorio (1280px) y móvil (390px).

### Requisitos de calidad que siempre aplican
- Respeta `prefers-reduced-motion`: reduce o desactiva movimiento y 3D en ese caso.
- Anima solo `transform`, `opacity` (y `filter` con moderación); nada de animaciones en acciones de teclado.
- Three.js siempre con `React.lazy()` / import dinámico: nunca en el bundle inicial. Libera recursos al desmontar.
- Rendimiento móvil: `dpr` limitado, render pausado fuera de pantalla, el 3D nunca tapa la legibilidad del texto.
