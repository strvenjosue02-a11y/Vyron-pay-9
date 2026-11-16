# Render de una imagen desde un .blend: blender -b X.blend -P render_still.py -- OUT.png RES SAMPLES [transparent]
import bpy, sys
a = sys.argv[sys.argv.index("--") + 1:]
s = bpy.context.scene; r = s.render
r.resolution_x = r.resolution_y = int(a[1]); r.resolution_percentage = 100; s.cycles.samples = int(a[2])
if len(a) > 3 and a[3] == "transparent":
    r.film_transparent = True; r.image_settings.color_mode = "RGBA"
    for o in s.objects:
        if o.type == "MESH" and o.name.startswith("Plane"): o.is_shadow_catcher = True
r.filepath = a[0]; bpy.ops.render.render(write_still=True)
