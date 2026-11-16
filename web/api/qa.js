// POST /api/qa {id, kind: "q"|"a", text, ts, qts?, author, signature}
// Preguntas: cualquiera, firmadas por su wallet. Respuestas: solo el creador del proyecto.
import { body, send, save, readOne, signedBy, hashText } from "./_lib.js";
import { msgQuestion, msgAnswer } from "../shared.js";
import { promises as fs } from "node:fs";

async function seedCreator(id) {
  try { const seeds = JSON.parse(await fs.readFile(new URL("../projects.json", import.meta.url), "utf8")); return seeds.find((x) => x.id === id)?.params?.creator || null; } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    const { id, kind, text, ts, qts, author, signature } = await body(req);
    const sub = await readOne(`submissions/${id}.json`);
    const creator = sub?.project?.params?.creator || (await seedCreator(id));
    if (!creator) return send(res, 404, { error: "Project not found." });
    const clean = String(text || "").trim();
    if (clean.length < 5 || clean.length > 800) return send(res, 400, { error: "Write 5 to 800 characters." });
    if (!Number.isInteger(ts) || Math.abs(Date.now() - ts) > 10 * 60 * 1000) return send(res, 400, { error: "Invalid time." });
    if (!/^0x[0-9a-fA-F]{40}$/.test(author || "")) return send(res, 400, { error: "Invalid wallet." });
    if (kind === "q") {
      if (!(await signedBy(author, msgQuestion(id, ts, hashText(clean)), signature))) return send(res, 401, { error: "The signature doesn't match your wallet." });
      await save(`qa/${id}/q-${ts}.json`, { id, kind, text: clean, ts, author, signature });
    } else if (kind === "a") {
      if (!Number.isInteger(qts)) return send(res, 400, { error: "Missing question." });
      if (!creator || creator.toLowerCase() !== author.toLowerCase()) return send(res, 401, { error: "Only the project's creator can answer." });
      if (!(await signedBy(author, msgAnswer(id, qts, ts, hashText(clean)), signature))) return send(res, 401, { error: "The signature doesn't match your wallet." });
      await save(`qa/${id}/a-${qts}.json`, { id, kind, text: clean, ts, qts, author, signature });
    } else return send(res, 400, { error: "Unknown kind." });
    send(res, 200, { ok: true });
  } catch (e) {
    send(res, e.message === "Ya existe" ? 409 : 500, { error: e.message === "Ya existe" ? "This question already has an answer." : "Couldn't save." });
  }
}
