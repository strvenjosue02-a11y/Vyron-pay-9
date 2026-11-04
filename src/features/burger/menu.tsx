import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { scrollToTarget } from "@/components/motion/smooth-scroll";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { categories, money, products, type Product } from "./data";
import { categoryIcon } from "./icons";
import type { Cart } from "./cart";

const tagStyle: Record<NonNullable<Product["tag"]>, string> = {
  Nuevo: "bg-accent/15 text-accent",
  Picante: "bg-primary/15 text-primary",
  Favorito: "bg-white/10 text-foreground",
  Veggie: "bg-emerald-500/15 text-emerald-400",
};

/** Per-category tile tint so the list reads as distinct sections at a glance. */
const tileTint: Record<string, string> = {
  burgers: "from-amber-700/50 to-red-900/40",
  fries: "from-yellow-500/40 to-amber-800/40",
  chicken: "from-orange-600/45 to-amber-900/40",
  combos: "from-red-700/45 to-zinc-900/40",
  drinks: "from-sky-600/35 to-indigo-900/40",
};

function QtyControl({ product, cart }: { product: Product; cart: Cart }) {
  const qty = cart.lines[product.id] ?? 0;
  return (
    <div className="flex h-11 items-center rounded-full bg-white/5">
      <AnimatePresence initial={false}>
        {qty > 0 && (
          <motion.div
            className="flex items-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            <button type="button" onClick={() => cart.remove(product.id)} aria-label={`Quitar ${product.name}`} className="tap grid size-11 place-items-center rounded-full">
              <Minus className="size-4" />
            </button>
            <span className="relative w-5 overflow-hidden text-center text-sm font-semibold tabular-nums">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={qty} className="block" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.15 }}>
                  {qty}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => cart.add(product.id)}
        aria-label={`Agregar ${product.name}`}
        className="tap grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_-6px_var(--primary)]"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function ProductRow({ product, cart }: { product: Product; cart: Cart }) {
  const Icon = categoryIcon[product.category as keyof typeof categoryIcon];
  return (
    <article className="flex gap-4 border-b border-white/[0.06] py-5 last:border-0">
      <div className={cn("grain relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br", tileTint[product.category])}>
        <Icon className="size-8 text-white/85" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold">{product.name}</h3>
          {product.tag && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", tagStyle[product.tag])}>{product.tag}</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <span className="font-semibold tabular-nums">{money(product.price)}</span>
            <span className="ml-2 text-xs text-muted-foreground tabular-nums">{product.kcal} kcal</span>
          </div>
          <QtyControl product={product} cart={cart} />
        </div>
      </div>
    </article>
  );
}

function Featured({ cart }: { cart: Cart }) {
  const picks = products.filter((p) => p.tag === "Favorito");
  return (
    <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2">
      {picks.map((p) => {
        const Icon = categoryIcon[p.category as keyof typeof categoryIcon];
        return (
          <div key={p.id} className={cn("grain relative flex w-[72%] max-w-72 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br p-5", tileTint[p.category])}>
            <Icon className="pointer-events-none absolute -right-4 -bottom-4 size-32 text-white/10" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Más pedido</p>
              <h3 className="mt-2 font-display text-2xl leading-tight">{p.name}</h3>
            </div>
            <div className="relative mt-8 flex items-center justify-between">
              <span className="text-lg font-semibold tabular-nums">{money(p.price)}</span>
              <button type="button" onClick={() => cart.add(p.id)} aria-label={`Agregar ${p.name}`} className="tap grid size-11 place-items-center rounded-full bg-white text-black">
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Menu({ cart }: { cart: Cart }) {
  const [active, setActive] = useState(categories[0].id);
  const sections = useRef<Record<string, HTMLElement | null>>({});
  const tabsRef = useRef<HTMLDivElement>(null);
  const lock = useRef(0); // ignore scroll-spy while a tab-triggered scroll is running

  // Scroll-spy: the section crossing the upper third is the active tab.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lock.current) return;
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-30% 0px -65% 0px" },
    );
    Object.values(sections.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // Keep the active tab visible inside the horizontal tab strip.
  useEffect(() => {
    // Scroll only the strip horizontally — scrollIntoView would also move the page.
    const strip = tabsRef.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!strip || !tab) return;
    strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  const go = (id: string) => {
    const el = sections.current[id];
    if (!el) return;
    setActive(id);
    lock.current = Date.now() + 1000;
    scrollToTarget(el, -72);
  };

  return (
    <section id="menu" aria-label="Menú" className="relative mx-auto max-w-2xl px-5 pb-40">
      <Reveal className="pt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Carta</p>
        <h2 className="mt-2 font-display text-4xl">El menú</h2>
      </Reveal>
      <Reveal delay={0.08} className="mt-6">
        <Featured cart={cart} />
      </Reveal>

      <nav className="sticky top-0 z-20 -mx-5 mt-8 border-b border-white/[0.06] bg-background/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl" aria-label="Categorías">
        <div ref={tabsRef} role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto px-5 py-2">
          {categories.map((c) => {
            const on = c.id === active;
            return (
              <button
                key={c.id}
                data-tab={c.id}
                role="tab"
                aria-selected={on}
                type="button"
                onClick={() => go(c.id)}
                className={cn("tap relative h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-200", on ? "text-primary-foreground" : "text-muted-foreground")}
              >
                {on && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-primary" transition={spring.snappy} />}
                <span className="relative">{c.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {categories.map((c) => (
        <section key={c.id} id={c.id} ref={(el) => void (sections.current[c.id] = el)} className="scroll-mt-20 pt-8" aria-labelledby={`${c.id}-h`}>
          <h2 id={`${c.id}-h`} className="font-display text-2xl">{c.label}</h2>
          <div className="mt-2">
            {products
              .filter((p) => p.category === c.id)
              .map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 4) * 0.05} y={12}>
                  <ProductRow product={p} cart={cart} />
                </Reveal>
              ))}
          </div>
        </section>
      ))}
    </section>
  );
}
