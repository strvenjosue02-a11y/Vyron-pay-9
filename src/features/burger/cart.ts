import { useCallback, useMemo, useState } from "react";
import { products } from "./data";

export type Cart = ReturnType<typeof useCart>;

export function useCart() {
  const [lines, setLines] = useState<Record<string, number>>({});
  const add = useCallback((id: string) => setLines((l) => ({ ...l, [id]: (l[id] ?? 0) + 1 })), []);
  const remove = useCallback(
    (id: string) =>
      setLines((l) => {
        const next = { ...l };
        if ((next[id] ?? 0) <= 1) delete next[id];
        else next[id] -= 1;
        return next;
      }),
    [],
  );
  const { count, total, items } = useMemo(() => {
    const items = Object.entries(lines).map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }));
    return {
      items,
      count: items.reduce((n, i) => n + i.qty, 0),
      total: items.reduce((n, i) => n + i.qty * i.product.price, 0),
    };
  }, [lines]);
  return { lines, add, remove, count, total, items };
}
