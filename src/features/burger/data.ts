/** Burger layers, bottom → top. `height` is the assembled thickness in scene units. */
export const layers = [
  { id: "bottom-bun", name: "Pan brioche", detail: "Base tostada en mantequilla", height: 0.37 },
  { id: "patty", name: "Smash de res 180 g", detail: "Angus, costra caramelizada a 250 °C", height: 0.3 },
  { id: "cheese", name: "Cheddar fundido", detail: "Madurado 12 meses, se derrite en la plancha", height: 0.03 },
  { id: "onion", name: "Cebolla morada", detail: "Cortada fina, crujiente", height: 0.06 },
  { id: "pickles", name: "Pepinillos", detail: "Encurtidos en casa con eneldo", height: 0.05 },
  { id: "tomato", name: "Tomate de huerta", detail: "Rodajas gruesas, recién cortadas", height: 0.09 },
  { id: "lettuce", name: "Lechuga crespa", detail: "Hojas frías para el contraste", height: 0.08 },
  { id: "top-bun", name: "Corona con ajonjolí", detail: "Horneado cada mañana", height: 0.89 },
] as const;

export type Category = { id: string; label: string };
export const categories: Category[] = [
  { id: "burgers", label: "Hamburguesas" },
  { id: "fries", label: "Papas" },
  { id: "chicken", label: "Pollo" },
  { id: "combos", label: "Combos" },
  { id: "drinks", label: "Bebidas" },
];

export type Product = {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  kcal: number;
  tag?: "Nuevo" | "Picante" | "Favorito" | "Veggie";
};

export const products: Product[] = [
  { id: "smash-doble", category: "burgers", name: "Smash Doble", description: "Dos smash de res, cheddar, cebolla, pepinillos y salsa de la casa.", price: 11.9, kcal: 860, tag: "Favorito" },
  { id: "clasica", category: "burgers", name: "La Clásica", description: "Res 180 g, lechuga, tomate, cebolla morada y cheddar.", price: 9.5, kcal: 690 },
  { id: "bbq-bacon", category: "burgers", name: "BBQ Bacon", description: "Tocino ahumado, aros de cebolla, BBQ de chipotle y gouda.", price: 12.9, kcal: 940 },
  { id: "trufa", category: "burgers", name: "Trufa Negra", description: "Res wagyu, mayonesa de trufa, hongos salteados y gruyère.", price: 15.5, kcal: 820, tag: "Nuevo" },
  { id: "diabla", category: "burgers", name: "La Diabla", description: "Jalapeño asado, pepper jack, salsa habanero y cebolla crujiente.", price: 12.5, kcal: 880, tag: "Picante" },
  { id: "garden", category: "burgers", name: "Garden", description: "Medallón de garbanzo y remolacha, aguacate y alioli de limón.", price: 10.9, kcal: 610, tag: "Veggie" },

  { id: "papas-clasicas", category: "fries", name: "Papas Clásicas", description: "Corte grueso, doble fritura, sal de mar.", price: 3.9, kcal: 420 },
  { id: "papas-trufa", category: "fries", name: "Papas Trufa & Parmesano", description: "Aceite de trufa, parmesano y perejil.", price: 5.9, kcal: 510, tag: "Favorito" },
  { id: "papas-cheddar", category: "fries", name: "Cheddar & Tocino", description: "Salsa de cheddar, tocino crujiente y cebollín.", price: 6.5, kcal: 690 },
  { id: "camote", category: "fries", name: "Camote Crujiente", description: "Batata con paprika ahumada y mayo de chipotle.", price: 4.9, kcal: 450, tag: "Veggie" },

  { id: "tenders", category: "chicken", name: "Tenders (5 pzs)", description: "Pechuga empanizada a mano, crujiente por fuera, jugosa por dentro.", price: 8.9, kcal: 640, tag: "Favorito" },
  { id: "nashville", category: "chicken", name: "Nashville Hot", description: "Sándwich de pollo picante, pepinillos y slaw.", price: 11.5, kcal: 870, tag: "Picante" },
  { id: "alitas-bbq", category: "chicken", name: "Alitas BBQ (8)", description: "Glaseadas con BBQ de miel y ajonjolí.", price: 10.5, kcal: 780 },
  { id: "alitas-buffalo", category: "chicken", name: "Alitas Buffalo (8)", description: "Salsa buffalo clásica con dip de queso azul.", price: 10.5, kcal: 760, tag: "Picante" },
  { id: "popcorn", category: "chicken", name: "Popcorn Chicken", description: "Bocados crujientes con miel mostaza.", price: 6.9, kcal: 520, tag: "Nuevo" },

  { id: "combo-smash", category: "combos", name: "Combo Smash", description: "Smash Doble + papas clásicas + bebida.", price: 15.9, kcal: 1420, tag: "Favorito" },
  { id: "combo-pollo", category: "combos", name: "Combo Crunch", description: "Tenders (5) + papas cheddar + bebida.", price: 15.5, kcal: 1480 },
  { id: "combo-familia", category: "combos", name: "Familiar", description: "4 burgers clásicas, 2 papas grandes, 8 alitas y 4 bebidas.", price: 49.9, kcal: 5200 },

  { id: "malteada", category: "drinks", name: "Malteada Vainilla", description: "Helado artesanal, vainilla de Papantla.", price: 5.5, kcal: 580 },
  { id: "limonada", category: "drinks", name: "Limonada de la Casa", description: "Limón amarillo, menta y un toque de jengibre.", price: 3.5, kcal: 140 },
  { id: "soda", category: "drinks", name: "Refresco", description: "Cola, naranja o lima-limón. Refill gratis.", price: 2.5, kcal: 180 },
  { id: "cerveza", category: "drinks", name: "Cerveza Artesanal", description: "IPA o lager local, 355 ml.", price: 5.9, kcal: 210 },
];

export const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" });
