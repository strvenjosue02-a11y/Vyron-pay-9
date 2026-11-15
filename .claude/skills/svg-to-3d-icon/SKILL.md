---
name: svg-to-3d-icon
description: Turns a flat SVG logo or icon into a studio-lit 3D icon (extruded plate with rounded edges, raised glyph, glossy/matte/chrome materials, soft contact shadow) rendered with Blender Cycles to transparent PNGs (hero 3/4, front, isometric), plus a review sheet, GLB, .blend and an optional turntable MP4. Use when the user wants an icon or logo made 3D or volumetric ("3D-иконка", "объёмная/трёхмерная иконка", "сделай лого в 3D"), a 3D app icon, an isometric icon, a 3D render or mockup of an SVG logo, or a spinning logo video.
compatibility: Requires Blender 4.2+ (Cycles, uses the GPU when present) and Python 3.8+. ffmpeg only for --turntable.
metadata:
  version: "1.0"
---

# SVG → 3D icon

Everything runs through one script, `scripts/svg3d.py`. Start it with plain `python3`: it finds Blender
(`--blender`, `$BLENDER`, `PATH`, standard installs), re-launches itself inside Blender, prints a JSON
summary to stdout and progress to stderr. Blender's own log goes to `<out>/blender.log`.

## Workflow

- [ ] 1. Check the SVG
- [ ] 2. Preview render
- [ ] 3. Review the sheet, tune, re-preview
- [ ] 4. Final render
- [ ] 5. Verify and report

### 1. Check the SVG

Read the file. The Blender importer only understands **filled shapes**. It drops strokes, `<text>`,
gradients, masks/clip-paths, opacity and raster images (the script lists what it found under `warnings`).
If the art depends on any of these, ask for an outlined version: Figma → *Outline stroke* + *Flatten*,
Illustrator → *Object → Expand*, Inkscape → *Path → Stroke to Path*.

How shapes become 3D:
- The **first** shape, if it covers ≥ 70 % of the art's bounding box, becomes the **plate**: a slab with round edges.
- Every other shape becomes a **raised layer** on the plate, stacked in document order (later = on top).
- With no plate, every shape becomes a free-standing extrusion. `--add-plate "#HEX"` generates an
  app-icon plate behind the art. `--no-plate` stops a big first shape from being treated as a plate.

### 2. Preview

```bash
python3 scripts/svg3d.py path/to/icon.svg --preview
```

This renders 768 px at 48 samples, takes about 20 s on an Apple-silicon GPU and skips the exports. Output goes to
`<svg dir>/<svg name>-3d/` unless you pass `-o DIR`.

### 3. Review and tune

Look at `<name>_sheet.png`: views in columns, light background on top, dark background below. Check:
- The silhouette matches the SVG. A missing part means the importer dropped it (see step 1).
- Raised edges are clean. A layer that looks blobby or has lost its corners has a bevel too big for its strokes, so lower `--layer-bevel`.
- `color_check` in the JSON: `brightness_ratio` should be 0.8–1.25 and `clipped_share` low. If not, a
  warning suggests an `--exposure` value.
- The shadow isn't cropped and the icon doesn't touch the frame.

| Flag | Default | Effect |
|---|---|---|
| `--depth` | 0.18 | plate thickness (fraction of icon width); 0.25+ reads chunky/toy, 0.10 slim/premium |
| `--relief` | 0.06 | height of raised layers; 0.03 embossed, 0.10 bold |
| `--bevel` | 0.035 | plate edge radius; 0.06+ soft pillow edge |
| `--layer-bevel` | 0.012 | raised-layer edge radius (sharp corners soften by this much); lower it for thin lines |
| `--preset` | glossy | `glossy` lacquered plastic · `matte` soft-touch · `chrome` metal layers on a glossy plate |
| `--colors` | from SVG | override fills in SVG order: `"#C6E800,#111111"`, `-` keeps one |
| `--views` | hero,front,iso | any of `hero` (3/4, turned), `front`, `iso` (true isometric, art on a 45° diamond) |
| `--no-shadow` | off | drop the contact shadow; tighter framing |
| `--bg` | none | also write `<view>_bg.png` on this color; also sets the turntable background |

For a look the flags can't reach (other lighting, camera angles, glass, clay, per-view tweaks), read
[references/look-tuning.md](references/look-tuning.md).

### 4. Final

```bash
python3 scripts/svg3d.py path/to/icon.svg [tuning flags]
python3 scripts/svg3d.py path/to/icon.svg [tuning flags] --turntable 96   # + 3.2 s looping video
```

Final = 2048 px at 256 samples. On an Apple M4 (10-core GPU) that's about 3 min per view, plus about 1 min on the first
render for Metal kernel compilation. The turntable renders 1080 px frames at 64 samples, 10–18 s per frame (about 13 s
on average), so 96 frames take roughly 20 min. `--turntable 48` halves that but plays for only 1.6 s. Always run the final in the background.
On a CPU-only machine renders are 5–10× slower: use `--size 1024 --samples 96`.

### 5. Verify and report

Look at the final PNGs yourself before reporting, and apply the same review checks as in step 3. Then report:

```markdown
**3D icon ready** (`<out dir>`)
- `<name>_hero.png`, `_front.png`, `_iso.png`: 2048 px, transparent, soft shadow
- `<name>_sheet.png`: all views on light and dark, for a quick review
- `<name>.glb`: for web, Spline, Figma 3D plugins · `<name>.blend`: open to tweak in Blender
- `<name>_turntable.mp4` (if rendered)
Look: <preset>, depth/relief values, color check result. Re-render: `<exact command>`
```

## Gotchas

- **Brand color depends on exposure.** The light rig is calibrated so a face turned toward the camera renders at
  exactly the SVG fill color (Standard view transform). If you add or strengthen lights, or switch to AgX/Filmic,
  saturated colors shift. At 2.4× too much light, lime #C6E800 clipped to plain yellow. Trust `color_check`.
- **The floor must stay invisible to reflections.** The shadow catcher has `visible_glossy = False`. Without that,
  every glossy face mirrors the lit floor: black glyphs turn grey and colors get a white haze.
- Only the Key and Top lights cast shadows. A shadow-casting fill or rim light low to the horizon smears long streaks across the floor.
- **Isometric turns the art 45°.** It's a true isometric top face, so a letter reads diagonally. If the user
  needs the glyph upright, use `hero` or `front`.
- **Pure black layers get their shape only from reflections.** Under `--preset matte` they look flat, so lift
  them to about `#1A1A1A` with `--colors`.
- If you edit the script, keep the rounding on the mesh. The curve's own bevel (`bevel_depth` with a negative `offset`
  to preserve the silhouette) folds into a visible lip at acute corners. The script instead extrudes the curve, welds
  it into a mesh and rounds the edges with a clamped Bevel modifier.
- Also when editing: `Curve.transform()` scales each point's radius too. The script resets radii to 1.0 after every
  transform, and any new transform code must do the same.
- Also when editing: every render must set its own exposure. Views carry `ev` trims (iso is −1 EV), and a render
  that doesn't set exposure inherits the last one. That is how the turntable once came out a stop dark.
  `turntable_color_check` in the JSON guards against this.
- `.blend` opens posed for the first view. Thickness is baked into the meshes, while the bevels stay live as modifiers.
  To change depth or relief, re-run the script. Re-running into the same folder overwrites files with the same name.
