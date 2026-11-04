#!/usr/bin/env python3
"""
Tripo3D (API v3) por lotes: foto recortada → modelo 3D GLB con texturas PBR.
Endpoints tomados del SDK oficial (github.com/VAST-AI-Research/tripo-python-sdk, MIT):
  POST /v3/files                        (multipart "file")        → data.file_token
  POST /v3/generation/image-to-model    {input, model, ...}       → data.task_id
  GET  /v3/tasks/{task_id}                                          → data.status / progress / output.model_url

  export TRIPO_API_KEY=tsk_...          # nunca en el repo
  python tools/tripo/tripo_batch.py tools/tripo/input tools/tripo/out [--only nombre] [--model v3.1-20260211]

Reanudable: guarda task_id en out/<nombre>.json y no repite lo ya descargado.
Necesita acceso de red a openapi.tripo3d.ai y al CDN de descarga que devuelva model_url.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

BASE = os.environ.get("TRIPO_BASE_URL", "https://openapi.tripo3d.ai")


def ctx():
    c = ssl.create_default_context()
    bundle = "/root/.ccr/ca-bundle.crt"  # proxy de esta sesión cloud, si existe
    if os.path.exists(bundle):
        c.load_verify_locations(bundle)
    return c


def call(method: str, path: str, key: str, body: bytes | None = None, ctype: str | None = None) -> dict:
    req = urllib.request.Request(BASE + path, data=body, method=method, headers={"Authorization": f"Bearer {key}"})
    if ctype:
        req.add_header("Content-Type", ctype)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, context=ctx(), timeout=120) as r:
                payload = json.loads(r.read().decode())
            if payload.get("code") not in (None, 0):
                raise RuntimeError(f"Tripo {path}: {payload}")
            return payload.get("data", payload)
        except urllib.error.HTTPError as e:
            text = e.read().decode(errors="replace")[:400]
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(int(e.headers.get("retry-after") or 2 ** attempt * 2))
                continue
            raise RuntimeError(f"HTTP {e.code} en {path}: {text}") from None
    raise RuntimeError("sin respuesta")


def upload(path: Path, key: str) -> str:
    boundary = uuid.uuid4().hex
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{path.name}\"\r\n"
            f"Content-Type: {mime}\r\n\r\n").encode() + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    data = call("POST", "/v3/files", key, body, f"multipart/form-data; boundary={boundary}")
    return data["file_token"]


def download(url: str, dst: Path) -> None:
    with urllib.request.urlopen(urllib.request.Request(url), context=ctx(), timeout=300) as r, open(dst, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("dst", type=Path)
    ap.add_argument("--only")
    ap.add_argument("--model", default="v3.1-20260211")
    ap.add_argument("--face-limit", type=int, default=60000)
    ap.add_argument("--balance", action="store_true", help="solo mostrar el saldo")
    a = ap.parse_args()
    key = os.environ.get("TRIPO_API_KEY")
    if not key:
        sys.exit("Falta TRIPO_API_KEY en el entorno.")
    if a.balance:
        print(call("GET", "/v3/account/balance", key))
        return
    a.dst.mkdir(parents=True, exist_ok=True)
    images = sorted(p for p in a.src.glob("*.png") if not a.only or p.stem == a.only)

    # 1) Lanzar todas las tareas (corren en paralelo en los servidores de Tripo).
    jobs = {}
    for img in images:
        meta_p = a.dst / f"{img.stem}.json"
        meta = json.loads(meta_p.read_text()) if meta_p.exists() else {}
        if (a.dst / f"{img.stem}.glb").exists():
            print(f"= {img.stem}: ya descargado")
            continue
        if not meta.get("task_id"):
            token = upload(img, key)
            payload = {
                "input": token,
                "model": a.model,
                "texture": True,
                "pbr": True,
                "texture_quality": "detailed",
                "geometry_quality": "detailed",
                "texture_alignment": "original_image",
                "face_limit": a.face_limit,
                "auto_size": True,
                "enable_image_autofix": True,
            }
            meta = {"task_id": call("POST", "/v3/generation/image-to-model", key, json.dumps(payload).encode(), "application/json")["task_id"],
                    "model": a.model, "source": img.name}
            meta_p.write_text(json.dumps(meta, indent=1))
            print(f"+ {img.stem}: tarea {meta['task_id']}")
        jobs[img.stem] = meta

    # 2) Esperar y descargar.
    while jobs:
        for name, meta in list(jobs.items()):
            t = call("GET", f"/v3/tasks/{meta['task_id']}", key)
            status = str(t.get("status", "unknown")).lower()
            print(f"  {name}: {status} {t.get('progress', '')}")
            if status == "success":
                out = t.get("output") or {}
                url = out.get("model_url") or out.get("pbr_model_url") or out.get("pbr_model") or out.get("model")
                download(url, a.dst / f"{name}.glb")
                for k in ("rendered_image_url", "rendered_image"):
                    if out.get(k):
                        download(out[k], a.dst / f"{name}-render.webp")
                        break
                meta.update(status="success", output=out)
                (a.dst / f"{name}.json").write_text(json.dumps(meta, indent=1))
                print(f"✓ {name}.glb")
                jobs.pop(name)
            elif status in ("failed", "cancelled", "banned", "expired", "unknown"):
                meta.update(status=status, error=t)
                (a.dst / f"{name}.json").write_text(json.dumps(meta, indent=1))
                print(f"✗ {name}: {status}")
                jobs.pop(name)
        if jobs:
            time.sleep(8)


if __name__ == "__main__":
    main()
