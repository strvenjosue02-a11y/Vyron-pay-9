# Mascota chibi anime (rana) sobre un cohete, estilo cel-shading con contorno. Blender 5.x, Cycles CPU, fondo transparente.
# blender -b -P frog_rocket.py -- salida.png [porcentaje]
import bpy, math, sys, random
out = sys.argv[sys.argv.index("--") + 1]
pct = int(sys.argv[-1]) if sys.argv[-1].isdigit() else 100
random.seed(4)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 28; sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 1400; sc.render.resolution_percentage = pct
sc.view_settings.view_transform = "Standard"

def toon(name, rgb, size=0.55, smooth=0.04):
    m = bpy.data.materials.new(name); m.use_nodes = True; t = m.node_tree; n = t.nodes; n.clear()
    o = n.new("ShaderNodeOutputMaterial"); b = n.new("ShaderNodeBsdfToon"); b.inputs["Color"].default_value = (*rgb, 1); b.inputs["Size"].default_value = size; b.inputs["Smooth"].default_value = smooth
    e = n.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (*rgb, 1); e.inputs["Strength"].default_value = 0.75
    ad = n.new("ShaderNodeAddShader"); t.links.new(b.outputs[0], ad.inputs[0]); t.links.new(e.outputs[0], ad.inputs[1]); t.links.new(ad.outputs[0], o.inputs[0]); return m
def emis(name, rgb, k=6):
    m = bpy.data.materials.new(name); m.use_nodes = True; t = m.node_tree; n = t.nodes; n.clear()
    o = n.new("ShaderNodeOutputMaterial"); e = n.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (*rgb, 1); e.inputs["Strength"].default_value = k
    t.links.new(e.outputs[0], o.inputs[0]); return m
def outline_mat():
    m = bpy.data.materials.new("ol"); m.use_nodes = True; t = m.node_tree; n = t.nodes; n.clear()
    o = n.new("ShaderNodeOutputMaterial"); e = n.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (0.03, 0.02, 0.06, 1); e.inputs["Strength"].default_value = 1
    tr = n.new("ShaderNodeBsdfTransparent"); g = n.new("ShaderNodeNewGeometry"); mx = n.new("ShaderNodeMixShader")
    t.links.new(g.outputs["Backfacing"], mx.inputs[0]); t.links.new(e.outputs[0], mx.inputs[1]); t.links.new(tr.outputs[0], mx.inputs[2]); t.links.new(mx.outputs[0], o.inputs[0]); return m
OL = outline_mat()
def prim(kind, loc, scale, mat, rot=(0, 0, 0), outline=True, **kw):
    if kind == "sphere": bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=loc, segments=48, ring_count=24)
    elif kind == "cyl": bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=2, location=loc, vertices=48)
    elif kind == "cone": bpy.ops.mesh.primitive_cone_add(radius1=1, radius2=kw.get("r2", 0), depth=2, location=loc, vertices=48)
    elif kind == "cube": bpy.ops.mesh.primitive_cube_add(size=2, location=loc)
    o = bpy.context.object; o.scale = scale; o.rotation_euler = tuple(math.radians(r) for r in rot); bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    if outline:
        o.data.materials.append(OL); md = o.modifiers.new("ol", "SOLIDIFY"); md.thickness = kw.get("th", 0.045); md.offset = 1; md.use_flip_normals = True; md.material_offset = 1
    return o

GREEN = toon("green", (0.30, 0.86, 0.45)); GREEN2 = toon("green2", (0.22, 0.70, 0.38)); WHITE = toon("white", (0.97, 0.97, 1.0)); RED = toon("red", (1.0, 0.18, 0.45)); NAVY = toon("navy", (0.10, 0.10, 0.28))
PINK = toon("pink", (1.0, 0.55, 0.70)); BLACK = toon("black", (0.02, 0.02, 0.05)); YEL = toon("yel", (1.0, 0.82, 0.25)); CYAN = toon("cyan", (0.25, 0.85, 1.0))
# cohete (inclinado hacia arriba a la derecha)
R = (0, 0, 28)
prim("cyl", (0.2, 0, -1.1), (0.62, 0.62, 1.35), WHITE, rot=(0, 0, 0))
prim("cone", (0.2, 0, 0.9), (0.62, 0.62, 1.0), RED, rot=(0, 0, 0))
for a in (90, 210, 330):
    x, y = 0.2 + 0.78 * math.cos(math.radians(a)), 0.78 * math.sin(math.radians(a))
    prim("cube", (x, y, -2.1), (0.06, 0.55, 0.7), RED, rot=(0, 0, a), th=0.03)
prim("cyl", (0.2, 0, -1.0), (0.66, 0.66, 0.12), NAVY); prim("sphere", (0.2, -0.64, -0.6), (0.27, 0.12, 0.27), CYAN)
flame = emis("flame", (1.0, 0.45, 0.1), 2.2); bpy.ops.mesh.primitive_cone_add(radius1=0.5, radius2=0, depth=2.4, location=(0.2, 0, -3.9), vertices=32); f = bpy.context.object; f.rotation_euler = (math.pi, 0, 0); f.data.materials.append(flame)
bpy.ops.mesh.primitive_cone_add(radius1=0.28, radius2=0, depth=1.6, location=(0.2, 0, -3.5), vertices=32); f2 = bpy.context.object; f2.rotation_euler = (math.pi, 0, 0); f2.data.materials.append(emis("flame2", (1.0, 0.85, 0.3), 2.6))
prim("cyl", (0.2, 0, -2.5), (0.5, 0.5, 0.18), NAVY)
# rana chibi encima
prim("sphere", (0.2, 0, 1.9), (0.8, 0.7, 0.75), GREEN)            # cuerpo
prim("sphere", (0.2, 0.0, 3.15), (1.35, 1.15, 1.0), GREEN)         # cabeza grande
prim("sphere", (0.2, -0.8, 1.7), (0.5, 0.2, 0.4), toon("belly", (0.80, 1.0, 0.75)), outline=False)
for sx in (-1, 1):
    ex = 0.2 + sx * 0.78
    prim("sphere", (ex, -0.25, 4.0), (0.52, 0.5, 0.52), GREEN)       # bultos de ojos
    prim("sphere", (ex, -0.68, 4.0), (0.40, 0.2, 0.40), WHITE, outline=False)
    prim("sphere", (ex + sx * -0.03, -0.86, 3.98), (0.22, 0.12, 0.26), BLACK, outline=False)
    prim("sphere", (ex + 0.07, -0.98, 4.1), (0.07, 0.05, 0.07), WHITE, outline=False)
    prim("sphere", (0.2 + sx * 1.0, -0.95, 2.95), (0.24, 0.1, 0.16), PINK, outline=False)  # mejillas
    prim("sphere", (0.2 + sx * 1.35, -0.1, 2.1), (0.28, 0.28, 0.5), GREEN2, rot=(0, sx * 25, 0))  # brazos
    prim("sphere", (0.2 + sx * 1.55, -0.1, 2.75), (0.3, 0.3, 0.3), GREEN)                        # puños
    prim("sphere", (0.2 + sx * 0.6, -0.5, 1.2), (0.34, 0.5, 0.2), GREEN2)                         # patas
prim("sphere", (0.2, -1.12, 2.98), (0.2, 0.06, 0.1), BLACK, outline=False)
# casco/gafas anime: cinta
prim("cyl", (0.2, 0.0, 3.62), (1.38, 1.18, 0.1), YEL)
# estrellas y líneas de velocidad
for i in range(26):
    x, z = random.uniform(-4.2, 4.4), random.uniform(-3.5, 5.5)
    if abs(x - 0.2) < 1.9 and -2.5 < z < 4.8: continue
    c = random.choice([emis("s1", (1, 0.8, 0.25), 1.6), emis("s2", (0.3, 0.85, 1), 1.6), emis("s3", (1, 0.3, 0.65), 1.6)])
    bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.05, 0.14), location=(x, random.uniform(0.5, 1.5), z), subdivisions=1); bpy.context.object.data.materials.append(c)
for i in range(10):
    x, z = random.choice([-1, 1]) * random.uniform(1.6, 3.4), random.uniform(-4, 1)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=random.uniform(0.8, 1.8), location=(x, 0.6, z)); bpy.context.object.data.materials.append(emis("ln", (0.8, 0.9, 1), 1.2))
# luces: sol + contraluces neón
sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 7.0; so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), math.radians(15), math.radians(-35))
for nm, col, loc in (("pk", (1, 0.2, 0.55), (4, 3, 2)), ("cy", (0.2, 0.8, 1), (-4, 3, 1))):
    l = bpy.data.lights.new(nm, "POINT"); l.energy = 900; l.color = col; lo = bpy.data.objects.new(nm, l); lo.location = loc; sc.collection.objects.link(lo)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.2, -13.5, 0.7); cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = 50
cam.location = (0.4, -13.5, 0.2); cam.rotation_euler = (math.radians(90), 0, math.radians(4)); cam.data.lens = 42
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("OK", out)
