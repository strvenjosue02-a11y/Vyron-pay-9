# Fotos → modelos 3D (Tripo3D)

```bash
python tools/tripo/prepare.py tools/calco/fotos tools/tripo/input   # recortes limpios
export TRIPO_API_KEY=tsk_...                                        # secreto del entorno, nunca en git
python tools/tripo/tripo_batch.py tools/tripo/input tools/tripo/out  # genera y descarga los GLB
./tools/tripo/optimize.sh                                            # → public/models/*.glb + manifest.json
npm run build:estudio                                                # visor en dist-estudio/estudio.html
```
Red necesaria: `openapi.tripo3d.ai` y el CDN de `*.tripo3d.ai` / `*.tripo3d.com`. Detalle e investigación: `.claude/memory/research/imagen-a-3d.md`.
