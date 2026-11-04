# Vyron Pay 9 — reglas para Claude

## Regla obligatoria: stack de diseño y animación para toda web

Para **cualquier web, página, landing o componente** que se pida en este proyecto, usa siempre:

1. **UI UX Pro Max** (`.claude/skills/ui-ux-pro-max`) — antes de diseñar, genera el design system
   (estilo, paleta, tipografía, guías UX) con su búsqueda local y respétalo en todo el código.
2. **Skills de Emil Kowalski** (`.claude/skills/`) — `emil-design-eng` y `animate` para decidir
   curvas, duraciones y qué animar; `review-animations` para revisar el resultado;
   `mobile-native` para el acabado en móvil.
3. **21st.dev** (MCP `21st` en `.mcp.json`) — busca componentes React/Tailwind existentes antes de
   escribirlos desde cero.
4. **Framer Motion** (`framer-motion`) — todas las animaciones de UI en React: entradas, salidas
   (`AnimatePresence`), layout, gestos y scroll.
5. **Three.js** (`three`) — escenas 3D / fondos interactivos / efectos visuales.
   - Renderiza con **WebGPU** (`WebGPURenderer` desde `three/webgpu`) cuando el navegador lo soporte.
   - Cae automáticamente a **WebGL 2** si no hay WebGPU.

### Requisitos de calidad que siempre aplican
- Respeta `prefers-reduced-motion`: reduce o desactiva movimiento y 3D en ese caso.
- Anima solo `transform` y `opacity` salvo motivo claro; nada de animaciones en acciones de teclado.
- Carga Three.js de forma diferida (dynamic import) para no bloquear el primer render, y libera
  geometrías, materiales y el renderer al desmontar.
- Comprueba rendimiento en móvil (limitar `devicePixelRatio`, pausar el render fuera de pantalla).
