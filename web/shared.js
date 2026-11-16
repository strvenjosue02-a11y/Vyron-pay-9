// Código compartido entre la web y el servidor (sin dependencias).

export const META_KEYS = ["category", "color", "tagline", "about", "logo", "team", "cover", "links", "plan", "use", "risks", "anon"];
export const PARAM_KEYS = ["creator", "name", "symbol", "softcap", "hardcap", "saleTokens", "creatorTokens",
  "saleEnd", "initialBps", "milestones", "milestonePeriod", "liquidityBps"];

export const CATEGORIES = ["Local business", "Technology", "Environment", "Education", "Arts & culture", "Health", "Food & drink", "Other"];
export const COLORS = ["#18191D", "#E2512C", "#2F5D50", "#3B4FA8", "#8A4B12", "#6B3A8C", "#0E6E7A", "#9B2F55"];

/** Texto estable de un proyecto: es lo que se firma. Cambiar un solo carácter invalida las firmas. */
export const USE_KEYS = ["Development", "Marketing", "Security & audit", "Operations", "Other"];
export const USE_LINKS = ["web", "x", "telegram", "discord", "github"];
export function canonical(p) {
  const o = { id: String(p.id), meta: {}, params: {} };
  META_KEYS.forEach((k) => (o.meta[k] = String(p.meta?.[k] ?? "")));
  PARAM_KEYS.forEach((k) => (o.params[k] = String(p.params?.[k] ?? "")));
  return JSON.stringify(o);
}

export const msgSubmit = (id, hash) => `Holdfast: submit project\nid: ${id}\nhash: ${hash}`;
export const msgDecision = (approve, id, hash) => `Holdfast: ${approve ? "approve" : "reject"} project\nid: ${id}\nhash: ${hash}`;
export const msgUpdate = (id, ts, hash) => `Holdfast: post update\nproject: ${id}\ntime: ${ts}\nhash: ${hash}`;
export const msgQuestion = (id, ts, hash) => `Holdfast: ask a question\nproject: ${id}\ntime: ${ts}\nhash: ${hash}`;
export const msgAnswer = (id, qts, ts, hash) => `Holdfast: answer a question\nproject: ${id}\nquestion: ${qts}\ntime: ${ts}\nhash: ${hash}`;
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
  if (!m.cover) return "Add a cover image: it's the first thing backers see.";
  if (!m.logo) return "Add your token logo so people recognise it.";
  if (m.links) {
    let l; try { l = JSON.parse(m.links); } catch { return "Invalid links."; }
    if (!l || typeof l !== "object" || Array.isArray(l)) return "Invalid links.";
    for (const [k, v] of Object.entries(l)) if (!USE_LINKS.includes(k) || !/^https:\/\/[^\s]{4,120}$/.test(v)) return "Official links must start with https://.";
    if (!Object.keys(l).length) return "Add at least one official link.";
  } else return "Add at least one official link (website, X, Telegram or GitHub).";
  if (!m.risks || m.risks.length < 20 || m.risks.length > 800) return "Describe the main risks (20 to 800 characters).";
  { let u; try { u = JSON.parse(m.use || ""); } catch { return "Say how the money will be used."; }
    if (!u || typeof u !== "object") return "Say how the money will be used.";
    let sum = 0; for (const [k, v] of Object.entries(u)) { if (!USE_KEYS.includes(k) || !Number.isInteger(v) || v < 0 || v > 100) return "Invalid use of funds."; sum += v; }
    if (sum !== 100) return "The use of funds must add up to 100%."; }
  if (m.anon && m.anon !== "1") return "Invalid anonymous flag.";
  if (m.cover && !(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(m.cover) && m.cover.length <= 300000)) return "The cover image must be a PNG, JPG or WebP under 220 KB.";
  if (m.logo && !(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(m.logo) && m.logo.length <= 90000)) return "The token logo must be a PNG, JPG or WebP under 60 KB.";
  if (m.team) {
    let t; try { t = JSON.parse(m.team); } catch { return "Invalid team data."; }
    if (!Array.isArray(t) || t.length > 4) return "Add up to 4 team members.";
    for (const x of t) {
      if (!x || typeof x.name !== "string" || x.name.length < 2 || x.name.length > 40) return "Each team member needs a name (2 to 40 characters).";
      if (x.role !== undefined && (typeof x.role !== "string" || x.role.length > 40)) return "Team roles must be under 40 characters.";
      if (x.link && !/^https:\/\/[^\s]{4,120}$/.test(x.link)) return "Team links must start with https://.";
      if (x.photo && !(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(x.photo) && x.photo.length <= 40000)) return "Team photos must be small images.";
    }
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(q.creator || "")) return "Invalid creator wallet.";
  if (!q.name || q.name.length < 3 || q.name.length > 40) return "The name must be 3 to 40 characters.";
  if (!/^[A-Z0-9]{2,8}$/.test(q.symbol || "")) return "The ticker must be 2 to 8 capital letters or digits.";
  for (const k of ["softcap", "hardcap", "saleTokens", "creatorTokens", "saleEnd", "initialBps", "milestones", "milestonePeriod", "liquidityBps"])
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
  const lb = Number(q.liquidityBps);
  if (lb < 500 || lb > 2500) return "Liquidity must be 5% to 25%.";
  { let pl; try { pl = JSON.parse(m.plan || ""); } catch { return "Describe what you deliver in each release."; }
    if (!Array.isArray(pl) || pl.length !== ms || pl.some((x) => typeof x !== "string" || x.length < 5 || x.length > 140)) return "Describe each release in 5 to 140 characters."; }
  if (m.anon === "1") { if (bps !== 0) return "Anonymous teams use protected mode: 0% upfront."; if (ms < 5) return "Anonymous teams use protected mode: at least 5 releases."; if (hard > 10_000n * 10n ** 6n) return "Anonymous teams can raise up to 10,000 USDC on their first project."; }
  else { let t = []; try { t = JSON.parse(m.team || "[]"); } catch {} if (!t.length || !t.some((x) => x.link)) return "Add at least one team member with a public link, or choose anonymous protected mode."; }
  if (period < 14 * DAY || period > 180 * DAY) return "Each milestone window must be 14 to 180 days.";
  if (nowSec && (end < nowSec + 3 * DAY || end > nowSec + 180 * DAY)) return "The raise must close 3 to 180 days from today.";
  return null;
}

export const msgProfile = (addr, name, hash) => `Holdfast: set my trader profile\nwallet: ${addr.toLowerCase()}\nname: ${name}\nphoto: ${hash}`;
export function validProfile(name, photo) {
  if (!/^[A-Za-z0-9_\- ]{3,20}$/.test(name || "")) return "The username must be 3 to 20 letters, numbers, spaces, - or _.";
  if (photo && !(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(photo) && photo.length <= 24000)) return "The photo must be a small PNG, JPG or WebP.";
  return null;
}
