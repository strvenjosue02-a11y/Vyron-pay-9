# Plantilla de menú QR para restaurantes

## Para cada cliente nuevo
1. Copiá la carpeta `menu/` con el nombre del restaurante.
2. Editá **solo `config.js`**: nombre, lema, horario, WhatsApp, Instagram, platos y precios en colones.
3. Elegí `tema`: `playa`, `volcan`, `caribe` o `ciudad`. Si querés, poné `colorAcento` con el color de su logo.
4. Cuando el cliente pague, poné `modoDemo: false` para quitar el botón "Cambiar estilo".

## Qué trae
- Español e inglés (detecta el idioma del teléfono del turista)
- Precios en ₡ o $ (cambiá `tipoCambio`)
- Filtros: vegano, vegetariano, sin gluten
- Plato de la casa destacado
- Botón de reservar por WhatsApp con mensaje listo
- Panel de demo: 4 estilos, color principal y QR descargable para las mesas

## Trucos
- `?tema=volcan` en el link abre directo con ese estilo, útil para mandarle a cada restaurante el que le pega.
- `?cliente=1` oculta el panel de demo (el QR ya apunta a esa versión).
