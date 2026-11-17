/* =========================================================
   CONFIGURACIÓN DEL RESTAURANTE
   Para cada cliente nuevo: cambiá SOLO este archivo.
   ========================================================= */
window.RESTAURANTE = {
  nombre: "Salitre",
  lugar: { es: "Santa Teresa, Costa Rica", en: "Santa Teresa, Costa Rica" },
  lema: { es: "Cocina de autor frente al Pacífico", en: "Chef's cuisine on the Pacific shore" },
  horario: { es: "Martes a domingo, de 6 a 11 pm", en: "Tuesday to Sunday, 6 to 11 pm" },
  direccion: { es: "200 m norte de playa Hermosa, Santa Teresa", en: "200 m north of Hermosa beach, Santa Teresa" },
  whatsapp: "50688888888",          // con 506 adelante, sin espacios
  instagram: "salitre.cr",
  mapa: "https://maps.google.com/?q=Santa+Teresa+Costa+Rica",

  paleta: "bordeaux",                // bordeaux | nuit | bouteille | porcelaine
  metal: null,                       // ej. "#C9CCD1" para filos plateados en vez de dorados
  tipoCambio: 505,                   // colones por dólar
  modoDemo: true,                    // false = oculta el panel de paletas (versión final del cliente)

  nota: {
    texto: {
      es: "Cocinamos con lo que trae la lancha cada mañana. Por eso la carta cambia con el mar.",
      en: "We cook with whatever the boat brings in each morning, so the menu changes with the sea."
    },
    firma: { es: "Andrea Solís, chef", en: "Andrea Solís, chef" }
  },

  categorias: [
    {
      id: "empezar",
      nombre: { es: "Para empezar", en: "To begin" },
      platos: [
        { nombre: { es: "Ostras de Guanacaste", en: "Guanacaste oysters" },
          desc: { es: "Mignonette de cas, aceite de culantro", en: "Cas fruit mignonette, cilantro oil" },
          precio: 14000, marcas: ["sg"] },
        { nombre: { es: "Tartar de atún aleta amarilla", en: "Yellowfin tuna tartare" },
          desc: { es: "Palmito, yema curada, crujiente de yuca", en: "Heart of palm, cured yolk, cassava crisp" },
          precio: 13500, marcas: ["sg"] },
        { nombre: { es: "Queso Turrialba asado", en: "Roasted Turrialba cheese" },
          desc: { es: "Miel de jicote, higos, pan de masa madre", en: "Jicote honey, figs, sourdough" },
          precio: 9800, marcas: ["v"] }
      ]
    },
    {
      id: "platos",
      nombre: { es: "Platos", en: "Mains" },
      platos: [
        { nombre: { es: "Pargo rojo", en: "Red snapper" },
          desc: { es: "Beurre blanc de maracuyá, palmito asado", en: "Passion fruit beurre blanc, roasted heart of palm" },
          precio: 24000, marcas: ["sg"] },
        { nombre: { es: "Langosta del Caribe", en: "Caribbean lobster" },
          desc: { es: "Mantequilla de coco y lima, arroz negro", en: "Coconut and lime butter, black rice" },
          precio: 42000, marcas: ["sg"] },
        { nombre: { es: "Lomo de res madurado", en: "Dry-aged beef tenderloin" },
          desc: { es: "Jus de café de Tarrazú, puré de pejibaye", en: "Tarrazú coffee jus, peach palm purée" },
          precio: 38000, marcas: [] },
        { nombre: { es: "Risotto de hongos", en: "Mushroom risotto" },
          desc: { es: "Parmesano añejo, trufa negra", en: "Aged parmesan, black truffle" },
          precio: 19500, marcas: ["v", "sg"] }
      ]
    },
    {
      id: "postres",
      nombre: { es: "Postres", en: "Desserts" },
      platos: [
        { nombre: { es: "Soufflé de cacao de Talamanca", en: "Talamanca cacao soufflé" },
          desc: { es: "Crema inglesa de vainilla", en: "Vanilla crème anglaise" },
          precio: 8500, marcas: ["v"] },
        { nombre: { es: "Tarta tatin de piña", en: "Pineapple tarte tatin" },
          desc: { es: "Helado de natilla", en: "Sour cream ice cream" },
          precio: 7800, marcas: ["v"] }
      ]
    },
    {
      id: "bodega",
      nombre: { es: "Bodega", en: "Wine" },
      platos: [
        { nombre: { es: "Champagne Blanc de Blancs", en: "Champagne Blanc de Blancs" },
          desc: { es: "Copa", en: "By the glass" }, precio: 18000, marcas: [] },
        { nombre: { es: "Sancerre", en: "Sancerre" },
          desc: { es: "Copa, Loira", en: "By the glass, Loire" }, precio: 11000, marcas: [] },
        { nombre: { es: "Café de Tarrazú", en: "Tarrazú coffee" },
          desc: { es: "Chorreado en mesa", en: "Pour-over at the table" }, precio: 3500, marcas: ["vg"] }
      ]
    }
  ],

  degustacion: {
    nombre: { es: "Menú degustación", en: "Tasting menu" },
    desc: { es: "Siete tiempos que el chef arma según la pesca del día.", en: "Seven courses built around the day's catch." },
    precio: 75000,
    maridaje: { es: "Maridaje con vinos franceses", en: "French wine pairing" },
    precioMaridaje: 45000
  }
};
