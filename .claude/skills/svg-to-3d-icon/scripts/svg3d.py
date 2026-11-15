#!/usr/bin/env python3
"""Turn a flat SVG icon/logo into a studio-lit 3D icon, rendered with Blender Cycles.

Run it with any Python 3.8+: it finds Blender and re-launches itself inside it.

Usage:
  python3 scripts/svg3d.py ICON.svg [options]

Examples:
  python3 scripts/svg3d.py logo.svg --preview            # fast look-dev pass, 768px
  python3 scripts/svg3d.py logo.svg                      # final 2048px views + sheet + GLB + .blend
  python3 scripts/svg3d.py logo.svg --preset matte --depth 0.24 --relief 0.07
  python3 scripts/svg3d.py logo.svg --colors "#C6E800,#1A1A1A" --views hero --size 4096
  python3 scripts/svg3d.py glyph.svg --add-plate "#FFFFFF"
  python3 scripts/svg3d.py logo.svg --turntable 96 --bg "#0A0A0F"

Output (default dir: <svg dir>/<svg name>-3d/):
  <name>_<view>.png       transparent PNG with a soft contact shadow
  <name>_sheet.png        every view on a light and a dark background, for review
  <name>_<view>_bg.png    only with --bg: the view composited on that color
  <name>.glb, <name>.blend  geometry + materials (skipped with --preview)
  <name>_turntable.mp4    only with --turntable (needs ffmpeg)

A JSON summary goes to stdout, progress to stderr, Blender's own log to <out>/blender.log.
Exit codes: 0 ok, 2 bad input or arguments, 3 Blender not found, 4 Blender/render failure.
"""
import argparse
import glob
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

try:
    import bpy  # noqa: F401  (only importable inside Blender)
    IN_BLENDER = True
except ImportError:
    IN_BLENDER = False

# Camera/icon poses. tilt = lean back from upright, yaw = turn around the vertical axis,
# elev = camera elevation, azim = camera azimuth (0 = straight in front). Degrees.
# ev = exposure trim so the main face lands on the true fill colour (a flat icon faces the top light).
VIEWS = {
    "hero":  dict(upright=True,  tilt=10, yaw=-26, elev=9,      azim=0,  lens=85,  ortho=False, gap=0.30, ev=0.0),
    "front": dict(upright=True,  tilt=0,  yaw=0,   elev=12,     azim=0,  lens=100, ortho=False, gap=0.30, ev=0.0),
    "iso":   dict(upright=False, tilt=0,  yaw=0,   elev=35.264, azim=45, lens=0,   ortho=True,  gap=0.14, ev=-1.0),
}

# Material looks. "plate" = the big back shape, "layer" = everything stacked on it.
# spec = Principled "Specular IOR Level": low keeps the broad sheen from washing out the fill colour,
# while the sharp coat still draws crisp highlights along bevels.
PRESETS = {
    "glossy": dict(plate=dict(rough=0.40, spec=0.25, coat=0.8, coat_rough=0.04, metal=0.0),
                   layer=dict(rough=0.30, spec=0.40, coat=1.0, coat_rough=0.03, metal=0.0)),
    "matte":  dict(plate=dict(rough=0.62, spec=0.30, coat=0.0, coat_rough=0.30, metal=0.0),
                   layer=dict(rough=0.55, spec=0.30, coat=0.0, coat_rough=0.30, metal=0.0)),
    "chrome": dict(plate=dict(rough=0.40, spec=0.25, coat=0.8, coat_rough=0.04, metal=0.0),
                   layer=dict(rough=0.10, spec=0.50, coat=0.0, coat_rough=0.00, metal=1.0)),
}

SHEET_BACKGROUNDS = ("#EDEDEF", "#0E0E11")


# ----------------------------------------------------------------------------- shared helpers

def hex_to_srgb(value):
    h = value.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        raise ValueError(f'expected a hex color like "#C6E800", got "{value}"')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c):
    c = max(0.0, c)
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def srgb_to_hex(rgb):
    return "#%02X%02X%02X" % tuple(round(max(0.0, min(1.0, v)) * 255) for v in rgb)


def build_parser():
    p = argparse.ArgumentParser(
        prog="svg3d.py",
        description="Turn a flat SVG icon/logo into a studio-lit 3D icon (Blender + Cycles).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=("Sizes (--depth, --relief, --bevel, --layer-bevel) are fractions of the icon width.\n"
                "Exit codes: 0 ok, 2 bad input/arguments, 3 Blender not found, 4 Blender/render failure."))
    p.add_argument("svg", help="input .svg (filled shapes; strokes and text must be outlined)")
    p.add_argument("-o", "--out", help="output directory (default: <svg dir>/<svg name>-3d)")
    p.add_argument("--views", default="hero,front,iso",
                   help="comma list of: " + ", ".join(VIEWS) + " (default: all)")
    p.add_argument("--preset", choices=sorted(PRESETS), default="glossy", help="material look (default: glossy)")
    p.add_argument("--depth", type=float, default=0.18, help="plate thickness (default 0.18)")
    p.add_argument("--relief", type=float, default=0.06, help="height of shapes raised on the plate (default 0.06)")
    p.add_argument("--bevel", type=float, default=0.035, help="plate edge radius (default 0.035)")
    p.add_argument("--layer-bevel", type=float, default=0.012,
                   help="edge radius of raised shapes; lower it for thin lines (default 0.012)")
    p.add_argument("--colors", help='override fills in SVG order, e.g. "#C6E800,#111111" ("-" keeps one)')
    p.add_argument("--add-plate", metavar="HEX", help="put the art on a generated rounded-square plate of this color")
    p.add_argument("--no-plate", action="store_true", help="never treat the first big shape as a plate")
    p.add_argument("--no-shadow", action="store_true", help="no contact shadow; tighter framing")
    p.add_argument("--bg", metavar="HEX", help="also write <view>_bg.png composites (and the turntable) on this color")
    p.add_argument("--size", type=int, help="square render size in px (default 2048, preview 768)")
    p.add_argument("--samples", type=int, help="Cycles samples (default 256, preview 48)")
    p.add_argument("--exposure", type=float, default=0.0, help="exposure in stops (default 0)")
    p.add_argument("--preview", action="store_true", help="fast low-res pass; skips GLB/.blend/turntable")
    p.add_argument("--turntable", type=int, default=0, metavar="FRAMES",
                   help="also render a looping wobble of N frames at 30 fps (e.g. 96)")
    p.add_argument("--no-export", action="store_true", help="skip GLB and .blend")
    p.add_argument("--cpu", action="store_true", help="force CPU rendering")
    p.add_argument("--blender", help="path to the Blender executable (default: $BLENDER, PATH, standard installs)")
    p.add_argument("--_result", help=argparse.SUPPRESS)
    p.add_argument("--_out", help=argparse.SUPPRESS)
    return p


# ----------------------------------------------------------------------------- outer process

def fail(code, message, **extra):
    print(json.dumps({"ok": False, "error": message, **extra}, indent=2))
    sys.exit(code)


def find_blender(explicit):
    candidates = [explicit, os.environ.get("BLENDER"), shutil.which("blender"),
                  "/Applications/Blender.app/Contents/MacOS/Blender",
                  os.path.expanduser("~/Applications/Blender.app/Contents/MacOS/Blender")]
    candidates += sorted(glob.glob("/Applications/Blender*.app/Contents/MacOS/Blender"), reverse=True)
    candidates += ["/usr/bin/blender", "/usr/local/bin/blender", "/snap/bin/blender"]
    candidates += sorted(glob.glob(r"C:\Program Files\Blender Foundation\Blender*\blender.exe"), reverse=True)
    for c in candidates:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return None


def lint_svg(path):
    """Flag SVG features the Blender importer silently drops."""
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        fail(2, f"Could not parse SVG: {e}")
    tags, stroked, faded = set(), False, False
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        tags.add(tag)
        style = dict(kv.split(":", 1) for kv in el.get("style", "").split(";") if ":" in kv)
        style = {k.strip(): v.strip() for k, v in style.items()}
        stroke = el.get("stroke") or style.get("stroke")
        if stroke and stroke != "none":
            stroked = True
        for attr in ("opacity", "fill-opacity"):
            val = el.get(attr) or style.get(attr)
            try:
                faded = faded or (val is not None and float(val) < 1)
            except ValueError:
                pass
    warnings = []
    if tags & {"text", "tspan", "textPath"}:
        warnings.append("SVG has <text>: text is not imported. Convert text to outlines first.")
    if stroked:
        warnings.append("SVG has strokes: strokes are dropped. Outline them (Figma: Outline stroke) to keep them.")
    if tags & {"linearGradient", "radialGradient", "pattern"}:
        warnings.append("SVG uses gradients/patterns: shapes get a flat color. Pass --colors to pick it.")
    if tags & {"clipPath", "mask"}:
        warnings.append("SVG uses clip-path/mask: ignored by the importer. Flatten the art first.")
    if "image" in tags:
        warnings.append("SVG embeds a raster <image>: it is ignored.")
    if faded:
        warnings.append("SVG uses opacity < 1: ignored, shapes render fully opaque.")
    return warnings


def encode_turntable(frames_dir, mp4_path, bg_hex, fps=30):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None, "ffmpeg not found: turntable frames kept as PNGs in " + frames_dir
    r, g, b = (round(v * 255) for v in hex_to_srgb(bg_hex))
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-framerate", str(fps),
           "-i", os.path.join(frames_dir, "frame_%04d.png"),
           "-f", "lavfi", "-i", f"color=c=0x{r:02X}{g:02X}{b:02X}:s=16x16:r={fps}",
           "-filter_complex", ("[1][0]scale2ref[bg][fg];[bg][fg]overlay=shortest=1:format=auto,"
                               "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,"
                               "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709"),
           # tag BT.709 explicitly, otherwise players guess the matrix and greens drift
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-r", str(fps), "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", mp4_path]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        return None, "ffmpeg failed: " + proc.stderr.strip()[-400:]
    return mp4_path, None


def outer_main():
    args = build_parser().parse_args()
    svg = os.path.abspath(args.svg)
    if not os.path.isfile(svg):
        fail(2, f"SVG not found: {svg}")
    for name in args.views.split(","):
        if name.strip() not in VIEWS:
            fail(2, f'Unknown view "{name}". Choose from: {", ".join(VIEWS)}')
    for flag in ("colors", "add_plate", "bg"):
        for value in (getattr(args, flag) or "").split(","):
            if value.strip() and value.strip() != "-":
                try:
                    hex_to_srgb(value)
                except ValueError as e:
                    fail(2, f"--{flag.replace('_', '-')}: {e}")
    warnings = lint_svg(svg)
    stem = os.path.splitext(os.path.basename(svg))[0]
    out = os.path.abspath(args.out or os.path.join(os.path.dirname(svg), f"{stem}-3d"))
    os.makedirs(out, exist_ok=True)
    blender = find_blender(args.blender)
    if not blender:
        fail(3, "Blender not found. Install Blender 4.2+ or pass --blender /path/to/blender (or set $BLENDER).")

    result_path = os.path.join(out, ".svg3d-result.json")
    if os.path.exists(result_path):
        os.remove(result_path)
    cmd = [blender, "-b", "--factory-startup", "--python-exit-code", "4",
           "--python", os.path.abspath(__file__), "--",
           *sys.argv[1:], "--_result", result_path, "--_out", out]
    started = time.time()
    log_path = os.path.join(out, "blender.log")
    with open(log_path, "w") as log:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in proc.stdout:
            log.write(line)
            if line.startswith("[svg3d]"):
                sys.stderr.write(line)
                sys.stderr.flush()
        code = proc.wait()

    result = {}
    if os.path.exists(result_path):
        with open(result_path) as f:
            result = json.load(f)
        os.remove(result_path)
    if code != 0 or not result.get("ok"):
        with open(log_path) as f:
            tail = f.read().strip().splitlines()[-25:]
        fail(2 if result.get("input_error") else 4,
             result.get("error", f"Blender exited with code {code}"), log=log_path, log_tail=tail)

    frames = result.pop("turntable_frames", None)
    if frames:
        mp4, problem = encode_turntable(frames, os.path.join(out, f"{stem}_turntable.mp4"),
                                        args.bg or SHEET_BACKGROUNDS[1])
        if mp4:
            result["files"]["turntable"] = mp4
            shutil.rmtree(frames, ignore_errors=True)  # our own intermediate frames
        else:
            result.setdefault("warnings", []).append(problem)
    result["warnings"] = warnings + result.get("warnings", [])
    result["seconds_total"] = round(time.time() - started, 1)
    result["log"] = log_path
    print(json.dumps(result, indent=2))


# ----------------------------------------------------------------------------- inside Blender

def blender_main():
    import addon_utils
    import bmesh
    import numpy as np
    from mathutils import Euler, Matrix, Vector

    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    a = build_parser().parse_args(argv)
    out = a._out
    stem = os.path.splitext(os.path.basename(a.svg))[0]
    size = a.size or (768 if a.preview else 2048)
    samples = a.samples or (48 if a.preview else 256)
    views = [v.strip() for v in a.views.split(",") if v.strip()]
    result = {"ok": False, "input": os.path.abspath(a.svg), "out_dir": out, "files": {}, "warnings": []}
    W = 2.0  # icon width in scene units after normalisation

    def log(msg):
        print(f"[svg3d] {msg}", flush=True)

    def finish(code, **extra):
        result.update(extra)
        with open(a._result, "w") as f:
            json.dump(result, f, indent=2)
        sys.exit(code)

    scene = bpy.context.scene
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for mod in ("io_curve_svg", "io_scene_gltf2"):
        try:
            addon_utils.enable(mod, default_set=True)
        except Exception as e:  # noqa: BLE001
            result["warnings"].append(f"could not enable {mod}: {e}")

    # --- import: every filled SVG shape becomes a 2D curve, in document order
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=os.path.abspath(a.svg))

    def doc_order(ob):
        m = re.search(r"\.(\d+)$", ob.name)
        return int(m.group(1)) if m else 0

    curves = sorted((o for o in bpy.data.objects if o not in before and o.type == "CURVE"), key=doc_order)
    shapes = [o for o in curves if o.data.dimensions == "2D"]
    dropped = len(curves) - len(shapes)
    for ob in curves:
        if ob not in shapes:
            bpy.data.objects.remove(ob, do_unlink=True)
    if dropped:
        result["warnings"].append(f"{dropped} unfilled path(s) skipped (fill=none / stroke-only).")
    if not shapes:
        finish(2, input_error=True, error="No filled shapes in the SVG. Outline strokes/text and give shapes a fill.")

    def colour_of(ob):
        mats = ob.data.materials
        return tuple(mats[0].diffuse_color[:3]) if len(mats) and mats[0] else (0.0, 0.0, 0.0)

    colours = [colour_of(o) for o in shapes]  # linear RGB
    if a.colors:
        for i, value in enumerate(a.colors.split(",")):
            if i < len(colours) and value.strip() not in ("", "-"):
                colours[i] = tuple(srgb_to_linear(c) for c in hex_to_srgb(value))
        if len(a.colors.split(",")) > len(colours):
            result["warnings"].append(f"--colors has more entries than the SVG's {len(colours)} filled shapes.")

    def reset_radius(ob):
        # Curve.transform() scales point radius with the matrix, which would scale the bevel too.
        for sp in ob.data.splines:
            for p in (sp.bezier_points if sp.type == "BEZIER" else sp.points):
                p.radius = 1.0

    def bbox2d(ob):
        xs = [v[0] for v in ob.bound_box]
        ys = [v[1] for v in ob.bound_box]
        return min(xs), min(ys), max(xs), max(ys)

    def normalise(objs):
        """Centre the art on the origin and scale it so the widest side is W."""
        bpy.context.view_layer.update()
        boxes = [bbox2d(o) for o in objs]
        x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        s = W / max(x1 - x0, y1 - y0, 1e-9)
        m = Matrix.Diagonal((s, s, s, 1.0)) @ Matrix.Translation((-(x0 + x1) / 2, -(y0 + y1) / 2, 0.0))
        for o in objs:
            o.data.transform(m)
            reset_radius(o)
        bpy.context.view_layer.update()

    for ob in shapes:
        ob.data.transform(ob.matrix_world)
        ob.matrix_world = Matrix.Identity(4)
    normalise(shapes)

    def area(ob):
        x0, y0, x1, y1 = bbox2d(ob)
        return (x1 - x0) * (y1 - y0)

    def union_area():
        boxes = [bbox2d(o) for o in shapes]
        return ((max(b[2] for b in boxes) - min(b[0] for b in boxes))
                * (max(b[3] for b in boxes) - min(b[1] for b in boxes)))

    plate = None
    if a.add_plate:
        side, radius = W * 1.36, W * 1.36 * 0.2237
        cu = bpy.data.curves.new("Plate", "CURVE")
        cu.dimensions, cu.fill_mode = "2D", "BOTH"
        sp = cu.splines.new("BEZIER")
        h, r, k = side / 2, radius, radius * 0.5523
        pts = [((h, h - r), (0, -k), (0, k)), ((h - r, h), (k, 0), (-k, 0)),
               ((-h + r, h), (k, 0), (-k, 0)), ((-h, h - r), (0, k), (0, -k)),
               ((-h, -h + r), (0, k), (0, -k)), ((-h + r, -h), (-k, 0), (k, 0)),
               ((h - r, -h), (-k, 0), (k, 0)), ((h, -h + r), (0, -k), (0, k))]
        sp.bezier_points.add(len(pts) - 1)
        for bp, (co, hl, hr) in zip(sp.bezier_points, pts):
            bp.handle_left_type = bp.handle_right_type = "FREE"
            bp.co = (co[0], co[1], 0.0)
            bp.handle_left = (co[0] + hl[0], co[1] + hl[1], 0.0)
            bp.handle_right = (co[0] + hr[0], co[1] + hr[1], 0.0)
        sp.use_cyclic_u = True
        plate = bpy.data.objects.new("Plate", cu)
        scene.collection.objects.link(plate)
        shapes.insert(0, plate)
        colours.insert(0, tuple(srgb_to_linear(c) for c in hex_to_srgb(a.add_plate)))
        normalise(shapes)
    elif not a.no_plate and len(shapes) > 1 and area(shapes[0]) >= 0.7 * union_area():
        plate = shapes[0]
    layers = [o for o in shapes if o is not plate]

    # --- solidify: extrude the filled curve, weld it into a mesh, round the edges with a Bevel modifier.
    # (The curve's own bevel has to be offset inwards to keep the SVG silhouette, and that offset folds
    # over itself at acute corners; the Bevel modifier clamps there instead.)
    def solidify(ob, thickness, bevel, z_centre):
        cu = ob.data
        cu.dimensions, cu.fill_mode = "2D", "BOTH"
        cu.extrude, cu.bevel_depth, cu.offset = thickness / 2, 0.0, 0.0
        cu.resolution_u = 32
        for sp in cu.splines:
            sp.resolution_u = 32
        bpy.context.view_layer.update()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)  # caps and walls come out unconnected
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.5), verts=bm.verts, edges=bm.edges)
        bm.to_mesh(me)
        bm.free()
        for poly in me.polygons:
            poly.use_smooth = True
        solid = bpy.data.objects.new(ob.name, me)
        scene.collection.objects.link(solid)
        solid.location.z = z_centre
        b = max(0.0, min(bevel, thickness * 0.49))
        if b > 0:
            mod = solid.modifiers.new("Bevel", "BEVEL")
            mod.width, mod.segments, mod.profile = b, 10, 0.5
            mod.limit_method, mod.angle_limit = "ANGLE", math.radians(30)
            mod.use_clamp_overlap, mod.harden_normals, mod.miter_outer = True, True, "MITER_ARC"
        bpy.data.objects.remove(ob, do_unlink=True)
        return solid

    T = a.depth * W
    h = a.relief * W
    step = 0.0 if len(layers) < 2 else min(0.35 * h, 0.6 * h / (len(layers) - 1))  # stops overlaps z-fighting
    solids = {}
    if plate:
        solids[plate] = solidify(plate, T, a.bevel * W, -T / 2)
        embed = min(0.3 * h + 0.01, 0.5 * T)
        for i, ob in enumerate(layers):
            top = h + i * step
            solids[ob] = solidify(ob, top + embed, a.layer_bevel * W, (top - embed) / 2)
    else:
        for i, ob in enumerate(layers):
            solids[ob] = solidify(ob, T, a.bevel * W, -T / 2 + i * step)
    shapes = [solids[o] for o in shapes]
    layers = [solids[o] for o in layers]
    plate = solids[plate] if plate else None

    # --- materials
    def principled(name, rgb, look, metallic_base=False):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        base = rgb
        if metallic_base and look["metal"] > 0:
            lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
            base = (0.045, 0.045, 0.05) if lum < 0.02 else rgb  # black -> black chrome
        values = {"Base Color": (*[max(c, 0.004) for c in base], 1.0), "Metallic": look["metal"],
                  "Roughness": look["rough"], "Specular IOR Level": look["spec"],
                  "Coat Weight": look["coat"], "Coat Roughness": look["coat_rough"]}
        for key, val in values.items():
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = val
        m.diffuse_color = (*base, 1.0)
        return m

    preset = PRESETS[a.preset]
    total_area = union_area()
    info = []
    for ob, rgb in zip(shapes, colours):
        role = "plate" if ob is plate else "layer"
        ob.data.materials.clear()
        ob.data.materials.append(principled(f"{role}_{srgb_to_hex([linear_to_srgb(c) for c in rgb])}",
                                            rgb, preset[role], metallic_base=(role == "layer")))
        ob.name = "Plate" if ob is plate else "Layer"
        info.append({"object": ob.name, "role": role, "color": srgb_to_hex([linear_to_srgb(c) for c in rgb]),
                     "area_share": round(area(ob) / total_area, 3)})
    result["shapes"] = info

    root = bpy.data.objects.new("Icon", None)
    scene.collection.objects.link(root)
    for ob in shapes:
        ob.parent = root

    # --- studio: gradient world, softbox rig that follows the camera azimuth, shadow catcher
    world = bpy.data.worlds.new("Studio")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    coord, sep = nt.nodes.new("ShaderNodeTexCoord"), nt.nodes.new("ShaderNodeSeparateXYZ")
    remap, ramp = nt.nodes.new("ShaderNodeMapRange"), nt.nodes.new("ShaderNodeValToRGB")
    bg, wout = nt.nodes.new("ShaderNodeBackground"), nt.nodes.new("ShaderNodeOutputWorld")
    remap.inputs["From Min"].default_value, remap.inputs["From Max"].default_value = -1.0, 1.0
    ramp.color_ramp.elements[0].color = (0.012, 0.012, 0.014, 1)
    ramp.color_ramp.elements[1].color = (0.20, 0.20, 0.21, 1)  # brighter sky greys out glossy blacks
    mid = ramp.color_ramp.elements.new(0.5)
    mid.color = (0.045, 0.045, 0.05, 1)
    nt.links.new(coord.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], remap.inputs["Value"])
    nt.links.new(remap.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], wout.inputs["Surface"])

    rig = bpy.data.objects.new("LightRig", None)
    scene.collection.objects.link(rig)

    def softbox(name, loc, power, size, size_y=None, shape="RECTANGLE", shadow=True):
        light = bpy.data.lights.new(name, "AREA")
        light.shape, light.size, light.size_y, light.energy = shape, size, size_y or size, power
        if hasattr(light, "use_shadow"):
            light.use_shadow = shadow
        if hasattr(light, "cycles") and hasattr(light.cycles, "cast_shadow"):
            light.cycles.cast_shadow = shadow
        ob = bpy.data.objects.new(name, light)
        scene.collection.objects.link(ob)
        ob.parent = rig
        ob.location = loc
        ob.rotation_euler = (-Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        ob.visible_camera = False
        return ob

    # Rig space: camera sits on -Y looking at +Y. Powers are calibrated so a surface facing the
    # camera gets irradiance ~1, i.e. the SVG fill colour renders at its true value.
    # Only Key and Top cast shadows; a low fill/rim would smear long streaks across the floor.
    softbox("Key", (-3.0, -3.2, 5.2), 360, 3.0)
    softbox("Fill", (5.0, -2.2, 0.6), 80, 5.0, shadow=False)
    softbox("Rim", (2.8, 4.2, 2.4), 630, 6.0, 0.8, shadow=False)
    softbox("Top", (0.0, 0.3, 6.0), 270, 4.0, shape="DISK")

    ground = None
    if not a.no_shadow:
        me = bpy.data.meshes.new("Ground")
        me.from_pydata([(-40, -40, 0), (40, -40, 0), (40, 40, 0), (-40, 40, 0)], [], [(0, 1, 2, 3)])
        ground = bpy.data.objects.new("Ground", me)
        scene.collection.objects.link(ground)
        ground.is_shadow_catcher = True
        ground.visible_glossy = False  # a lit floor mirrored in every face greys out blacks and fills
        gm = bpy.data.materials.new("Ground")
        gm.use_nodes = True
        gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
        gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
        me.materials.append(gm)

    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.clip_start, cam.data.clip_end = 0.05, 500

    # --- render settings
    scene.render.engine = "CYCLES"
    device = "CPU"
    if not a.cpu:
        try:
            cprefs = bpy.context.preferences.addons["cycles"].preferences
            for backend in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
                try:
                    cprefs.compute_device_type = backend
                except TypeError:
                    continue
                cprefs.refresh_devices() if hasattr(cprefs, "refresh_devices") else cprefs.get_devices()
                gpus = [d for d in cprefs.devices if d.type != "CPU"]
                if gpus:
                    for d in cprefs.devices:
                        d.use = d.type != "CPU"
                    scene.cycles.device = "GPU"
                    device = f"GPU ({backend}: {', '.join(sorted({d.name for d in gpus}))})"
                    break
        except Exception as e:  # noqa: BLE001
            result["warnings"].append(f"GPU setup failed, using CPU: {e}")
    cyc = scene.cycles
    cyc.samples = samples
    cyc.use_adaptive_sampling = True
    cyc.use_denoising = True
    cyc.caustics_reflective = cyc.caustics_refractive = False
    cyc.max_bounces, cyc.glossy_bounces = 8, 6
    scene.render.film_transparent = True
    scene.render.use_persistent_data = True
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.view_settings.view_transform = "Standard"  # keeps brand colours honest (AgX/Filmic desaturate)
    scene.view_settings.look = "None"
    scene.view_settings.exposure = a.exposure
    result["render"] = {"engine": "Cycles", "device": device, "samples": samples, "size": size, "preset": a.preset}

    # --- views
    def icon_points():
        dg = bpy.context.evaluated_depsgraph_get()
        chunks = []
        for ob in shapes:
            ev = ob.evaluated_get(dg)
            me = ev.to_mesh()
            n = len(me.vertices)
            if n:
                co = np.empty(n * 3, dtype=np.float32)
                me.vertices.foreach_get("co", co)
                mw = np.array(ev.matrix_world, dtype=np.float64)
                chunks.append(co.reshape(n, 3).astype(np.float64) @ mw[:3, :3].T + mw[:3, 3])
            ev.to_mesh_clear()
        return np.concatenate(chunks)

    def pose(v, yaw_offset=0.0, tilt_offset=0.0, lift=0.0):
        """Rotate the icon for a view and centre it on the origin. Returns its world points."""
        rx = math.radians(90 - v["tilt"] - tilt_offset) if v["upright"] else 0.0
        root.rotation_euler = Euler((rx, 0.0, math.radians(v["yaw"] + yaw_offset)), "XYZ")
        root.location = (0, 0, 0)
        bpy.context.view_layer.update()
        pts = icon_points()
        centre = (pts.min(axis=0) + pts.max(axis=0)) / 2
        root.location = Vector((-centre).tolist()) + Vector((0, 0, lift))
        bpy.context.view_layer.update()
        return pts - centre + np.array([0, 0, lift])

    def frame(v, pts, ground_z, margin):
        el, az = math.radians(v["elev"]), math.radians(v["azim"])
        to_cam = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
        rig.rotation_euler = (0, 0, az)
        cam.data.type = "ORTHO" if v["ortho"] else "PERSP"
        if not v["ortho"]:
            cam.data.lens = v["lens"]
        cam.location = to_cam * 30
        cam.rotation_euler = (-to_cam).to_track_quat("-Z", "Y").to_euler()
        fit = pts
        if ground is not None:
            ground.location = (0, 0, ground_z)
            shadow = pts.copy()
            shadow[:, 2] = ground_z
            fit = np.concatenate([pts, shadow])
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        co, scale = cam.camera_fit_coords(dg, fit.ravel().tolist())
        forward = -to_cam
        if v["ortho"]:
            cam.data.ortho_scale = scale * margin
            cam.location = Vector(co) - forward * 30
        else:
            centre = Vector(((fit.min(axis=0) + fit.max(axis=0)) / 2).tolist())
            dist = (centre - Vector(co)).dot(forward)
            cam.location = Vector(co) - forward * dist * (margin - 1)
        bpy.context.view_layer.update()

    def setup_view(name):
        v = VIEWS[name]
        pts = pose(v)
        frame(v, pts, pts[:, 2].min() - v["gap"], 1.12 if a.no_shadow else 1.16)
        scene.view_settings.exposure = a.exposure + v["ev"]

    def render_to(path):
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)

    t_all = time.time()
    for name in views:
        t0 = time.time()
        setup_view(name)
        path = os.path.join(out, f"{stem}_{name}.png")
        render_to(path)
        result["files"][name] = path
        log(f"{name}: {time.time() - t0:.1f}s -> {path}")

    # --- composites: review sheet (+ optional flat-background versions)
    def read_rgba(path):
        img = bpy.data.images.load(path, check_existing=False)
        w, hh = img.size
        px = np.empty(w * hh * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        return px.reshape(hh, w, 4)

    def write_rgba(path, px, scale_to=None):
        hh, w, _ = px.shape
        img = bpy.data.images.new("svg3d_tmp", w, hh, alpha=True)
        img.pixels.foreach_set(np.ascontiguousarray(px, dtype=np.float32).ravel())
        if scale_to:
            img.scale(scale_to, scale_to)
        img.filepath_raw, img.file_format = path, "PNG"
        img.save()
        bpy.data.images.remove(img)

    def over(px, hex_colour):
        out_px = np.empty_like(px)
        alpha = px[..., 3:4]
        out_px[..., :3] = px[..., :3] * alpha + np.array(hex_to_srgb(hex_colour), dtype=np.float32) * (1 - alpha)
        out_px[..., 3] = 1.0
        return out_px

    cell = min(size, 1024)
    rows = []
    for colour in SHEET_BACKGROUNDS:
        row = []
        for name in views:
            composite = over(read_rgba(result["files"][name]), colour)
            tmp = os.path.join(out, f".cell_{name}.png")
            write_rgba(tmp, composite, scale_to=cell if cell != size else None)
            row.append(read_rgba(tmp))
            os.remove(tmp)
        rows.append(np.concatenate(row, axis=1))
    sheet_path = os.path.join(out, f"{stem}_sheet.png")
    write_rgba(sheet_path, np.concatenate(rows[::-1], axis=0))  # pixel rows run bottom-up: light row on top
    result["files"]["sheet"] = sheet_path
    if a.bg:
        for name in views:
            path = os.path.join(out, f"{stem}_{name}_bg.png")
            write_rgba(path, over(read_rgba(result["files"][name]), a.bg))
            result["files"][f"{name}_bg"] = path

    # --- colour check: does the main face render at the SVG fill colour? Catches over/under-exposure,
    # which silently shifts saturated brand colours (an overexposed lime clips to plain yellow).
    luma = np.array([0.2126, 0.7152, 0.0722])
    main = 0 if plate else max(range(len(shapes)), key=lambda i: area(shapes[i]))
    target_lum = float(np.array(colours[main]) @ luma)
    palette = np.array([[linear_to_srgb(c) * 255 for c in col] for col in colours])

    def colour_check(path, label):
        if target_lum <= 0.03:  # a near-black main shape has no meaningful brightness ratio
            return None
        px = read_rgba(path)[::4, ::4]
        srgb = px[..., :3] * 255
        nearest = np.linalg.norm(srgb[..., None, :] - palette, axis=-1).argmin(axis=-1)
        mask = (px[..., 3] > 0.98) & (nearest == main)
        if mask.sum() <= 200:
            return None
        med = np.median(srgb[mask], axis=0)
        ratio = float(np.array([srgb_to_linear(c / 255) for c in med]) @ luma) / target_lum
        clipped = float((srgb[mask] >= 254).any(axis=-1).mean())
        if not 0.8 <= ratio <= 1.25 or clipped > 0.2:
            stops = math.log2(max(ratio, 0.05))
            if clipped > 0.5:
                stops = max(stops, 1.0)  # clipping hides how far over it really is
            result["warnings"].append(
                f"{label}: main face renders at {ratio:.2f}x the fill brightness ({clipped:.0%} clipped), "
                f"brand colour is off. Try --exposure {a.exposure - stops:+.1f}.")
        return {"view": label, "target": srgb_to_hex(palette[main] / 255), "rendered_median": srgb_to_hex(med / 255),
                "brightness_ratio": round(ratio, 2), "clipped_share": round(clipped, 2)}

    check_view = "front" if "front" in views else views[0]
    check = colour_check(result["files"][check_view], check_view)
    if check:
        result["color_check"] = check

    # --- exports
    if not (a.preview or a.no_export):
        pose(dict(VIEWS["front"], tilt=0))  # upright, facing the viewer: +Y up / +Z out in glTF
        dg = bpy.context.evaluated_depsgraph_get()
        export_col = bpy.data.collections.new("Export")
        scene.collection.children.link(export_col)
        for ob in bpy.data.objects:
            ob.select_set(False)
        meshes, names = [], {ob: ob.name for ob in shapes}
        for ob in shapes:
            ob.name += "_src"  # free the clean names for the exported copies
        for ob in shapes:
            me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
            me.name = names[ob]
            if not len(me.materials):
                me.materials.append(ob.data.materials[0])
            mo = bpy.data.objects.new(names[ob], me)
            mo.matrix_world = ob.matrix_world.copy()
            export_col.objects.link(mo)
            mo.select_set(True)
            meshes.append(mo)
        glb = os.path.join(out, f"{stem}.glb")
        bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True)
        result["files"]["glb"] = glb
        for mo in meshes:
            me = mo.data
            bpy.data.objects.remove(mo, do_unlink=True)
            bpy.data.meshes.remove(me)
        bpy.data.collections.remove(export_col)
        for ob in shapes:
            ob.name = names[ob]

    if a.turntable and not a.preview:
        frames_dir = os.path.join(out, "turntable_frames")
        os.makedirs(frames_dir, exist_ok=True)
        for f in glob.glob(os.path.join(frames_dir, "frame_*.png")):
            os.remove(f)
        v, n, amp, bob = dict(VIEWS["hero"], yaw=0.0), a.turntable, 32.0, 0.06
        swing = np.concatenate([pose(v, yaw_offset=y) for y in (-amp, -amp / 2, 0, amp / 2, amp)])
        ground_z = swing[:, 2].min() - v["gap"] - bob
        scene.render.resolution_x = scene.render.resolution_y = min(size, 1080)
        cyc.samples = max(32, samples // 4)
        frame(v, swing + np.array([0, 0, bob]), ground_z, 1.12)  # camera fixed for the whole loop
        scene.view_settings.exposure = a.exposure + v["ev"]  # don't inherit the last still's trim (iso: -1 EV)
        t0 = time.time()
        for i in range(n):
            phase = 2 * math.pi * i / n
            pose(v, yaw_offset=amp * math.sin(phase), tilt_offset=3 * math.cos(phase), lift=bob * math.sin(2 * phase))
            render_to(os.path.join(frames_dir, f"frame_{i + 1:04d}.png"))
            if (i + 1) % 12 == 0 or i + 1 == n:
                log(f"turntable: {i + 1}/{n} frames ({time.time() - t0:.0f}s)")
        result["turntable_frames"] = frames_dir
        check = colour_check(os.path.join(frames_dir, "frame_0001.png"), "turntable")
        if check:
            result["turntable_color_check"] = check
        scene.render.resolution_x = scene.render.resolution_y = size
        cyc.samples = samples

    if not (a.preview or a.no_export):
        setup_view(views[0] if views else "hero")
        blend = os.path.join(out, f"{stem}.blend")
        bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
        result["files"]["blend"] = blend

    result["seconds_blender"] = round(time.time() - t_all, 1)
    result["ok"] = True
    finish(0)


if __name__ == "__main__":
    if IN_BLENDER:
        blender_main()
    else:
        outer_main()
