// POST /api/decide {id, approve, signature} -> el dueño aprueba o rechaza firmando con su wallet.
import { body, send, save, readOne, signedBy, hashProject, OWNER } from "./_lib.js";
import { msgDecision } from "../shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    const { id, approve, signature } = await body(req);
    const sub = await readOne(`submissions/${id}.json`);
    if (!sub) return send(res, 404, { error: "Project not found." });
    const hash = hashProject(sub.project);
    if (!(await signedBy(OWNER, msgDecision(!!approve, id, hash), signature)))
      return send(res, 401, { error: "Only the platform owner can decide." });
    await save(`decisions/${id}.json`, { id, approve: !!approve, hash, signature, at: Date.now() });
    send(res, 200, { ok: true });
  } catch (e) {
    send(res, e.message === "Ya existe" ? 409 : 500, { error: e.message === "Ya existe" ? "This project already has a decision." : "The decision couldn't be saved." });
  }
}
