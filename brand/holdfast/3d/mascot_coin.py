# Mascota inventada de Holdfast: criatura chibi con sudadera negra y una moneda gigante. Cel-shading con contorno.
# blender -b -P mascot_coin.py -- salida.png [porcentaje]
import bpy, math, sys, random
out = sys.argv[sys.argv.index("--") + 1]
pct = int(sys.argv[-1]) if sys.argv[-1].isdigit() else 100
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

SKIN = toon("skin", (0.80, 0.68, 1.0)); SKIN2 = toon("skin2", (0.62, 0.50, 0.92)); HOOD = toon("hood", (0.10, 0.09, 0.15)); HOOD2 = toon("hood2", (0.18, 0.15, 0.26))
WHITE = toon("white", (0.98, 0.98, 1.0)); BLACK = toon("black", (0.02, 0.02, 0.06)); PINK = toon("pink", (1.0, 0.45, 0.70)); GOLD = toon("gold", (1.0, 0.78, 0.22), glow=0.9); GOLD2 = toon("gold2", (0.85, 0.55, 0.10))
CYANE = emis("cyan", (0.2, 0.9, 1.0), 2.2)
# capucha (detrás de la cabeza) y cuerpo con sudadera
prim("sphere", (0, 0.45, 2.45), (1.6, 1.15, 1.45), HOOD)
prim("sphere", (0, 0.1, 0.55), (1.05, 0.85, 1.0), HOOD)
prim("sphere", (0, -0.62, 0.35), (0.62, 0.2, 0.34), HOOD2, outline=False)                      # bolsillo
for sx in (-1, 1): prim("cyl", (sx * 0.38, -0.78, 1.28), (0.04, 0.04, 0.5), WHITE, outline=False)   # cordones
# cabeza
prim("sphere", (0, -0.05, 2.45), (1.38, 1.12, 1.18), SKIN)
for sx in (-1, 1):
    prim("cone", (sx * 0.95, 0.1, 3.75), (0.36, 0.30, 0.62), SKIN, rot=(0, sx * 18, 0), r2=0.05)  # orejitas/cuernitos
    prim("cone", (sx * 0.95, -0.02, 3.62), (0.2, 0.15, 0.4), PINK, rot=(0, sx * 18, 0), r2=0.03, outline=False)
    ex = sx * 0.52
    prim("sphere", (ex, -1.05, 2.55), (0.36, 0.2, 0.46), BLACK, outline=False)                    # ojos
    prim("sphere", (ex + 0.1, -1.2, 2.72), (0.12, 0.06, 0.14), WHITE, outline=False)
    prim("sphere", (ex - 0.06, -1.2, 2.38), (0.06, 0.04, 0.07), WHITE, outline=False)
    prim("sphere", (sx * 0.98, -0.95, 2.1), (0.26, 0.1, 0.16), PINK, outline=False)               # mejillas
prim("sphere", (0, -1.12, 2.0), (0.2, 0.07, 0.11), BLACK, outline=False)                          # boca
prim("sphere", (0, -1.17, 2.02), (0.1, 0.04, 0.05), PINK, outline=False)
# antena con luz cian
prim("cyl", (0, 0.0, 3.75), (0.03, 0.03, 0.45), SKIN2, outline=False); bpy.ops.mesh.primitive_uv_sphere_add(radius=0.17, location=(0, 0, 4.3)); bpy.context.object.data.materials.append(CYANE)
# moneda gigante (frente al cuerpo, a la derecha)
cx, cy, cz = 1.55, -1.25, 0.9
prim("cyl", (cx, cy, cz), (1.75, 1.75, 0.2), GOLD, rot=(90, 0, 0), th=0.06)
prim("cyl", (cx, cy - 0.17, cz), (1.45, 1.45, 0.04), GOLD2, rot=(90, 0, 0), outline=False)
for bx, bz, sw, sh in ((-0.42, 0, 0.17, 0.85), (0.42, 0, 0.17, 0.85), (0, 0, 0.5, 0.14)):  # letra H grabada
    prim("cube", (cx + bx, cy - 0.23, cz + bz), (sw, 0.05, sh), toon("h", (1.0, 0.95, 0.7)), outline=False)
# brazos de la sudadera sosteniendo la moneda y manitas
for sx, hx in ((-1, cx - 1.55), (1, cx + 1.55)):
    prim("sphere", (sx * 1.05 + (0.3 if sx > 0 else 0) , -0.75, 0.9), (0.38, 0.42, 0.85), HOOD, rot=(0, sx * 12, 0))
    prim("sphere", (hx, cy - 0.1, cz - 0.1), (0.3, 0.3, 0.3), SKIN)
# pies (zapatillas) y colita
for sx in (-1, 1): prim("sphere", (sx * 0.55, -0.55, -0.55), (0.46, 0.68, 0.28), WHITE)
prim("sphere", (0, 1.1, 0.2), (0.3, 0.3, 0.3), SKIN2)
# destellos
for i in range(18):
    x, z = random.uniform(-3.8, 4.4), random.uniform(-1.4, 5.2)
    if abs(x) < 2.0 and -0.9 < z < 4.6: continue
    c = random.choice([emis("s1", (1, 0.82, 0.3), 1.6), emis("s2", (0.3, 0.85, 1), 1.6), emis("s3", (1, 0.4, 0.75), 1.6)])
    bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.06, 0.15), location=(x, random.uniform(0.6, 1.6), z), subdivisions=1); bpy.context.object.data.materials.append(c)
sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 7.0; so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), math.radians(15), math.radians(-35))
for nm, col, loc in (("pk", (1, 0.2, 0.55), (4, 3, 2)), ("cy", (0.2, 0.8, 1), (-4, 3, 1))):
    l = bpy.data.lights.new(nm, "POINT"); l.energy = 900; l.color = col; lo = bpy.data.objects.new(nm, l); lo.location = loc; sc.collection.objects.link(lo)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.6, -13.5, 1.9); cam.rotation_euler = (math.radians(90), 0, math.radians(3)); cam.data.lens = 46
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("OK", out)
