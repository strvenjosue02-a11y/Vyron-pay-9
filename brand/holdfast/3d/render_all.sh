#!/bin/bash
# Render completo del logo 3D: imagen principal + video en bucle.
set -e
cd "$(dirname "$0")"
OUT="$PWD/render"
blender -b --factory-startup --python-exit-code 1 -P holdfast_logo.py -- --mode anim --res 720 --samples 32 --out "$OUT" > "$OUT/anim.log" 2>&1
ffmpeg -y -loglevel error -framerate 30 -i "$OUT/frames/f_%04d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -movflags +faststart "$OUT/holdfast-3d-loop.mp4"
ffmpeg -y -loglevel error -framerate 30 -i "$OUT/frames/f_%04d.png" -c:v libvpx-vp9 -b:v 0 -crf 34 -pix_fmt yuv420p "$OUT/holdfast-3d-loop.webm"
blender -b --factory-startup --python-exit-code 1 -P holdfast_logo.py -- --mode hero --res 2048 --samples 200 --out "$OUT" > "$OUT/hero.log" 2>&1
echo LISTO
