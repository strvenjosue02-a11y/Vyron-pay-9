# Plantilla de reservas directas para casas y villas de alquiler

## Para cada cliente nuevo
1. Copiá la carpeta `villas/` con el nombre de la casa.
2. Editá **solo `config.js`**: nombre, ubicación, tarifas, habitaciones, comodidades, extras, Wi-Fi y WhatsApp.
3. Cambiá las coordenadas (`coordenadas`) para que el atardecer y el clima sean los de la casa.
4. Poné sus fotos en `img/` y cambiá las rutas en `fotos` (y `img/villa.jpg`).
5. Cuando pague, poné `modoDemo: false` para quitar el panel de paletas y las etiquetas "Render de referencia".

## Qué trae
- Calendario de disponibilidad: el huésped elige entrada y salida; las fechas ocupadas no se pueden elegir
- Cotizador al instante: noches por temporada, limpieza, extras, impuestos y el ahorro por reservar directo, en $ o ₡
- Solicitud por WhatsApp con las fechas, el total y los extras ya escritos
- Inglés y español (se detecta el idioma del teléfono)
- Extras que venden más: chef privado, traslado, paseo en bote (se editan en `extras`)
- Guía del huésped con Wi-Fi de un toque, horarios, normas y qué hay cerca (para un QR dentro de la casa)
- Encuesta de salida: las buenas notas van a la reseña pública, las malas llegan solo a los anfitriones
- Hora del atardecer, fase del día y clima en vivo
- La web cambia de paleta sola con el sol (arena de día, atardecer, océano de noche)
- Funciona sin señal después de abrirla una vez (`sw.js`)

## Que el anfitrión bloquee fechas desde el celular
1. Crear una hoja de Google con las columnas `inicio` y `fin` (formato AAAA-MM-DD). La fecha `fin` es la salida.
2. Archivo > Compartir > Publicar en la web > formato CSV. Copiar el link.
3. Pegarlo en `hojaGoogle` dentro de `config.js`.
Reemplazá `reservadas: "demo"` por `reservadas: []` para quitar las fechas de ejemplo.

## Trucos
- `?paleta=oceano` abre directo con esa paleta: arena, oceano, atardecer o selva.
- `?cliente=1` oculta el panel de demo. Con `#guia` al final abre la guía del huésped (para el QR de la casa).
- `?cliente=1&encuesta=1` abre la encuesta de salida (para el QR de despedida).

## Lo que esta versión NO hace todavía
- No cobra en línea: la solicitud va por WhatsApp y el anfitrión confirma.
- No se sincroniza sola con Airbnb o Booking (las fechas se bloquean a mano o por la hoja de Google).
