import { SmoothScroll, scrollToTarget } from "@/components/motion/smooth-scroll";
import { BurgerHero } from "@/features/burger/burger-hero";
import { Menu } from "@/features/burger/menu";
import { OrderBar } from "@/features/burger/order-bar";
import { useCart } from "@/features/burger/cart";
import { ChickenScene, FriesScene, Showcase } from "@/features/food/showcase";

const jump = (id: string) => () => {
  const el = document.getElementById(id);
  if (el) scrollToTarget(el, -72);
};

export default function App() {
  const cart = useCart();
  return (
    <SmoothScroll>
      <main>
        <BurgerHero />
        <Showcase
          id="capitulo-papas"
          eyebrow="Papas de la casa"
          Scene={FriesScene}
          cta="Ver papas"
          onCta={jump("fries")}
          beats={[
            { at: 0, title: "Corte grueso, a mano", body: "Papa blanca de temporada, cortada cada mañana en bastones de 11 mm." },
            { at: 0.35, title: "Doble fritura", body: "Primero a 150 °C para cocer el centro, después a 185 °C para la costra." },
            { at: 0.7, title: "Sal de mar, al momento", body: "Escamas finas justo al salir del aceite, para que se adhieran." },
          ]}
        />
        <Showcase
          id="capitulo-pollo"
          eyebrow="Pollo frito"
          Scene={ChickenScene}
          cta="Ver pollo"
          onCta={jump("chicken")}
          beats={[
            { at: 0, title: "Marinado 24 horas", body: "Suero de leche, ajo y pimentón ahumado: jugoso hasta el hueso." },
            { at: 0.3, title: "Empanizado a mano", body: "Doble pasada por harina especiada para esas crestas que crujen." },
            { at: 0.65, title: "Recién salido", body: "Muslos y tiras dorados, servidos sobre papel en cuanto dejan de chisporrotear." },
          ]}
        />
        <Menu cart={cart} />
      </main>
      <OrderBar cart={cart} />
    </SmoothScroll>
  );
}
