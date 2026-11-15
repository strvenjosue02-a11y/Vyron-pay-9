// Código compartido entre la web y el servidor (sin dependencias).

export const META_KEYS = ["category", "color", "tagline", "about"];
export const PARAM_KEYS = ["creator", "name", "symbol", "softcap", "hardcap", "saleTokens", "creatorTokens",
  "saleEnd", "initialBps", "milestones", "milestonePeriod"];

export const CATEGORIES = ["Local business", "Technology", "Environment", "Education", "Arts & culture", "Health", "Food & drink", "Other"];
export const COLORS = ["#18191D", "#E2512C", "#2F5D50", "#3B4FA8", "#8A4B12", "#6B3A8C", "#0E6E7A", "#9B2F55"];

/** Texto estable de un proyecto: es lo que se firma. Cambiar un solo carácter invalida las firmas. */
export function canonical(p) {
  const o = { id: String(p.id), meta: {}, params: {} };
  META_KEYS.forEach((k) => (o.meta[k] = String(p.meta?.[k] ?? "")));
  PARAM_KEYS.forEach((k) => (o.params[k] = String(p.params?.[k] ?? "")));
  return JSON.stringify(o);
}

export const msgSubmit = (id, hash) => `Holdfast: submit project\nid: ${id}\nhash: ${hash}`;
export const msgDecision = (approve, id, hash) => `Holdfast: ${approve ? "approve" : "reject"} project\nid: ${id}\nhash: ${hash}`;
export const msgUpdate = (id, ts, hash) => `Holdfast: post update\nproject: ${id}\ntime: ${ts}\nhash: ${hash}`;
export const msgPanel = (day) => `Holdfast: open owner panel\ndate: ${day}`;

const DAY = 86400;
const isInt = (s) => /^\d+$/.test(String(s));

/** Returns an error message in English, o null si el proyecto es válido. */
export function validate(p, nowSec) {
  if (!p || typeof p !== "object") return "Empty project.";
  if (!/^[a-z0-9-]{3,48}$/.test(p.id || "")) return "Invalid identifier.";
  const m = p.meta || {}, q = p.params || {};
  if (!CATEGORIES.includes(m.category)) return "Choose a category.";
  if (!COLORS.includes(m.color)) return "Invalid colour.";
  if (!m.tagline || m.tagline.length < 10 || m.tagline.length > 120) return "The one-line summary must be 10 to 120 characters.";
  if (!m.about || m.about.length < 40 || m.about.length > 2000) return "The description must be 40 to 2,000 characters.";
  if (!/^0x[0-9a-fA-F]{40}$/.test(q.creator || "")) return "Invalid creator wallet.";
  if (!q.name || q.name.length < 3 || q.name.length > 40) return "The name must be 3 to 40 characters.";
  if (!/^[A-Z0-9]{2,8}$/.test(q.symbol || "")) return "The ticker must be 2 to 8 capital letters or digits.";
  for (const k of ["softcap", "hardcap", "saleTokens", "creatorTokens", "saleEnd", "initialBps", "milestones", "milestonePeriod"])
    if (!isInt(q[k])) return `Invalid value: ${k}.`;
  const soft = BigInt(q.softcap), hard = BigInt(q.hardcap);
  if (soft < 10n ** 6n) return "The minimum goal must be at least 1 USDC.";
  if (soft > hard) return "The minimum goal can't be above the maximum.";
  if (hard > 10n ** 12n) return "The maximum goal can't exceed 1,000,000 USDC.";
  if (BigInt(q.saleTokens) === 0n) return "There must be tokens for backers.";
  if (BigInt(q.creatorTokens) > BigInt(q.saleTokens)) return "The team can't keep more tokens than backers get.";
  const bps = Number(q.initialBps), ms = Number(q.milestones), period = Number(q.milestonePeriod), end = Number(q.saleEnd);
  if (bps < 0 || bps > 3000) return "The upfront release must be 0% to 30%.";
  if (ms < 1 || ms > 6) return "There must be 1 to 6 milestones.";
  if (period < 14 * DAY || period > 180 * DAY) return "Each milestone window must be 14 to 180 days.";
  if (nowSec && (end < nowSec + 3 * DAY || end > nowSec + 180 * DAY)) return "The raise must close 3 to 180 days from today.";
  return null;
}
