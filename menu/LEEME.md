# Plantilla de carta de lujo para restaurantes

## Para cada cliente nuevo
1. Copiá la carpeta `menu/` con el nombre del restaurante.
2. Editá **solo `config.js`**: nombre, lema, horario, WhatsApp, platos, maridajes, alérgenos, experiencias y reseñas.
3. Elegí la `paleta`: `bordeaux`, `nuit`, `bouteille` o `porcelaine`. Con `metal` cambiás el filo dorado por plata, cobre o champán.
4. Cambiá `resenaGoogle` por el link "Escribir una reseña" de su perfil de Google.
5. Cuando pague, poné `modoDemo: false` para quitar el panel de paletas.

## Qué trae
- Carta en español e inglés, precios finales en ₡ o $ (impuestos y servicio incluidos)
- Filtro de dieta y alergias: sin gluten, vegetariano, vegano, sin mariscos, sin nueces, sin lácteos
- "Abierto ahora" o "Cerrado, abre a las…", calculado con la hora de Costa Rica
- Maridaje sugerido por plato y menú degustación con maridaje
- Experiencias (mesa del chef, cena en la playa, música en vivo) que llevan directo a reservar
- Reseñas de Google destacadas y QR para pedir reseñas en la cuenta
- Reserva por WhatsApp: día, hora, personas, ocasión y alergias, con el mensaje ya escrito
- Horario de la semana con el día de hoy marcado
- Funciona sin señal después de abrirla una vez (`sw.js`)
- Panel de demo: 4 paletas, filo de la vajilla y 2 QR descargables

## Que el dueño cambie precios y "agotado" solo
1. Crear una hoja de Google con columnas `id`, `precio`, `agotado`.
   El `id` es el de cada plato en `config.js` (ej. `pargo`). En `agotado` se escribe `si` o se deja vacío.
2. Archivo > Compartir > Publicar en la web > formato CSV. Copiar el link.
3. Pegarlo en `hojaGoogle` dentro de `config.js`.
Desde ahí el dueño edita la hoja en su celular y la carta se actualiza sola.

## Trucos
- `?paleta=nuit` en el link abre directo con esa paleta: mandale a cada restaurante la que le pega.
- `?cliente=1` oculta el panel de demo (el QR de mesas ya apunta a esa versión).

## Portada 3D
Las imágenes de `img/` son renders de Blender (plato de porcelana con filo dorado, una por paleta).
Para un cliente se puede renderizar una versión con su logo grabado en el plato.
