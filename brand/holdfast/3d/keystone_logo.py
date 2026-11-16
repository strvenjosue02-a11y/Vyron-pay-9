"""Logo 3D de Holdfast: la clave del arco (paleta Noche y brasa). Blender 5.2, sin pantalla.
Uso: blender -b --factory-startup --python-exit-code 1 -P keystone_logo.py -- --mode preview|final --out DIR
El arco (piedra hueso) se sostiene gracias a la clave central (esmalte brasa)."""
import bpy, bmesh, math, sys, os, argparse, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser(); ap.add_argument("--mode", default="preview"); ap.add_argument("--out", default="//out")
args = ap.parse_args(argv)

RO, RI, CZ, DEPTH = 0.44, 0.27, 0.46, 0.17   # radio exterior/interior, centro del arco, grosor
GAP = math.radians(1.1)                       # junta entre piedras
KEY = math.radians(17)                        # media apertura de la clave

def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)

for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
scene = bpy.context.scene

def prism(name, pts2d, y0=-DEPTH / 2, depth=DEPTH):
    """pts2d: contorno (x, z) en sentido antihorario; se extruye en Y."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y0 + depth, z)) for x, z in pts2d]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)], vec=(0, -depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    bev = ob.modifiers.new("Bevel", "BEVEL"); bev.width = 0.012; bev.segments = 6
    bev.limit_method = "ANGLE"; bev.angle_limit = math.radians(30); bev.harden_normals = True
    ob.modifiers.new("WN", "WEIGHTED_NORMAL").keep_sharp = True
    return ob

def arc_pts(a0, a1, n=48):
    out = [(RO * math.cos(a0 + (a1 - a0) * i / n), CZ + RO * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
    inn = [(RI * math.cos(a1 - (a1 - a0) * i / n), CZ + RI * math.sin(a1 - (a1 - a0) * i / n)) for i in range(n + 1)]
    return out + inn

# dovelas (piedras del arco) a cada lado + pilar, separadas por juntas
J = 0.008  # junta en metros para los pilares
pieces = []
def side(sign):
    out = []
    pil = [(RI, 0.0), (RO, 0.0), (RO, CZ - J), (RI, CZ - J)]
    out.append([(sign * x, z) for x, z in (pil if sign > 0 else reversed(pil))])
    top = math.pi / 2 - KEY - GAP
    cuts = [0.0, top / 3, 2 * top / 3, top]
    for i in range(3):
        a0, a1 = cuts[i] + (GAP / 2 if i else 0.0), cuts[i + 1] - GAP / 2
        pts = arc_pts(a0, a1, 16)
        pts = [(sign * x, z) for x, z in pts]
        out.append(pts if sign > 0 else list(reversed(pts)))
    return out
stones = []
for k, pts in enumerate(side(1) + side(-1)):
    stones.append(prism(f"Stone_{k}", pts))
arch_l, arch_r = stones[0], stones[4]
# la clave: un poco más alta que el arco y adelantada, para que se lea como la pieza que sostiene
ka0, ka1 = math.pi / 2 - KEY, math.pi / 2 + KEY
kro = RO + 0.05
key_pts = [(kro * math.cos(ka0 + (ka1 - ka0) * i / 24), CZ + kro * math.sin(ka0 + (ka1 - ka0) * i / 24)) for i in range(25)]
key_pts += [(RI * math.cos(ka1 - (ka1 - ka0) * i / 24), CZ + RI * math.sin(ka1 - (ka1 - ka0) * i / 24)) for i in range(25)]
keystone = prism("Keystone", key_pts, y0=-DEPTH / 2 - 0.012, depth=DEPTH + 0.024)

def mat(name, hexc, rough, coat=0.0, coat_rough=0.1, spec=0.5, noise=False):
    m = bpy.data.materials.new(name); nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = srgb(hexc); b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Coat Weight"].default_value = coat; b.inputs["Coat Roughness"].default_value = coat_rough
    if noise:  # leve textura de piedra
        tex = nt.nodes.new("ShaderNodeTexNoise"); tex.inputs["Scale"].default_value = 38; tex.inputs["Detail"].default_value = 8
        bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.14
        nt.links.new(tex.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m
stone = mat("Travertine", "#DDD6C8", 0.6, coat=0.1, coat_rough=0.4, noise=True)
for o in stones: o.data.materials.append(stone)
keystone.data.materials.append(mat("Ember_Enamel", "#D9441E", 0.35, coat=0.8, coat_rough=0.08, spec=0.45))

# piso oscuro + fondo
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0)); floor = bpy.context.active_object
floor.data.materials.append(mat("Night_Floor", "#141517", 0.55, spec=0.3))
world = bpy.data.worlds.new("W"); scene.world = world
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs["Color"].default_value = srgb("#0F1012"); bg.inputs["Strength"].default_value = 0.05

def area(name, loc, size, energy, color=(1, 1, 1), target=(0, 0, 0.55)):
    l = bpy.data.lights.new(name, "AREA"); l.shape = "DISK"; l.size = size; l.energy = energy; l.color = color
    o = bpy.data.objects.new(name, l); o.location = loc; scene.collection.objects.link(o)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); return o
area("Key", (-1.7, -1.9, 2.3), 1.4, 220)
area("Rim", (1.6, 1.4, 1.5), 1.0, 260, (1.0, 0.82, 0.68))
area("Fill", (2.0, -2.0, 0.6), 2.0, 22, (0.85, 0.9, 1.0))
area("Top", (0, 0.2, 2.6), 1.2, 60, target=(0, 0, 1.0))

cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 70
cam = bpy.data.objects.new("Cam", cam_d); scene.collection.objects.link(cam)
cam.location = (0.9, -2.9, 0.95)
cam.rotation_euler = (Vector((0, 0, 0.5)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

r = scene.render; scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"
scene.cycles.use_denoising = True; scene.cycles.use_adaptive_sampling = True
try: scene.view_settings.view_transform = "AgX"; scene.view_settings.look = "AgX - Medium High Contrast"
except TypeError: pass
out = bpy.path.abspath(args.out); os.makedirs(out, exist_ok=True)
r.resolution_percentage = 100
if args.mode == "preview":
    r.resolution_x = r.resolution_y = 720; scene.cycles.samples = 40
    r.filepath = os.path.join(out, "keystone-preview.png")
else:
    r.resolution_x = r.resolution_y = 1600; scene.cycles.samples = 160
    r.film_transparent = True; floor.is_shadow_catcher = True
    r.image_settings.color_mode = "RGBA"
    r.filepath = os.path.join(out, "keystone-3d.png")
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "keystone-logo.blend"))
print("@@JSON@@" + json.dumps({"out": r.filepath, "dims": [list(o.dimensions) for o in (arch_l, arch_r, keystone)]}))
