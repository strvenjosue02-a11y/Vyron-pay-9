import type { SVGProps } from "react";
import { CupSoda, Drumstick, Hamburger, Package } from "lucide-react";

/** Lucide has no fries glyph; drawn on the same 24px grid and 2px stroke. */
export function Fries(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 10 7 3M11 10V2M14 10l1-7M17 10l1.5-5" />
      <path d="M5 10h14l-1.6 10.2a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8z" />
    </svg>
  );
}

export const categoryIcon = {
  burgers: Hamburger,
  fries: Fries,
  chicken: Drumstick,
  combos: Package,
  drinks: CupSoda,
} as const;
