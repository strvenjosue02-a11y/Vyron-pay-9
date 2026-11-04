import { photo, type Photo } from "./assets";

export type OptionGroup =
  | { id: string; label: string; kind: "one"; choices: { id: string; label: string; delta: number }[] }
  | { id: string; label: string; kind: "many"; max?: number; choices: { id: string; label: string; delta: number }[] }
  | { id: string; label: string; kind: "remove"; choices: { id: string; label: string }[] };

export type Product = {
  id: string;
  category: CategoryId;
  name: string;
  short: string;
  description: string;
  price: number;
  kcal: number;
  minutes: number;
  weight?: string;
  tag?: string;
  photo: Photo;
  options: OptionGroup[];
};

export type CategoryId = "burgers" | "combos" | "pollo" | "papas" | "nachos" | "batidos";
export const categories: { id: CategoryId; label: string }[] = [
  { id: "burgers", label: "Hamburguesas" },
  { id: "combos", label: "Combos" },
  { id: "pollo", label: "Pollo" },
  { id: "papas", label: "Papas" },
  { id: "nachos", label: "Nachos" },
  { id: "batidos", label: "Batidos" },
];

const extrasBurger = {
  id: "extras", label: "Extras", kind: "many" as const, max: 4,
  choices: [
    { id: "bacon", label: "Tocino ahumado", delta: 25 },
    { id: "cheddar", label: "Cheddar extra", delta: 18 },
    { id: "jalapeno", label: "Jalapeño asado", delta: 12 },
    { id: "huevo", label: "Huevo estrellado", delta: 20 },
  ],
};
const papasSize = {
  id: "papas", label: "Papas", kind: "one" as const,
  choices: [
    { id: "reg", label: "Regulares", delta: 0 },
    { id: "gde", label: "Grandes", delta: 15 },
    { id: "cheddar", label: "Con cheddar y tocino", delta: 32 },
  ],
};
const bebida = {
  id: "bebida", label: "Bebida", kind: "one" as const,
  choices: [
    { id: "refresco", label: "Refresco 500 ml", delta: 0 },
    { id: "limonada", label: "Limonada natural", delta: 8 },
    { id: "batido", label: "Mini batido", delta: 35 },
  ],
};
const shakeSize = {
  id: "size", label: "Tamaño", kind: "one" as const,
  choices: [
    { id: "16", label: "16 oz", delta: 0 },
    { id: "24", label: "24 oz", delta: 22 },
  ],
};
const shakeExtras = {
  id: "extras", label: "Toppings", kind: "many" as const, max: 3,
  choices: [
    { id: "crema", label: "Doble crema batida", delta: 10 },
    { id: "cookie", label: "Galleta triturada", delta: 12 },
    { id: "jarabe", label: "Jarabe de chocolate", delta: 10 },
  ],
};

export const products: Product[] = [
  {
    id: "smash-bacon", category: "burgers", name: "Smash Bacon", short: "Doble smash, cheddar fundido y tocino crujiente",
    description: "Dos carnes smash a la plancha con costra, cheddar americano fundido, tocino ahumado, jitomate, lechuga, cebolla morada y salsa de la casa en pan brioche tostado.",
    price: 189, kcal: 1080, minutes: 9, weight: "2 × 110 g", tag: "Más pedida", photo: photo("burger-bacon"),
    options: [
      { id: "carne", label: "Carne", kind: "one", choices: [{ id: "doble", label: "Doble", delta: 0 }, { id: "sencilla", label: "Sencilla", delta: -35 }, { id: "triple", label: "Triple", delta: 45 }] },
      extrasBurger,
      { id: "quitar", label: "Quitar", kind: "remove", choices: [{ id: "cebolla", label: "Cebolla" }, { id: "jitomate", label: "Jitomate" }, { id: "lechuga", label: "Lechuga" }, { id: "salsa", label: "Salsa" }] },
    ],
  },
  {
    id: "clasica-papas", category: "combos", name: "Clásica + papas", short: "Cheeseburger con papas a la francesa y bebida",
    description: "Carne de res de 150 g, cheddar, lechuga rizada, jitomate y pepinillos en pan brioche, con papas fritas de corte grueso y la bebida que elijas.",
    price: 175, kcal: 1240, minutes: 10, weight: "150 g", photo: photo("burger-papas"),
    options: [papasSize, bebida, extrasBurger, { id: "quitar", label: "Quitar", kind: "remove", choices: [{ id: "pepinillos", label: "Pepinillos" }, { id: "jitomate", label: "Jitomate" }, { id: "lechuga", label: "Lechuga" }] }],
  },
  {
    id: "tenders-papas", category: "pollo", name: "Tenders + papas", short: "Pechuga empanizada a mano con papas",
    description: "Seis tiras de pechuga marinada 24 horas en suero de leche, empanizadas a mano y fritas al momento, con papas de la casa y dos aderezos.",
    price: 165, kcal: 1120, minutes: 11, weight: "6 piezas", photo: photo("pollo-papas"),
    options: [
      { id: "piezas", label: "Piezas", kind: "one", choices: [{ id: "6", label: "6 piezas", delta: 0 }, { id: "4", label: "4 piezas", delta: -30 }, { id: "10", label: "10 piezas", delta: 65 }] },
      { id: "salsas", label: "Aderezos", kind: "many", max: 2, choices: [{ id: "ranch", label: "Ranch", delta: 0 }, { id: "bbq", label: "BBQ ahumada", delta: 0 }, { id: "buffalo", label: "Buffalo", delta: 0 }, { id: "miel", label: "Miel mostaza", delta: 0 }] },
      papasSize,
    ],
  },
  {
    id: "papas-casa", category: "papas", name: "Papas de la casa", short: "Corte grueso, doble fritura, sal de mar",
    description: "Papa blanca cortada cada mañana, frita primero a 150 °C y después a 185 °C para una costra dorada y el centro suave. Sal de mar al salir del aceite.",
    price: 69, kcal: 480, minutes: 6, weight: "250 g", photo: photo("papas"),
    options: [
      { id: "size", label: "Tamaño", kind: "one", choices: [{ id: "reg", label: "Regular", delta: 0 }, { id: "gde", label: "Grande", delta: 20 }, { id: "fam", label: "Para compartir", delta: 45 }] },
      { id: "extras", label: "Extras", kind: "many", max: 3, choices: [{ id: "cheddar", label: "Salsa cheddar", delta: 22 }, { id: "tocino", label: "Tocino", delta: 25 }, { id: "trufa", label: "Aceite de trufa y parmesano", delta: 35 }] },
    ],
  },
  {
    id: "nachos-supremos", category: "nachos", name: "Nachos supremos", short: "Totopos, carne, cheddar, guacamole y pico de gallo",
    description: "Totopos de maíz recién fritos con carne molida sazonada, cheddar fundido, guacamole, crema, pico de gallo y salsa de aguacate, servidos en sartén caliente.",
    price: 155, kcal: 980, minutes: 8, tag: "Para compartir", photo: photo("nachos"),
    options: [
      { id: "proteina", label: "Proteína", kind: "one", choices: [{ id: "res", label: "Carne de res", delta: 0 }, { id: "pollo", label: "Pollo", delta: 0 }, { id: "sin", label: "Sin carne", delta: -25 }] },
      { id: "extras", label: "Extras", kind: "many", max: 3, choices: [{ id: "guac", label: "Doble guacamole", delta: 25 }, { id: "jalapeno", label: "Jalapeños", delta: 10 }, { id: "queso", label: "Más queso", delta: 18 }] },
      { id: "quitar", label: "Quitar", kind: "remove", choices: [{ id: "crema", label: "Crema" }, { id: "cebolla", label: "Cebolla" }, { id: "cilantro", label: "Cilantro" }] },
    ],
  },
  {
    id: "batido-fresa", category: "batidos", name: "Batido de fresa", short: "Fresa natural, crema batida y galleta",
    description: "Helado de vainilla batido con fresas frescas, coronado con crema batida, galleta graham triturada y una fresa entera.",
    price: 89, kcal: 640, minutes: 4, photo: photo("batido-fresa"), options: [shakeSize, shakeExtras],
  },
  {
    id: "batido-chocolate", category: "batidos", name: "Batido de chocolate", short: "Chocolate oscuro, chispas y barquillo",
    description: "Helado de chocolate batido con jarabe de cacao en el vaso, crema batida, chispas de chocolate, cereza y barquillo.",
    price: 89, kcal: 720, minutes: 4, photo: photo("batido-chocolate"), options: [shakeSize, shakeExtras],
  },
  {
    id: "batido-oreo", category: "batidos", name: "Batido cookies & cream", short: "Vainilla con galleta de chocolate triturada",
    description: "Helado de vainilla batido con galletas de chocolate trituradas, crema batida y dos galletas enteras.",
    price: 95, kcal: 780, minutes: 4, tag: "Nuevo", photo: photo("batido-oreo"), options: [shakeSize, shakeExtras],
  },
];

export const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
