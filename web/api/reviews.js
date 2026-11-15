// POST /api/reviews {day, signature} -> revisiones de la IA, solo para el dueño.
import { body, send, readAll, signedBy, OWNER } from "./_lib.js";
import { msgPanel } from "../shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    const { day, signature } = await body(req);
    const today = new Date().toISOString().slice(0, 10);
    if (day !== today) return send(res, 401, { error: "Signature expired. Open the panel again." });
    if (!(await signedBy(OWNER, msgPanel(day), signature))) return send(res, 401, { error: "Only the owner can see reviews." });
    const reviews = await readAll("reviews/");
    send(res, 200, { reviews: Object.fromEntries(reviews.map((r) => [r.data.id, r.data])) });
  } catch (e) {
    send(res, 500, { error: "Reviews couldn't be loaded." });
  }
}
