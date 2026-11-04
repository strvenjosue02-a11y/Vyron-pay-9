# Fuentes de assets 3D sin API key (accesibles desde GitHub/npm)

(2026-11-04, 3d-researcher). Todas las URLs `raw.githubusercontent.com` de esta nota se probaron con `curl -I` → HTTP 200 y binario real (no puntero LFS) salvo que se indique.
Patrón de descarga recomendado (no ejecuta nada): `curl -L -o public/models/x.glb https://raw.githubusercontent.com/<owner>/<repo>/<rama>/<ruta>` y luego optimizar (ver `rendimiento-movil.md`).
Para explorar un repo grande sin bajarlo: `git clone --depth 1 --filter=blob:none --no-checkout <url>` + `git ls-tree -r --name-only HEAD`. **No** usar `git ls-tree -l` (pide cada blob y tarda minutos).

## Resumen por calidad

| Fuente | Licencia | Estilo | Acceso aquí |
|---|---|---|---|
| KhronosGroup/glTF-Sample-Assets | por modelo (CC0 / CC-BY-4.0 / otras) | PBR realista, extensiones KHR | raw GitHub OK |
| mrdoob/three.js `examples/models`, `examples/textures` | por modelo (mixta) | realista + demos | raw GitHub OK (rama `dev`) |
| `@pmndrs/assets` (npm) | CC0-1.0 | HDRIs EXR, matcaps, normal maps, 3 modelos | npm OK, autohospedado |
| pmndrs/drei-assets | CC0 (HDRIs de Poly Haven 1k) | 12 HDRIs .hdr, LUTs, basis transcoder | raw GitHub OK |
| pmndrs/market-assets | 308 CC0 + 2 CC-BY | low-poly (Kenney), algunos PBR | raw GitHub OK |
| trebeljahr/quaternius-showcase | CC0 (modelos), MIT (código) | low-poly Quaternius, ~1545 GLB | raw GitHub OK |
| KayKit-Game-Assets/* | CC0 | low-poly estilizado, rigs + animaciones | raw GitHub OK (no probado archivo a archivo) |
| NoLimitNexus/game-models | animaciones KayKit CC0 | 132 clips en `Rig_Medium` | raw GitHub (no probado) |
| `@webxr-input-profiles/assets` (npm) | MIT (Amazon) | manos genéricas rigged | npm OK |
| makehumancommunity/mpfb2, makehuman | código GPL; assets CC0 según el proyecto (no verificado en repo) | humanos realistas, requiere Blender | clone OK, pero exportar GLB requiere Blender local |

Bloqueados aquí (y CDN externo en producción, evitar dependencias en runtime): polyhaven.com, ambientcg.com, sketchfab, kenney.nl, quaternius.com, raw.githack.com (presets de drei `<Environment preset>`), gstatic.com (decoder Draco por defecto de `useGLTF`).

## Comida
- **Khronos** (`Models/<X>/glTF-Binary/<X>.glb`):
  - `Avocado` — CC0 (Microsoft). 8,1 MB por texturas grandes → recomprimir. Escaneo realista.
  - `BarramundiFish` — CC0 (Microsoft). Pescado realista.
  - `IridescentDishWithOlives` — CC-BY-4.0 (Eric Chadwick). "Plato elegante" con aceitunas, usa iridiscencia/transmisión.
  - `MandarinOrange` — CC-BY-4.0 (zamdreamer, Eric Chadwick); solo `glTF/` (no .glb).
  - `PotOfCoals` — CC-BY-4.0. Brasas emisivas.
- **pmndrs/market-assets** (`files/models/<nombre>/model.gltf`, Kenney Food Kit, CC0, low-poly ~10 KB): `burger`, `burger-cheese`, `burger-double`, `burger-cheese-double`, `fries`, `fries-empty`, `hot-dog`, `meat-patty`, `meat-cooked`, `meat-raw`, `meat-ribs`, `bacon`, `bread`, `loaf`, `loaf-baguette`, `croissant`, `cheese`, `cheese-cut`, `tomato`, `tomato-slice`, `onion`, `onion-half`, `salad`, `sandwich`, `pizza`, `taco`, `sushi-*`, `maki-*`, `donut*`, `cake*`, `apple`, `banana`, `pear`, `strawberry`, `watermelon`, `pineapple`, `lemon`, `grapes`, `cherries`, `whole-ham`, `turkey`, `plate*`, `glass-wine`, `wine-red`, `utensil-*`. Licencia: `info.json` `"license": 1` = CC0 según `pmndrs/market/src/helpers/constants/licenses.js`. Ej.: `https://raw.githubusercontent.com/pmndrs/market-assets/main/files/models/burger/model.gltf` (11 KB). **No hay pollo frito** en ninguna fuente encontrada → procedural (`comida-procedural.md`).
- **Quaternius** `public/glb/crops_pack/*.glb` (frutas/verduras low-poly CC0).
- three.js `examples/models/spz/tomatoes.spz` — Gaussian splat de tomates, CC-BY-4.0 (Grail). Requiere loader de splats, no glTF.

## Mobiliario
- **Khronos (PBR de alta calidad, ideal para realismo)**: `SheenChair` (CC0, 4,1 MB), `ClearcoatWicker` (CC0), `GlamVelvetSofa` (CC-BY-4.0), `SheenWoodLeatherSofa` (CC-BY-4.0 + CC0), `ChairDamaskPurplegold` (CC-BY-4.0), `SpecularSilkPouf` (CC-BY-4.0), `CommercialRefrigerator` (CC-BY-4.0), `GlassVaseFlowers`, `AnisotropyBarnLamp`, `LightsPunctualLamp`.
- **Quaternius house_interior_pack** (CC0, 123 GLB): `Bed_King.glb`, `Bed_Single.glb`, `Bed_Bunk.glb`, `Couch_L.glb`, `Couch_Large1..3.glb`, `Couch_Medium1.glb`, `Chair_1..4.glb`, `Carpet_*.glb` en `trebeljahr/quaternius-showcase/main/public/glb/house_interior_pack/`.
- **pmndrs/market-assets**: `bed` (CC0, saravieira), `table`, `bench`, `pillow`; `_files/too-big/sofa`, `_files/too-big/office-chair` (gltf grandes).
- three.js: `examples/models/gltf/SheenChair.glb`, `coffeeMug.glb`, `bath_day.glb` (licencias no documentadas en el repo → **no verificado**).

## Edificios / arquitectura
- Quaternius `buildings_pack_2/` (`Building1_Large.glb`, `House1.glb`…), `buildings_pack_3/`, `street_pack/`, `medieval_village_pack/`, `modular_medieval_buildings_pack/`, `cyberpunk_pack/` — CC0.
- KayKit `KayKit-City-Builder-Bits-1.0` (CC0, 41 GLB), `KayKit-Medieval-Hexagon-Pack-1.0`, `KayKit-Dungeon-Remastered-1.0`.
- pmndrs market: `house1`, `house-3..7`, `house-18`, `tower`, `barn`, `library-large`, `bridge-01` (Kenney, CC0).
- Khronos `Sponza` (licencia CRYENGINE, no CC) y `VirtualCity` (3DRT testing) → **no usar en producción**.
- three.js `LittlestTokyo.glb` (animado; licencia CC-BY de Glen Fox según demos de three.js — **no verificado** en el repo).
- `ToxSam/open-source-3D-assets`: registro JSON (`data/projects.json`) de ~991 GLB CC0 de Polygonal Mind (parques, museos, mansiones); los enlaces apuntan a hosts externos → **no probados**.

## Humanos y partes del cuerpo
- **Manos**: `@webxr-input-profiles/assets@1.0.20` (MIT) → `dist/profiles/generic-hand/left.glb`, `right.glb` (rigged, 25 joints WebXR). `npm pack` y copiar a `public/`.
- **Cabeza realista**: three.js `examples/models/gltf/LeePerrySmith/LeePerrySmith.glb` (CC-BY-3.0, Lee Perry-Smith / Infinite Realities) — clásico para SSS de piel; mapas en la misma carpeta.
- Bustos: three.js `tennyson-bust.glb`, `Nefertiti/Nefertiti.glb` (ver su README).
- Humanos rigged: Khronos `RiggedFigure` / `CesiumMan` (CC-BY-4.0, baja calidad); `BrainStem` (EULA Poser → evitar).
- Quaternius `modular_men/*.glb` y `modular_women/*.glb` (CC0, 21 personajes low-poly rigged con animaciones).
- KayKit `KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf/{Knight,Barbarian,Mage,Rogue,Rogue_Hooded}.glb` (CC0).
- Mixamo (`Soldier.glb`, `Xbot.glb`, `Michelle.glb` en three.js): términos de Adobe, requieren cuenta; no redistribuir sueltos → usar solo como prueba.
- Humano realista a medida: **MPFB2** (makehumancommunity/mpfb2, Blender) o `kblood/CharacterCreator` (GPL, MPFB→GLB). Requiere Blender local, no aquí.
- `makehuman-js/makehuman-js` (329★, navegador) — sin licencia declarada, sin GLB en el repo → **no recomendado**.

## Animales
- Khronos `Fox` (CC0 modelo PixelMannen + CC-BY-4.0 rig/anim tomkranis): 3 clips (Survey, Walk, Run).
- three.js `Horse.glb`, `Flamingo.glb`, `Parrot.glb`, `Stork.glb` (morph targets, proyecto ro.me; licencia no documentada → **no verificado**).
- Quaternius `animals_pack/` (CC0, animados): `Alpaca, Bull, Cow, Deer, Donkey, Fox, Horse, Horse_White, Husky, ShibaInu, Stag, Wolf`. Ej.: `https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/animals_pack/Fox.glb` (590 KB, probado). También `dinosaurs_pack/`, `fish_pack/`, `cute_fish_pack/`.
- pmndrs market: `bunny`, `dogue`, `low-poly-horse`, `fish`, `dragon`.
- `@pmndrs/assets/models/bunny.glb` (Stanford bunny).

## HDRIs y texturas (iluminación)
- **`@pmndrs/assets@1.7.0` (CC0)** — EXR en base64 como módulo JS, 130–420 KB: `hdri/{apartment,bridge,city,dawn,esplanade,forest,hall,lab,lobby,night,park,sky,studio,sunrise,sunset,venice,warehouse,workshop}.exr`. Uso: `<Environment files={suspend(import('@pmndrs/assets/hdri/studio.exr')).default} />`. drei detecta `data:application/exr` (verificado en `useEnvironment.js:getExtension`). **Mejor opción**: sin red en runtime, sin CDN.
- `pmndrs/drei-assets/hdri/*_1k.hdr` (los de los presets de drei: `studio_small_03`, `empty_warehouse_01`, `potsdamer_platz`, `venice_sunset`, `lebombo`, `st_fagans_interior`…). 1,6 MB c/u. Descargar a `public/hdri/`.
- three.js `examples/textures/equirectangular/`: `ferndale_studio_04_1k.hdr`, `monochrome_studio_02_1k.hdr` (estudio, ideal producto/comida), `royal_esplanade_2k.hdr.jpg`, `venice_sunset_1k.hdr`, `quarry_01_1k.hdr`… (Poly Haven, CC0).
- Texturas PBR en three.js: `examples/textures/hardwood2_{diffuse,bump,roughness}.jpg` (madera), `brick_{diffuse,bump,roughness}.jpg`, `carbon/`, `ambientcg/Ice002_*`, `pbr/Scratched_gold/`, `floors/FloorsCheckerboard_*`, `waternormals.jpg`.
- `@pmndrs/assets/normals/0000..0028.webp` (normal maps tileables CC0), `matcaps/0000..0283.webp`.
- Mirrors de ambientCG: `fabien-michel/sweethome3d-textures-ambientcg` (CC0, 40★) — texturas en formato SweetHome3D (**no verificado** si incluyen normal/roughness).
- RoomEnvironment (three) genera un entorno de estudio sin ninguna descarga (ver `realismo.md`).
