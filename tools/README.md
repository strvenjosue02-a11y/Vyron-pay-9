# Herramientas locales (sin API keys)

| Herramienta | Qué hace | Cómo |
|---|---|---|
| `tools/calco/` | **Foto real → 3D.** Recorta el fondo (IS-Net), estima profundidad (Depth Anything V2), genera un GLB 2.5D con la textura real de la foto, extrae el perfil de revolución y las capas/colores reales (p. ej. alturas de cada capa de una hamburguesa vista de lado) y exporta recortes AVIF/WebP. ~5 s por foto en CPU. | `./tools/calco/fetch-models.sh` y luego `python tools/calco/calco.py all foto.jpg -o out/` |
| `tools/blender/` | **Blender 5.2 sin interfaz (bpy).** Modelado con modificadores reales (Subdivision, Displace, Bevel, Solidify), materiales Principled BSDF con subsurface, render Cycles + OpenImageDenoise con transformada AgX. Para fotos de producto con fondo transparente y secuencias de fotogramas para scroll. | `python tools/blender/render_burger.py clasica out.png --samples 64 --size 1080 1080 [--explode 0..1]` |

Entorno: `python3 -m venv ~/.venv-calco && ~/.venv-calco/bin/pip install -r tools/calco/requirements.txt`.
Los modelos `.onnx` no se versionan (se bajan con `fetch-models.sh`).
