/* =========================================================
   CONFIGURACIÓN DEL RESTAURANTE
   Para cada cliente nuevo: cambiá SOLO este archivo.
   Instrucciones completas en LEEME.md
   ========================================================= */
window.RESTAURANTE = {
  nombre: "Salitre",
  lugar: { es: "Santa Teresa, Costa Rica", en: "Santa Teresa, Costa Rica" },
  lema: { es: "Cocina de autor frente al Pacífico", en: "Chef's cuisine on the Pacific shore" },

  // Días abiertos: 0 domingo, 1 lunes ... 6 sábado. Hora en formato 24 h.
  horario: { dias: [2, 3, 4, 5, 6, 0], abre: "18:00", cierra: "23:00" },
  direccion: { es: "200 m norte de playa Hermosa, Santa Teresa", en: "200 m north of Hermosa beach, Santa Teresa" },
  whatsapp: "50688888888",                 // con 506 adelante, sin espacios
  instagram: "salitre.cr",
  mapa: "https://maps.google.com/?q=Santa+Teresa+Costa+Rica",
  resenaGoogle: "https://g.page/r/EJEMPLO/review",   // link "Escribir una reseña" de Google Business

  paleta: "bordeaux",                      // bordeaux | nuit | bouteille | porcelaine
  metal: null,                             // ej. "#C9CCD1" para filos plateados
  tipoCambio: 505,                         // colones por dólar
  modoDemo: true,                          // false = oculta el panel de paletas y las etiquetas "Foto de referencia"
  // Fotos: cada categoría y el menú degustación aceptan "foto". Reemplazá las de img/ por las del restaurante.

  // Opcional: hoja de Google publicada como CSV (columnas: id, precio, agotado).
  // El dueño cambia precios o marca "si" en agotado desde el celular y la carta se actualiza sola.
  hojaGoogle: "",

  nota: {
    texto: {
      es: "Cocinamos con lo que trae la lancha cada mañana. Por eso la carta cambia con el mar.",
      en: "We cook with whatever the boat brings in each morning, so the menu changes with the sea."
    },
    firma: { es: "Andrea Solís, chef", en: "Andrea Solís, chef" }
  },

  /* marcas: v vegetariano, vg vegano, sg sin gluten
     contiene: mariscos, nueces, lacteos (para el filtro de alergias) */
  categorias: [
    {
      id: "empezar",
      nombre: { es: "Para empezar", en: "To begin" },
      foto: "img/foto-caviar.jpg",
      platos: [
        { id: "ostras", nombre: { es: "Ostras de Guanacaste", en: "Guanacaste oysters" },
          desc: { es: "Mignonette de cas, aceite de culantro", en: "Cas fruit mignonette, cilantro oil" },
          maridaje: { es: "Champagne Blanc de Blancs", en: "Champagne Blanc de Blancs" },
          precio: 14000, marcas: ["sg"], contiene: ["mariscos"] },
        { id: "tartar", nombre: { es: "Tartar de atún aleta amarilla", en: "Yellowfin tuna tartare" },
          desc: { es: "Palmito, yema curada, crujiente de yuca", en: "Heart of palm, cured yolk, cassava crisp" },
          maridaje: { es: "Sancerre", en: "Sancerre" },
          precio: 13500, marcas: ["sg"], contiene: ["mariscos"] },
        { id: "turrialba", nombre: { es: "Queso Turrialba asado", en: "Roasted Turrialba cheese" },
          desc: { es: "Miel de jicote, higos, nueces tostadas", en: "Jicote honey, figs, toasted walnuts" },
          precio: 9800, marcas: ["v"], contiene: ["lacteos", "nueces"] }
      ]
    },
    {
      id: "platos",
      nombre: { es: "Platos", en: "Mains" },
      platos: [
        { id: "pargo", nombre: { es: "Pargo rojo", en: "Red snapper" },
          desc: { es: "Beurre blanc de maracuyá, palmito asado", en: "Passion fruit beurre blanc, roasted heart of palm" },
          maridaje: { es: "Chablis Premier Cru", en: "Chablis Premier Cru" },
          precio: 24000, marcas: ["sg"], contiene: ["mariscos", "lacteos"] },
        { id: "langosta", nombre: { es: "Langosta del Caribe", en: "Caribbean lobster" },
          desc: { es: "Mantequilla de coco y lima, arroz negro", en: "Coconut and lime butter, black rice" },
          maridaje: { es: "Meursault", en: "Meursault" },
          precio: 42000, marcas: ["sg"], contiene: ["mariscos"], agotado: true },
        { id: "lomo", nombre: { es: "Lomo de res madurado", en: "Dry-aged beef tenderloin" },
          desc: { es: "Jus de café de Tarrazú, puré de pejibaye", en: "Tarrazú coffee jus, peach palm purée" },
          maridaje: { es: "Saint-Émilion Grand Cru", en: "Saint-Émilion Grand Cru" },
          precio: 38000, marcas: ["sg"], contiene: ["lacteos"] },
        { id: "risotto", nombre: { es: "Risotto de hongos", en: "Mushroom risotto" },
          desc: { es: "Parmesano añejo, trufa negra", en: "Aged parmesan, black truffle" },
          maridaje: { es: "Bourgogne Pinot Noir", en: "Bourgogne Pinot Noir" },
          precio: 19500, marcas: ["v", "sg"], contiene: ["lacteos"] },
        { id: "palmito", nombre: { es: "Palmito a la brasa", en: "Ember-roasted heart of palm" },
          desc: { es: "Mole de cacao, aguacate, semillas de ayote", en: "Cacao mole, avocado, squash seeds" },
          precio: 16500, marcas: ["vg", "sg"], contiene: [] }
      ]
    },
    {
      id: "postres",
      nombre: { es: "Postres", en: "Desserts" },
      foto: "img/foto-esfera.jpg",
      platos: [
        { id: "souffle", nombre: { es: "Soufflé de cacao de Talamanca", en: "Talamanca cacao soufflé" },
          desc: { es: "Crema inglesa de vainilla", en: "Vanilla crème anglaise" },
          maridaje: { es: "Banyuls", en: "Banyuls" },
          precio: 8500, marcas: ["v"], contiene: ["lacteos"] },
        { id: "tatin", nombre: { es: "Tarta tatin de piña", en: "Pineapple tarte tatin" },
          desc: { es: "Helado de natilla", en: "Sour cream ice cream" },
          precio: 7800, marcas: ["v"], contiene: ["lacteos"] }
      ]
    },
    {
      id: "bodega",
      nombre: { es: "Bodega", en: "Wine" },
      foto: "img/foto-vino.jpg",
      platos: [
        { id: "champagne", nombre: { es: "Champagne Blanc de Blancs", en: "Champagne Blanc de Blancs" },
          desc: { es: "Copa", en: "By the glass" }, precio: 18000, marcas: ["vg", "sg"], contiene: [] },
        { id: "sancerre", nombre: { es: "Sancerre", en: "Sancerre" },
          desc: { es: "Copa, Loira", en: "By the glass, Loire" }, precio: 11000, marcas: ["vg", "sg"], contiene: [] },
        { id: "cafe", nombre: { es: "Café de Tarrazú", en: "Tarrazú coffee" },
          desc: { es: "Chorreado en la mesa", en: "Pour-over at the table" }, precio: 3500, marcas: ["vg", "sg"], contiene: [] }
      ]
    }
  ],

  degustacion: {
    nombre: { es: "Menú degustación", en: "Tasting menu" },
    desc: { es: "Siete tiempos que el chef arma según la pesca del día.", en: "Seven courses built around the day's catch." },
    precio: 75000,
    maridaje: { es: "Maridaje con vinos franceses", en: "French wine pairing" },
    precioMaridaje: 45000,
    foto: "img/foto-champan.jpg"
  },

  experiencias: [
    { nombre: { es: "Mesa del chef", en: "Chef's table" },
      desc: { es: "Seis personas frente a la cocina abierta. Andrea cocina y explica cada tiempo.", en: "Six guests facing the open kitchen while Andrea cooks and explains each course." },
      ocasion: "chef" },
    { nombre: { es: "Cena privada en la playa", en: "Private dinner on the beach" },
      desc: { es: "Mesa para dos al atardecer, con mesero propio. Ideal para propuestas.", en: "A table for two at sunset with your own waiter. Made for proposals." },
      ocasion: "playa" },
    { nombre: { es: "Jazz los viernes", en: "Jazz on Fridays" },
      desc: { es: "Trío en vivo desde las 8 pm. Conviene reservar.", en: "Live trio from 8 pm. Booking recommended." },
      ocasion: "jazz" }
  ],

  // Reseñas de ejemplo para la demo. Con un cliente real, copiá textos reales de su Google.
  resenas: {
    nota: 4.8, total: 1240,
    lista: [
      { texto: { es: "La mejor cena de todo el viaje. El pargo con maracuyá todavía lo recuerdo.", en: "Best dinner of our whole trip. I still think about the snapper with passion fruit." }, autor: "Emma R., Londres" },
      { texto: { es: "Servicio impecable y una carta de vinos franceses que no esperábamos encontrar en Santa Teresa.", en: "Flawless service and a French wine list we never expected in Santa Teresa." }, autor: "Julien M., Lyon" },
      { texto: { es: "Hicimos la cena en la playa para nuestro aniversario. Perfecto de principio a fin.", en: "We booked the beach dinner for our anniversary. Perfect from start to finish." }, autor: "Daniela C., San José" }
    ]
  }
};
