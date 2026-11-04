import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Check, Minus, Plus } from "lucide-react";
import { cx as cn } from "./cx";
import { Sheet } from "./sheet";
import { DepthPhoto } from "./depth-photo";
import { mxn, type OptionGroup, type Product } from "./data";
import { defaultSelection, unitPrice, type Cart, type Selection } from "./cart";

function Group({ g, value, onChange }: { g: OptionGroup; value: string[]; onChange: (v: string[]) => void }) {
  const hint = g.kind === "one" ? "Elige 1" : g.kind === "many" ? (g.max ? `Hasta ${g.max}` : "Opcional") : "Opcional";
  return (
    <fieldset className="mt-7">
      <legend className="flex w-full items-baseline justify-between">
        <span className="label">{g.label}</span>
        <span className="text-xs text-[var(--muted)]">{hint}</span>
      </legend>
      <div className={cn("mt-3 grid gap-2", g.kind === "remove" ? "grid-cols-2" : "grid-cols-1")}>
        {g.choices.map((c) => {
          const on = value.includes(c.id);
          const full = g.kind === "many" && !!g.max && value.length >= g.max && !on;
          const toggle = () => {
            if (g.kind === "one") onChange([c.id]);
            else if (on) onChange(value.filter((v) => v !== c.id));
            else if (!full) onChange([...value, c.id]);
          };
          const delta = "delta" in c ? c.delta : 0;
          return (
            <button
              key={c.id}
              type="button"
              role={g.kind === "one" ? "radio" : "checkbox"}
              aria-checked={on}
              aria-disabled={full}
              onClick={toggle}
              className={cn(
                "tap choice flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 text-left",
                on ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/10 bg-white/[0.03]",
                full && "opacity-40",
              )}
            >
              <span className={cn("grid size-5 shrink-0 place-items-center border transition-colors duration-150", g.kind === "one" ? "rounded-full" : "rounded-md", on ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-white/30")}>
                {on && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className={cn("min-w-0 flex-1 text-[15px]", g.kind === "remove" && on && "line-through decoration-[var(--accent)]")}>{c.label}</span>
              {delta !== 0 && <span className="shrink-0 text-sm tabular-nums text-[var(--muted)]">{delta > 0 ? "+" : "−"}{mxn(Math.abs(delta))}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProductSheet({ product, onClose, cart, onAdded }: { product: Product | null; onClose: () => void; cart: Cart; onAdded: (name: string) => void }) {
  const [sel, setSel] = useState<Selection>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [shown, setShown] = useState<Product | null>(product);

  useEffect(() => {
    if (product) {
      setShown(product);
      setSel(defaultSelection(product));
      setQty(1);
      setNotes("");
    }
  }, [product]);

  const p = shown;
  const total = useMemo(() => (p ? unitPrice(p, sel) * qty : 0), [p, sel, qty]);

  return (
    <Sheet open={!!product} onClose={onClose} label={p ? p.name : "Producto"}>
      {p && (
        <div className="pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]">
          <div className="stage relative mx-4 mt-3 overflow-hidden rounded-[22px] px-8 pt-6 pb-4">
            <DepthPhoto key={p.id} {...p.photo} alt={p.name} className="mx-auto max-h-[38dvh]" priority eager strength={0.04} sizes="(max-width: 640px) 80vw, 420px" />
            <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] uppercase tracking-[0.18em] text-white/45">Desliza para girarla</p>
          </div>
          <div className="px-5">
            <div className="mt-5 flex items-start justify-between gap-4">
              <h2 className="display min-w-0 text-[2.4rem] leading-[0.9] [overflow-wrap:anywhere]">{p.name}</h2>
              <p className="shrink-0 pt-1 text-xl font-semibold tabular-nums">{mxn(p.price)}</p>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{p.description}</p>
            <dl className="spec mt-4 flex flex-wrap gap-x-5 gap-y-1">
              {p.weight && <div><dt>Porción</dt><dd>{p.weight}</dd></div>}
              <div><dt>Energía</dt><dd>{p.kcal.toLocaleString("es-MX")} kcal</dd></div>
              <div><dt>Listo en</dt><dd>{p.minutes} min</dd></div>
            </dl>
            {p.options.map((g) => (
              <Group key={g.id} g={g} value={sel[g.id] ?? []} onChange={(v) => setSel((s) => ({ ...s, [g.id]: v }))} />
            ))}
            <label className="mt-7 block">
              <span className="label">Notas para cocina</span>
              <textarea
                value={notes}
                maxLength={140}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ej. bien dorada, salsa aparte"
                className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-base placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
              />
              <span className="mt-1 block text-right text-xs tabular-nums text-[var(--muted)]">{notes.length}/140</span>
            </label>
          </div>
          <div className="glass fixed inset-x-0 bottom-0 mx-auto flex max-w-xl items-center gap-3 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
            <div className="flex h-14 shrink-0 items-center rounded-full bg-white/[0.06]">
              <button type="button" aria-label="Menos" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="tap grid size-14 place-items-center disabled:opacity-30"><Minus className="size-4" /></button>
              <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
              <button type="button" aria-label="Más" disabled={qty >= cart.MAX_QTY} onClick={() => setQty((q) => Math.min(cart.MAX_QTY, q + 1))} className="tap grid size-14 place-items-center disabled:opacity-30"><Plus className="size-4" /></button>
            </div>
            <button
              type="button"
              onClick={() => { cart.add(p.id, sel, notes, qty); onAdded(p.name); onClose(); }}
              className="tap cta flex h-14 min-w-0 flex-1 items-center justify-between gap-2 rounded-full px-6 font-semibold"
            >
              <span className="truncate">Agregar</span>
              <span className="relative overflow-hidden tabular-nums">
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.span key={total} className="block" initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-100%", opacity: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}>
                    {mxn(total)}
                  </m.span>
                </AnimatePresence>
              </span>
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
