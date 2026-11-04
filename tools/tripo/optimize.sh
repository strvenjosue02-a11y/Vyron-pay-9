#!/bin/bash
# GLB crudo de Tripo (10–40 MB) → GLB web: texturas WebP 1024 px, geometría meshopt, sin datos sobrantes.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p public/models
for f in tools/tripo/out/*.glb; do
  n=$(basename "$f" .glb)
  npx gltf-transform optimize "$f" "public/models/$n.glb" --texture-compress webp --texture-size 1024 --compress meshopt --simplify false
  echo "$n: $(du -h "$f" | cut -f1) → $(du -h "public/models/$n.glb" | cut -f1)"
done
node -e 'const fs=require("fs");const l=fs.readdirSync("public/models").filter(f=>f.endsWith(".glb")).map(f=>f.replace(".glb",""));fs.writeFileSync("public/models/manifest.json",JSON.stringify({models:l},null,1));console.log("manifest:",l.join(", "))'
