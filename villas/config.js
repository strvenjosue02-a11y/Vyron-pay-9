/* =========================================================
   CONFIGURACIÓN DE LA CASA
   Para cada cliente nuevo: cambiá SOLO este archivo.
   Instrucciones completas en LEEME.md
   ========================================================= */
window.VILLA = {
  nombre: "Casa Marea",
  lugar: { es: "Nosara, Guanacaste", en: "Nosara, Guanacaste" },
  lema: { es: "Una casa frente al Pacífico para ocho personas", en: "A Pacific-view house for eight guests" },

  anfitrion: {
    nombre: "Andrea y Luis",
    nota: {
      es: "Construimos esta casa para pasar tiempo en familia y ahora la compartimos con la suya. Respondemos personalmente cada mensaje.",
      en: "We built this house to spend time with family and now we share it with yours. We answer every message personally."
    }
  },

  whatsapp: "50688888888",                 // con 506 adelante, sin espacios
  instagram: "casamarea.cr",
  mapa: "https://maps.google.com/?q=Nosara+Costa+Rica",
  resenaUrl: "https://g.page/r/EJEMPLO/review",     // link para dejar reseña (Google o Airbnb)

  // Ubicación de la casa (calcula el atardecer) y un punto en el mar cercano (olas)
  coordenadas: { lat: 9.9763, lng: -85.6539 },
  coordenadasMar: { lat: 9.97, lng: -85.70 },

  // "auto" = cambia sola con el sol: de día arena, al atardecer atardecer, de noche la de "paletaNoche".
  // También se puede fijar una: arena | oceano | atardecer | selva
  paleta: "auto",
  paletaNoche: "oceano",
  tipoCambio: 505,                         // colones por dólar
  modoDemo: true,                          // false = oculta el panel de paletas y las etiquetas de foto de referencia

  // Opcional: hoja de Google publicada como CSV con las columnas "inicio" y "fin" (AAAA-MM-DD).
  // El anfitrión bloquea fechas desde el celular y el calendario se actualiza solo.
  hojaGoogle: "",

  specs: {
    huespedes: 8, habitaciones: 4, banos: "4 y medio",
    playa: { es: "3 minutos a pie", en: "a 3-minute walk" }
  },
  descripcion: {
    es: "Dos plantas de líneas limpias, ventanales al mar y una piscina infinita que mira directo al atardecer. Cocina completa, terraza con parrilla y aire acondicionado en cada habitación.",
    en: "Two floors of clean lines, floor-to-ceiling windows to the sea and an infinity pool facing the sunset. Full kitchen, terrace with grill and air conditioning in every bedroom."
  },

  checkin: "3:00 pm",
  checkout: "11:00 am",
  minNoches: 3,

  // Precios en dólares por noche. Los períodos se revisan en orden; gana el primero que coincida.
  tarifas: [
    { id: "fin",  nombre: { es: "Fin de año", en: "New Year" },        rangos: [["12-20", "01-05"]], noche: 650 },
    { id: "alta", nombre: { es: "Temporada alta", en: "High season" },  rangos: [["12-01", "04-30"]], noche: 420 },
    { id: "baja", nombre: { es: "Temporada verde", en: "Green season" }, rangos: [["05-01", "11-30"]], noche: 260 }
  ],
  limpieza: 150,                           // una sola vez por estadía
  impuesto: 0.13,                          // IVA que se suma al total
  descuentoDirecto: 10,                    // % de descuento sobre el hospedaje al reservar directo

  extras: [
    { id: "chef",    nombre: { es: "Chef privado, una cena", en: "Private chef, one dinner" },   precio: 180 },
    { id: "traslado", nombre: { es: "Traslado desde el aeropuerto", en: "Airport transfer" },    precio: 140 },
    { id: "bote",    nombre: { es: "Paseo en bote al atardecer", en: "Sunset boat tour" },      precio: 220 }
  ],

  // Noches ocupadas: [entrada, salida). La fecha de salida queda libre para otra entrada.
  // "demo" genera fechas ocupadas a partir de hoy, para que la demo siempre se vea viva.
  reservadas: "demo",

  habitaciones: [
    { nombre: { es: "Principal", en: "Primary suite" },       desc: { es: "Cama king, baño privado y terraza con vista al mar.", en: "King bed, private bath and a terrace with sea views." } },
    { nombre: { es: "Segunda suite", en: "Second suite" },    desc: { es: "Cama queen, baño privado y salida a la piscina.", en: "Queen bed, private bath and direct pool access." } },
    { nombre: { es: "Habitación doble", en: "Twin room" },    desc: { es: "Dos camas individuales y baño compartido con la tercera.", en: "Two single beds and a bath shared with the third room." } },
    { nombre: { es: "Habitación familiar", en: "Family room" }, desc: { es: "Cama queen y litera para niños. Aire acondicionado.", en: "Queen bed and bunk beds for children. Air conditioning." } }
  ],

  comodidades: [
    { es: "Piscina infinita", en: "Infinity pool" },
    { es: "Aire acondicionado en todas las habitaciones", en: "Air conditioning in every bedroom" },
    { es: "Wi-Fi de fibra óptica", en: "Fiber-optic Wi-Fi" },
    { es: "Cocina completa", en: "Full kitchen" },
    { es: "Parrilla en la terraza", en: "Terrace grill" },
    { es: "Espacio de trabajo", en: "Workspace" },
    { es: "Lavadora y secadora", en: "Washer and dryer" },
    { es: "Parqueo para tres carros", en: "Parking for three cars" },
    { es: "Toallas de playa y sillas", en: "Beach towels and chairs" },
    { es: "Aceptamos mascotas pequeñas", en: "Small pets welcome" }
  ],

  fotos: [
    { src: "img/villa.jpg", x: 62, y: 72, z: 2.2 },
    { src: "img/villa.jpg", x: 12, y: 40, z: 2.0 },
    { src: "img/villa.jpg", x: 88, y: 78, z: 2.1 }
  ],

  wifi: { red: "Casa Marea", clave: "nosara2026" },
  guia: {
    cerca: [
      { es: "Playa Guiones", en: "Playa Guiones", dato: { es: "3 minutos a pie", en: "3-minute walk" } },
      { es: "Supermercado y farmacia", en: "Supermarket and pharmacy", dato: { es: "5 minutos en carro", en: "5 minutes by car" } },
      { es: "Clases de surf y yoga", en: "Surf and yoga classes", dato: { es: "A 8 minutos", en: "8 minutes away" } },
      { es: "Restaurantes de pescado fresco", en: "Fresh seafood restaurants", dato: { es: "A 4 minutos", en: "4 minutes away" } }
    ],
    normas: [
      { es: "No se permiten fiestas ni eventos", en: "No parties or events" },
      { es: "Silencio después de las 10 pm", en: "Quiet hours after 10 pm" },
      { es: "No se fuma dentro de la casa", en: "No smoking inside the house" }
    ]
  },

  resenas: {
    nota: 4.9, total: 86,
    lista: [
      { texto: { es: "La vista desde la piscina es increíble y los anfitriones respondieron todo en minutos. Volveremos.", en: "The view from the pool is unreal and the hosts answered everything within minutes. We'll be back." }, autor: "Sarah y Tom, Denver" },
      { texto: { es: "Casa impecable, cama cómoda y un atardecer distinto cada noche. Perfecta para ir con amigos.", en: "Spotless house, comfortable beds and a different sunset every night. Perfect for a group of friends." }, autor: "Camille, Montreal" },
      { texto: { es: "Reservamos directo y fue facilísimo. Nos ayudaron con el traslado y el chef.", en: "We booked direct and it was effortless. They set up the transfer and the chef for us." }, autor: "Familia Rojas, San José" }
    ]
  }
};
