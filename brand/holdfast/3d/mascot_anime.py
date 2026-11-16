# Mascota Holdfast: chica anime cyberpunk con visor, pelo rosa y auriculares neón. Cel-shading con contorno.
# blender -b -P mascot_coin.py -- salida.png [porcentaje]
import bpy, math, sys, random
out = sys.argv[sys.argv.index("--") + 1]
pct = int(sys.argv[-2]) if sys.argv[-2].isdigit() else 100
MOOD = sys.argv[-1] if sys.argv[-1] in ("up", "down", "calm") else "calm"
random.seed(9)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 28; sc.cycles.use_denoising = True
sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = 1400; sc.render.resolution_percentage = pct
sc.view_settings.view_transform = "Standard"

def toon(name, rgb, size=0.55, smooth=0.04, glow=0.75):
    m = bpy.data.materials.new(name); m.use_nodes = True; t = m.node_tree; n = t.nodes; n.clear()
    o = n.new("ShaderNodeOutputMaterial"); b = n.new("ShaderNodeBsdfToon"); b.inputs["Color"].default_value = (*rgb, 1); b.inputs["Size"].default_value = size; b.inputs["Smooth"].default_value = smooth
    e = n.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (*rgb, 1); e.inputs["Strength"].default_value = glow
    ad = n.new("ShaderNodeAddShader"); t.links.new(b.outputs[0], ad.inputs[0]); t.links.new(e.outputs[0], ad.inputs[1]); t.links.new(ad.outputs[0], o.inputs[0]); return m
def emis(name, rgb, k=1.6):
    m = bpy.data.materials.new(name); m.use_nodes = True; t = m.node_tree; n = t.nodes; n.clear()
    o = n.new("ShaderNodeOutputMaterial"); e = n.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (*rgb, 1); e.inputs["Strength"].default_value = k
    t.links.new(e.outputs[0], o.inputs[0]); return m
def outline_mat():
    m = bpy.data.materials.new("ol"); m.use_nodes = True; t = m.node_tree; n = t.nodes; n.clear()
    o = n.new("ShaderNodeOutputMaterial"); e = n.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (0.03, 0.02, 0.07, 1)
    tr = n.new("ShaderNodeBsdfTransparent"); g = n.new("ShaderNodeNewGeometry"); mx = n.new("ShaderNodeMixShader")
    t.links.new(g.outputs["Backfacing"], mx.inputs[0]); t.links.new(e.outputs[0], mx.inputs[1]); t.links.new(tr.outputs[0], mx.inputs[2]); t.links.new(mx.outputs[0], o.inputs[0]); return m
OL = outline_mat()
def prim(kind, loc, scale, mat, rot=(0, 0, 0), outline=True, th=0.05, **kw):
    if kind == "sphere": bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=loc, segments=48, ring_count=24)
    elif kind == "cyl": bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=2, location=loc, vertices=64)
    elif kind == "cone": bpy.ops.mesh.primitive_cone_add(radius1=1, radius2=kw.get("r2", 0), depth=2, location=loc, vertices=32)
    elif kind == "cube": bpy.ops.mesh.primitive_cube_add(size=2, location=loc)
    o = bpy.context.object; o.scale = scale; o.rotation_euler = tuple(math.radians(r) for r in rot); bpy.ops.object.shade_smooth(); o.data.materials.append(mat)
    if outline:
        o.data.materials.append(OL); md = o.modifiers.new("ol", "SOLIDIFY"); md.thickness = th; md.offset = 1; md.use_flip_normals = True; md.material_offset = 1
    return o

SKIN = toon("skin", (1.0, 0.82, 0.78)); HAIR = toon("hair", (1.0, 0.25, 0.60)); HAIR2 = toon("hair2", (0.75, 0.12, 0.45)); JK = toon("jk", (0.05, 0.05, 0.10), glow=0.15); JK2 = toon("jk2", (0.12, 0.10, 0.22), glow=0.2)
WHITE = toon("white", (0.98, 0.98, 1.0)); BLACK = toon("black", (0.02, 0.02, 0.06)); PINK = toon("pink", (1.0, 0.5, 0.65)); EYE = toon("eye", (0.2, 0.85, 1.0), glow=1.2)
CY = emis("cyan", (0.2, 0.9, 1.0), 2.4); MG = emis("mag", (1.0, 0.2, 0.65), 2.4); VIS = emis("vis", (0.25, 0.9, 1.0), 1.4)
# torso / chaqueta
prim("sphere", (0, 0.1, -0.9), (1.7, 1.0, 1.5), JK)
prim("cube", (0, -0.9, -0.6), (0.05, 0.03, 1.2), CY, outline=False)
for sx in (-1, 1): prim("cube", (sx * 0.95, -0.85, -0.3), (0.04, 0.03, 0.7), MG, rot=(0, sx * 10, 0), outline=False)
prim("cyl", (0, -0.1, 0.55), (0.42, 0.42, 0.45), SKIN)          # cuello
prim("cyl", (0, -0.1, 0.35), (0.75, 0.75, 0.22), JK2)           # cuello alto
# pelo trasero y cabeza
prim("sphere", (0, 0.35, 1.9), (1.55, 1.25, 1.65), HAIR2)
prim("sphere", (0, -0.02, 1.85), (1.3, 1.1, 1.2), SKIN)
# flequillo (casquete rosa) + mechones
prim("sphere", (0, -0.1, 2.35), (1.42, 1.2, 0.82), HAIR)
for sx in (-1, 1):
    prim("cone", (sx * 0.55, -0.95, 2.0), (0.34, 0.28, 0.62), HAIR, rot=(180, 0, sx * 8), r2=0.02)
    prim("cone", (sx * 1.3, -0.35, 1.5), (0.32, 0.3, 0.9), HAIR, rot=(180, 0, sx * 10), r2=0.02)
prim("cone", (0.1, -1.0, 2.1), (0.3, 0.26, 0.55), HAIR, rot=(180, 0, 0), r2=0.02)
# visor cian sobre la frente (levantado) y ojos grandes anime
prim("cube", (0, -1.12, 2.3), (1.15, 0.06, 0.1), VIS, rot=(0, 3, 0), outline=False)
for sx in (-1, 1):
    ex = sx * 0.52
    if MOOD == "up":   # ojos felices en arco ^ ^
        prim("sphere", (ex, -1.05, 1.78), (0.36, 0.1, 0.12), BLACK, rot=(0, sx * -12, 0), outline=False)
        prim("sphere", (ex, -1.07, 1.7), (0.3, 0.08, 0.07), PINK, rot=(0, sx * -12, 0), outline=False)
    else:
        sz = 0.5 if MOOD == "down" else 0.44
        prim("sphere", (ex, -1.0, 1.72), (0.34, 0.12, sz), BLACK, outline=False)
        prim("sphere", (ex, -1.1, 1.72), (0.27, 0.07, sz - 0.07), EYE, outline=False)
        prim("sphere", (ex + 0.09, -1.17, 1.88), (0.1, 0.04, 0.12), WHITE, outline=False)
        prim("sphere", (ex - 0.07, -1.17, 1.56), (0.05, 0.03, 0.06), WHITE, outline=False)
        if MOOD == "down":
            prim("cube", (ex, -1.1, 2.12), (0.3, 0.03, 0.04), BLACK, rot=(0, sx * 22, 0), outline=False)   # cejas tristes
            prim("sphere", (ex + sx * 0.12, -1.18, 1.35), (0.07, 0.04, 0.14), CY, outline=False)            # lágrima
    prim("sphere", (sx * 0.95, -0.85, 1.4), (0.22, 0.08, 0.13), PINK, outline=False)
    # auriculares con luz
    prim("cyl", (sx * 1.38, 0.0, 1.8), (0.42, 0.42, 0.22), JK, rot=(0, 90, 0))
    prim("cyl", (sx * 1.58, 0.0, 1.8), (0.3, 0.3, 0.06), MG if sx > 0 else CY, rot=(0, 90, 0), outline=False)
if MOOD == "up": prim("sphere", (0, -1.1, 1.36), (0.2, 0.06, 0.15), BLACK, outline=False); prim("sphere", (0, -1.14, 1.32), (0.12, 0.04, 0.07), PINK, outline=False)
elif MOOD == "down": prim("sphere", (0, -1.1, 1.34), (0.14, 0.05, 0.04), BLACK, outline=False)
else: prim("sphere", (0, -1.1, 1.38), (0.14, 0.05, 0.07), PINK, outline=False)
# arco de auriculares
prim("sphere", (0, 0.0, 2.75), (1.52, 0.2, 0.16), JK, rot=(0, 0, 0), outline=False)
# destellos
for i in range(20):
    x, z = random.uniform(-3.6, 3.6), random.uniform(-2.2, 4.4)
    if abs(x) < 2.0 and -1.6 < z < 3.6: continue
    c = random.choice([CY, MG, emis("g", (1, 0.85, 0.3), 1.8)])
    bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.06, 0.15), location=(x, random.uniform(0.6, 1.6), z), subdivisions=1); bpy.context.object.data.materials.append(c)
sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 7.0; so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), math.radians(15), math.radians(-35))
for nm, col, loc in (("pk", (1, 0.2, 0.55), (4, 3, 2)), ("cy", (0.2, 0.8, 1), (-4, 3, 1))):
    l = bpy.data.lights.new(nm, "POINT"); l.energy = 1100; l.color = col; lo = bpy.data.objects.new(nm, l); lo.location = loc; sc.collection.objects.link(lo)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.3, -13.5, 0.9); cam.rotation_euler = (math.radians(90), 0, math.radians(1.5)); cam.data.lens = 46
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("OK", out)
