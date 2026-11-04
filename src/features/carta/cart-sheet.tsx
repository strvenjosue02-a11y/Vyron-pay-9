import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, m } from "motion/react";
import { Bike, Minus, Plus, Store, Trash2 } from "lucide-react";
import { cx as cn } from "./cx";
import { Sheet } from "./sheet";
import { mxn } from "./data";
import type { Cart } from "./cart";

const DELIVERY = 35;
type Mode = "recoger" | "domicilio";
type Placed = { id: string; total: number; count: number; mode: Mode; name: string };

export function CartSheet({ open, onClose, cart }: { open: boolean; onClose: () => void; cart: Cart }) {
  const [mode, setMode] = useState<Mode>("recoger");
  const [step, setStep] = useState<"cart" | "datos">("cart");
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", phone: "", address: "", pay: "efectivo" });

  useEffect(() => { if (!open) { setStep("cart"); setErrors({}); } }, [open]);
  useEffect(() => { if (open && !cart.count && !placed) setStep("cart"); }, [open, cart.count, placed]);

  const total = cart.subtotal + (mode === "domicilio" && cart.count ? DELIVERY : 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (form.name.trim().length < 2) err.name = "Escribe tu nombre para llamarte cuando esté listo.";
    if (form.phone.replace(/\D/g, "").length < 10) err.phone = "El teléfono debe tener 10 dígitos.";
    if (mode === "domicilio" && form.address.trim().length < 8) err.address = "Agrega calle, número y colonia.";
    setErrors(err);
    if (Object.keys(err).length) return;
    setPlaced({ id: "V" + String(Date.now()).slice(-5), total, count: cart.count, mode, name: form.name.trim().split(" ")[0] });
    cart.clear();
  };

  const field = (k: keyof typeof form, label: string, props: Record<string, unknown>) => (
    <label className="block">
      <span className="label">{label}</span>
      <input
        value={form[k]}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `${k}-err` : undefined}
        className={cn("mt-2 h-13 w-full rounded-2xl border bg-white/[0.03] px-4 text-base focus:outline-none", errors[k] ? "border-[var(--danger)]" : "border-white/10 focus:border-[var(--accent)]")}
        {...props}
      />
      {errors[k] && <span id={`${k}-err`} className="mt-1.5 block text-sm text-[var(--danger)]">{errors[k]}</span>}
    </label>
  );

  return (
    <Sheet
      open={open}
      onClose={() => { onClose(); if (placed) setTimeout(() => setPlaced(null), 400); }}
      label="Tu pedido"
      header={<h2 className="display px-5 pt-3 pb-2 text-3xl">{placed ? "Pedido enviado" : step === "cart" ? "Tu pedido" : "Tus datos"}</h2>}
    >
      <AnimatePresence mode="wait" initial={false}>
        {placed ? (
          <m.div key="ok" className="px-5 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] text-center" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}>
            <svg viewBox="0 0 52 52" className="mx-auto size-20 text-[var(--accent)]" aria-hidden>
              <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2" className="draw-circle" />
              <path d="M15 27l7 7 15-15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="draw-check" />
            </svg>
            <p className="mt-5 text-lg">Gracias, {placed.name}. Ya estamos cocinando.</p>
            <p className="mt-2 text-[var(--muted)]">Pedido <span className="font-mono text-white">{placed.id}</span> · {placed.count} {placed.count === 1 ? "artículo" : "artículos"} · {mxn(placed.total)}</p>
            <p className="mt-1 text-[var(--muted)]">{placed.mode === "domicilio" ? "Llega en 30–40 min." : "Listo para recoger en 15 min."}</p>
            <button type="button" onClick={onClose} className="tap cta mt-8 h-14 w-full rounded-full font-semibold">Volver al menú</button>
          </m.div>
        ) : !cart.count ? (
          <m.div key="empty" className="px-5 pt-6 pb-12 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-lg">Tu pedido está vacío.</p>
            <p className="mt-1 text-[var(--muted)]">Toca un producto para elegirlo y personalizarlo.</p>
            <button type="button" onClick={onClose} className="tap mt-6 h-12 rounded-full border border-white/15 px-6">Ver el menú</button>
          </m.div>
        ) : step === "cart" ? (
          <m.div key="cart" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
            <ul className="px-5">
              {cart.items.map((l) => (
                <li key={l.key} className="flex gap-3 border-b border-white/[0.07] py-4 last:border-0">
                  <img src={l.product.photo.small} alt="" width={56} height={56} className="size-14 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{l.product.name}</p>
                      <p className="shrink-0 tabular-nums">{mxn(l.total)}</p>
                    </div>
                    {l.summary && <p className="mt-0.5 text-sm text-[var(--muted)] [overflow-wrap:anywhere]">{l.summary}</p>}
                    {l.notes && <p className="mt-0.5 text-sm italic text-[var(--muted)] [overflow-wrap:anywhere]">“{l.notes}”</p>}
                    <div className="mt-2 flex items-center gap-1">
                      <button type="button" aria-label={l.qty === 1 ? `Quitar ${l.product.name}` : "Menos"} onClick={() => cart.setQty(l.key, l.qty - 1)} className="tap grid size-11 place-items-center rounded-full bg-white/[0.06]">
                        {l.qty === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                      </button>
                      <span className="w-8 text-center font-semibold tabular-nums">{l.qty}</span>
                      <button type="button" aria-label="Más" disabled={l.qty >= cart.MAX_QTY} onClick={() => cart.setQty(l.key, l.qty + 1)} className="tap grid size-11 place-items-center rounded-full bg-white/[0.06] disabled:opacity-30">
                        <Plus className="size-4" />
                      </button>
                      <span className="ml-2 text-xs tabular-nums text-[var(--muted)]">{mxn(l.unit)} c/u</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 px-5">
              <div role="radiogroup" aria-label="Entrega" className="grid grid-cols-2 gap-2 rounded-2xl bg-white/[0.04] p-1">
                {([["recoger", "Recoger", Store], ["domicilio", "A domicilio", Bike]] as const).map(([id, label, Icon]) => (
                  <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)} className={cn("tap flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors duration-150", mode === id ? "bg-white text-black" : "text-[var(--muted)]")}>
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>
              <dl className="mt-5 space-y-1.5 text-[15px]">
                <div className="flex justify-between text-[var(--muted)]"><dt>Subtotal</dt><dd className="tabular-nums">{mxn(cart.subtotal)}</dd></div>
                {mode === "domicilio" && <div className="flex justify-between text-[var(--muted)]"><dt>Envío</dt><dd className="tabular-nums">{mxn(DELIVERY)}</dd></div>}
                <div className="flex justify-between pt-1 text-lg font-semibold"><dt>Total</dt><dd className="tabular-nums">{mxn(total)}</dd></div>
              </dl>
              <button type="button" onClick={() => setStep("datos")} className="tap cta mt-5 mb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] h-14 w-full rounded-full font-semibold">Continuar · {mxn(total)}</button>
            </div>
          </m.div>
        ) : (
          <m.form key="datos" onSubmit={submit} noValidate className="space-y-4 px-5 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
            {field("name", "Nombre", { autoComplete: "given-name", enterKeyHint: "next" })}
            {field("phone", "Teléfono", { type: "tel", inputMode: "tel", autoComplete: "tel", enterKeyHint: "next" })}
            {mode === "domicilio" && field("address", "Dirección de entrega", { autoComplete: "street-address", enterKeyHint: "done" })}
            <fieldset>
              <legend className="label">Pago al recibir</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[["efectivo", "Efectivo"], ["tarjeta", "Tarjeta"]].map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={form.pay === id} onClick={() => setForm((f) => ({ ...f, pay: id }))} className={cn("tap h-12 rounded-2xl border text-sm font-medium", form.pay === id ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/10")}>{label}</button>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setStep("cart")} className="tap h-14 rounded-full border border-white/15 px-6">Atrás</button>
              <button type="submit" className="tap cta h-14 flex-1 rounded-full font-semibold">Pedir · {mxn(total)}</button>
            </div>
          </m.form>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
