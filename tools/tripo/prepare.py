#!/usr/bin/env python3
"""
Prepara cada foto para generar su modelo 3D: recorte limpio (Calco/IS-Net), sin platos ni
restos finos (popotes cortados, migas sueltas), centrado en un lienzo cuadrado transparente.
Los generadores imagen→3D rinden mejor con un único objeto centrado y sin fondo.

  python tools/tripo/prepare.py tools/calco/fotos tools/tripo/input
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "calco"))
import calco  # noqa: E402

# Reglas por foto: qué quitar además del fondo.
RULES = {
    "burger-bacon": {"remove_plate": True},
    "batido-oreo": {"open_px": 31},
    "batido-chocolate": {"open_px": 7},
    "batido-fresa": {"open_px": 7},
}


def remove_plate(rgb, alpha):
    """Platos/servilletas: píxeles casi blancos y poco saturados en la mitad inferior."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32) / 255
    h = alpha.shape[0]
    plate = (hsv[..., 1] < 0.16) & (hsv[..., 2] > 0.55)
    plate[: int(h * 0.45)] = False
    plate = cv2.morphologyEx(plate.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
    return alpha * (~plate)


def drop_thin_parts(alpha, px):
    """Abre la máscara para cortar apéndices finos y se queda con el cuerpo principal."""
    m = (alpha > 0.5).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (px, px))
    opened = cv2.morphologyEx(m, cv2.MORPH_OPEN, k)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(opened, 8)
    if n <= 1:
        return alpha
    body = (lab == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    keep = cv2.dilate(body, np.ones((5, 5), np.uint8))
    return alpha * keep


def largest(alpha):
    m = (alpha > 0.5).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n <= 1:
        return alpha
    keep = (lab == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA])))
    return alpha * cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8))


def square(rgba, size=1024, pad=0.08):
    ys, xs = np.where(rgba[..., 3] > 10)
    crop = rgba[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    im = Image.fromarray(crop, "RGBA")
    s = int(size * (1 - 2 * pad))
    im.thumbnail((s, s), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas


def main(src: Path, dst: Path):
    dst.mkdir(parents=True, exist_ok=True)
    for f in sorted(src.glob("*.jpg")):
        rule = RULES.get(f.stem, {})
        rgb = calco.load_rgb(f)
        a = calco.refine_alpha(calco.cutout(rgb))
        if rule.get("remove_plate"):
            a = remove_plate(rgb, a)
        if rule.get("open_px"):
            a = drop_thin_parts(a, rule["open_px"])
        a = largest(a)
        a = cv2.GaussianBlur(a.astype(np.float32), (3, 3), 0)
        rgba = np.dstack([rgb, (np.clip(a, 0, 1) * 255).astype(np.uint8)])
        square(rgba).save(dst / f"{f.stem}.png")
        print("ok", f.stem)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
