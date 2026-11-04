# Blender → kit procedural propio en TypeScript para three.js (WebGLRenderer, three 0.187)

(2026-11-04, 3d-researcher). Fuente: `github.com/blender/blender` rama `main`, commit `5ace1949287d` (2026-11-04), clon sparse en el scratchpad.
**Licencia**: Blender es GPL-2.0+. Aquí solo hay *algoritmos, parámetros y fórmulas descritos con nuestras palabras*; no se copia código. Al implementar, escribir desde esta nota, no desde el fuente de Blender. Los hashes citados (Jenkins lookup3, PCG3D) son algoritmos públicos (dominio público / paper JCGT 2020), reimplementables sin problema.
Convención: Blender es **Z-arriba**, three es **Y-arriba** → al portar fórmulas que usan "eje Z" (twist, bend, cast cilíndrico), usar Y en three o rotar antes/después.

---

## 0. Diseño recomendado del kit (decisión clave)

1. **Representación interna = malla poligonal, no `BufferGeometry`.** Catmull-Clark, Bevel, Solidify (rim), Screw y Weld necesitan caras (quads), aristas y vecindad. `BufferGeometry` es triángulos sueltos con vértices duplicados en costuras de UV/normal.
   ```ts
   type PolyMesh = {
     pos: Float32Array;          // xyz por vértice ÚNICO (soldado)
     faces: Uint32Array;         // índices de esquinas concatenados
     faceStart: Uint32Array;     // offset de cada cara en `faces` (len = F+1) → caras de n lados
     // atributos opcionales por esquina (corner): uv, color; por vértice: weight (≈ vertex group)
     crease?: Map<number, number>; // clave edgeKey(a,b) → 0..1 (afilado para Catmull-Clark)
   };
   ```
   - `fromBufferGeometry(g)` = `mergeVertices` (quitando `normal`/`uv` antes, ver LESSONS) + agrupar triángulos coplanares en quads opcionalmente.
   - `toBufferGeometry(m, {flat?})` = triangular cada cara en abanico, `computeVertexNormals()` al final (una sola vez).
2. **Pila de modificadores = lista ordenada de funciones puras** `(m: PolyMesh, ctx) => PolyMesh`. Blender distingue (`ModifierTypeType` en cada `MOD_*.cc`):
   - `OnlyDeform` (solo mueve vértices, topología igual): Displace, Smooth, LaplacianSmooth, Cast, SimpleDeform → baratos, se pueden reaplicar por frame.
   - `Constructive` (cambia topología): Subsurf, Bevel, Array, Screw, Solidify, Weld.
   - `Nonconstructive`: Remesh (genera malla nueva desde cero).
   El orden importa: se evalúan de arriba a abajo (`source/blender/blenkernel/intern/mesh_data_update.cc`). Orden típico para comida: **forma base → SimpleDeform → Subsurf → Displace → Smooth (suave) → Solidify (si es lámina)**.
3. **"Vertex group" = `Float32Array` de pesos por vértice**: todos los deformadores de Blender interpolan `lerp(orig, deformado, peso)` → añadir `weight?: Float32Array` a cada modificador da enmascarado gratis (p. ej. no desplazar la base del pan).
4. **Cachear** el resultado de los `Constructive`; animar solo los `OnlyDeform`. Construir en un Web Worker si el total supera ~50k vértices.

---

## 1. Modificadores (algoritmo + parámetros por defecto + pseudo-código + coste)

Defaults leídos de `source/blender/makesdna/DNA_modifier_types.h` (ya no existe `DNA_modifier_defaults.h`: los defaults están como inicializadores en cada struct).

### 1.1 Subdivision Surface (`MOD_subsurf.cc` → OpenSubdiv vía `blenkernel/intern/subdiv*.cc`)
Defaults: `levels=1` (viewport), `renderLevels=2`, `subdivType=0` (Catmull-Clark; 1 = Simple), `quality=3`, `uv_smooth=PRESERVE_BOUNDARIES`, `boundary_smooth=ALL`, usa creases. Blender delega en OpenSubdiv (esquema Catmark), reglas estándar de Catmull-Clark:
```
por nivel:
  F_f  = media(vértices de la cara f)                          // face point
  E_e  = (v0 + v1 + F_a + F_b) / 4          si e es interior   // edge point
       = (v0 + v1) / 2                      si borde o crease=1
  V'   = (Q + 2R + (n-3)·V) / n             interior, n = valencia
         Q = media de F de caras vecinas, R = media de puntos medios de aristas vecinas
       = 3/4·V + 1/8·(Vprev + Vnext)        vértice de borde (vecinos de borde)
       = V                                   esquina (2 aristas de borde) si boundary=PRESERVE_CORNERS
  crease c∈(0,1): mezclar regla suave y afilada con peso c (semi-sharp: c·nivel decrece 1 por nivel)
  nueva topología: cada cara de n lados → n quads (F_f, E, V', E)
```
- Tras 1 nivel todo son quads; cada nivel ×4 caras. Coste O(F·4^L) memoria y tiempo; nivel 2 suele bastar (nivel 3 para hero en desktop).
- UV: interpolar igual que posiciones pero tratando costuras de UV como borde (= `PRESERVE_BOUNDARIES`).
- Atajo: `three-subdivide@1.1.5` (MIT, peer three>=0.125) hace **Loop** (triángulos), no Catmull-Clark; vale para suavizar mallas triangulares ya existentes pero redondea distinto y no respeta quads.
- Para comida: subdividir **antes** del Displace (el ruido necesita vértices); nivel 2 sobre una base de ~200–500 quads → 3–8k quads.

### 1.2 Displace (`MOD_displace.cc`)
Defaults: `strength=1.0`, `midlevel=0.5`, `direction=NORMAL`, `texmapping=LOCAL` (coordenadas locales del vértice), `space=LOCAL`. Algoritmo exacto (líneas 160–240):
```
for v: t = textura(coord(v))          // intensidad 0..1 (sin textura: t = 1)
       d = clamp((t - midlevel) * strength * peso(v), -1e4, 1e4)
       switch dir:
         NORMAL / CLNOR: p += n_v * d    // normal de vértice (CLNOR = normal personalizada)
         X|Y|Z:          p[eje] += d     // en espacio local (o del eje global si space=GLOBAL)
         RGB_XYZ:        p += (rgb - midlevel) * strength   // vector displacement
coord(v): LOCAL = posición local; GLOBAL = mundo; OBJECT = en el espacio de otro objeto; UV = uv del vértice
```
- Con `midlevel 0.5` y ruido normalizado 0..1 la superficie se mueve hacia fuera y hacia dentro por igual → el volumen se conserva aprox. `midlevel 0` = solo hincha.
- Coste O(V·coste_ruido). fBm 4 octavas en CPU JS: ~1–2 M evaluaciones/s → 50k vértices ≈ 30–50 ms.
- **Usar la posición como semilla** (no el índice) para que costuras duplicadas reciban el mismo valor; recalcular normales después.
- Alternativa GPU (WebGL): mismo cálculo en el vertex shader con `onBeforeCompile` (`#include <begin_vertex>`), pero entonces las normales hay que derivarlas (diferencias finitas en 2 tangentes) → mejor en CPU para objetos estáticos; GPU solo si se anima.

### 1.3 Solidify (`MOD_solidify.cc`, `MOD_solidify_extrude.cc` = modo Simple, `MOD_solidify_nonmanifold.cc` = Complex)
Defaults: `offset (grosor)=0.01`, `offset_fac=-1` (hacia dentro), `flag=RIM` (cierra bordes), `merge_tolerance=1e-4`, modo `EXTRUDE` (Simple).
```
ofs_orig = -((1 - offset_fac)/2) * grosor      // dónde queda la capa original
ofs_new  = grosor + ofs_orig                     // dónde queda la copia
shell_v  = copia de todos los vértices; caras de la copia con winding invertido
Simple sin "Even":     p_orig += n_v * ofs_orig ;  p_new += n_v * ofs_new
"Even thickness":      escala por vértice = media ponderada por ángulo de esquina de 1/cos(ángulo(n_v, n_cara))
                       (shell_v3v3_normalized_to_dist) → grosor constante en esquinas
RIM:                   por cada arista de borde (usada por 1 cara) crear quad (a, b, b', a')
```
- Coste O(V+F). Para comida: lechuga/queso/salsa = plano deformado + Solidify 1.5–3 mm (en unidades de escena, ver §4). En three también se puede evitar con `side: DoubleSide`, pero sin grosor no hay silueta ni sombra de canto.

### 1.4 Bevel (`MOD_bevel.cc` → `bmesh/tools/bmesh_bevel.cc`, ~8000 líneas)
Defaults: `value (ancho)=0.1`, `res (segmentos)=1`, `profile=0.5`, `profile_type=SUPERELLIPSE`, `lim_flags=ANGLE`, `bevel_angle=30°`, `affect=EDGES`, `miter=SHARP`.
- Perfil: el parámetro `profile` p∈(0,1) se convierte a exponente de superelipse `r = -ln2 / ln(√p)` (línea ~8276): p=0.5 → r=2 (**cuarto de círculo**), p=0.25 → r=1 (chaflán recto), p→1 → r→∞ (cuadrado). Curva: `y = (1 - x^r)^(1/r)`.
- El bevel general (vértices con n aristas, "vmesh" con subdivisión de Catmull-Clark en las esquinas) es demasiado complejo para portar. **Para nuestros casos (cajas, papas, cortes)** usar el caso especial "caja redondeada":
```
roundedBox(w,h,d, radio r, segs s, exponente e=2):
  para cada vértice de una esfera-cubo subdividida (caras de cubo con s·k divisiones):
    q = clamp(p, -(half - r), +(half - r))     // núcleo
    dir = p - q ; p' = q + normalizeSuperellipse(dir, e) * r
  (≡ RoundedBoxGeometry de three/addons, que ya existe para e=2)
  e>2 → esquinas más cuadradas (papa cortada fresca); e≈2 → papa frita blanda
```
- Coste O(V). `RoundedBoxGeometry(w,h,d,segments,radius)` está en `three/addons/geometries/RoundedBoxGeometry.js` (0.187) → base directa para papas.

### 1.5 Smooth (`MOD_smooth.cc`)
Defaults: `fac=0.5`, `repeat=1`, ejes XYZ. Detalle no obvio: promedia **puntos medios de aristas**, no vecinos:
```
repeat veces:
  acc[v] = Σ_{aristas (v,u)} (p_v + p_u)/2 ;  cnt[v] = nº aristas
  p_v = (1-fac)·p_v + fac·(acc[v]/cnt[v])      // por eje habilitado, fac·peso(v)
```
Equivale a Laplaciano uniforme con factor efectivo fac/2. Encoge la malla (pierde volumen) con muchas iteraciones. Coste O(E·repeat).

### 1.6 Laplacian Smooth (`MOD_laplaciansmooth.cc`)
Defaults: `lambda=0.01`, `lambda_border=0.01`, `repeat=1`, flags `PRESERVE_VOLUME | NORMALIZED`. Algoritmo:
- Pesos **cotangente** por triángulo (área de anillo) y pesos 1/longitud en aristas de borde; sistema **implícito** (Euler hacia atrás) `(I + λL) x' = x` resuelto con mínimos cuadrados dispersos (Eigen).
- `PRESERVE_VOLUME`: tras resolver, escala respecto al centroide por `β = (V_ini / V_fin)^(1/3)` (volumen = suma de tetraedros con el centroide).
- Lambda negativo → infla (realza detalle).
Port práctico (sin solver): **Taubin λ|μ** explícito, que no encoge:
```
for it in 0..N:  p += λ·L(p) ; p += μ·L(p)      // λ=0.5, μ=-0.53, L(p)=media(vecinos)-p (o cotangente)
después (opcional): escalar por (V_ini/V_fin)^(1/3) respecto al centroide (como Blender)
```
Coste O(E·N); N=5–20 típico. Úsalo para "derretir" queso o suavizar uniones de metaballs.

### 1.7 Cast (`MOD_cast.cc`)
Defaults: `fac=0.5`, `radius=0` (sin límite), `size=0` (auto), tipo `SPHERE` (también `CYLINDER`, `CUBOID`), ejes XYZ, `SIZE_FROM_RADIUS`.
```
len = size>0 ? size : media(|p - centro|)        // radio automático
for v (si radius>0 y |p-c|>radius → saltar):
  dir = normalize(p - c)    (cilindro: componente del eje = 0, y ese eje no se toca)
  p = fac·(c + dir·len) + (1-fac)·p              // por eje habilitado, fac·peso
CUBOID: igual pero proyectando a la caja de semilados = max|min|,|max| por eje
```
Útil para: inflar un cubo subdividido a "bola de masa" (pollo), redondear un pan (`fac 0.3–0.6`). Coste O(V).

### 1.8 Simple Deform (`MOD_simpledeform.cc`) — twist / bend / taper / stretch
Defaults: `factor = 45°` (rad), `limit=[0,1]`, modo `TWIST`, eje Z (bend usa su propia convención). Puntos clave:
- **El ángulo es total sobre el objeto**: `k = factor / (hi - lo)` donde `lo, hi` = rango del objeto en el eje límite × `limit[0..1]` (líneas ~340–350). Los vértices fuera de `[lo,hi]` se recortan al límite (`dcut`) y se trasladan rígidamente → partes fuera del límite no se deforman.
- Fórmulas (eje principal = Z en Blender ≡ Y en three):
```
twist:   θ = z·k ; (x,y) = rot(θ)·(x,y)
taper:   s = z·k ; x *= 1+s ; y *= 1+s
stretch: s = z²·k - k + 1 ; x*=s ; y*=s ; z*=1+k
bend (doblar a lo largo de X alrededor de Z):
         θ = x·k ; x' = -(y - 1/k)·sin θ ; y' = y·cos θ + (1 - cos θ)/k ; z' = z
         (+ dcut rotado para las partes fuera del límite)
resultado = lerp(p, p', peso(v))
```
- "Lock axis" (X/Y) fuerza esa coordenada a 0 antes de deformar y la reañade después.
- Coste O(V). Papas: `bend 8°–25°`, `twist 0°–10°` aleatorio por instancia (ver §4.2). Pollo: `taper -0.3` para estrechar el hueso del muslo.

### 1.9 Array (`MOD_array.cc`)
Defaults: `count=2`, `offset_type=RELATIVE`, `scale (offset relativo)=[1,0,0]`, `offset const=[1,0,0]`, `merge_dist=0.01` (merge desactivado por defecto), `fit_type=FIXEDCOUNT`.
```
off = I;  if CONST: off.t += offset ; if RELATIVE: off.t += scale ⊙ (bbox.max - bbox.min)
        if OBJECT: off = off · (objeto_offset relativo)        // permite rotar/escalar acumulando
copia_i = M_i · malla, M_i = off^i     (FIT_LENGTH: count = floor(length / |off.t|) + 1)
merge: soldar vértices de la copia i con la i-1 a distancia < merge_dist ; caps opcionales en extremos
uv_offset * i opcional
```
En three: para copias **idénticas** usar `InstancedMesh` (1 draw call) en vez de fusionar; fusionar solo si después va un Subsurf/Displace continuo (p. ej. aros de cebolla soldados). Coste O(V·count).

### 1.10 Screw / Lathe (`MOD_screw.cc`)
Defaults: `steps=16`, `render_steps=16`, `angle=2π`, `screw_ofs=0`, `iter=1`, eje Z, `merge_dist=0.01`, sombreado suave.
```
steps_tot = (steps+1)·iter - (iter-1)
cerrado = |screw_ofs|≈0 && |angle|≈2π && steps_tot>3  → se suelda la última vuelta con la primera
para step s: θ_s = angle·iter · s / (steps_tot - (cerrado?0:1)) ;  t_s = screw_ofs·iter · s/(steps_tot-1)
  vert(s,i) = R_eje(θ_s)·perfil_i + eje·t_s
caras: quad por cada arista del perfil entre step s y s+1 ; uv.u = s/steps_tot, uv.v = a lo largo del perfil
```
`LatheGeometry(points, segments)` de three ya es el caso `screw_ofs=0` (Y es el eje), pero **no suelda la costura** (duplica la columna 0/2π) → pasar por `mergeVertices` antes de desplazar. `screw_ofs≠0` = espiral (churros, pasta fusilli). Coste O(perfil·steps).

### 1.11 Remesh (`MOD_remesh.cc`, voxel en `blenkernel/intern/mesh_remesh_voxel.cc`)
Defaults: `mode=VOXEL`, `voxel_size=0.1`, `adaptivity=0`; modos Blocks/Smooth/Sharp usan octree "dualcon" con `depth=4`, `scale=0.9`.
- Voxel = OpenVDB `meshToLevelSet` (malla → SDF en rejilla de `voxel_size`) + `volumeToMesh(isovalue 0, adaptivity)` (dual contouring adaptativo).
Port para nosotros: **SDF → Marching Cubes**. Construir la forma como función de distancia (unión suave de esferas/cápsulas: `smin(a,b,k) = min(a,b) - h²k/4, h = max(k-|a-b|,0)/k`) y poligonizar con `MarchingCubes` (`three/addons/objects/MarchingCubes.js`, existe en 0.187) o un MC propio que devuelva PolyMesh. Ideal para **pollo frito** (muslo = cápsula + esferas con smin) y salsas/gotas.
Coste O(N³) con N = tamaño/voxel; 64³ ≈ 260k celdas ≈ 20–60 ms en JS; 96³ para hero. Resultado: triángulos uniformes → después Laplacian/Taubin 3–5 iteraciones y Displace.

### 1.12 Weld (`MOD_weld.cc` → `geometry::mesh_merge_by_distance_*`)
Defaults: `merge_dist=0.001`, `mode=ALL` (cualquier par a < dist; KD-tree) o `CONNECTED` (solo extremos de una misma arista).
```
ALL: hash espacial con celda = merge_dist; para cada v buscar en 27 celdas; unir con el representante de menor índice;
     reindexar caras; eliminar caras degeneradas (<3 vértices distintos) y duplicadas
```
`mergeVertices(geo, tol)` de `BufferGeometryUtils` es un Weld ALL por cuantización (no por distancia real: dos puntos a 0.9·tol pueden caer en celdas distintas) y exige que **todos** los atributos coincidan → quitar `uv`/`normal` antes. Coste O(V).

### Resumen de coste (V vértices, F caras)
| Modificador | Tipo | Coste | Reaplicable por frame |
|---|---|---|---|
| Displace, Cast, SimpleDeform | deform | O(V) (+ruido) | sí |
| Smooth / Taubin | deform | O(E·iter) | sí con pocos vértices |
| Laplacian implícito | deform | solver disperso, caro | no (portar como Taubin) |
| Subsurf | constructivo | O(F·4^L) | no (cachear) |
| Solidify, Array, Screw, Weld, Bevel caja | constructivo | O(V+F) | no |
| Remesh (SDF+MC) | nuevo | O(N³) | no (worker) |

---

## 2. Geometry Nodes que merece la pena portar

### 2.1 Distribute Points on Faces (`nodes/geometry/nodes/node_geo_distribute_points_on_faces.cc`)
Defaults: `Density=10` (puntos por unidad²), modo Random o Poisson Disk: `Distance Min=0`, `Density Max=10`, `Density Factor=1` (0..1, campo), `Seed=0`.
- **Random**: por triángulo `tri_i`: `rng = RNG(hash(tri_i, seed))`; `n = round_probabilistic(área·densidad)` (densidad = media de los 3 vértices); n puntos con baricéntricas uniformes (`√r1` trick). Estable: cambiar un triángulo no reordena los demás.
- **"Poisson Disk" de Blender NO es Bridson**: es *dart throwing + eliminación*:
  1. generar puntos Random con `Density Max`;
  2. KD-tree; recorrer en orden y, para cada punto no eliminado, eliminar todos los vecinos a < `Distance Min`;
  3. eliminar cada superviviente si `hash(bary) > densityFactor interpolado` (máscara de densidad).
- Salidas: Normal (interpolada de la cara) y Rotation (`normal_to_rotation`: el eje +Z local de la instancia apunta a la normal, Blender Z-arriba).
```ts
// Port (nuestro): puntos sobre PolyMesh triangulado
for (t of tris) { const rng = mulberry32(hash2(t, seed)); let n = area(t)*densMax; n = Math.floor(n) + (rng() < n%1 ? 1:0);
  for (k<n) { let r1=rng(), r2=rng(); const s=Math.sqrt(r1); const b=[1-s, s*(1-r2), s*r2]; pts.push({p:mix(b), n:faceNormal, bary:b, tri:t}); } }
if (dmin>0) eliminateWithinRadius(pts, dmin);           // grid hash de celda dmin, orden de inserción
pts = pts.filter(p => hashFloat(p.bary) <= densityAt(p)); // densidad 0..1 por vértice (p. ej. y>base del pan)
```
Alternativa ya hecha: `MeshSurfaceSampler` (`three/addons/math/MeshSurfaceSampler.js`, ponderado por área + `setWeightAttribute`), sin Poisson. Coste O(N log N).

### 2.2 Instance on Points (`node_geo_instance_on_points.cc`) + alinear a normal
Entradas: Selection, Instance, Pick Instance (+ Instance Index → elegir variante por punto), Rotation, Scale (1,1,1). En three:
```ts
q.setFromUnitVectors(UP_Y, n);                                     // alinear +Y local a la normal
q.multiply(spin.setFromAxisAngle(UP_Y, rand()*2π));                // giro aleatorio sobre la normal
m.compose(p + n*offset, q, s.setScalar(lerp(0.8,1.2,rand())));
inst.setMatrixAt(i, m); inst.setColorAt(i, colorVariado);          // instanceColor = variación por instancia
```
"Pick Instance" ⇒ un `InstancedMesh` por variante (p. ej. 3 formas de sésamo / cristal de sal).

### 2.3 Set Position (`node_geo_set_position.cc`)
`Selection`, `Position` (por defecto el campo de posición actual), `Offset` (0). Equivale a `p = Position(p) + Offset(p)` para los seleccionados. En nuestro kit: modificador `setPosition(fn: (p, n, i) => Vector3, weight?)`; con ruido: `p += n * (noise(p*scale) - 0.5) * strength` ≡ Displace con textura procedural.

### 2.4 Texturas procedurales (fórmulas para CPU TS y GLSL)
Archivos: `gpu/shaders/material/gpu_shader_material_{noise,fractal_noise,tex_noise,voronoi,fractal_voronoi,tex_wave}.bsl.hh`, hashes en `gpu/shaders/nodes/gpu_shader_common_hash.bsl.hh`; espejo Cycles en `intern/cycles/kernel/svm/{noise,fractal_noise,voronoi,wave}.h`. **Musgrave ya no existe** (Blender 4.1+): sus 5 tipos están dentro de Noise (`noise_type`: fBM, Multifractal, Hybrid Multifractal, Heterogeneous Terrain, Ridged Multifractal).

**Perlin "de Blender"** (gradiente mejorado de Perlin):
```
fade(t) = t³(t(6t-15)+10)
hash entero 3D = Jenkins lookup3 `hash_uint3(x,y,z)` (a=b=c=0xdeadbeef+(3<<2)+13; c+=z; b+=y; a+=x; final(a,b,c); return c)
grad(h, x,y,z): h&=15; u = h<8 ? x : y; v = h<4 ? y : (h==12||h==14 ? x : z);
               return ((h&1)? -u:u) + ((h&2)? -v:v)
perlin(p) = trilinear(grad(hash(celda+esquina), p_frac - esquina), fade(frac))
snoise3(p) = 0.9820 · perlin(p)       (1D 0.2500, 2D 0.6616, 4D 0.8344: escalado empírico a ≈[-1,1])
noise(p)   = 0.5·snoise(p) + 0.5      → [0,1]
```
(Nuestro `SimplexNoise` de three no da el mismo patrón, pero sí el mismo "carácter"; si queremos fidelidad con valores tomados de un .blend, implementar este Perlin.)

**Noise Texture** (defaults: Scale 5, Detail 2, Roughness 0.5, Lacunarity 2, Distortion 0, Offset 0, Gain 1, Normalize on):
```
p = coord·scale
distorsión: p += distortion · (snoise(p+off0), snoise(p+off1), snoise(p+off2)),  off_k = 100 + hash(k)·100
fBM(p, detail, rough, lac):
  sum=0, amp=1, maxamp=0, f=1
  for i in 0..floor(detail): sum += snoise(f·p)·amp; maxamp += amp; amp *= rough; f *= lac
  rmd = detail - floor(detail): si ≠0 → mezclar con una octava extra (sum2 = sum + snoise(f·p)·amp) por rmd
  normalize → 0.5·sum/maxamp + 0.5
multifractal: value=1; pwr=1; repetir: value *= pwr·snoise(p)+1; pwr*=rough; p*=lac
hetero terrain: value = offset + snoise(p); luego value += (snoise(p)+offset)·pwr·value
hybrid: weight=1; signal=(snoise(p)+offset)·pwr; value += weight·signal; weight *= gain·signal (clamp ≤1)
ridged: signal = (offset - |snoise(p)|)²; weight = clamp(signal·gain,0,1); value += signal·weight·pwr …
```
Ojo: **Detail 2 = 3 octavas** (el bucle es `i <= detail`). Detail máx 15.

**Voronoi** (defaults: Scale 5, Detail 0, Roughness 0.5, Lacunarity 2, Smoothness 1, Exponent 0.5, Randomness 1; métricas Euclídea/Manhattan/Chebychev/Minkowski):
```
celda c = floor(p), local l = p - c
punto de la celda vecina o (o∈{-1,0,1}³) = o + hash3(c+o)·randomness,   hash3 = PCG3D (Jarzynski-Olano):
   v = v*1664525 + 1013904223; v.x+=v.y*v.z; v.y+=v.z*v.x; v.z+=v.x*v.y; v ^= v>>16; (repetir las 3 sumas)
   → (v & 0x7fffffff) / 0x7fffffff
F1: distancia mínima (+ Color = hash3 de esa celda, Position)
F2: segunda distancia mínima
Smooth F1 (vecindario 5×5×5): h = smoothstep(0,1, 0.5 + 0.5·(d_acum - d)/smoothness);
   d_acum = mix(d_acum, d, h) - smoothness·h·(1-h)
Distance to Edge: 1) vector al punto más cercano vc; 2) min sobre vecinos de dot((vc+vp)/2, normalize(vp-vc))
N-Sphere Radius: mitad de la distancia entre el punto más cercano y su vecino más cercano
fractal (Detail>0): como fBM pero con lerps; distance-to-edge fractal = min(d, d_oct/scale) mezclado por amplitud
```
**Wave** (defaults: Scale 5, Distortion 0, Detail 2, Detail Scale 1, Detail Roughness 0.5, Phase 0; Bands/Rings; perfil Sine/Saw/Triangle):
```
p = coord·scale ; n = bands: p.x·20 (diagonal: (x+y+z)·10) | rings: |p con el eje anulado|·20 (esférico: |p|·20)
n += phase ; if distortion: n += distortion·(fBM(p·detailScale, detail, detailRough, normalize)·2 - 1)
sine: 0.5 + 0.5·sin(n - π/2) ; saw: frac(n/2π) ; tri: |frac(n/2π + .5) - .5|·2
```
Coste GLSL aproximado por píxel: Perlin 3D ≈ 8 hashes; fBM detail 4 = 5 Perlin; Voronoi F1 3D = 27 hashes; Smooth F1 = 125 → **no** usar Smooth F1 por píxel en móvil; hornear a textura.

**Estrategia recomendada**: generar en CPU (TS) a **texturas** (`DataTexture`/canvas 512–1024) o en atributos de vértice; en GLSL por píxel solo 1 Perlin/fBM de 2–3 octavas para microdetalle de roughness. Equivalentes nativos sin escribir GLSL: `ImprovedNoise` y `SimplexNoise` (`three/addons/math/`).

---

## 3. Principled BSDF → `MeshPhysicalMaterial` (WebGLRenderer)

Entradas y defaults leídos de `nodes/shader/nodes/node_shader_bsdf_principled.cc`; evaluación EEVEE en `gpu_shader_material_principled.bsl.hh` + `gpu_shader_material_open_pbr_util.bsl.hh`; Cycles en `intern/cycles/kernel/svm/closure.h`. three: `node_modules/three/src/renderers/shaders/ShaderChunk/lights_physical_fragment.glsl.js`.

| Principled (default) | three `MeshPhysicalMaterial` | Notas de conversión |
|---|---|---|
| Base Color (0.8 gris, lineal) | `color` | Blender guarda lineal; three convierte desde sRGB (`color="#hex"`). Pasar con `new Color().setRGB(r,g,b, LinearSRGBColorSpace)` si se copian números de Blender |
| Metallic (0) | `metalness` | igual |
| Roughness (0.5) | `roughness` | igual (ambos GGX, roughness perceptual α=r²) |
| IOR (1.5) | `ior` (1.5) | igual; F0 = ((ior-1)/(ior+1))² |
| Specular IOR Level (0.5) | `specularIntensity` = **2 × level** | Blender: F0 ×= 2·level (0.5 → sin cambio). three: `specularColor = min(F0·specularColor,1)·specularIntensity` **y además** escala F90 (Blender deja F90=1) |
| Specular Tint (blanco) | `specularColor` | igual (tinte de F0 en dieléctricos) |
| Anisotropic (0) / Rotation (0) | `anisotropy`, `anisotropyRotation` (rad = rot·2π) | three requiere tangentes (`computeTangents` o `anisotropyMap`) |
| Transmission Weight (0) | `transmission` | coste: pasada extra de la escena opaca (1 por frame, compartida) |
| — (volumen en otro nodo) | `thickness`, `attenuationColor`, `attenuationDistance` | absorción tipo Beer, **no** dispersión; Blender lo haría con Volume Absorption |
| Transmission Dispersion Scale / Abbe (0 / 20) | `dispersion` | three: dispersión directa (0–1 aprox.) |
| Coat Weight (0) | `clearcoat` | |
| Coat Roughness (0.03) | `clearcoatRoughness` | default de Blender 0.03 ≠ three 0 |
| Coat IOR (1.5) | — (fijo 1.5 en three) | |
| Coat Tint (blanco) | — | simular oscureciendo `color` |
| Coat Normal | `clearcoatNormalMap` | |
| Sheen Weight (0) | `sheen` | |
| Sheen Roughness (0.5) | `sheenRoughness` (1 por defecto en three) | |
| Sheen Tint (blanco) | `sheenColor` | Blender: tinte×peso; three: color ya multiplicado |
| Emission Color/Strength | `emissive` / `emissiveIntensity` | |
| Alpha | `opacity` + `transparent` (o `alphaHash`) | |
| Thin Film Thickness (0 nm) / IOR (1.33) | `iridescence`=1, `iridescenceThicknessRange=[t,t]`, `iridescenceIOR` | pompas, aceite muy fino |
| Diffuse Roughness (0, Oren-Nayar) | — | Lambert en three |
| **Subsurface Weight (0)** | **no existe en WebGLRenderer** | ver abajo |
| Subsurface Radius (1, 0.2, 0.1) × Scale (0.005 m) | — | radio = camino libre medio por canal RGB en metros: 5 mm rojo, 1 mm verde, 0.5 mm azul |
| Subsurface IOR (1.4), Anisotropy (0) | — | |
| Thin Wall (false) | `transmission` + `thickness: 0` | |

**SSS con WebGLRenderer (no hay `MeshSSSNodeMaterial`)** — opciones de más barata a más cara:
1. **Wrap + tinte** (gratis): `sheen 0.2–0.4` con `sheenColor` cálido + `color` algo más saturado; da el "borde iluminado" de la comida.
2. **Translucidez de Frostbite** (Barré-Brisebois 2011) inyectada con `onBeforeCompile` en `MeshPhysicalMaterial`, en `RE_Direct`: `I_back = attenuation · (pow(saturate(dot(V, -(L + N·distortion))), power)·scale + ambient) · thicknessColor · (1 - thickness)`. Parámetros de partida (los mismos que usa `MeshSSSNodeMaterial`): distortion 0.1, ambient 0, attenuation 0.1, power 2, scale 10–16. `three/addons/shaders/SubsurfaceScatteringShader.js` existe en 0.187 como referencia, pero está montado sobre Phong (ShaderMaterial) → mejor el parche sobre Physical para conservar IBL/clearcoat.
3. **Transmission + thickness + attenuation** (queso fundido, gel de tomate): `transmission 0.15–0.35, thickness 0.3–1 (escena), attenuationColor` = color saturado, `attenuationDistance` ≈ radio SSS rojo en unidades de escena. Cuesta la pasada de transmisión; con varios objetos es la misma pasada.
4. Conversión aproximada de radios: `attenuationDistance ≈ Subsurface Scale × max(Radius) × unidades_por_metro`; `attenuationColor ≈ Base Color` normalizado a su máximo.

---

## 4. Recetas de look-dev de comida (Blender → three)

**Escala**: usar 1 unidad = 10 cm (pan de 10–11 cm de diámetro → radio 0.52). Si la escena ya usa radio de pan = 1, multiplicar todas las distancias de abajo por ~1.9. Los "mm" se dan en mundo real.

### 4.1 Rebozado frito crujiente (pollo, aros, tempura)
Pila Blender: forma base (metaballs/SDF) → Remesh voxel → Subsurf 1 → Displace(Voronoi) → Displace(Noise) → Smooth 0.3×2.
- **Forma**: muslo = cápsula (largo 9 cm, radio 2.2 cm) ∪smin esfera (radio 3 cm, k=1.5 cm) + hueso cápsula 0.6 cm sobresaliendo 2 cm; MC a 72³ (desktop) / 48³ (móvil) → Taubin 4 iter.
- **Grumos ("crunchy bumps")**: Voronoi 3D **F1 invertido** (`1 - d`), escala ≈ 1 celda cada 4–6 mm (Scale ~18–25 por unidad de 10 cm), randomness 1, potenciado `pow(1-d, 2)`; strength 2.5–4 mm, midlevel 0.3 (hincha más que hunde).
- **Microrugosidad**: Noise fBM Scale ~60–90, Detail 4–6, Roughness 0.6, Distortion 0.3–0.5, strength 0.6–1 mm, midlevel 0.5.
- **Escamas/láminas de harina**: Voronoi Distance-to-Edge escala ~10, `smoothstep(0, 0.08, d)` restando 1 mm → grietas entre placas.
- **Color** (vértice o textura, según el valor de desplazamiento h∈[0,1]): grietas `#6B3A12`, medio `#B9732B`, crestas `#E2A552`; mezclar también con AO/cavidad (h bajo = más oscuro y más rugoso). Variar ±6 % de tono con fBM grande (escala 3) → zonas más fritas.
- **Material**: `roughness` 0.42 en crestas → 0.75 en grietas (mapa); `clearcoat 0.35, clearcoatRoughness 0.3` (película de aceite); `sheen 0.3, sheenRoughness 0.5, sheenColor #FFD7A0` (pelusa de miga); `specularIntensity 0.6`; SSS opción 1 o 2 con thicknessColor `#C8641E`, scale 8. Bump/normal de alta frecuencia: textura del fBM 1024² con `bumpScale` 0.6–1.
- Coste: ~20–40k triángulos por pieza en desktop; móvil: 8–12k + normal map horneado.

### 4.2 Papas fritas (French fries)
Pila: `RoundedBox` (= Bevel en caja) → SimpleDeform bend → SimpleDeform twist → Displace Noise leve → instanciar con variación.
- **Base**: sección 9×9 mm (estándar) / 6×6 (shoestring) / 12×12 (steak), largo 6–10 cm (distribución normal μ=7.5, σ=1.2 cm). `RoundedBoxGeometry(0.09, 0.75, 0.09, segs 3, radius 0.012)` en escala 1u=10 cm — radio ≈ 13 % de la sección (profile 0.5 ≡ círculo); segmentos a lo largo: ≥ 10 para que el bend sea suave. **Ojo**: `RoundedBoxGeometry` parte de `BoxGeometry(1,1,1, 2·segments+1, …)` y deja el tramo recto central en **un solo segmento** (verificado `RoundedBoxGeometry.js:65-75`) → el bend se vería quebrado. Usar nuestro `roundedBox` (§1.4) sobre `BoxGeometry(w, L, d, 4, 14, 4)` con divisiones longitudinales.
- **Bend**: 8°–25° total (aleatorio, signo aleatorio) a lo largo del eje largo; **twist** 0°–10°; taper ±0.05 en una punta (corte irregular).
- **Superficie**: Noise Scale ~40, Detail 3, strength 0.3–0.5 mm; extremos con Voronoi suave (cortes desgarrados) y ligera hinchazón (Cast cuboid fac 0.15).
- **Gradiente dorado**: por vértice t = |y|/(largo/2): centro `#E9B556` → puntas `#B8752A` (`smoothstep(0.65, 1, t)`); aristas un 8 % más oscuras (curvatura). Variación por instancia con `setColorAt`: tono ±4°, luminosidad ±8 %; ~10 % de papas más pálidas `#F0CF83`.
- **Material**: `roughness 0.55` (+ruido 0.45–0.7), `clearcoat 0.25, clearcoatRoughness 0.4`, `sheen 0.15 #FFE2A8`, SSS opción 1.
- **Sal**: cubos de 0.3–0.6 mm (BoxGeometry 1×1×1 escalado, o icosaedro detail 0 deformado), 40–80 por papa visible, Distribute Points on Faces con `Distance Min` 1.2 mm y density factor mayor en caras superiores (`n·up`); `InstancedMesh` único para todas: `color #F7F5EF, roughness 0.15, ior 1.54 (halita), specularIntensity 1, transmission 0` (transmission en miles de instancias no aporta). Alinear a normal + giro aleatorio + inclinación ±25°.
- **Instanciado**: 25–40 papas en un `InstancedMesh` por variante de forma (3–4 variantes precalculadas con distinto bend/twist) — 1 draw call por variante + 1 de sal.

### 4.3 Pan glaseado (bun brillante)
- Forma: Screw/Lathe de un perfil superelipse (ya en `comida-procedural.md` §1) → Weld costura → Subsurf 1 → Displace fBM Scale ~3 (bultos 2–3 mm) + Scale ~25 (granulado 0.3 mm).
- Color: corona `#A65A1C` → hombros `#C9792E` → base sin tostar `#EBC27E` (`smoothstep` por altura + fBM escala 4 ±5 %).
- Material (glaseado de huevo): `roughness 0.45` base + `clearcoat 0.6–0.8, clearcoatRoughness 0.18–0.25` (el coat da el highlight nítido, la base queda mate), `sheen 0.25 #F4C890`, `specularIntensity 0.5`; normal de poro muy fina (fBM 1024² `normalScale 0.15`).
- Sésamo: Distribute Points (Distance Min ~6 mm, density factor = `smoothstep(0.35, 0.6, altura)`) + Instance on Points alineado a normal; semilla elipsoide 3.2×1.6×1.2 mm, `#F1DFB5`, `roughness 0.4`, `clearcoat 0.3`; ~60–90 semillas.

### 4.4 Queso fundido (cheddar / americano)
- Geometría: plano 9×9 cm subdividido 40×40 → Set Position "gravedad": para cada vértice fuera del radio del soporte R (patty ≈ 5.2 cm): `y -= droop·(r - R)²` con droop ≈ 8 (por unidad), más mayor en esquinas; añadir 3–5 **goteos** como campos gaussianos alargados en Y (largo 1–2.5 cm) → Taubin 6–10 iter (efecto "derretido") → Solidify 2–3 mm Even + rim → Subsurf 1.
- Material: `color #F0A21A` (americano `#F6B53A`), `roughness 0.28–0.35`, `clearcoat 0.3, clearcoatRoughness 0.2`, `sheen 0.1`; SSS: opción 3 (`transmission 0.2, thickness 0.5, attenuationColor #E8860C, attenuationDistance 0.03`) en desktop, opción 1/2 en móvil. Principled de referencia: Subsurface Weight 0.4, Radius (1, 0.45, 0.12), Scale 3 mm.

### 4.5 Salsas (ketchup, mostaza, mayo, BBQ)
- Geometría: curva (CatmullRomCurve3) sobre la superficie → `TubeGeometry` con radio variable 2–4 mm (aplastar a elipse 1:0.55 contra la superficie) o SDF de cápsulas + MC; pequeños charcos: discos con Displace Noise y Smooth.
- Materiales (alto brillo, opacos): ketchup `#8E160C`, `roughness 0.12, clearcoat 1, clearcoatRoughness 0.05, ior 1.4`; mostaza `#D9A21B` roughness 0.2; mayo `#F2EBD3` roughness 0.18 + `sheen 0.2` + opción SSS 1; BBQ `#4A1B0C` roughness 0.1 clearcoat 1. Transmission no necesaria (salvo gotas de aceite: `transmission 1, roughness 0, ior 1.47, thickness 0.002`).

### 4.6 Iluminación de look-dev (equivalente a un "studio" de Blender)
HDRI de estudio a `environmentIntensity 0.6–0.9` + 2–3 `Lightformer` (softbox): key rectangular 4×1 a 45° (intensidad 2–3), rim detrás-arriba (3–5, estrecho → define el brillo del coat), fill tenue (0.5). Tone mapping Neutral, exposición 1.0–1.15.

---

## 5. Extras WebGL2 al pasar la página de comida a `WebGLRenderer`

Versiones instaladas (leídas de `node_modules/*/package.json`, 2026-11-04):
| Paquete | Versión | peerDependencies | ¿Compatible con three 0.187? |
|---|---|---|---|
| three | 0.187.0 | — | — |
| @react-three/fiber | 9.8.2 | three >=0.156, react >=19 <19.4 | sí |
| @react-three/drei | 10.7.9 | three >=0.159, fiber ^9 | sí |
| postprocessing | 6.39.6 | three >=0.168.0 **<0.188.0** | sí (**no subir three a 0.188**) |
| @react-three/postprocessing | 3.2.2 | postprocessing ^6.36, fiber >=9.7, three >=0.156; deps `n8ao ^2.0.0`, `maath` | sí |
| n8ao | 2.0.1 | postprocessing >=6.30, three >=0.137 | sí |
| @pmndrs/assets | 1.7.0 | — | HDRI local (`hdri/studio.exr.js`) |

Ahora utilizables (todos usan `ShaderMaterial`/`onBeforeCompile`/`WebGLRenderTarget`, que con WebGPURenderer no funcionaban):
- **drei `ContactShadows`** (defaults: `scale 10, frames Infinity, opacity 1, blur 1, far 10, resolution 512`): poner `frames={1}` en escena estática (no re-renderiza cada frame).
- **drei `AccumulativeShadows` + `RandomizedLight`** (defaults `frames 40, alphaTest 0.75, scale 10, temporal false`): sombras suaves de área "tipo Cycles"; caro durante la acumulación, gratis después. Para objetos que se mueven (vista explotada con scroll) usar `temporal` + `frames 100` o ContactShadows.
- **drei `Environment` con hijos `<Lightformer>`**: `EnvironmentPortal` renderiza los hijos (y el HDRI de `files` como fondo del portal) en un `WebGLCubeRenderTarget` HalfFloat de `resolution 256`, `frames 1` → softboxes que reflejan en clearcoat/salsas. Ya montado así en `src/components/three/gl-canvas.tsx`.
- **drei `MeshTransmissionMaterial`** (`samples 10`, `resolution`, `backside`, `thickness`, `chromaticAberration`, `anisotropicBlur`, `distortion`): sus `#include <transmission_pars_fragment>`/`<transmission_fragment>` y las funciones que reutiliza (`getVolumeTransmissionRay`, `applyIorToRoughness`, `getTransmissionSample`, `EnvironmentBRDF`) existen en los chunks de three 0.187 (grep) → debería compilar; **no probado en ejecución**. Útil para vaso de refresco/hielo; caro (FBO propio + N muestras): 1 objeto como máximo y `samples 6` en móvil.
- **@react-three/postprocessing** exporta `EffectComposer, N8AO, SMAA, Bloom, ToneMapping, Vignette, DepthOfField, FXAA, SSAO, Noise, HueSaturation, BrightnessContrast, LUT…`. Defaults de `EffectComposer`: `multisampling 4`, `frameBufferType HalfFloatType`, y **pone `gl.toneMapping = NoToneMapping`** mientras está montado → hay que añadir `<ToneMapping mode={ToneMappingMode.NEUTRAL} />` (enum de `postprocessing`: NEUTRAL=8, AGX=7, ACES_FILMIC=6) como último efecto. `N8AO` defaults: `aoRadius 5, aoSamples 16, denoiseSamples 4, denoiseRadius 12, distanceFalloff 1, intensity 1`; para comida a escala 1u=10 cm usar `aoRadius 0.3–0.6, distanceFalloff 0.5–1, intensity 1.5–2.5, halfRes` en móvil. Con N8AO activo poner `multisampling={0}` y usar SMAA (N8AO + MSAA duplica coste).
- Materiales WebGL extra: `three-custom-shader-material` (no instalado; basado en onBeforeCompile) o nuestro propio `onBeforeCompile` para la translucidez SSS (§3) y para ruido por píxel en roughness.
- Addons de three útiles para el kit (presentes en 0.187): `RoundedBoxGeometry`, `ParametricGeometry`, `ConvexGeometry`, `DecalGeometry` (marcas de parrilla como calco), `MarchingCubes`, `MeshSurfaceSampler`, `ImprovedNoise`, `SimplexNoise`, `SimplifyModifier` (LOD móvil), `TessellateModifier`, `EdgeSplitModifier`, `CurveModifier`, `BufferGeometryUtils` (`mergeVertices`, `mergeGeometries`, `computeMikkTSpaceTangents`, `toCreasedNormals`).
- Librerías npm: `three-subdivide@1.1.5` (MIT, Loop), `three-bvh-csg@0.0.18` (MIT; peers three>=0.179, three-mesh-bvh>=0.9.7) para booleanos (mordisco en la hamburguesa, corte de la papa), `manifold-3d@3.5.4` (Apache-2.0, WASM; booleanos robustos, más pesado).

---

## 6. Rutas en el repo de Blender consultadas
- `source/blender/makesdna/DNA_modifier_types.h` (defaults de todos los modificadores)
- `source/blender/modifiers/intern/MOD_{subsurf,displace,solidify,solidify_extrude,solidify_nonmanifold,bevel,smooth,laplaciansmooth,cast,simpledeform,array,screw,remesh,weld}.cc`
- `source/blender/bmesh/tools/bmesh_bevel.cc` (superelipse, `pro_super_r`)
- `source/blender/blenkernel/intern/subdiv*.cc`, `mesh_remesh_voxel.cc`, `mesh_data_update.cc`
- `source/blender/nodes/geometry/nodes/node_geo_{distribute_points_on_faces,instance_on_points,set_position,merge_by_distance}.cc`
- `source/blender/nodes/shader/nodes/node_shader_{bsdf_principled,tex_noise,tex_voronoi,tex_wave}.cc`
- `source/blender/gpu/shaders/material/gpu_shader_material_{principled,open_pbr_util,noise,fractal_noise,tex_noise,voronoi,fractal_voronoi,tex_wave}.bsl.hh`
- `source/blender/gpu/shaders/nodes/gpu_shader_common_hash.bsl.hh`
- `intern/cycles/kernel/svm/{closure,noise,fractal_noise,voronoi,wave}.h`, `intern/cycles/kernel/closure/bssrdf.h`
