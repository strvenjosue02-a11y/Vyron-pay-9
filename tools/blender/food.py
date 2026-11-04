"""
Modelos de comida para Blender Studio, construidos con modificadores reales de Blender
(Subdivision, Displace, Bevel, Solidify) y materiales Principled con subsurface.
Unidades: 1 = 10 cm (una hamburguesa mide ~1.1 de radio).
"""
from __future__ import annotations

import math
import random

import bpy  # bpy primero: registra bmesh/mathutils
import bmesh
from mathutils import Vector

import studio as S

# ------------------------------------------------------------------ materiales compartidos
def mats():
    M = {}
    M["crust"] = S.add_noise_color(
        S.principled("crust", S.hex_rgb("#b86a26"), roughness=0.42, sss=0.12, sss_radius=(1, 0.6, 0.3), coat=0.35, coat_rough=0.25, sheen=0.15),
        ["#ecd3a2", "#d6a050", "#bb6c25", "#8e4512", "#6c300b"], by="z", z_range=(0.0, 1.0), ramp_pos=[0, 0.1, 0.3, 0.66, 1.0], scale=9, bump=0.08)
    M["bottom"] = S.add_noise_color(
        S.principled("bottom", S.hex_rgb("#c98a3d"), roughness=0.55, sss=0.15, sss_radius=(1, 0.6, 0.3)),
        ["#b8702a", "#cf9548", "#ebd0a0"], by="z", z_range=(0.0, 1.0), ramp_pos=[0, 0.55, 0.95], scale=9, bump=0.06)
    M["patty"] = S.voronoi_bump(S.add_noise_color(
        S.principled("patty", S.hex_rgb("#4a2414"), roughness=0.5, coat=0.3, coat_rough=0.3, sss=0.05),
        ["#1e0c05", "#3d1b0c", "#5a2c14", "#7a4222"], scale=14, detail=10), strength=0.55, scale=22)
    M["cheese"] = S.principled("cheese", S.hex_rgb("#f39a0c"), roughness=0.35, sss=0.3, sss_radius=(1, 0.4, 0.08), sss_scale=0.03, coat=0.15, coat_rough=0.2)
    M["lettuce"] = S.add_noise_color(
        S.principled("lettuce", S.hex_rgb("#3f8a1e"), roughness=0.4, sss=0.25, sss_radius=(0.4, 1, 0.2), sss_scale=0.02, coat=0.35, coat_rough=0.15),
        ["#245e10", "#3f8a1e", "#8cc450"], scale=5, bump=0.05)
    M["tomato"] = S.principled("tomato", S.hex_rgb("#c3200f"), roughness=0.2, sss=0.5, sss_radius=(1, 0.25, 0.15), sss_scale=0.06, coat=0.7, coat_rough=0.05)
    M["tomato_flesh"] = S.add_noise_color(
        S.principled("tomato_flesh", S.hex_rgb("#e0391f"), roughness=0.25, sss=0.6, sss_radius=(1, 0.3, 0.2), sss_scale=0.06, coat=0.6, coat_rough=0.05),
        ["#d9301b", "#ef5a35", "#f4a25a"], scale=18)
    M["onion"] = S.principled("onion", S.hex_rgb("#efdcee"), roughness=0.25, sss=0.6, sss_radius=(1, 0.8, 1), transmission=0.15, coat=0.5)
    M["pickle"] = S.add_noise_color(S.principled("pickle", S.hex_rgb("#7d8f2c"), roughness=0.3, sss=0.4, coat=0.6), ["#4c5e14", "#8a9a3a", "#c2c77a"], scale=7)
    M["sesame"] = S.principled("sesame", S.hex_rgb("#f2e3bd"), roughness=0.45, sss=0.3)
    M["bacon"] = S.add_noise_color(S.principled("bacon", S.hex_rgb("#8a2c1a"), roughness=0.35, coat=0.45, sss=0.2),
                                   ["#5c180c", "#9a3420", "#d7896a", "#efc2a3"], scale=3.5, ramp_pos=[0, 0.4, 0.62, 1])
    M["sauce"] = S.principled("sauce", S.hex_rgb("#f0c77a"), roughness=0.15, sss=0.4, coat=0.8, coat_rough=0.05)
    M["fried"] = S.voronoi_bump(S.add_noise_color(
        S.principled("fried", S.hex_rgb("#c27a2e"), roughness=0.5, sss=0.25, sss_radius=(1, 0.6, 0.3), coat=0.15),
        ["#6a320e", "#a85e1f", "#d69a48", "#efc47c"], scale=16), strength=0.8, scale=18)
    M["avocado"] = S.principled("avocado", S.hex_rgb("#a8c25a"), roughness=0.35, sss=0.4, coat=0.3)
    M["veggie"] = S.voronoi_bump(S.add_noise_color(S.principled("veggie", S.hex_rgb("#7a3b2a"), roughness=0.55, coat=0.15),
                                                   ["#4a2216", "#7d3c2a", "#9a5a3a"], scale=12), strength=0.45, scale=26)
    return M


# ------------------------------------------------------------------ piezas
def top_bun(M, seeds=True, seed=0):
    prof = [(0, 0), (0.95, 0), (1.14, 0.04), (1.2, 0.16), (1.13, 0.38), (0.94, 0.62), (0.62, 0.82), (0.3, 0.92), (0, 0.94)]
    o = S.lathe("TopBun", prof, steps=96)
    S.smooth(o, 2)
    S.displace(o, "CLOUDS", strength=0.035, size=0.35, seed=seed)
    S.assign(o, M["crust"])
    if seeds:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.03)
        proto = bpy.context.active_object
        proto.scale = (1, 2.1, 0.42)
        S.assign(proto, M["sesame"])
        S.scatter_on(o, proto, 110, where=lambda c, n: n.z > 0.45, scale=(0.85, 1.15), seed=seed + 3, offset=0.004)
        bpy.data.objects.remove(proto)
    return o


def bottom_bun(M, seed=0):
    prof = [(0, 0), (0.9, 0), (1.1, 0.05), (1.17, 0.18), (1.12, 0.31), (1.0, 0.38), (0.5, 0.39), (0, 0.39)]
    o = S.lathe("BottomBun", prof, steps=96)
    S.smooth(o, 2)
    S.displace(o, "CLOUDS", strength=0.025, size=0.3, seed=seed + 1)
    return S.assign(o, M["bottom"])


def patty(M, mat="patty", r=1.16, h=0.3, seed=0, crisp=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=r, depth=h, location=(0, 0, h / 2))
    o = bpy.context.active_object
    o.name = "Patty"
    bev = o.modifiers.new("Bevel", "BEVEL")
    bev.width, bev.segments = 0.08, 4
    S.smooth(o, 2)
    S.displace(o, "VORONOI" if crisp else "CLOUDS", strength=0.09 if crisp else 0.07, size=0.18 if crisp else 0.22, seed=seed + 7)
    return S.assign(o, M[mat])


def cheese(M, size=2.1, seed=0):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=60, y_subdivisions=60, size=size)
    o = bpy.context.active_object
    o.name = "Cheese"
    o.rotation_euler.z = math.radians(45 + seed * 7)
    def melt(co):
        d = math.hypot(co.x, co.y)
        sag = (d - 1.0) ** 1.3 * 1.25 if d > 1.0 else 0
        pull = 1 - max(0, d - 1.0) * 0.3
        return Vector((co.x * pull, co.y * pull, -sag))
    S.deform_verts(o, melt)
    so = o.modifiers.new("Solidify", "SOLIDIFY")
    so.thickness = 0.035
    S.smooth(o, 1)
    return S.assign(o, M["cheese"])


def lettuce(M, r=1.3, seed=0, rings=14, segs=180):
    """Hoja como malla polar (anillos × segmentos): rápido y con volantes limpios."""
    bm = bmesh.new()
    center = bm.verts.new((0, 0, 0))
    grid = [[bm.verts.new((r * (k + 1) / rings * math.cos(2 * math.pi * j / segs), r * (k + 1) / rings * math.sin(2 * math.pi * j / segs), 0))
             for j in range(segs)] for k in range(rings)]
    for j in range(segs):
        bm.faces.new((center, grid[0][j], grid[0][(j + 1) % segs]))
    for k in range(rings - 1):
        for j in range(segs):
            bm.faces.new((grid[k][j], grid[k + 1][j], grid[k + 1][(j + 1) % segs], grid[k][(j + 1) % segs]))
    o = S.new_mesh_obj("Lettuce", bm)
    def ruffle(co):
        d = math.hypot(co.x, co.y) / r
        a = math.atan2(co.y, co.x)
        z = (math.sin(a * 13 + seed) * 0.6 + math.sin(a * 29 + 1.3) * 0.4) * 0.09 * d * d - d * d * 0.08
        return Vector((co.x, co.y, z))
    S.deform_verts(o, ruffle)
    so = o.modifiers.new("Solidify", "SOLIDIFY")
    so.thickness = 0.012
    S.smooth(o, 1)
    return S.assign(o, M["lettuce"])


def tomato_slices(M, n=3, seed=0):
    out = []
    for i in range(n):
        a = i / n * math.tau + seed
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.5, depth=0.09, location=(math.cos(a) * 0.45, math.sin(a) * 0.45, 0.045))
        o = bpy.context.active_object
        bev = o.modifiers.new("Bevel", "BEVEL")
        bev.width, bev.segments = 0.02, 3
        S.smooth(o, 1)
        o.data.materials.append(M["tomato"])
        o.data.materials.append(M["tomato_flesh"])
        for p in o.data.polygons:
            p.material_index = 1 if abs(p.normal.z) > 0.9 else 0
        out.append(o)
    return out


def onion_rings(M, n=3):
    out = []
    for i, (x, y, s) in enumerate([(0.35, 0.2, 1), (-0.4, 0.3, 0.82), (0.05, -0.45, 0.66)][:n]):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.42 * s, minor_radius=0.035, major_segments=64, minor_segments=12, location=(x, y, 0.035))
        o = bpy.context.active_object
        o.scale.z = 0.6
        S.smooth(o, 0)
        out.append(S.assign(o, M["onion"]))
    return out


def pickles(M, n=3):
    out = []
    for x, y in [(0.55, -0.2), (-0.5, -0.35), (-0.1, 0.55)][:n]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.27, depth=0.045, location=(x, y, 0.025))
        o = bpy.context.active_object
        bev = o.modifiers.new("Bevel", "BEVEL")
        bev.width, bev.segments = 0.012, 2
        S.smooth(o, 1)
        out.append(S.assign(o, M["pickle"]))
    return out


def bacon(M, n=2, seed=0):
    out = []
    for i in range(n):
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=80, y_subdivisions=6, size=1)
        o = bpy.context.active_object
        o.scale = (2.3, 0.42, 1)
        bpy.ops.object.transform_apply(scale=True)
        rnd = random.Random(seed + i)
        ph = rnd.random() * 6
        S.deform_verts(o, lambda co: Vector((co.x, co.y, math.sin(co.x * 6 + ph) * 0.07 + math.sin(co.x * 13) * 0.015)))
        so = o.modifiers.new("Solidify", "SOLIDIFY")
        so.thickness = 0.03
        S.smooth(o, 1)
        o.rotation_euler.z = (i - 0.5) * 0.9
        o.location.z = 0.05
        out.append(S.assign(o, M["bacon"]))
    return out


def sauce_blob(M, r=0.95):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=r, depth=0.04, location=(0, 0, 0.02))
    o = bpy.context.active_object
    S.smooth(o, 2)
    S.displace(o, "CLOUDS", strength=0.05, size=0.3)
    return S.assign(o, M["sauce"])


def avocado(M):
    out = []
    for i in range(4):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(0, 0, 0))
        o = bpy.context.active_object
        o.scale = (0.9, 0.36, 0.07)
        o.rotation_euler.z = i * 0.8
        o.location = (math.cos(i * 1.6) * 0.35, math.sin(i * 1.6) * 0.35, 0.035)
        S.smooth(o, 1)
        out.append(S.assign(o, M["avocado"]))
    return out


def group(name, parts):
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        p.parent = root
    return root


# ------------------------------------------------------------------ recetas
BURGERS = {
    # nombre: lista de capas de abajo arriba
    "clasica": ["bottom", "patty", "cheese", "onion", "pickles", "tomato", "lettuce", "top"],
    "smash-doble": ["bottom", "sauce", "patty", "cheese", "patty", "cheese", "onion", "pickles", "top"],
    "bbq-bacon": ["bottom", "patty", "cheese", "bacon", "onion", "sauce", "top"],
    "crispy-chicken": ["bottom", "sauce", "fried", "lettuce", "tomato", "top"],
    "garden": ["bottom", "lettuce", "veggie", "avocado", "tomato", "onion", "top"],
}

HEIGHTS = {"bottom": 0.39, "patty": 0.3, "fried": 0.36, "veggie": 0.3, "cheese": 0.04, "onion": 0.05, "pickles": 0.05,
           "tomato": 0.09, "lettuce": 0.07, "top": 0.94, "sauce": 0.04, "bacon": 0.09, "avocado": 0.07}


def build_burger(recipe: list[str], M, seed=0):
    """Devuelve [(objetos de la capa, altura base)] para poder animar el despiece."""
    layers, z = [], 0.0
    for i, kind in enumerate(recipe):
        s = seed * 31 + i
        if kind == "bottom": objs = [bottom_bun(M, s)]
        elif kind == "top": objs = [top_bun(M, seed=s)]
        elif kind in ("patty", "veggie"): objs = [patty(M, kind, seed=s)]
        elif kind == "fried": objs = [patty(M, "fried", r=1.22, h=0.36, seed=s, crisp=True)]
        elif kind == "cheese": objs = [cheese(M, seed=s)]
        elif kind == "lettuce": objs = [lettuce(M, seed=s)]
        elif kind == "tomato": objs = tomato_slices(M, seed=s)
        elif kind == "onion": objs = onion_rings(M)
        elif kind == "pickles": objs = pickles(M)
        elif kind == "bacon": objs = bacon(M, seed=s)
        elif kind == "sauce": objs = [sauce_blob(M)]
        elif kind == "avocado": objs = avocado(M)
        else: raise ValueError(kind)
        g = group(f"L{i}-{kind}", objs)
        g.location.z = z
        layers.append((g, z, kind))
        z += HEIGHTS[kind]
    return layers, z
