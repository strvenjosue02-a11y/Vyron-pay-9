# Fuentes de assets sin API key

Fuente: `.claude/memory/research/fuentes-assets.md` y `juegos.md` (3d-researcher, 2026-11-04,
URLs raw probadas con `curl -I` → 200 salvo nota). **Ningún asset se ha cargado aún en una escena de
este repo** → probar carga + licencia antes de publicar. Red aquí: solo GitHub y npm.

Descarga: `curl -L -o public/models/x.glb https://raw.githubusercontent.com/<owner>/<repo>/<rama>/<ruta>`
→ optimizar (meshopt). Explorar repos grandes: `git clone --depth 1 --filter=blob:none --no-checkout` +
`git ls-tree -r --name-only HEAD` (nunca `ls-tree -l`: tarda minutos).

| Fuente | Licencia | Estilo | Ruta |
|---|---|---|---|
| KhronosGroup/glTF-Sample-Assets | por modelo (`metadata.json`) | PBR realista | `Models/<X>/glTF-Binary/<X>.glb` |
| pmndrs/market-assets | 308 CC0 (`license:1`) + 2 CC-BY | low-poly Kenney | `files/models/<nombre>/model.gltf` |
| trebeljahr/quaternius-showcase | CC0 | low-poly, ~1545 GLB | `public/glb/<pack>/<X>.glb` |
| KayKit-Game-Assets/* | CC0 | estilizado + rigs | por repo (no probado archivo a archivo) |
| NoLimitNexus/game-models | CC0 (KayKit) | 132 animaciones | `library/animations/Rig_Medium_*.glb` (no probado) |
| `@pmndrs/assets` (npm, ya en package.json) | CC0 | HDRI EXR, matcaps, normals | `hdri/<x>.exr`, `normals/00xx.webp` |
| pmndrs/drei-assets | CC0 | HDRI 1k (1,6 MB) | `hdri/*_1k.hdr` |
| mrdoob/three.js (rama `dev`) | mixta | demos | `examples/models`, `examples/textures` |
| `@webxr-input-profiles/assets` (npm) | MIT | manos rigged | `dist/profiles/generic-hand/{left,right}.glb` |

## Por categoría
- **Comida realista**: Khronos `Avocado` (CC0, 8,1 MB → recomprimir), `BarramundiFish` (CC0),
  `IridescentDishWithOlives` (CC-BY-4.0), `MandarinOrange` (CC-BY-4.0, solo glTF), `PotOfCoals` (CC-BY-4.0).
- **Comida low-poly** (Kenney CC0): `burger`, `burger-cheese`, `fries`, `hot-dog`, `meat-patty`,
  `tomato-slice`, `pizza`, `sushi-*`, `donut*`, frutas, `plate*`… No hay pollo frito → procedural.
- **Muebles**: Khronos `SheenChair` (CC0), `ClearcoatWicker` (CC0), `GlamVelvetSofa`,
  `SheenWoodLeatherSofa`, `ChairDamaskPurplegold`, `SpecularSilkPouf` (CC-BY-4.0); Quaternius
  `house_interior_pack/` (`Bed_King`, `Couch_L`, `Chair_1..4`…).
- **Edificios**: Quaternius `buildings_pack_2/3`, `street_pack`, `medieval_village_pack`,
  `cyberpunk_pack`; KayKit `City-Builder-Bits-1.0`; Kenney `house1`, `tower`, `barn`.
- **Humanos / cuerpo**: manos WebXR (MIT); `LeePerrySmith.glb` en three.js (CC-BY-3.0, cabeza para
  SSS); Quaternius `modular_men/`, `modular_women/` (CC0, rigged); KayKit Adventurers (CC0).
  Humano realista a medida: MPFB2 en Blender (no disponible aquí).
- **Animales**: Khronos `Fox` (CC0 + CC-BY-4.0, 3 clips); Quaternius `animals_pack/` (CC0,
  animados; `Fox.glb` 590 KB probado), `dinosaurs_pack/`, `fish_pack/`; Kenney `bunny`, `fish`.
- **HDRI/texturas**: `@pmndrs/assets/hdri/{studio,city,warehouse,sunset,…}.exr`; three.js
  `examples/textures/equirectangular/monochrome_studio_02_1k.hdr` (estudio, ideal producto);
  `hardwood2_*`, `brick_*`.

## No usar en producción
Khronos `Sponza` (CRYENGINE), `VirtualCity` (3DRT), `BrainStem` (Poser EULA); Mixamo
(`Soldier/Xbot/Michelle`); licencias no documentadas de three.js (`Horse`, `Flamingo`,
`LittlestTokyo`: no verificadas). Bloqueados aquí y CDN externos: polyhaven, ambientcg, sketchfab,
kenney.nl, quaternius.com, raw.githack.com, gstatic.com. Atribuye siempre los CC-BY.
