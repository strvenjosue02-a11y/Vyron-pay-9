# Imagen → modelo 3D: herramientas evaluadas (2026-11-04, web-builder)

Objetivo: convertir fotos reales de comida (recortadas) en GLB con texturas PBR para la web.

| Herramienta | Tipo | Calidad para comida | Licencia / coste | Requisitos | Estado aquí |
|---|---|---|---|---|---|
| **Tripo3D API v3** | Servicio (API REST) | Alta: textura fiel a la foto (`texture_alignment: original_image`), PBR, `detailed` | De pago por créditos; clave `tsk_…` | Red a `openapi.tripo3d.ai` + CDN de descarga | **Elegida.** Cliente listo (`tools/tripo/tripo_batch.py`). Bloqueada por red: proxy → 403 |
| TRELLIS 2 (Microsoft) | Modelo abierto | Muy alta, PBR nativo hasta 4K | MIT | GPU ≥16 GB (no hay GPU aquí) o Space de Hugging Face | Bloqueado (huggingface.co) |
| Hunyuan3D-2 (Tencent) | Modelo abierto | Alta | Licencia propia con límites regionales | GPU o Space HF | Bloqueado |
| TripoSR / Stable Fast 3D / SPAR3D | Modelos abiertos ligeros | Media (geometría blanda, textura por vértice/baja) | MIT / Stability Community | Corre en CPU (lento) pero pesos solo en HF | Bloqueado (pesos en HF) |
| Meshy / Rodin | Servicios | Alta | De pago | Sus dominios | No evaluados |

Fuentes: SDK oficial `VAST-AI-Research/tripo-python-sdk` (MIT, leído en GitHub: endpoints `/v3/files`, `/v3/generation/image-to-model`, `/v3/tasks/{id}`, `model_url`; versiones `v3.1-20260211`, `v3.0-20250812`, `v2.5-20250123`, `P1-20260311`, `P2-20260801`; la API v2 se apagó el 2026-10-31). Comparativas 2026: cmarix.com, 3daistudio.com, app.cinevva.com (comerciales: tomar con cautela).

## Pipeline del repo
1. `tools/tripo/prepare.py` — recorte IS-Net + limpieza por foto (quita plato, popotes cortados), cuadrado 1024 transparente centrado → `tools/tripo/input/*.png`. **Probado.**
2. `tools/tripo/tripo_batch.py` — sube, crea tareas en paralelo, sondea, descarga GLB + render; reanudable. **Escrito contra el SDK; sin probar en vivo (red bloqueada).**
3. `tools/tripo/optimize.sh` — `gltf-transform optimize` (WebP 1024 + meshopt) → `public/models/*.glb` + `manifest.json`. **Probado** con Avocado (Khronos, CC0): 8.1 MB → 60 KB.
4. `estudio.html` (`npm run build:estudio`) — visor three.js (GLTFLoader + MeshoptDecoder, RoomEnvironment, NeutralToneMapping, modos textura/arcilla/malla, carga local de .glb). **Probado** en 390 y 1280 px.

## Pendiente para el usuario
- Permitir en la red del entorno: `openapi.tripo3d.ai`, `*.tripo3d.ai`, `*.tripo3d.com` (CDN de descarga de `model_url`).
- Guardar la clave como secreto `TRIPO_API_KEY` (no en el chat ni en el repo).
