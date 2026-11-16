# Símbolo 3D de Holdfast: moneda oscura con H y velas de trading. blender -b -P coin_candles.py -- salida.png porcentaje up|down|calm
import bpy, math, sys, random
out = sys.argv[sys.argv.index("--") + 1]; pct = int(sys.argv[-2]); MOOD = sys.argv[-1]
random.seed(4)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 48; sc.cycles.use_denoising = True
sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = 1200; sc.render.resolution_percentage = pct
sc.view_settings.view_transform = "Standard"
PINK = (1.0, 0.18, 0.53); VIO = (0.42, 0.18, 1.0); CYA = (0.24, 0.88, 1.0)
GLOW = {"up": PINK, "down": VIO, "calm": CYA}[MOOD]
def mat(name, col, metal=0.0, rough=0.5, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    if emit: b.inputs["Emission Color"].default_value = (*col, 1); b.inputs["Emission Strength"].default_value = emit
    return m
DARK = mat("dark", (0.04, 0.04, 0.07), 0.9, 0.25); RIM = mat("rim", GLOW, 0, 0.3, 1.1); HM = mat("h", (0.95, 0.95, 1.0), 1.0, 0.18)
UPM = mat("up", PINK, 0, 0.3, 0.45); DNM = mat("dn", VIO, 0, 0.3, 0.45)
tilt = {"up": -12, "down": 8, "calm": 0}[MOOD]
bpy.ops.object.empty_add(location=(0, 0, 0)); root = bpy.context.object; root.rotation_euler = (math.radians(90 + tilt), 0, math.radians(-38))
def add(o): o.parent = root; return o
bpy.ops.mesh.primitive_cylinder_add(radius=1.6, depth=0.34, vertices=96, location=(0, 0, 0)); c = add(bpy.context.object); c.data.materials.append(DARK); bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_torus_add(major_radius=1.6, minor_radius=0.09, major_segments=96, minor_segments=24, location=(0, 0, 0.17)); r = add(bpy.context.object); r.data.materials.append(RIM)
bpy.ops.mesh.primitive_torus_add(major_radius=1.6, minor_radius=0.09, major_segments=96, minor_segments=24, location=(0, 0, -0.17)); r = add(bpy.context.object); r.data.materials.append(RIM)
bpy.ops.mesh.primitive_torus_add(major_radius=1.2, minor_radius=0.03, major_segments=96, minor_segments=12, location=(0, 0, 0.18)); r = add(bpy.context.object); r.data.materials.append(RIM)
bpy.ops.object.text_add(location=(0, 0, 0.18)); t = add(bpy.context.object); t.data.body = "H"; t.data.size = 1.7; t.data.extrude = 0.07; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.materials.append(HM)
# velas flotando delante-detrás de la moneda
cs = [(-2.9, -0.3, 0.9, 1), (-2.35, 0.0, 1.5, 1), (-1.8, -0.9, 0.8, 0), (2.0, 0.4, 1.4, 1), (2.55, 0.9, 1.0, 0), (3.1, 0.2, 1.8, 1), (2.9, -1.0, 0.7, 0)]
if MOOD == "down": cs = [(x, z, h, 0 if i % 3 else 1) for i, (x, z, h, u) in enumerate(cs)]
if MOOD == "up": cs = [(x, z, h, 1 if i % 3 else 0) for i, (x, z, h, u) in enumerate(cs)]
for x, z, h, u in cs:
    y = random.uniform(-0.5, -0.1) - 0.2
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z)); b = bpy.context.object; b.scale = (0.28, 0.28, h); b.data.materials.append(UPM if u else DNM); bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=h + 0.9, location=(x, y, z)); w = bpy.context.object; w.data.materials.append(UPM if u else DNM)
    for o in (b, w): o.parent = None
sun = bpy.data.lights.new("s", "AREA"); sun.energy = 900; sun.size = 6; so = bpy.data.objects.new("s", sun); so.location = (-3, -6, 5); so.rotation_euler = (math.radians(60), 0, math.radians(-25)); sc.collection.objects.link(so)
for col, loc in ((PINK, (4, -4, 1)), (CYA, (-5, -3, -1))):
    l = bpy.data.lights.new("p", "POINT"); l.energy = 900; l.color = col; lo = bpy.data.objects.new("p", l); lo.location = loc; sc.collection.objects.link(lo)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.05, 0.09, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.7
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c")); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -11, 0.2); cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = 50
sc.render.filepath = out; bpy.ops.render.render(write_still=True); print("OK", out)
