#!/bin/bash
# Descarga los modelos ONNX de Calco desde releases de GitHub (sin API key).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p models
get() { [ -s "models/$1" ] || curl -fSL --retry 3 -o "models/$1" "$2"; }
get isnet-general-use.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx
get depth_anything_v2_vits.onnx https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits.onnx
echo "modelos listos en $(pwd)/models"
