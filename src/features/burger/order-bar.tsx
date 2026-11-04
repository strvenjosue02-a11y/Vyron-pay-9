import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { ease } from "@/lib/motion";
import { money } from "./data";
import type { Cart } from "./cart";

function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  return (
    <span className="relative inline-flex overflow-hidden tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-100%", opacity: 0 }} transition={{ duration: 0.2, ease: ease.outQuint }}>
          {format(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function OrderBar({ cart }: { cart: Cart }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const hidden = reduce ? { opacity: 0 } : { y: "110%" };

  useEffect(() => {
    if (cart.count === 0) setOpen(false);
  }, [cart.count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) setOpen(false);
  };

  return (
    <>
      <AnimatePresence>
        {cart.count > 0 && !open && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
            initial={hidden}
            animate={{ y: 0, opacity: 1 }}
            exit={hidden}
            transition={{ duration: 0.4, ease: ease.drawer }}
          >
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="tap mx-auto flex h-14 w-full max-w-md items-center justify-between rounded-2xl bg-primary px-5 text-primary-foreground shadow-[0_18px_40px_-12px_var(--primary)]"
            >
              <span className="flex items-center gap-3">
                <span className="relative">
                  <ShoppingBag className="size-5" />
                  <span className="absolute -top-2 -right-2.5 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-primary">
                    <AnimatedNumber value={cart.count} format={String} />
                  </span>
                </span>
                <span className="font-semibold">Ver pedido</span>
              </span>
              <span className="font-semibold"><AnimatedNumber value={cart.total} format={money} /></span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={() => setOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Tu pedido"
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] max-w-lg overflow-hidden rounded-t-3xl border-t border-white/10 bg-card"
              initial={hidden}
              animate={{ y: 0, opacity: 1 }}
              exit={hidden}
              transition={{ duration: 0.45, ease: ease.drawer }}
              drag={reduce ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.6 }}
              onDragEnd={onDragEnd}
            >
              <div className="drag-handle mx-auto mt-3 h-1.5 w-10 rounded-full bg-white/20" />
              <div className="flex items-center justify-between px-5 pt-3">
                <h2 className="font-display text-2xl">Tu pedido</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="tap grid size-11 place-items-center rounded-full bg-white/5">
                  <X className="size-5" />
                </button>
              </div>
              <ul className="max-h-[50dvh] overflow-y-auto overscroll-contain px-5 py-2" data-lenis-prevent>
                {cart.items.map(({ product, qty }) => (
                  <li key={product.id} className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-3 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground tabular-nums">{money(product.price * qty)}</p>
                    </div>
                    <div className="flex items-center rounded-full bg-white/5">
                      <button type="button" onClick={() => cart.remove(product.id)} aria-label={`Quitar ${product.name}`} className="tap grid size-11 place-items-center"><Minus className="size-4" /></button>
                      <span className="w-5 text-center text-sm font-semibold tabular-nums">{qty}</span>
                      <button type="button" onClick={() => cart.add(product.id)} aria-label={`Agregar ${product.name}`} className="tap grid size-11 place-items-center"><Plus className="size-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-white/[0.06] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
                <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{money(cart.total)}</span></div>
                <button type="button" className="tap mt-4 h-14 w-full rounded-2xl bg-primary font-semibold text-primary-foreground">
                  Pagar {money(cart.total)}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
