// POST /api/update {id, text, ts, signature} -> el creador publica un avance firmado.
import { body, send, save, readOne, signedBy, hashText } from "./_lib.js";
import { msgUpdate } from "../shared.js";
import fs from "node:fs/promises";
async function seedCreator(id) {
  try { const seeds = JSON.parse(await fs.readFile(new URL("../projects.json", import.meta.url), "utf8")); return seeds.find((x) => x.id === id)?.params?.creator || null; } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    const { id, text, ts, signature } = await body(req);
    if (!/^[a-z0-9-]{2,40}$/.test(String(id))) return send(res, 400, { error: "Bad project." });
    const sub = await readOne(`submissions/${id}.json`), creator = sub?.project?.params?.creator || (await seedCreator(id));
    if (!creator) return send(res, 404, { error: "Project not found." });
    const clean = String(text || "").trim();
    if (clean.length < 10 || clean.length > 1500) return send(res, 400, { error: "The update must be 10 to 1,500 characters." });
    if (!Number.isInteger(ts) || Math.abs(Date.now() - ts) > 10 * 60 * 1000) return send(res, 400, { error: "Invalid time." });
    if (!(await signedBy(creator, msgUpdate(id, ts, hashText(clean)), signature)))
      return send(res, 401, { error: "Only the project's creator can post updates." });
    await save(`updates/${id}/${ts}.json`, { id, text: clean, ts, signature });
    send(res, 200, { ok: true });
  } catch (e) {
    send(res, 500, { error: "The update couldn't be posted." });
  }
}
