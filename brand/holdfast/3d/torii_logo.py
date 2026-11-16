"""Logo 3D de Holdfast: arco torii (anime neón de lujo). Blender 5.2, sin pantalla.
Uso: blender -b --factory-startup --python-exit-code 1 -P torii_logo.py -- --out DIR
Guarda torii-logo.blend; el estilo anime se aplica después con blender-stylized-npr/toon_setup.py."""
import bpy, bmesh, math, sys, os, argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser(); ap.add_argument("--out", default="//out"); args = ap.parse_args(argv)

def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)

for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
scene = bpy.context.scene
col = scene.collection

def finish(ob, bevel=0.008):
    for p in ob.data.polygons: p.use_smooth = True
    b = ob.modifiers.new("Bevel", "BEVEL"); b.width = bevel; b.segments = 4
    b.limit_method = "ANGLE"; b.angle_limit = math.radians(30); b.harden_normals = True
    ob.modifiers.new("WN", "WEIGHTED_NORMAL").keep_sharp = True
    return ob

def box(name, cx, cz, sx, sz, sy, rot_y=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); col.objects.link(ob)
    ob.location = (cx, 0, cz); ob.rotation_euler.y = rot_y
    return finish(ob)

def pillar(name, x, lean):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=0.05, radius2=0.042, depth=0.88)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); col.objects.link(ob)
    ob.location = (x, 0, 0.44); ob.rotation_euler.y = lean
    return finish(ob, 0.006)

def kasagi(name, z0, half, thick, depth, lift, n=48):
    """Viga superior curva: los extremos suben como en un torii."""
    bm = bmesh.new()
    top, bot = [], []
    for i in range(n + 1):
        x = -half + 2 * half * i / n
        t = abs(x) / half
        off = lift * t ** 2.4
        bot.append((x, z0 + off)); top.append((x, z0 + thick + off * 1.15))
    ring = bot + list(reversed(top))
    vs = [bm.verts.new((x, depth / 2, z)) for x, z in ring]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)], vec=(0, -depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); col.objects.link(ob)
    return finish(ob, 0.008)

X = 0.30
pl = pillar("Pillar_L", -X, math.radians(2.2))
pr = pillar("Pillar_R", X, math.radians(-2.2))
nuki = box("Nuki", 0, 0.62, 0.84, 0.05, 0.055)
strut = box("Gakuzuka", 0, 0.715, 0.07, 0.15, 0.05)
shimaki = box("Shimaki", 0, 0.81, 0.88, 0.05, 0.075)
beam = kasagi("Kasagi", 0.835, 0.56, 0.075, 0.11, 0.075)
cap = kasagi("Kasagi_Cap", 0.835 + 0.075, 0.585, 0.022, 0.125, 0.087)

def mat(name, hexc, rough):
    m = bpy.data.materials.new(name)
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = srgb(hexc); b.inputs["Roughness"].default_value = rough
    return m
stone, ember, ink = mat("Travertine", "#DDD6C8", 0.6), mat("Ember_Enamel", "#D9441E", 0.35), mat("Ink_Lacquer", "#17161C", 0.3)
for o in (pl, pr, nuki, strut): o.data.materials.append(stone)
for o in (shimaki, beam): o.data.materials.append(ember)
cap.data.materials.append(ink)

bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0)); floor = bpy.context.active_object
floor.data.materials.append(mat("Night_Floor", "#141517", 0.55))
world = bpy.data.worlds.new("W"); scene.world = world
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs["Color"].default_value = srgb("#0F1012"); bg.inputs["Strength"].default_value = 0.05
for name, loc, size, e in (("Key", (-1.7, -1.9, 2.3), 1.4, 220), ("Rim", (1.6, 1.4, 1.5), 1.0, 200)):
    l = bpy.data.lights.new(name, "AREA"); l.size = size; l.energy = e
    o = bpy.data.objects.new(name, l); o.location = loc; col.objects.link(o)
    o.rotation_euler = (Vector((0, 0, 0.5)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 70
cam = bpy.data.objects.new("Cam", cam_d); col.objects.link(cam)
cam.location = (0.85, -2.9, 0.9)
cam.rotation_euler = (Vector((0, 0, 0.5)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.use_denoising = True
out = bpy.path.abspath(args.out); os.makedirs(out, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "torii-logo.blend"))
print("@@JSON@@", [o.name for o in scene.objects if o.type == "MESH"])
