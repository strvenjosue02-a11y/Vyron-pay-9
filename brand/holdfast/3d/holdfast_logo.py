"""Logo 3D de Holdfast (dirección A, Equal Halves) en Blender 5.2, modo sin pantalla.

Uso:
  blender -b --factory-startup --python-exit-code 1 -P holdfast_logo.py -- --mode preview|hero|anim --out DIR

Las dos mitades salen del símbolo 2D (cuadrícula de 100 unidades -> 1 unidad = 1 cm):
  mitad izquierda: medio disco r=30, lado plano en x=44, centro y=56 (grafito)
  mitad derecha:   medio disco r=30, lado plano en x=56, centro y=44 (brasa)
"""
import bpy, bmesh, math, sys, os, argparse, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mode", default="preview", choices=["preview", "hero", "anim", "seq"])
ap.add_argument("--out", default="//out")
ap.add_argument("--res", type=int, default=0)
ap.add_argument("--samples", type=int, default=0)
args = ap.parse_args(argv)

U = 0.01          # 1 unidad del SVG = 1 cm
R = 30 * U        # radio
GAP = 6 * U       # medio hueco (lado plano a 6 u del centro)
DEPTH = 9 * U     # grosor
FPS, FRAMES = 30, 150

def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)

# ------------------------------------------------------------------ escena limpia
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"

# ------------------------------------------------------------------ geometría
def half_disc(name, flat_x, cz, side):
    """side=-1: la curva apunta a la izquierda; +1: a la derecha."""
    bm = bmesh.new()
    n = 96
    pts = []
    for i in range(n + 1):
        a = -math.pi / 2 + math.pi * i / n          # de abajo a arriba
        x = flat_x + side * R * math.cos(a)
        z = cz + R * math.sin(a)
        pts.append(bm.verts.new((x, DEPTH / 2, z)))
    face = bm.faces.new(pts if side > 0 else list(reversed(pts)))
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    verts = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=verts, vec=(0, -DEPTH, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    bev = ob.modifiers.new("Bevel", "BEVEL")
    bev.width = 1.6 * U; bev.segments = 8; bev.limit_method = "ANGLE"; bev.angle_limit = math.radians(30)
    bev.harden_normals = True; bev.profile = 0.6
    ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL").keep_sharp = True
    return ob

left = half_disc("Half_Graphite", -GAP, -6 * U, -1)
right = half_disc("Half_Ember", GAP, 6 * U, +1)

def mat(name, hexc, rough, coat=0.0, coat_rough=0.05, spec=0.5):
    m = bpy.data.materials.new(name)
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = srgb(hexc)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    return m

left.data.materials.append(mat("Ceramic_Graphite", "#18191D", 0.52, coat=0.15, coat_rough=0.35))
right.data.materials.append(mat("Enamel_Ember", "#C9411E", 0.42, coat=0.55, coat_rough=0.14, spec=0.35))

# pivote común para el balanceo del conjunto
rig = bpy.data.objects.new("Logo_Rig", None)
scene.collection.objects.link(rig)
left.parent = rig; right.parent = rig
rig.location = (0, 0, 0.42)

# ------------------------------------------------------------------ fondo infinito (cyclorama)
bm = bmesh.new()
W, Dp, H, rad = 8.0, 6.0, 5.0, 1.2
prof = [(-Dp, 0.0), (0.6, 0.0)] + [(0.6 + rad * math.sin(math.pi / 2 * i / 16), rad - rad * math.cos(math.pi / 2 * i / 16)) for i in range(1, 17)] + [(0.6 + rad, H)]
rows = []
for x in (-W / 2, W / 2):
    rows.append([bm.verts.new((x, y, z)) for (y, z) in prof])
for i in range(len(prof) - 1):
    bm.faces.new((rows[0][i], rows[1][i], rows[1][i + 1], rows[0][i + 1]))
me = bpy.data.meshes.new("Cyc"); bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
cyc = bpy.data.objects.new("Cyc", me); scene.collection.objects.link(cyc)
cyc.data.materials.append(mat("Porcelain", "#F1F2EF", 0.7, spec=0.3))
cyc.is_holdout = False

# ------------------------------------------------------------------ luces de estudio
def area(name, loc, size, energy, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, "AREA"); l.shape = "DISK"; l.size = size; l.energy = energy; l.color = color
    o = bpy.data.objects.new(name, l); o.location = loc; scene.collection.objects.link(o)
    d = Vector((0, 0, 0.42)) - Vector(loc); o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return o

area("Key", (-1.8, -1.8, 2.4), 1.6, 140)
area("Fill", (2.4, -1.4, 0.9), 2.5, 28, (0.96, 0.98, 1.0))
area("Rim", (0.6, 1.8, 1.6), 1.0, 160)
area("Top", (0.0, -0.3, 3.0), 3.0, 25)
world = bpy.data.worlds.new("W"); scene.world = world
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs["Color"].default_value = srgb("#F1F2EF"); bg.inputs["Strength"].default_value = 0.12

# ------------------------------------------------------------------ cámara
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 85; cam_d.dof.use_dof = True
cam_d.dof.aperture_fstop = 5.6
cam = bpy.data.objects.new("Cam", cam_d); scene.collection.objects.link(cam)
cam.location = (0.35, -3.1, 0.95)
cam.rotation_euler = (Vector((0, 0, 0.42)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam_d.dof.focus_object = rig
scene.camera = cam

# ------------------------------------------------------------------ animación (bucle perfecto de 5 s)
# 1-45 llegan desde los lados · 45-120 se sostienen con un balanceo suave · 120-150 se separan · 150 = 1
scene.render.fps = FPS; scene.frame_start = 1; scene.frame_end = FRAMES
def key(ob, f, x=None, rz=None, ry=None):
    if x is not None: ob.location.x = x; ob.keyframe_insert("location", index=0, frame=f)
    if rz is not None: ob.rotation_euler.z = rz; ob.keyframe_insert("rotation_euler", index=2, frame=f)
    if ry is not None: ob.rotation_euler.y = ry; ob.keyframe_insert("rotation_euler", index=1, frame=f)
OUT_X = 0.42 if args.mode == "seq" else 0.95
for ob, s in ((left, -1), (right, 1)):
    key(ob, 1, x=s * OUT_X, ry=s * math.radians(-28))
    key(ob, 46, x=0.0, ry=0.0)
    key(ob, 120, x=0.0, ry=0.0)
    key(ob, FRAMES, x=s * OUT_X, ry=s * math.radians(-28))
# balanceo del conjunto: gira apenas mientras se sostienen
key(rig, 1, rz=math.radians(-34)); key(rig, 46, rz=math.radians(-24)); key(rig, 83, rz=math.radians(-12))
key(rig, 120, rz=math.radians(-20)); key(rig, FRAMES, rz=math.radians(-34))

def fcurves(ob):
    ad = ob.animation_data
    if not ad or not ad.action: return []
    out = []
    try:
        for slot in ad.action.slots:
            for layer in ad.action.layers:
                for strip in layer.strips:
                    cb = strip.channelbag(slot)
                    if cb: out += list(cb.fcurves)
    except AttributeError:
        out = list(getattr(ad.action, "fcurves", []))
    return out
for ob in (left, right, rig):
    for fc in fcurves(ob):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"; kp.easing = "AUTO"
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"

# ------------------------------------------------------------------ render
r = scene.render
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.use_denoising = True
scene.cycles.use_adaptive_sampling = True
scene.render.use_persistent_data = True
scene.render.use_motion_blur = args.mode == "anim"
for vt, lk in (("AgX", "AgX - Medium High Contrast"), ("AgX", "None")):
    try:
        scene.view_settings.view_transform = vt; scene.view_settings.look = lk; break
    except TypeError:
        continue
r.resolution_percentage = 100
out = bpy.path.abspath(args.out)
os.makedirs(out, exist_ok=True)

if args.mode == "preview":
    r.resolution_x = r.resolution_y = args.res or 720
    scene.cycles.samples = args.samples or 48
    scene.frame_set(80)
    r.filepath = os.path.join(out, "preview.png"); bpy.ops.render.render(write_still=True)
elif args.mode == "hero":
    r.resolution_x = r.resolution_y = args.res or 2048
    scene.cycles.samples = args.samples or 256
    scene.frame_set(80)
    r.filepath = os.path.join(out, "holdfast-3d-hero.png"); bpy.ops.render.render(write_still=True)
    # versión transparente (sin fondo) para usar sobre cualquier color
    cyc.hide_render = True; r.film_transparent = True
    r.filepath = os.path.join(out, "holdfast-3d-transparente.png"); bpy.ops.render.render(write_still=True)
elif args.mode == "seq":
    # Secuencia transparente para la portada controlada por scroll: llegada + inicio del sostén (frames 1-70).
    r.resolution_x = r.resolution_y = args.res or 960
    scene.cycles.samples = args.samples or 24
    r.film_transparent = True
    cyc.hide_render = True
    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0, 0, 0))
    floor = bpy.context.active_object; floor.name = "ShadowFloor"; floor.is_shadow_catcher = True
    r.image_settings.file_format = "PNG"; r.image_settings.color_mode = "RGBA"
    scene.frame_start, scene.frame_end = int(os.environ.get("SEQ_START", 1)), 70
    scene.frame_step = int(os.environ.get("SEQ_STEP", 1))
    r.filepath = os.path.join(out, "seq", "s_####")
    bpy.ops.render.render(animation=True)
else:
    r.resolution_x = r.resolution_y = args.res or 1080
    scene.cycles.samples = args.samples or 64
    r.image_settings.file_format = "PNG"
    r.filepath = os.path.join(out, "frames", "f_####")
    bpy.ops.render.render(animation=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "holdfast-logo.blend"))
tris = sum(len(o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh().loop_triangles) for o in (left, right))
print("@@JSON@@" + json.dumps({"mode": args.mode, "out": out, "dims_left": list(left.dimensions), "dims_right": list(right.dimensions), "tris": tris}))
