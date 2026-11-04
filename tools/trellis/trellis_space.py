#!/usr/bin/env python3
"""
TRELLIS.2 (Microsoft, MIT) a través del Space oficial de Hugging Face — sin GPU local.

  python tools/trellis/trellis_space.py tools/tripo/input tools/trellis/out [--only nombre] [--res 1024]

Con HF_TOKEN en el entorno usa tu cuota de ZeroGPU; sin él, la cuota anónima (pequeña).
Flujo del Space: start_session → preprocess_image → image_to_3d → extract_glb.
"""
import argparse
import os
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client, handle_file


def generate(client: Client, img: Path, out: Path, res: str, tex: int, faces: int) -> Path:
    client.predict(api_name="/start_session")
    pre = client.predict(handle_file(str(img)), api_name="/preprocess_image")
    client.predict(handle_file(pre if isinstance(pre, str) else pre["path"]), 0, res, api_name="/image_to_3d")
    glb, _ = client.predict(faces, tex, api_name="/extract_glb")
    path = glb if isinstance(glb, str) else glb.get("path") or glb.get("value")
    dst = out / f"{img.stem}.glb"
    shutil.copy(path, dst)
    return dst


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("dst", type=Path)
    ap.add_argument("--only")
    ap.add_argument("--res", default="1024", choices=["512", "1024", "1536"])
    ap.add_argument("--texture", type=int, default=2048)
    ap.add_argument("--faces", type=int, default=200000)
    a = ap.parse_args()
    a.dst.mkdir(parents=True, exist_ok=True)
    token = os.environ.get("HF_TOKEN")
    client = Client("microsoft/TRELLIS.2", hf_token=token) if token else Client("microsoft/TRELLIS.2")
    for img in sorted(a.src.glob("*.png")):
        if a.only and img.stem != a.only:
            continue
        if (a.dst / f"{img.stem}.glb").exists():
            print(f"= {img.stem}: ya existe")
            continue
        t = time.time()
        try:
            p = generate(client, img, a.dst, a.res, a.texture, a.faces)
            print(f"✓ {img.stem}: {p.stat().st_size / 1e6:.1f} MB en {time.time() - t:.0f} s", flush=True)
        except Exception as e:  # cuota agotada, cola, error del Space
            print(f"✗ {img.stem}: {str(e)[:300]}", flush=True)
            if "quota" in str(e).lower() or "GPU" in str(e):
                sys.exit(2)


if __name__ == "__main__":
    main()
