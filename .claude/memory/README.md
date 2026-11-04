# Memoria colectiva

Cerebro compartido de los agentes de este repo. **Todo agente lo lee antes de empezar y lo actualiza al terminar.**

| Archivo | Quién escribe | Qué contiene |
|---|---|---|
| `KNOWLEDGE.md` | `3d-researcher` (aprende), `web-builder` (confirma) | Hechos verificados: fuentes de assets, librerías, técnicas, versiones. |
| `LESSONS.md` | cualquiera | Errores ya cometidos y cómo evitarlos. Leer SIEMPRE antes de programar. |
| `HANDOFF.md` | ambos | Bandeja de mensajes entre agentes: pedidos abiertos, respuestas, estado. |
| `research/*.md` | `3d-researcher` | Notas largas por tema (iluminación, materiales, comida, anatomía…). |

## Reglas
1. **No duplicar**: si algo ya está, mejóralo en su sitio (más preciso, mejor rendimiento, fuente mejor) en vez de añadir otra entrada.
2. **Evidencia**: cada hecho lleva fuente (repo/commit, doc, o "probado en <archivo>").
3. **Fecha y autor** en cada entrada: `(2026-11-04, web-builder)`.
4. **Innovar**: si una técnica conocida tiene una alternativa más rápida o más realista, anótala como `MEJORA:` con la medición.
5. **Red**: en este entorno solo GitHub y npm son accesibles; anota si una fuente requiere otra red o API key.
