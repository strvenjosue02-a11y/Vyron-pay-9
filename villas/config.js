/* =========================================================
   CONFIGURACIÓN DE LA CABAÑA
   Para cada cliente nuevo: cambiá SOLO este archivo.
   Instrucciones completas en LEEME.md
   ========================================================= */
window.VILLA = {
  nombre: "Refugio Niebla",
  lugar: { es: "Monteverde, Costa Rica", en: "Monteverde, Costa Rica" },
  lema: { es: "Una cabaña A-frame entre las nubes", en: "An A-frame cabin among the clouds" },
  coords: "10°18′ N  ·  84°49′ O",
  altura: { es: "1.480 m sobre el mar", en: "1,480 m above sea level" },

  intro: {
    es: "Para dos personas, con espacio para un niño. Madera de pino por dentro, techo negro por fuera y un bosque entero al otro lado del vidrio.",
    en: "For two guests, with room for one child. Pine wood inside, a black roof outside and an entire forest on the other side of the glass."
  },

  anfitrion: {
    nombre: "Andrea y Luis",
    nota: {
      es: "Construimos el Refugio para desconectarnos y ahora lo compartimos. Respondemos personalmente cada mensaje y te dejamos la chimenea lista.",
      en: "We built the Refuge to disconnect, and now we share it. We answer every message personally and leave the fireplace ready for you."
    }
  },

  whatsapp: "50688888888",                  // con 506 adelante, sin espacios
  instagram: "refugioniebla.cr",
  lat: 10.3, lng: -84.8167,                 // ubicación exacta: de aquí salen Google Maps, Waze y el mapa
  mapa: "", waze: "",                       // opcional: pegá un enlace propio para reemplazar los automáticos
  resenaUrl: "https://g.page/r/EJEMPLO/review",      // link para dejar reseña (Google o Airbnb)

  paleta: "brasa",                          // brasa | bosque | medianoche | niebla
  tipoCambio: 505,                          // colones por dólar
  modoDemo: true,                           // false = oculta el panel de paletas
  // Opcional: hoja de Google publicada como CSV con columnas "inicio" y "fin" (AAAA-MM-DD).
  // El anfitrión bloquea fechas desde el celular y el calendario se actualiza solo.
  hojaGoogle: "",

  maxHuespedes: 3,
  checkin: "3:00 pm",
  checkout: "11:00 am",
  minNoches: 2,

  // Datos de la ficha (la lista con líneas finas debajo de la presentación)
  ficha: [
    { k: { es: "Capacidad", en: "Sleeps" },       v: { es: "2 adultos y 1 niño", en: "2 adults and 1 child" } },
    { k: { es: "Dormitorio", en: "Bedroom" },     v: { es: "Loft con cama king y vista al bosque", en: "Loft with a king bed and forest view" } },
    { k: { es: "Calefacción", en: "Heating" },    v: { es: "Chimenea de leña, leña incluida", en: "Wood fireplace, firewood included" } },
    { k: { es: "Terraza", en: "Deck" },           v: { es: "Jacuzzi privado, abierto las 24 horas", en: "Private hot tub, open 24 hours" } },
    { k: { es: "Temperatura", en: "Climate" },    v: { es: "Entre 12 y 20 °C todo el año", en: "Between 12 and 20 °C all year" } },
    { k: { es: "Energía", en: "Power" },          v: { es: "Paneles solares en el techo", en: "Solar panels on the roof" } },
    { k: { es: "Llegada", en: "Arrival" },        v: { es: "Autónoma, con código por WhatsApp", en: "Self check-in, code by WhatsApp" } }
  ],

  // Lo que la hace distinta (cada línea es un título grande con su explicación)
  destacados: [
    { t: { es: "Chimenea y leña", en: "Fireplace and wood" }, d: { es: "Prendé el fuego a las 5 de la tarde. Dejamos la leña seca y todo lo necesario.", en: "Light the fire at 5 pm. We leave dry wood and everything you need." } },
    { t: { es: "Jacuzzi con vista", en: "Hot tub with a view" }, d: { es: "En la terraza, rodeado de árboles. Es solo tuyo y siempre está caliente.", en: "On the deck, surrounded by trees. It is all yours and always warm." } },
    { t: { es: "Cama en el loft", en: "Bed in the loft" }, d: { es: "Dormís bajo el techo de madera, mirando el bosque por la ventana triangular.", en: "You sleep under the timber roof, looking at the forest through the triangular window." } },
    { t: { es: "Cocina completa", en: "Full kitchen" }, d: { es: "Estufa, cafetera de filtro, sartenes y todo para cocinar sin salir.", en: "Stove, drip coffee maker, pans and everything to cook without leaving." } },
    { t: { es: "Silencio de verdad", en: "Real silence" }, d: { es: "Sin vecinos a la vista. Solo pájaros, viento y la niebla que sube por la tarde.", en: "No neighbors in sight. Just birds, wind and the fog that rolls in by afternoon." } }
  ],

  fotos: {
    fondoPort: "img/fondo-port.jpg",
    fondoLand: "img/fondo-land.jpg",
    exterior: "img/foto-exterior.jpg",
    interior: "img/foto-interior.jpg",
    detalles: [
      { src: "img/det-loft.jpg",   cls: "wide", cap: { es: "El loft", en: "The loft" } },
      { src: "img/det-sala.jpg",   cls: "",     cap: { es: "La sala", en: "The living room" } },
      { src: "img/det-cocina.jpg", cls: "tall", cap: { es: "Cocina y escalera", en: "Kitchen and ladder" } }
    ]
  },

  // Precios en dólares por noche. Los períodos se revisan en orden; gana el primero que coincida.
  tarifas: [
    { id: "fin",  nombre: { es: "Fin de año", en: "New Year" },          rangos: [["12-20", "01-05"]], noche: 320 },
    { id: "alta", nombre: { es: "Temporada alta", en: "High season" },    rangos: [["12-01", "04-30"]], noche: 210 },
    { id: "baja", nombre: { es: "Temporada verde", en: "Green season" }, rangos: [["05-01", "11-30"]], noche: 140 }
  ],
  limpieza: 60,                             // una sola vez por estadía
  impuesto: 0.13,                           // IVA que se suma al total
  descuentoDirecto: 10,                     // % de descuento sobre el hospedaje al reservar directo
  cancelacion: {
    es: "Cancelación gratis hasta 7 días antes de la llegada. Después se cobra la primera noche.",
    en: "Free cancellation up to 7 days before arrival. After that, the first night is charged."
  },

  extras: [
    { id: "lena",   nombre: { es: "Kit de fogata y leña extra", en: "Fire pit kit and extra wood" },        precio: 25 },
    { id: "desa",   nombre: { es: "Desayuno de campo para dos", en: "Country breakfast for two" },         precio: 36 },
    { id: "cena",   nombre: { es: "Cena romántica con chef en la cabaña", en: "Private chef dinner for two" }, precio: 95 },
    { id: "decor",  nombre: { es: "Decoración sorpresa (aniversario o cumpleaños)", en: "Surprise decoration (anniversary or birthday)" }, precio: 45 },
    { id: "aves",   nombre: { es: "Caminata guiada de aves al amanecer", en: "Guided sunrise bird walk" },  precio: 60 },
    { id: "late",   nombre: { es: "Salida tarde, hasta las 3 pm", en: "Late check-out until 3 pm" },        precio: 30 }
  ],

  // Noches ocupadas: [entrada, salida). La fecha de salida queda libre para otra entrada.
  // "demo" genera fechas ocupadas a partir de hoy, para que la demo siempre se vea viva.
  reservadas: "demo",

  llegar: [
    { es: "Desde San José", en: "From San José", dato: { es: "3 horas y media", en: "3.5 hours" } },
    { es: "Desde el aeropuerto de Liberia", en: "From Liberia airport", dato: { es: "2 horas y media", en: "2.5 hours" } },
    { es: "Último tramo", en: "Last stretch", dato: { es: "2 km de lastre, mejor con vehículo alto", en: "2 km of gravel, a high vehicle is best" } }
  ],
  llevar: [
    { es: "Abrigo y calcetines gruesos, de noche refresca", en: "A jacket and thick socks, nights are cool" },
    { es: "Zapatos cerrados para caminar en el bosque", en: "Closed shoes for forest walks" },
    { es: "Traje de baño para el jacuzzi", en: "A swimsuit for the hot tub" }
  ],
  cerca: [
    { es: "Mirador del valle", en: "Valley viewpoint", dato: { es: "6 minutos en carro", en: "6 minutes by car" } },
    { es: "Café de montaña", en: "Mountain café", dato: { es: "8 minutos en carro", en: "8 minutes by car" } },
    { es: "Supermercado y farmacia", en: "Supermarket and pharmacy", dato: { es: "10 minutos en carro", en: "10 minutes by car" } },
    { es: "Reserva de bosque nuboso", en: "Cloud forest reserve", dato: { es: "12 minutos en carro", en: "12 minutes by car" } },
    { es: "Puentes colgantes", en: "Hanging bridges", dato: { es: "15 minutos en carro", en: "15 minutes by car" } }
  ],
  normas: [
    { es: "No se permiten fiestas ni eventos", en: "No parties or events" },
    { es: "Silencio después de las 10 pm", en: "Quiet hours after 10 pm" },
    { es: "No se fuma dentro de la cabaña", en: "No smoking inside the cabin" },
    { es: "No se aceptan mascotas", en: "No pets allowed" }
  ],
  wifi: { red: "Refugio Niebla", clave: "niebla1480" },

  faq: [
    { q: { es: "¿Hace frío?", en: "Is it cold?" }, a: { es: "De noche bajan las temperaturas a unos 12 °C. La chimenea, las cobijas y el jacuzzi lo resuelven. Traé abrigo.", en: "Nights drop to about 12 °C. The fireplace, blankets and hot tub take care of it. Bring a jacket." } },
    { q: { es: "¿Hay Wi-Fi y señal de celular?", en: "Is there Wi-Fi and cell signal?" }, a: { es: "Sí, hay Wi-Fi de fibra en toda la cabaña y buena señal. Funciona para trabajar a distancia.", en: "Yes, fiber Wi-Fi throughout the cabin and good cell signal. It works for remote work." } },
    { q: { es: "¿Cómo es el camino?", en: "What is the road like?" }, a: { es: "Los últimos 2 km son de lastre. Un carro normal llega con calma; un vehículo alto es más cómodo, sobre todo si llueve.", en: "The last 2 km are gravel. A regular car makes it slowly; a high vehicle is more comfortable, especially in rain." } },
    { q: { es: "¿Cómo es la llegada?", en: "How does arrival work?" }, a: { es: "Es autónoma. El día de tu llegada te enviamos por WhatsApp el código de la puerta y las instrucciones.", en: "It is self check-in. On arrival day we send the door code and instructions on WhatsApp." } },
    { q: { es: "¿Qué pasa si llueve?", en: "What if it rains?" }, a: { es: "Es bosque nuboso: llueve y es parte del plan. La cabaña tiene chimenea, libros y juegos de mesa.", en: "It is cloud forest: rain is part of the plan. The cabin has a fireplace, books and board games." } }
  ],

  resenas: {
    nota: 4.9, total: 124,
    lista: [
      { texto: { es: "Despertar con la niebla entre los árboles desde la cama es algo que no olvidaremos. Los anfitriones pensaron en todo.", en: "Waking up to fog among the trees from bed is something we won't forget. The hosts thought of everything." }, autor: "Sarah y Tom, Denver" },
      { texto: { es: "Jacuzzi, chimenea y silencio. Vinimos dos noches y quisimos quedarnos una semana.", en: "Hot tub, fireplace and silence. We came for two nights and wanted to stay a week." }, autor: "Camille, Montreal" },
      { texto: { es: "Reservamos directo y fue facilísimo. Nos dejaron la cena lista el día del aniversario.", en: "We booked direct and it was effortless. They had dinner ready on our anniversary." }, autor: "Familia Rojas, San José" }
    ]
  }
};
