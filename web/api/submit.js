// POST /api/submit {project, signature} -> el creador envía su proyecto firmado; la IA lo revisa.
import { body, send, save, readOne, signedBy, hashProject, aiReview } from "./_lib.js";
import { validate, msgSubmit } from "../shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Usa POST." });
  try {
    const { project, signature } = await body(req);
    const err = validate(project, Math.floor(Date.now() / 1000));
    if (err) return send(res, 400, { error: err });
    const hash = hashProject(project);
    if (!(await signedBy(project.params.creator, msgSubmit(project.id, hash), signature)))
      return send(res, 401, { error: "La firma no corresponde a la wallet del creador." });
    if (await readOne(`submissions/${project.id}.json`)) return send(res, 409, { error: "Ya existe un proyecto con ese identificador." });
    await save(`submissions/${project.id}.json`, { project, signature, hash, at: Date.now() });
    const review = await aiReview(project);
    await save(`reviews/${project.id}.json`, { id: project.id, ...review });
    send(res, 200, { ok: true, id: project.id });
  } catch (e) {
    send(res, 500, { error: "No se pudo guardar el proyecto." });
  }
}
