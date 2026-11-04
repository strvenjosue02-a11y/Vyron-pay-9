#!/usr/bin/env python3
"""
Genera los recursos de la carta desde fotos reales:
  python tools/calco/menu_assets.py carpeta_de_fotos/ src/assets/food/
Por cada foto: recorte AVIF/WebP (960 y 480 px), mapa de profundidad alineado (384 px)
y manifest.json con el tamaño real para reservar espacio (CLS = 0).
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import calco  # noqa: E402

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
man = {}
for f in sorted([*src.glob("*.jpg"), *src.glob("*.jpeg"), *src.glob("*.png"), *src.glob("*.webp")]):
    name = f.stem
    rgb = calco.load_rgb(f)
    a = calco.refine_alpha(calco.cutout(rgb))
    d = calco.depth(rgb)
    ys, xs = np.where(a > 0.04)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([rgb, (a * 255).astype(np.uint8)])[y0:y1, x0:x1]
    m = a[y0:y1, x0:x1] > 0.5
    dep = d[y0:y1, x0:x1]
    dv = dep[m]
    dep = np.clip((dep - dv.min()) / (dv.max() - dv.min() + 1e-6), 0, 1) * m
    dep = cv2.GaussianBlur(cv2.dilate(dep.astype(np.float32), np.ones((9, 9), np.uint8)), (0, 0), 3)
    im = Image.fromarray(rgba, "RGBA")
    H, W = rgba.shape[:2]
    for tag, mx in (("lg", 960), ("sm", 480)):
        r = im.copy()
        r.thumbnail((mx, mx), Image.LANCZOS)
        r.save(dst / f"{name}-{tag}.avif", quality=58 if tag == "lg" else 55)
        r.save(dst / f"{name}-{tag}.webp", quality=80, method=6)
    di = Image.fromarray((dep * 255).astype(np.uint8), "L")
    di.thumbnail((384, 384), Image.LANCZOS)
    di.save(dst / f"{name}-depth.webp", quality=85)
    man[name] = {"w": int(W), "h": int(H)}
    print(name, W, H)
(dst / "manifest.json").write_text(json.dumps(man, indent=1))
