"""
Blender Studio — utilidades para render fotorrealista de producto con Blender (bpy) sin interfaz.
Escena de estudio (softboxes de área, fondo transparente), Cycles + OpenImageDenoise,
AgX como transformada de color y materiales Principled BSDF con subsurface real.
"""
from __future__ import annotations

import math
import random
from typing import Iterable

import bpy  # bpy primero: registra bmesh/mathutils
import bmesh
from mathutils import Vector


# ------------------------------------------------------------------ escena
def reset(resolution=(1080, 1080), samples=64, transparent=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = samples
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = 0.02
    s.cycles.use_denoising = True
    s.cycles.denoiser = "OPENIMAGEDENOISE"
    s.cycles.max_bounces = 8
    s.cycles.transmission_bounces = 8
    s.cycles.glossy_bounces = 4
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    s.render.resolution_x, s.render.resolution_y = resolution
    s.render.resolution_percentage = 100
    s.render.film_transparent = transparent
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    s.render.image_settings.compression = 30
    s.view_settings.view_transform = "AgX"
    for look in ("AgX - Punchy", "AgX - Medium High Contrast", "Punchy"):
        try:
            s.view_settings.look = look
            break
        except TypeError:
            continue
    world = bpy.data.worlds.new("World")
    s.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.05, 0.045, 0.04, 1)
    bg.inputs["Strength"].default_value = 0.6
    return s


def area_light(name, loc, target=(0, 0, 0.6), power=400, size=2.0, color=(1, 0.95, 0.88), shape="RECTANGLE", size_y=None):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.color = color
    data.shape = shape
    data.size = size
    if size_y is not None:
        data.size_y = size_y
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    look_at(obj, target)
    return obj


def studio_lights(scale=1.0, warm_rim=True):
    """Key grande delante-derecha, contra cálido detrás-izquierda, relleno suave, cenital débil."""
    area_light("Key", (3.2 * scale, -3.6 * scale, 3.4 * scale), power=900 * scale**2, size=3.0 * scale)
    area_light("Rim", (-3.4 * scale, 3.0 * scale, 2.6 * scale), power=1100 * scale**2, size=0.8 * scale, size_y=4 * scale,
               color=(1, 0.72, 0.45) if warm_rim else (1, 1, 1))
    area_light("Fill", (-3.8 * scale, -2.6 * scale, 1.2 * scale), power=220 * scale**2, size=3.5 * scale, color=(1, 0.93, 0.86))
    area_light("Top", (0, 0, 5 * scale), power=180 * scale**2, size=4 * scale)


def camera(loc, target, lens=70):
    data = bpy.data.cameras.new("Cam")
    data.lens = lens
    data.dof.use_dof = False
    cam = bpy.data.objects.new("Cam", data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = loc
    look_at(cam, target)
    bpy.context.scene.camera = cam
    return cam


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def shadow_catcher(size=12, z=0.0):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    p = bpy.context.active_object
    p.name = "ShadowCatcher"
    p.is_shadow_catcher = True
    return p


# ------------------------------------------------------------------ materiales
def principled(name, color, roughness=0.5, sss=0.0, sss_radius=(1.0, 0.5, 0.25), sss_scale=0.05, coat=0.0,
               coat_rough=0.1, sheen=0.0, sheen_tint=(1, 1, 1), transmission=0.0, ior=1.45, metallic=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    def setv(k, v):
        if k in b.inputs:
            b.inputs[k].default_value = v
    setv("Base Color", (*color, 1) if len(color) == 3 else color)
    setv("Roughness", roughness)
    setv("Metallic", metallic)
    setv("Subsurface Weight", sss)
    setv("Subsurface Radius", sss_radius)
    setv("Subsurface Scale", sss_scale)
    setv("Coat Weight", coat)
    setv("Coat Roughness", coat_rough)
    setv("Sheen Weight", sheen)
    setv("Sheen Tint", (*sheen_tint, 1))
    setv("Transmission Weight", transmission)
    setv("IOR", ior)
    setv("Specular IOR Level", spec)
    return m


def hex_rgb(h: str):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def add_noise_color(mat, colors: list[str], scale=6.0, detail=6.0, attr="Base Color", by="noise", ramp_pos: Iterable[float] | None = None,
                    bump=0.0, bump_scale=30.0, z_range=None):
    """Base Color = ColorRamp(ruido o altura Z) — como un shader de Blender hecho a mano."""
    nt = mat.node_tree
    b = nt.nodes["Principled BSDF"]
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    pos = list(ramp_pos) if ramp_pos else [i / (len(colors) - 1) for i in range(len(colors))]
    while len(els) < len(colors):
        els.new(0.5)
    for e, c, p in zip(els, colors, pos):
        e.position = p
        e.color = (*hex_rgb(c), 1)
    if by == "z":
        geo = nt.nodes.new("ShaderNodeTexCoord")  # Generated = caja del objeto normalizada [0,1]
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = z_range or (0, 1)
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = scale
        noise.inputs["Detail"].default_value = detail
        mix = nt.nodes.new("ShaderNodeMath")
        mix.operation = "MULTIPLY_ADD"
        nt.links.new(geo.outputs["Generated"], sep.inputs[0])
        nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
        nt.links.new(noise.outputs["Fac"], mix.inputs[0])
        mix.inputs[1].default_value = 0.18
        nt.links.new(mr.outputs["Result"], mix.inputs[2])
        nt.links.new(mix.outputs[0], ramp.inputs["Fac"])
    else:
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = scale
        noise.inputs["Detail"].default_value = detail
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs[attr])
    if bump > 0:
        bn = nt.nodes.new("ShaderNodeBump")
        bn.inputs["Strength"].default_value = bump
        bnoise = nt.nodes.new("ShaderNodeTexNoise")
        bnoise.inputs["Scale"].default_value = bump_scale
        bnoise.inputs["Detail"].default_value = 8
        nt.links.new(bnoise.outputs["Fac"], bn.inputs["Height"])
        nt.links.new(bn.outputs["Normal"], b.inputs["Normal"])
    return mat


def voronoi_bump(mat, strength=0.4, scale=40.0, ridged=True):
    """Relieve de costra: Voronoi (distancia a borde) + ruido fino → Bump."""
    nt = mat.node_tree
    b = nt.nodes["Principled BSDF"]
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "DISTANCE_TO_EDGE" if ridged else "F1"
    vor.inputs["Scale"].default_value = scale
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale * 3
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = 0.35
    nt.links.new(noise.outputs["Fac"], add.inputs[0])
    nt.links.new(vor.outputs["Distance"], add.inputs[2])
    bn = nt.nodes.new("ShaderNodeBump")
    bn.inputs["Strength"].default_value = strength
    nt.links.new(add.outputs[0], bn.inputs["Height"])
    nt.links.new(bn.outputs["Normal"], b.inputs["Normal"])
    return mat


# ------------------------------------------------------------------ geometría
def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def smooth(obj, subsurf=2, auto=True):
    for p in obj.data.polygons:
        p.use_smooth = True
    if subsurf:
        m = obj.modifiers.new("Subsurf", "SUBSURF")
        m.levels = m.render_levels = subsurf
    return obj


def displace(obj, kind="CLOUDS", strength=0.05, size=0.25, mid=0.5, seed=0):
    tex = bpy.data.textures.new(f"{obj.name}-{kind}", kind)
    if hasattr(tex, "noise_scale"):
        tex.noise_scale = size
    if kind == "VORONOI":
        tex.distance_metric = "DISTANCE"
    m = obj.modifiers.new("Displace", "DISPLACE")
    m.texture = tex
    m.strength = strength
    m.mid_level = mid
    m.texture_coords = "OBJECT"
    empty = bpy.data.objects.new(f"{obj.name}-texspace", None)
    bpy.context.scene.collection.objects.link(empty)
    empty.location = (seed * 1.7, seed * 2.3, seed * 0.9)
    m.texture_coords_object = empty
    return m


def deform_verts(obj, fn):
    me = obj.data
    for v in me.vertices:
        v.co = fn(v.co.copy())
    me.update()


def new_mesh_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def lathe(name, profile: list[tuple[float, float]], steps=96):
    """Screw/Spin de Blender: revoluciona un perfil (r, z) alrededor de Z."""
    bm = bmesh.new()
    rings = []
    for k in range(steps):
        a = 2 * math.pi * k / steps
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for k in range(steps):
        r0, r1 = rings[k], rings[(k + 1) % steps]
        for i in range(len(profile) - 1):
            try:
                bm.faces.new((r0[i], r1[i], r1[i + 1], r0[i + 1]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_mesh_obj(name, bm)


def scatter_on(obj, proto, count, where=lambda co, n: True, scale=(0.8, 1.2), seed=1, offset=0.0):
    """Distribute Points on Faces + Instance on Points (alineado a la normal), evaluado sobre la malla final."""
    rnd = random.Random(seed)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    polys = [p for p in me.polygons if where(obj.matrix_world @ p.center, p.normal)]
    areas = [p.area for p in polys]
    total = sum(areas)
    out = []
    for i in range(count):
        t, acc = rnd.random() * total, 0.0
        for p, a in zip(polys, areas):
            acc += a
            if acc >= t:
                break
        n = (obj.matrix_world.to_3x3() @ p.normal).normalized()
        c = obj.matrix_world @ p.center
        inst = proto.copy()
        bpy.context.scene.collection.objects.link(inst)
        inst.location = c + n * offset
        q = n.to_track_quat("Z", "Y")
        inst.rotation_euler = q.to_euler()
        inst.rotation_euler.rotate_axis("Z", rnd.random() * math.tau)
        s = rnd.uniform(*scale)
        inst.scale = (proto.scale.x * s, proto.scale.y * s, proto.scale.z * s)
        inst.parent = obj
        inst.matrix_parent_inverse = obj.matrix_world.inverted()
        out.append(inst)
    ev.to_mesh_clear()
    return out


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
