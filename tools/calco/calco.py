#!/usr/bin/env python3
"""
Calco — de foto real a 3D, 100 % local (sin API ni GPU).

  python calco.py cutout  foto.jpg  -o out/        # quita el fondo (IS-Net)
  python calco.py depth   foto.jpg  -o out/        # mapa de profundidad (Depth Anything V2)
  python calco.py relief  foto.jpg  -o out/        # GLB 2.5D con la textura real de la foto
  python calco.py profile foto.jpg  -o out/        # perfil de revolución (pan, vaso, cubeta) → JSON para Forja
  python calco.py all     foto.jpg  -o out/        # todo lo anterior + paleta y miniaturas AVIF/WebP

Modelos (ONNX, licencias permisivas) en $CALCO_MODELS (por defecto tools/calco/models/, ver fetch-models.sh):
  isnet-general-use.onnx        — github.com/danielgatis/rembg (IS-Net, Apache-2.0)
  depth_anything_v2_vits.onnx   — github.com/fabio-sim/Depth-Anything-ONNX (Depth Anything V2 Small, Apache-2.0)
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
import trimesh
from PIL import Image

MODELS = Path(os.environ.get("CALCO_MODELS", Path(__file__).resolve().parent / "models"))
_sessions: dict[str, ort.InferenceSession] = {}


def session(name: str) -> ort.InferenceSession:
    if name not in _sessions:
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = os.cpu_count() or 4
        _sessions[name] = ort.InferenceSession(str(MODELS / name), opts, providers=["CPUExecutionProvider"])
    return _sessions[name]


def load_rgb(path: str | Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


# ---------------------------------------------------------------- recorte
def cutout(rgb: np.ndarray) -> np.ndarray:
    """Máscara alfa [0,1] del objeto principal con IS-Net (1024², normalización de rembg)."""
    h, w = rgb.shape[:2]
    x = cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_LANCZOS4).astype(np.float32) / 255.0
    x = (x - 0.5) / 1.0
    x = x.transpose(2, 0, 1)[None]
    out = session("isnet-general-use.onnx").run(None, {"input_image": x})[0][0, 0]
    out = (out - out.min()) / (out.max() - out.min() + 1e-8)
    alpha = cv2.resize(out, (w, h), interpolation=cv2.INTER_LINEAR)
    return np.clip(alpha, 0, 1)


def refine_alpha(alpha: np.ndarray) -> np.ndarray:
    """Limpia ruido y deja un borde suave de ~1 px (sin halo)."""
    m = (alpha > 0.5).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 1:  # quedarse con la mayor región (el producto)
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        m = (labels == keep).astype(np.uint8)
    soft = cv2.GaussianBlur(alpha * m, (3, 3), 0)
    return np.clip(soft, 0, 1)


# ---------------------------------------------------------------- profundidad
def depth(rgb: np.ndarray) -> np.ndarray:
    """Profundidad relativa [0,1] (1 = más cerca) con Depth Anything V2 Small."""
    h, w = rgb.shape[:2]
    x = cv2.resize(rgb, (518, 518), interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255.0
    x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    d = session("depth_anything_v2_vits.onnx").run(None, {"l_x_": x})[0][0]
    d = cv2.resize(d, (w, h), interpolation=cv2.INTER_CUBIC)
    d = (d - d.min()) / (d.max() - d.min() + 1e-8)
    return d


# ---------------------------------------------------------------- relieve 2.5D
def relief_mesh(rgb: np.ndarray, alpha: np.ndarray, dep: np.ndarray, res: int = 256, thickness: float = 0.35) -> trimesh.Trimesh:
    """
    Malla de relieve: rejilla res×res desplazada por la profundidad, recortada por la máscara,
    con la foto real proyectada de frente como textura. La cara trasera es el espejo
    aplanado (lo bastante para giros de ±35° sin ver el truco).
    """
    h, w = rgb.shape[:2]
    ys, xs = np.where(alpha > 0.5)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    crop = slice(y0, y1 + 1), slice(x0, x1 + 1)
    rgb_c, a_c, d_c = rgb[crop], alpha[crop], dep[crop]
    ch, cw = a_c.shape
    aspect = cw / ch
    gw, gh = (res, max(2, int(res / aspect))) if aspect >= 1 else (max(2, int(res * aspect)), res)

    a_s = cv2.resize(a_c, (gw, gh), interpolation=cv2.INTER_AREA)
    d_s = cv2.resize(d_c, (gw, gh), interpolation=cv2.INTER_AREA)
    inside = a_s > 0.5
    # Normaliza la profundidad solo dentro del objeto y suaviza un poco (menos "escalones").
    dv = d_s[inside]
    d_s = np.clip((d_s - dv.min()) / (dv.max() - dv.min() + 1e-8), 0, 1)
    d_s = cv2.bilateralFilter(d_s.astype(np.float32), 5, 0.1, 3)
    # Erosiona hacia el borde para que el contorno se curve hacia atrás (silueta redondeada).
    dist = cv2.distanceTransform(inside.astype(np.uint8), cv2.DIST_L2, 5)
    edge = np.clip(dist / (0.06 * max(gw, gh)), 0, 1)
    z = (0.35 + 0.65 * d_s) * np.sqrt(edge) * thickness

    sx, sy = (1.0, 1.0 / aspect) if aspect >= 1 else (aspect, 1.0)
    idx = -np.ones((gh, gw), np.int64)
    verts, uvs = [], []
    for j in range(gh):
        for i in range(gw):
            if inside[j, i]:
                idx[j, i] = len(verts)
                u, v = i / (gw - 1), j / (gh - 1)
                verts.append(((u - 0.5) * 2 * sx, (0.5 - v) * 2 * sy, z[j, i]))
                uvs.append((u, 1 - v))
    faces = []
    for j in range(gh - 1):
        for i in range(gw - 1):
            a, b, c, d = idx[j, i], idx[j, i + 1], idx[j + 1, i], idx[j + 1, i + 1]
            if min(a, b, c, d) >= 0:
                faces += [(a, c, b), (b, c, d)]
    verts = np.array(verts, np.float32)
    uvs = np.array(uvs, np.float32)
    faces = np.array(faces, np.int64)
    # Cara trasera: espejo con 40 % del relieve, normales invertidas, misma textura.
    back = verts.copy()
    back[:, 2] = -verts[:, 2] * 0.4
    n = len(verts)
    all_v = np.vstack([verts, back])
    all_f = np.vstack([faces, faces[:, ::-1] + n])
    all_uv = np.vstack([uvs, uvs])

    tex = Image.fromarray(np.dstack([rgb_c, (a_c * 255).astype(np.uint8)]), "RGBA")
    material = trimesh.visual.material.PBRMaterial(baseColorTexture=tex, roughnessFactor=0.6, metallicFactor=0.0, alphaMode="MASK", alphaCutoff=0.5)
    mesh = trimesh.Trimesh(all_v, all_f, visual=trimesh.visual.TextureVisuals(uv=all_uv, material=material), process=False)
    return mesh


# ---------------------------------------------------------------- perfil de revolución
def profile(alpha: np.ndarray, samples: int = 48) -> dict:
    """
    Para objetos con simetría de revolución (panes, vasos, cubetas): por cada fila,
    medio ancho de la silueta → puntos (radio, altura) normalizados, listos para
    THREE.LatheGeometry / Forja. Altura 1 = alto real del objeto en la foto.
    """
    m = alpha > 0.5
    rows = np.where(m.any(axis=1))[0]
    y0, y1 = rows.min(), rows.max()
    H = y1 - y0
    pts = []
    for k in range(samples + 1):
        y = int(y1 - k * H / samples)
        xs = np.where(m[y])[0]
        if len(xs) == 0:
            continue
        pts.append([round((xs.max() - xs.min()) / 2 / H, 4), round(k / samples, 4)])
    return {"points": pts, "aspect": round(float(m.any(axis=0).sum() / H), 4), "note": "radio y altura normalizados por el alto del objeto"}


# ---------------------------------------------------------------- paleta y bandas
def palette(rgb: np.ndarray, alpha: np.ndarray, k: int = 6) -> list[str]:
    px = rgb[alpha > 0.5].reshape(-1, 3).astype(np.float32)
    if len(px) > 60000:
        px = px[np.random.default_rng(0).choice(len(px), 60000, replace=False)]
    _, labels, centers = cv2.kmeans(px, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.ravel(), minlength=k)
    order = np.argsort(-counts)
    return ["#%02x%02x%02x" % tuple(int(c) for c in centers[i]) for i in order]


def layer_bands(rgb: np.ndarray, alpha: np.ndarray, max_layers: int = 10) -> list[dict]:
    """Capas horizontales (hamburguesa vista de lado): cambios fuertes de color por fila → alturas y colores reales."""
    m = alpha > 0.5
    rows = np.where(m.any(axis=1))[0]
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    means = np.array([lab[y][m[y]].mean(axis=0) if m[y].any() else np.zeros(3) for y in rows])
    means = cv2.GaussianBlur(means.reshape(-1, 1, 3), (1, 9), 0).reshape(-1, 3)
    diff = np.linalg.norm(np.diff(means, axis=0), axis=1)
    cuts = sorted(np.argsort(-diff)[: max_layers - 1].tolist())
    edges = [0] + [c + 1 for c in cuts] + [len(rows)]
    H = rows[-1] - rows[0]
    bands = []
    for a, b in zip(edges[:-1], edges[1:]):
        if b - a < 2:
            continue
        seg = means[a:b].mean(axis=0).astype(np.uint8).reshape(1, 1, 3)
        r, g, bl = cv2.cvtColor(seg, cv2.COLOR_LAB2RGB)[0, 0]
        bands.append({"from": round(1 - b / len(rows), 4), "to": round(1 - a / len(rows), 4), "color": "#%02x%02x%02x" % (r, g, bl), "height_px": int((b - a) * H / len(rows))})
    return bands[::-1]


# ---------------------------------------------------------------- salida
def save_images(rgb: np.ndarray, alpha: np.ndarray, out: Path, stem: str) -> None:
    rgba = Image.fromarray(np.dstack([rgb, (alpha * 255).astype(np.uint8)]), "RGBA")
    bbox = rgba.getbbox()
    rgba = rgba.crop(bbox)
    rgba.save(out / f"{stem}-cutout.png")
    for size in (480, 960):
        r = rgba.copy()
        r.thumbnail((size, size), Image.LANCZOS)
        r.save(out / f"{stem}-{size}.webp", quality=82, method=6)
        try:
            r.save(out / f"{stem}-{size}.avif", quality=60)
        except Exception:
            pass  # Pillow sin AVIF: queda el WebP


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["cutout", "depth", "relief", "profile", "all"])
    ap.add_argument("image")
    ap.add_argument("-o", "--out", default="calco-out")
    ap.add_argument("--res", type=int, default=256, help="resolución de la rejilla del relieve")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stem = Path(args.image).stem
    rgb = load_rgb(args.image)
    alpha = refine_alpha(cutout(rgb))
    report: dict = {"source": str(args.image), "size": list(rgb.shape[:2][::-1])}

    if args.cmd in ("cutout", "all"):
        save_images(rgb, alpha, out, stem)
    dep = None
    if args.cmd in ("depth", "relief", "all"):
        dep = depth(rgb)
        Image.fromarray((dep * 255).astype(np.uint8)).save(out / f"{stem}-depth.png")
    if args.cmd in ("relief", "all"):
        mesh = relief_mesh(rgb, alpha, dep, res=args.res)
        mesh.export(out / f"{stem}-relief.glb")
        report["relief"] = {"vertices": int(len(mesh.vertices)), "faces": int(len(mesh.faces))}
    if args.cmd in ("profile", "all"):
        report["profile"] = profile(alpha)
        report["palette"] = palette(rgb, alpha)
        report["layers"] = layer_bands(rgb, alpha)
    (out / f"{stem}.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps({k: v for k, v in report.items() if k != "profile"}, ensure_ascii=False)[:800])


if __name__ == "__main__":
    main()
