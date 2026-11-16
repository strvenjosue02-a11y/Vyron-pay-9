# Ciudad cyberpunk neo-noir para el fondo del inicio (Blender 5.x, Cycles CPU).
# blender -b -P city_noir.py -- out.png
import bpy, random, sys, math
out = sys.argv[sys.argv.index("--") + 1]
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 48; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 4; sc.cycles.transparent_max_bounces = 16
sc.render.resolution_x, sc.render.resolution_y = 2400, 1200; sc.render.resolution_percentage = int(sys.argv[-1]) if sys.argv[-1].isdigit() else 100
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Punchy"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.09, 0.025, 0.06, 1); bg.inputs[1].default_value = 1

def mat(name, build):
    m = bpy.data.materials.new(name); m.use_nodes = True; build(m.node_tree); return m

def emis(name, rgb, k):
    def b(t):
        n = t.nodes; n.clear(); o = n.new("ShaderNodeOutputMaterial"); e = n.new("ShaderNodeEmission")
        e.inputs[0].default_value = (*rgb, 1); e.inputs[1].default_value = k; t.links.new(e.outputs[0], o.inputs[0])
    return mat(name, b)

def building_mat(name, c1, c2, lit):
    def b(t):
        n, L = t.nodes, t.links; n.clear()
        o = n.new("ShaderNodeOutputMaterial"); tc = n.new("ShaderNodeTexCoord")
        br = n.new("ShaderNodeTexBrick"); br.inputs["Scale"].default_value = 0.6; br.offset = 0
        br.inputs["Color1"].default_value = (*c1, 1); br.inputs["Color2"].default_value = (*c2, 1)
        br.inputs["Mortar"].default_value = (0, 0, 0, 1); br.inputs["Mortar Size"].default_value = 0.22
        br.inputs["Brick Width"].default_value = 0.7; br.inputs["Row Height"].default_value = 0.55
        L.new(tc.outputs["Object"], br.inputs["Vector"])
        nz = n.new("ShaderNodeTexWhiteNoise"); L.new(tc.outputs["Object"], nz.inputs["Vector"])
        mp = n.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.857, 0.857, 1.09); L.new(tc.outputs["Object"], mp.inputs["Vector"])
        fl = n.new("ShaderNodeVectorMath"); fl.operation = "FLOOR"; L.new(mp.outputs[0], fl.inputs[0]); L.new(fl.outputs[0], nz.inputs["Vector"])
        ramp = n.new("ShaderNodeValToRGB"); ramp.color_ramp.interpolation = "CONSTANT"
        ramp.color_ramp.elements[1].position = 1 - lit; L.new(nz.outputs["Value"], ramp.inputs[0])
        mul = n.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs[0].default_value = 1
        L.new(br.outputs["Color"], mul.inputs[6]); L.new(ramp.outputs["Color"], mul.inputs[7])
        p = n.new("ShaderNodeBsdfPrincipled"); p.inputs["Base Color"].default_value = (0.03, 0.02, 0.035, 1); p.inputs["Roughness"].default_value = 0.5
        L.new(mul.outputs[2], p.inputs["Emission Color"]); p.inputs["Emission Strength"].default_value = 2.2
        L.new(p.outputs[0], o.inputs[0])
    return mat(name, b)

WARM = building_mat("warm", (1.0, 0.45, 0.22), (1.0, 0.7, 0.45), 0.24)
PINK = building_mat("pink", (1.0, 0.18, 0.5), (1.0, 0.5, 0.35), 0.2)
DIM = building_mat("dim", (0.5, 0.2, 0.3), (0.6, 0.3, 0.2), 0.06)
NEON = [emis("n1", (1.0, 0.1, 0.45), 14), emis("n2", (1.0, 0.35, 0.12), 14), emis("n3", (1.0, 0.55, 0.75), 10)]
RED = emis("red", (1, 0.05, 0.03), 30)

def fog_mat(k):
    def b(t):
        n, L = t.nodes, t.links; n.clear(); o = n.new("ShaderNodeOutputMaterial")
        e = n.new("ShaderNodeEmission"); e.inputs[0].default_value = (0.35, 0.08, 0.22, 1); e.inputs[1].default_value = 0.7
        tr = n.new("ShaderNodeBsdfTransparent"); mx = n.new("ShaderNodeMixShader"); mx.inputs[0].default_value = k
        L.new(tr.outputs[0], mx.inputs[1]); L.new(e.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], o.inputs[0])
    return mat("fog%.2f" % k, b)

def box(x, y, sx, sy, h, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, h / 2)); o = bpy.context.object
    o.scale = (sx, sy, h); bpy.ops.object.transform_apply(scale=True); o.data.materials.append(m); return o

def plane(x, y, z, sx, sz, m, rot=0):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, z), rotation=(math.pi / 2, 0, rot)); o = bpy.context.object
    o.scale = (sx, sz, 1); o.data.materials.append(m); return o

# filas de edificios: lejos altas y tenues, cerca bajas con neón. Hueco al centro-derecha para el torii.
for row, y in enumerate(range(170, 34, -12)):
    x = -120.0
    near = y < 80
    while x < 120:
        wdt = random.uniform(5, 13) if near else random.uniform(6, 15)
        h = random.uniform(10, 34) if near else random.uniform(25, 75)
        if 4 < x < 46 and near: h *= 0.45  # deja ver el torii
        m = random.choice([WARM, PINK, PINK, DIM]) if near else random.choice([DIM, DIM, WARM, PINK])
        b = box(x + wdt / 2, y + random.uniform(-2, 2), wdt, random.uniform(6, 10), h, m)
        if random.random() < 0.5:  # remate escalonado + antena
            tw = wdt * random.uniform(0.4, 0.7); th = random.uniform(4, 14)
            box(x + wdt / 2, y, tw, 4, th + h, m)
            if random.random() < 0.7:
                box(x + wdt / 2, y, 0.25, 0.25, th + h + random.uniform(6, 16), DIM)
                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(x + wdt / 2, y, th + h + 16)); bpy.context.object.data.materials.append(RED)
        if near and random.random() < 0.55:  # letrero vertical de neón
            sh = random.uniform(5, 14); plane(x + 1.2, y - 5.2, random.uniform(4, max(5, h - sh)), 0.9, sh, random.choice(NEON))
        if near and wdt > 8 and random.random() < 0.3:  # valla horizontal
            plane(x + wdt / 2, y - 5.3, random.uniform(6, max(7, h - 3)), wdt * 0.7, random.uniform(1.6, 3), random.choice(NEON))
        x += wdt + random.uniform(0.3, 2.5)
    if row % 2 == 0:
        plane(0, y - 6, 60, 400, 140, fog_mat(0.10 if y > 60 else 0.05))

# calle mojada con reflejo
bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 60, 0)); g = bpy.context.object
gm = mat("wet", lambda t: (t.nodes["Principled BSDF"].inputs["Base Color"].__setattr__("default_value", (0.01, 0.008, 0.012, 1)), t.nodes["Principled BSDF"].inputs["Roughness"].__setattr__("default_value", 0.08), t.nodes["Principled BSDF"].inputs["Metallic"].__setattr__("default_value", 0.6)))
g.data.materials.append(gm)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -20, 26); cam.rotation_euler = (math.radians(93), 0, 0); cam.data.lens = 22
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("OK", out)
