// Código compartido entre la web y el servidor (sin dependencias).

export const META_KEYS = ["category", "color", "tagline", "about"];
export const PARAM_KEYS = ["creator", "name", "symbol", "softcap", "hardcap", "saleTokens", "creatorTokens",
  "saleEnd", "initialBps", "milestones", "milestonePeriod"];

export const CATEGORIES = ["Comercio local", "Tecnología", "Medio ambiente", "Educación", "Arte y cultura", "Salud", "Alimentos", "Otro"];
export const COLORS = ["#1F5E4B", "#8A4B12", "#3B4FA8", "#9B2F55", "#5B3A8C", "#0E6E7A", "#6B6B12", "#A23B1F"];

/** Texto estable de un proyecto: es lo que se firma. Cambiar un solo carácter invalida las firmas. */
export function canonical(p) {
  const o = { id: String(p.id), meta: {}, params: {} };
  META_KEYS.forEach((k) => (o.meta[k] = String(p.meta?.[k] ?? "")));
  PARAM_KEYS.forEach((k) => (o.params[k] = String(p.params?.[k] ?? "")));
  return JSON.stringify(o);
}

export const msgSubmit = (id, hash) => `Peer: enviar proyecto\nid: ${id}\nhash: ${hash}`;
export const msgDecision = (approve, id, hash) => `Peer: ${approve ? "aprobar" : "rechazar"} proyecto\nid: ${id}\nhash: ${hash}`;
export const msgUpdate = (id, ts, hash) => `Peer: publicar avance\nproyecto: ${id}\nfecha: ${ts}\nhash: ${hash}`;
export const msgPanel = (day) => `Peer: abrir panel del dueño\nfecha: ${day}`;

const DAY = 86400;
const isInt = (s) => /^\d+$/.test(String(s));

/** Devuelve un texto de error en español, o null si el proyecto es válido. */
export function validate(p, nowSec) {
  if (!p || typeof p !== "object") return "Proyecto vacío.";
  if (!/^[a-z0-9-]{3,48}$/.test(p.id || "")) return "Identificador inválido.";
  const m = p.meta || {}, q = p.params || {};
  if (!CATEGORIES.includes(m.category)) return "Elige una categoría.";
  if (!COLORS.includes(m.color)) return "Color inválido.";
  if (!m.tagline || m.tagline.length < 10 || m.tagline.length > 120) return "El resumen debe tener entre 10 y 120 caracteres.";
  if (!m.about || m.about.length < 40 || m.about.length > 2000) return "La descripción debe tener entre 40 y 2.000 caracteres.";
  if (!/^0x[0-9a-fA-F]{40}$/.test(q.creator || "")) return "Wallet del creador inválida.";
  if (!q.name || q.name.length < 3 || q.name.length > 40) return "El nombre debe tener entre 3 y 40 caracteres.";
  if (!/^[A-Z0-9]{2,8}$/.test(q.symbol || "")) return "El símbolo debe tener de 2 a 8 letras mayúsculas o números.";
  for (const k of ["softcap", "hardcap", "saleTokens", "creatorTokens", "saleEnd", "initialBps", "milestones", "milestonePeriod"])
    if (!isInt(q[k])) return `Dato inválido: ${k}.`;
  const soft = BigInt(q.softcap), hard = BigInt(q.hardcap);
  if (soft < 10n ** 6n) return "La meta mínima debe ser al menos 1 USDC.";
  if (soft > hard) return "La meta mínima no puede superar la máxima.";
  if (hard > 10n ** 12n) return "La meta máxima no puede superar 1.000.000 USDC.";
  if (BigInt(q.saleTokens) === 0n) return "Debe haber tokens para los inversores.";
  if (BigInt(q.creatorTokens) > BigInt(q.saleTokens)) return "El equipo no puede quedarse más tokens que los inversores.";
  const bps = Number(q.initialBps), ms = Number(q.milestones), period = Number(q.milestonePeriod), end = Number(q.saleEnd);
  if (bps < 0 || bps > 3000) return "La entrega inicial debe ser de 0% a 30%.";
  if (ms < 1 || ms > 6) return "Debe haber de 1 a 6 etapas.";
  if (period < 14 * DAY || period > 180 * DAY) return "El plazo por etapa debe ser de 14 a 180 días.";
  if (nowSec && (end < nowSec + 3 * DAY || end > nowSec + 180 * DAY)) return "La venta debe cerrar entre 3 y 180 días desde hoy.";
  return null;
}
