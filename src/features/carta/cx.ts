/** Une clases condicionales (sin tailwind-merge: la carta no compone clases en conflicto). */
export const cx = (...v: (string | false | null | undefined)[]) => v.filter(Boolean).join(" ");
