# Plantilla: cabañas y casas de alquiler

Una sola web por cliente. Se cambia SOLO `config.js` y las fotos de `img/`.

## Para un cliente nuevo
1. Copiá la carpeta `villas/` y cambiá `config.js`: nombre, lugar, ficha, destacados, tarifas por temporada, extras, WhatsApp, normas, FAQ.
2. Reemplazá las fotos de `img/` por las del cliente (`foto-exterior.jpg` vertical o cuadrada, `foto-interior.jpg`, y 3 detalles `det-*.jpg`). Sin renders ni fotos ajenas.
3. Poné `modoDemo: false` (oculta el panel de paletas) y elegí `paleta`: brasa | bosque | medianoche | niebla.
4. Opcional: `hojaGoogle` con una hoja publicada como CSV (columnas `inicio`, `fin`) para bloquear fechas desde el celular.
5. Subí la carpeta a Vercel (Root Directory = esa carpeta).

## Incluye
ES/EN, dólares/colones, calendario con fechas ocupadas, cotizador (temporadas, limpieza, extras, impuesto, descuento por reserva directa), solicitud por WhatsApp, guía para el huésped (QR), encuesta de salida que manda las reseñas buenas a Google y las malas al anfitrión, funciona sin internet.

## No incluye
Pago en línea ni sincronización automática con Airbnb/Booking (iCal). Las reservas se confirman por WhatsApp.
