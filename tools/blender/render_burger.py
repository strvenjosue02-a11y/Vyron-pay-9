"""
Render de producto: python render_burger.py <receta> <salida.png> [--samples N] [--size W H] [--explode 0..1]
"""
import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import studio as S  # noqa: E402
import food as F  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("recipe")
ap.add_argument("out")
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--size", type=int, nargs=2, default=(1080, 1080))
ap.add_argument("--explode", type=float, default=0.0)
ap.add_argument("--seed", type=int, default=0)
a = ap.parse_args()

S.reset(tuple(a.size), a.samples, transparent=True)
M = F.mats()
layers, top = F.build_burger(F.BURGERS[a.recipe], M, seed=a.seed)
gap = 0.55 * a.explode
for i, (g, z, _) in enumerate(layers):
    g.location.z = z + gap * i
total = top + gap * (len(layers) - 1)
S.shadow_catcher()
S.studio_lights()
aspect = a.size[0] / a.size[1]
half = math.tan(math.radians(36 / 2 / 1.4)) / 1  # 50 mm → ~39.6° FOV horizontal en 36 mm
dist = max(1.75 / (0.36 * min(aspect, 1)), (total / 2 + 0.5) / 0.36)
S.camera((0, -dist * math.cos(math.radians(14)), total / 2 + dist * math.sin(math.radians(14))), (0, 0, total / 2), lens=50)
S.render(a.out)
print("ok", a.out)
