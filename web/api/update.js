// POST /api/update {id, text, ts, signature} -> el creador publica un avance firmado.
import { body, send, save, readOne, signedBy, hashText } from "./_lib.js";
import { msgUpdate } from "../shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    const { id, text, ts, signature } = await body(req);
    const sub = await readOne(`submissions/${id}.json`);
    if (!sub) return send(res, 404, { error: "Project not found." });
    const clean = String(text || "").trim();
    if (clean.length < 10 || clean.length > 1500) return send(res, 400, { error: "The update must be 10 to 1,500 characters." });
    if (!Number.isInteger(ts) || Math.abs(Date.now() - ts) > 10 * 60 * 1000) return send(res, 400, { error: "Invalid time." });
    if (!(await signedBy(sub.project.params.creator, msgUpdate(id, ts, hashText(clean)), signature)))
      return send(res, 401, { error: "Only the project's creator can post updates." });
    await save(`updates/${id}/${ts}.json`, { id, text: clean, ts, signature });
    send(res, 200, { ok: true });
  } catch (e) {
    send(res, 500, { error: "The update couldn't be posted." });
  }
}
