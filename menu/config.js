/* =========================================================
   CONFIGURACIÓN DEL RESTAURANTE
   Para cada cliente nuevo: cambiá SOLO este archivo.
   ========================================================= */
window.RESTAURANTE = {
  nombre: "Pochote",
  lema: {
    es: "Cocina de playa, pescado del día y patacones como en casa.",
    en: "Beach kitchen, catch of the day and patacones like home."
  },
  ubicacion: { es: "Santa Teresa, Puntarenas", en: "Santa Teresa, Costa Rica" },
  horario:   { es: "Todos los días, 12 md a 10 pm", en: "Every day, 12 pm to 10 pm" },
  whatsapp: "50688888888",          // con 506 adelante, sin espacios
  instagram: "pochote.cr",
  mapa: "https://maps.google.com/?q=Santa+Teresa+Costa+Rica",

  tema: "playa",                     // playa | volcan | caribe | ciudad
  colorAcento: null,                 // ej. "#FF6B4A" para forzar un color
  tipoCambio: 505,                   // colones por dólar
  modoDemo: true,                    // false = oculta el botón de estilos (versión final del cliente)

  notaPrecios: {
    es: "Precios en colones con impuestos incluidos (IVA 13 % y servicio 10 %).",
    en: "Prices include taxes (13 % VAT and 10 % service)."
  },

  destacado: {
    nombre: { es: "Pescado entero frito", en: "Whole fried snapper" },
    desc: {
      es: "Pargo rojo de la lancha de esta mañana, patacones, arroz con coco y ensalada de repollo.",
      en: "Red snapper off this morning's boat, patacones, coconut rice and cabbage slaw."
    },
    precio: 12500,
    etiquetas: ["sinGluten"]
  },

  categorias: [
    {
      id: "entradas",
      nombre: { es: "Para compartir", en: "To share" },
      platos: [
        { nombre: { es: "Ceviche de pescado", en: "Fish ceviche" },
          desc: { es: "Corvina, limón mandarina, culantro y chile dulce.", en: "Sea bass, mandarin lime, cilantro and sweet pepper." },
          precio: 5800, etiquetas: ["sinGluten"] },
        { nombre: { es: "Patacones con frijol molido", en: "Patacones with black bean dip" },
          desc: { es: "Plátano verde frito, frijol molido, pico de gallo y natilla.", en: "Fried green plantain, bean dip, pico de gallo and sour cream." },
          precio: 4200, etiquetas: ["vegetariano", "sinGluten"] },
        { nombre: { es: "Chifrijo", en: "Chifrijo" },
          desc: { es: "Arroz, frijoles, chicharrón, pico de gallo y aguacate.", en: "Rice, beans, crispy pork, pico de gallo and avocado." },
          precio: 4900, etiquetas: [] },
        { nombre: { es: "Tacos de pescado", en: "Fish tacos" },
          desc: { es: "Tres tacos con pescado en tempura, repollo morado y salsa de chile panameño.", en: "Three tempura fish tacos, purple cabbage and Panamanian chili sauce." },
          precio: 5500, etiquetas: ["picante"] }
      ]
    },
    {
      id: "fuertes",
      nombre: { es: "Platos fuertes", en: "Mains" },
      platos: [
        { nombre: { es: "Casado de pescado", en: "Casado with fish" },
          desc: { es: "Filete a la plancha, arroz, frijoles, plátano maduro y ensalada.", en: "Grilled fillet, rice, beans, sweet plantain and salad." },
          precio: 7200, etiquetas: ["sinGluten"] },
        { nombre: { es: "Arroz con mariscos", en: "Seafood rice" },
          desc: { es: "Camarón, calamar y mejillón con achiote y culantro.", en: "Shrimp, squid and mussels with annatto and cilantro." },
          precio: 8900, etiquetas: [] },
        { nombre: { es: "Sopa de mariscos", en: "Seafood soup" },
          desc: { es: "Caldo de coco, camarón, pescado y yuca.", en: "Coconut broth, shrimp, fish and cassava." },
          precio: 7800, etiquetas: ["sinGluten", "picante"] },
        { nombre: { es: "Bowl de la huerta", en: "Garden bowl" },
          desc: { es: "Arroz integral, frijoles negros, aguacate, palmito y vinagreta de maracuyá.", en: "Brown rice, black beans, avocado, heart of palm and passion fruit dressing." },
          precio: 6400, etiquetas: ["vegano", "sinGluten"] }
      ]
    },
    {
      id: "bebidas",
      nombre: { es: "Bebidas", en: "Drinks" },
      platos: [
        { nombre: { es: "Batido de cas", en: "Cas fruit smoothie" },
          desc: { es: "En agua o en leche.", en: "With water or milk." },
          precio: 2200, etiquetas: ["vegano"] },
        { nombre: { es: "Guaro sour", en: "Guaro sour" },
          desc: { es: "Guaro Cacique, limón y sirope de tapa de dulce.", en: "Local cane liquor, lime and raw sugar syrup." },
          precio: 3900, etiquetas: [] },
        { nombre: { es: "Cerveza nacional", en: "Local beer" },
          desc: { es: "Imperial, Pilsen o Bavaria.", en: "Imperial, Pilsen or Bavaria." },
          precio: 2500, etiquetas: [] },
        { nombre: { es: "Café chorreado", en: "Pour-over coffee" },
          desc: { es: "Café de Tarrazú hecho en chorreador.", en: "Tarrazú coffee brewed in a traditional cloth drip." },
          precio: 1800, etiquetas: ["vegano"] }
      ]
    },
    {
      id: "postres",
      nombre: { es: "Postres", en: "Desserts" },
      platos: [
        { nombre: { es: "Tres leches", en: "Tres leches cake" },
          desc: { es: "La receta de la abuela.", en: "Grandma's recipe." },
          precio: 3200, etiquetas: ["vegetariano"] },
        { nombre: { es: "Arroz con leche", en: "Rice pudding" },
          desc: { es: "Con canela y clavo de olor.", en: "With cinnamon and clove." },
          precio: 2600, etiquetas: ["vegetariano", "sinGluten"] }
      ]
    }
  ]
};
