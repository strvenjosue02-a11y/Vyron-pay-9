import { keccak256, toBytes, verifyMessage, getAddress } from "viem";
import { promises as fs } from "node:fs";
import path from "node:path";
import { canonical } from "../shared.js";
import { CONFIG } from "../config.js";

export const OWNER = getAddress(process.env.PEER_OWNER || CONFIG.platform); // PEER_OWNER solo para pruebas locales
export const hashProject = (p) => keccak256(toBytes(canonical(p)));
export const hashText = (t) => keccak256(toBytes(String(t)));

export async function signedBy(address, message, signature) {
  try { return await verifyMessage({ address: getAddress(address), message, signature }); } catch { return false; }
}

// ---------------------------------------------------------------- almacenamiento
// En Vercel: Blob. En local (pruebas): archivos en DATA_DIR.
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const DATA_DIR = process.env.DATA_DIR || "/tmp/peer-data";

export async function save(key, data, { overwrite = false } = {}) {
  const body = JSON.stringify(data);
  if (USE_BLOB) {
    const { put } = await import("@vercel/blob");
    await put(key, body, { access: "public", addRandomSuffix: false, allowOverwrite: overwrite, contentType: "application/json" });
    return;
  }
  const file = path.join(DATA_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (!overwrite) { try { await fs.access(file); throw new Error("exists"); } catch (e) { if (e.message === "exists") throw new Error("Ya existe"); } }
  await fs.writeFile(file, body);
}

export async function readAll(prefix) {
  if (USE_BLOB) {
    const { list } = await import("@vercel/blob");
    const out = [];
    let cursor;
    do {
      const r = await list({ prefix, cursor, limit: 1000 });
      const docs = await Promise.all(r.blobs.map(async (b) => {
        try { return { key: b.pathname, data: await (await fetch(b.url, { cache: "no-store" })).json() }; } catch { return null; }
      }));
      out.push(...docs.filter(Boolean));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out;
  }
  const dir = path.join(DATA_DIR, prefix);
  const walk = async (d) => {
    let entries = [];
    try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { return []; }
    const res = await Promise.all(entries.map(async (e) => {
      const f = path.join(d, e.name);
      if (e.isDirectory()) return walk(f);
      return [{ key: path.relative(DATA_DIR, f), data: JSON.parse(await fs.readFile(f, "utf8")) }];
    }));
    return res.flat();
  };
  return walk(dir);
}

export async function readOne(key) {
  if (!USE_BLOB) {
    try { return JSON.parse(await fs.readFile(path.join(DATA_DIR, key), "utf8")); } catch { return null; }
  }
  const docs = await readAll(key);
  return docs.find((d) => d.key === key)?.data || null;
}

// ---------------------------------------------------------------- http
export async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}
export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------- revisión con IA
const MODEL = "anthropic/claude-haiku-5.5";

export async function aiReview(project) {
  const q = project.params;
  const facts = {
    nombre: q.name, simbolo: q.symbol, categoria: project.meta.category, resumen: project.meta.tagline,
    descripcion: project.meta.about, meta_minima_usdc: Number(q.softcap) / 1e6, meta_maxima_usdc: Number(q.hardcap) / 1e6,
    entrega_inicial_pct: Number(q.initialBps) / 100, etapas: Number(q.milestones), dias_por_etapa: Number(q.milestonePeriod) / 86400,
    tokens_inversores: q.saleTokens, tokens_equipo: q.creatorTokens, wallet_creador: q.creator,
  };
  try {
    const { generateText } = await import("ai");
    const { text } = await generateText({
      model: MODEL,
      maxOutputTokens: 700,
      system: "Eres analista de riesgo de un launchpad cripto. Revisas proyectos antes de que el dueño los apruebe. " +
        "Busca señales de estafa (promesas de ganancias garantizadas, urgencia, datos vagos, metas desproporcionadas, " +
        "equipo que se queda demasiados tokens, entrega inicial alta, textos copiados o sin sentido). " +
        "Responde SOLO un JSON: {\"riesgo\":\"bajo|medio|alto\",\"resumen\":\"una o dos frases\",\"senales\":[\"...\"],\"preguntas\":[\"...\"]}. " +
        "Escribe en español simple. Máximo 4 señales y 3 preguntas para hacerle al creador.",
      prompt: JSON.stringify(facts),
    });
    const j = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    return { ok: true, riesgo: ["bajo", "medio", "alto"].includes(j.riesgo) ? j.riesgo : "medio", resumen: String(j.resumen || ""),
      senales: (j.senales || []).slice(0, 4).map(String), preguntas: (j.preguntas || []).slice(0, 3).map(String), model: MODEL, at: Date.now() };
  } catch (e) {
    console.error("aiReview", e);
    return { ok: false, error: "La revisión con IA no está disponible para este proyecto. Revísalo a mano antes de aprobarlo.", at: Date.now() };
  }
}
