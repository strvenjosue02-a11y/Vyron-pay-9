import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowDown, Plus, ShoppingBag } from "lucide-react";
import { cx as cn } from "./cx";
import { categories, mxn, products, type CategoryId, type Product } from "./data";
import { DepthPhoto, type DepthHandle } from "./depth-photo";
import { ProductSheet } from "./product-sheet";
import { CartSheet } from "./cart-sheet";
import { defaultSelection, useCart, type Cart } from "./cart";

const hero = products[0];

function Hero({ onOrder }: { onOrder: (p: Product) => void }) {
  const ref = useRef<HTMLElement>(null);
  const depth = useRef<DepthHandle>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.86]);
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);
  const wordY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  useMotionValueEvent(scrollYProgress, "change", (v) => depth.current?.setTilt(0, -v * 0.9));

  return (
    <section ref={ref} className="relative flex min-h-svh flex-col overflow-hidden" aria-label="Smash Bacon">
      <div className="spot pointer-events-none absolute inset-0" />
      <header className="relative z-10 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+1.1rem)]">
        <span className="display text-xl tracking-[0.06em]">VYRON<span className="text-[var(--accent)]">·</span></span>
        <span className="flex items-center gap-2 text-xs text-[var(--muted)]"><span className="size-1.5 rounded-full bg-emerald-400" />Abierto · hasta 23:00</span>
      </header>

      <div className="relative flex flex-1 items-center justify-center">
        <m.p aria-hidden style={reduce ? undefined : { y: wordY }} className="display word pointer-events-none absolute inset-x-0 top-[14%] select-none text-center leading-[0.8]">
          SMASH
        </m.p>
        <m.div style={reduce ? undefined : { scale, y }} className="hero-in relative z-[1] w-[min(88vw,520px)] touch-pan-y">
          <DepthPhoto ref={depth} {...hero.photo} alt="Smash Bacon: doble carne, cheddar fundido y tocino" priority strength={0.045} sizes="(max-width: 640px) 88vw, 520px" />
        </m.div>
      </div>

      <div className="relative z-10 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <p className="label rise" style={{ animationDelay: "120ms" }}>N.º 01 — La más pedida</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="display rise text-[clamp(2.9rem,13vw,5.5rem)] leading-[0.85]" style={{ animationDelay: "180ms" }}>Smash<br />Bacon</h1>
          <div className="rise shrink-0 pb-1 text-right" style={{ animationDelay: "240ms" }}>
            <p className="text-2xl font-semibold tabular-nums">{mxn(hero.price)}</p>
            <p className="text-xs text-[var(--muted)]">{hero.kcal.toLocaleString("es-MX")} kcal · {hero.minutes} min</p>
          </div>
        </div>
        <div className="rise mt-5 flex gap-2" style={{ animationDelay: "300ms" }}>
          <button type="button" onClick={() => onOrder(hero)} className="tap cta h-14 flex-1 rounded-full font-semibold">Pedir ahora</button>
          <a href="#menu" className="tap grid h-14 place-items-center rounded-full border border-white/15 px-5 text-sm" aria-label="Ver el menú completo">
            <span className="flex items-center gap-2">Menú <ArrowDown className="size-4" /></span>
          </a>
        </div>
      </div>
    </section>
  );
}

function CategoryNav({ active, onPick }: { active: CategoryId; onPick: (id: CategoryId) => void }) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const s = strip.current;
    const el = s?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (s && el) s.scrollTo({ left: el.offsetLeft - (s.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);
  return (
    <nav aria-label="Categorías" className="glass sticky top-0 z-30 pt-[env(safe-area-inset-top,0px)]">
      <div ref={strip} className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-2.5">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            data-cat={c.id}
            aria-current={active === c.id ? "true" : undefined}
            onClick={() => onPick(c.id)}
            className={cn("tap chip h-10 shrink-0 rounded-full px-4 text-sm font-medium", active === c.id ? "bg-white text-black" : "text-[var(--muted)]")}
          >
            {c.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function ProductCard({ p, onOpen, onQuickAdd, index }: { p: Product; onOpen: () => void; onQuickAdd: () => void; index: number }) {
  return (
    <article className="card reveal relative" style={{ animationDelay: `${Math.min(index, 3) * 50}ms` }}>
      {/* La vitrina queda por encima del enlace estirado: tocarla abre el detalle, el "+" agrega. */}
      <div className="stage relative z-[2] aspect-[4/3] overflow-hidden rounded-[22px]" onClick={onOpen}>
        <picture>
          <source srcSet={p.photo.small} type="image/avif" />
          {p.photo.smallWebp && <source srcSet={p.photo.smallWebp} type="image/webp" />}
          <img src={p.photo.smallWebp ?? p.photo.small} alt="" width={p.photo.width} height={p.photo.height} loading="lazy" decoding="async" className="food absolute inset-0 m-auto h-[86%] w-[86%] object-contain" />
        </picture>
        {p.tag && <span className="absolute top-3 left-3 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-black">{p.tag}</span>}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
          aria-label={`Agregar ${p.name} al pedido`}
          className="tap cta absolute right-3 bottom-3 z-10 grid size-12 place-items-center rounded-full shadow-[0_10px_24px_-8px_var(--accent)]"
        >
          <Plus className="size-5" />
        </button>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="display text-[1.75rem] leading-[0.95] [overflow-wrap:anywhere]">
            {/* Stretched link: toda la tarjeta abre el detalle; el "+" queda por encima. */}
            <button type="button" onClick={onOpen} className="text-left after:absolute after:inset-0 after:rounded-[22px] after:content-['']">
              {p.name}
            </button>
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{p.short}</p>
          <p className="spec mt-2">{[p.weight, `${p.kcal.toLocaleString("es-MX")} kcal`, `${p.minutes} min`].filter(Boolean).join("  ·  ")}</p>
        </div>
        <p className="shrink-0 pt-0.5 text-lg font-semibold tabular-nums">{mxn(p.price)}</p>
      </div>
    </article>
  );
}

function OrderBar({ cart, onOpen }: { cart: Cart; onOpen: () => void }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {cart.count > 0 && (
        <m.div
          className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
          initial={reduce ? { opacity: 0 } : { y: "120%" }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: "120%" }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        >
          <button type="button" onClick={onOpen} className="tap cta mx-auto flex h-16 w-full max-w-md items-center justify-between rounded-full pr-6 pl-2 font-semibold shadow-[0_18px_40px_-14px_var(--accent)]">
            <span className="flex items-center gap-3">
              <span className="relative grid size-12 place-items-center rounded-full bg-black/15">
                <ShoppingBag className="size-5" />
              </span>
              <span>
                Ver pedido
                <span className="ml-2 text-sm font-medium opacity-70 tabular-nums">{cart.count > 99 ? "99+" : cart.count} {cart.count === 1 ? "artículo" : "artículos"}</span>
              </span>
            </span>
            <span className="tabular-nums">{mxn(cart.subtotal)}</span>
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}

export function Carta() {
  const cart = useCart();
  const [open, setOpen] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [active, setActive] = useState<CategoryId>(categories[0].id);
  const [toast, setToast] = useState<string | null>(null);
  const lock = useRef(0);

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => { if (Date.now() < lock.current) return; for (const e of es) if (e.isIntersecting) setActive(e.target.id as CategoryId); },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    categories.forEach((c) => { const el = document.getElementById(c.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const pick = (id: CategoryId) => {
    setActive(id);
    lock.current = Date.now() + 900;
    const el = document.getElementById(id);
    if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 60, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const [sheetFeatures, setSheetFeatures] = useState<typeof domAnimation | null>(null);
  const wantSheets = open !== null || cartOpen;
  useEffect(() => {
    if (wantSheets && !sheetFeatures) import("./motion-features").then((r) => setSheetFeatures(() => r.default));
  }, [wantSheets, sheetFeatures]);
  const closeProduct = useCallback(() => setOpen(null), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  return (
    // domAnimation (≈15 KB) al inicio; el arrastre (domMax) llega al abrir una hoja.
    <LazyMotion features={sheetFeatures ?? domAnimation} strict>
      <main>
        <Hero onOrder={setOpen} />
        <div id="menu" className="scroll-mt-0">
          <CategoryNav active={active} onPick={pick} />
          {categories.map((c, ci) => {
            const items = products.filter((p) => p.category === c.id);
            return (
              <section key={c.id} id={c.id} aria-labelledby={`${c.id}-t`} className="scroll-mt-16 px-4 pt-12">
                <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-3">
                  <h2 id={`${c.id}-t`} className="display text-[clamp(2.4rem,11vw,4rem)] leading-none">
                    <span className="mr-3 align-top font-mono text-xs font-normal tracking-normal text-[var(--accent)]">{String(ci + 1).padStart(2, "0")}</span>
                    {c.label}
                  </h2>
                  <span className="text-xs text-[var(--muted)] tabular-nums">{items.length} {items.length === 1 ? "opción" : "opciones"}</span>
                </div>
                <div className="mt-6 grid gap-x-5 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((p, i) => (
                    <ProductCard key={p.id} p={p} index={i} onOpen={() => setOpen(p)} onQuickAdd={() => { cart.add(p.id, defaultSelection(p), "", 1); setToast(p.name); }} />
                  ))}
                </div>
              </section>
            );
          })}
          <footer className="px-5 pt-16 pb-36 text-sm text-[var(--muted)]">
            <p className="display text-3xl text-white">VYRON·</p>
            <p className="mt-2">Av. Reforma 222, CDMX · Todos los días de 12:00 a 23:00</p>
            <p className="mt-1">Precios en pesos mexicanos, IVA incluido.</p>
          </footer>
        </div>
      </main>
      <OrderBar cart={cart} onOpen={() => setCartOpen(true)} />
      <AnimatePresence>
        {toast && (
          <m.p
            role="status"
            className="glass fixed top-[calc(env(safe-area-inset-top,0px)+4rem)] left-1/2 z-[60] max-w-[calc(100vw-2rem)] -translate-x-1/2 truncate rounded-full px-5 py-2.5 text-sm"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          >
            {toast} · agregado
          </m.p>
        )}
      </AnimatePresence>
      <ProductSheet product={open} onClose={closeProduct} cart={cart} onAdded={setToast} />
      <CartSheet open={cartOpen} onClose={closeCart} cart={cart} />
    </LazyMotion>
  );
}
