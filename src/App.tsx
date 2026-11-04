import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { BurgerHero } from "@/features/burger/burger-hero";
import { Menu } from "@/features/burger/menu";
import { OrderBar } from "@/features/burger/order-bar";
import { useCart } from "@/features/burger/cart";

export default function App() {
  const cart = useCart();
  return (
    <SmoothScroll>
      <main className="dark">
        <BurgerHero />
        <Menu cart={cart} />
      </main>
      <OrderBar cart={cart} />
    </SmoothScroll>
  );
}
