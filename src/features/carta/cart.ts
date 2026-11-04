import { useCallback, useEffect, useMemo, useState } from "react";
import { products, type Product } from "./data";

export type Selection = Record<string, string[]>; // groupId → choice ids
export type Line = { key: string; productId: string; selection: Selection; notes: string; qty: number };

const KEY = "vyron-carrito-v1";
const MAX_QTY = 99;

export function unitPrice(p: Product, sel: Selection) {
  let price = p.price;
  for (const g of p.options) {
    if (g.kind === "remove") continue;
    for (const id of sel[g.id] ?? []) price += g.choices.find((c) => c.id === id)?.delta ?? 0;
  }
  return Math.max(0, price);
}

export function describe(p: Product, sel: Selection) {
  const parts: string[] = [];
  for (const g of p.options) {
    const ids = sel[g.id] ?? [];
    if (!ids.length) continue;
    const labels = ids.map((id) => g.choices.find((c) => c.id === id)?.label).filter(Boolean);
    parts.push(g.kind === "remove" ? `Sin ${labels.join(", ").toLowerCase()}` : labels.join(", "));
  }
  return parts.join(" · ");
}

export const defaultSelection = (p: Product): Selection =>
  Object.fromEntries(p.options.filter((g) => g.kind === "one").map((g) => [g.id, [g.choices[0].id]]));

const lineKey = (productId: string, sel: Selection, notes: string) =>
  productId + "|" + Object.keys(sel).sort().map((k) => `${k}:${[...sel[k]].sort().join(",")}`).join(";") + "|" + notes.trim();

function load(): Line[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Line[]) : [];
    return v.filter((l) => products.some((p) => p.id === l.productId));
  } catch {
    return [];
  }
}

export function useCart() {
  const [lines, setLines] = useState<Line[]>(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* almacenamiento bloqueado: el carrito vive en memoria */ }
  }, [lines]);

  const add = useCallback((productId: string, selection: Selection, notes: string, qty: number) => {
    const key = lineKey(productId, selection, notes);
    setLines((ls) => {
      const found = ls.find((l) => l.key === key);
      if (found) return ls.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l));
      return [...ls, { key, productId, selection, notes: notes.trim(), qty: Math.min(MAX_QTY, qty) }];
    });
  }, []);
  const setQty = useCallback((key: string, qty: number) => {
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.key !== key) : ls.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, qty) } : l))));
  }, []);
  const clear = useCallback(() => setLines([]), []);

  const view = useMemo(() => {
    const items = lines.map((l) => {
      const product = products.find((p) => p.id === l.productId)!;
      const unit = unitPrice(product, l.selection);
      return { ...l, product, unit, total: unit * l.qty, summary: describe(product, l.selection) };
    });
    return { items, count: items.reduce((n, i) => n + i.qty, 0), subtotal: items.reduce((n, i) => n + i.total, 0) };
  }, [lines]);

  return { ...view, add, setQty, clear, MAX_QTY };
}
export type Cart = ReturnType<typeof useCart>;
