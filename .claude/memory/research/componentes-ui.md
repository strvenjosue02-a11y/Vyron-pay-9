# Componentes 3D/animados evaluados (2026-11-04, web-builder) — sin instalar

Fuentes: React Bits leído en GitHub (DavidHDev/react-bits, licencia **MIT + Commons Clause**: se puede usar en el producto, no revender los componentes). Aceternity UI y 21st.dev solo por buscador (sus dominios están bloqueados aquí; Aceternity no publica su código en GitHub).

| # | Componente | Librería | Dependencias | Uso en la carta | Veredicto |
|---|---|---|---|---|---|
| 1 | ModelViewer | React Bits | three, R3F, drei (486 l.) | Visor del GLB de cada producto en su hoja | Adaptar (quitar OBJLoader, cargar meshopt, lazy) |
| 2 | ScrollStack | React Bits | react (337 l.) | Combos que se apilan al hacer scroll | Integrar |
| 3 | DepthCarousel | React Bits | gsap (439 l.) | "Lo más pedido" con profundidad | Integrar |
| 4 | TearTicket | React Bits | motion (609 l.) | Comanda/ticket que se rasga al confirmar | Integrar |
| 5 | SplitFlapText | React Bits | react (410 l.) | Número de pedido / tablero "abierto" | Integrar |
| 6 | ScrollVelocity | React Bits | motion (322 l.) | Banda de texto que corre con el scroll | Integrar |
| 7 | Container Scroll Animation | Aceternity | motion | Hero de combo que rota en 3D al hacer scroll | Integrar (necesita acceso a ui.aceternity.com o 21st.dev) |
| 8 | Apple Cards Carousel | Aceternity | motion | Categorías que se expanden | Integrar |
| 9 | 3D Card Effect | Aceternity | motion | Elevar ingredientes al pasar el cursor | Solo escritorio: en Android no hay hover |
| 10 | Product Bounce Card | 21st.dev (Ruixen) | framer-motion | Tarjeta de producto con rebote 3D | Licencia sin confirmar |

Descartados por peso o encaje: FlyingButton (2136 líneas), MagicBento/CardSwap (traen @hugeicons).

## Generadores 3D clonados
- **TRELLIS.2** (microsoft, MIT): imagen→3D con PBR, muy alta calidad. Requiere Linux + NVIDIA ≥24 GB + CUDA 12.4 + pesos en Hugging Face. No corre aquí (sin GPU, HF bloqueado). Viable en GPU alquilada o en el Space oficial.
- **text-to-cad** (earthtojake, MIT): CAD paramétrico con build123d/OpenCascade (STEP/GLB/STL). Para piezas fabricables (cajas, vasos, bandejas), no para comida orgánica.
