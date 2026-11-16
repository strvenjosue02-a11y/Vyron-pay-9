// GET /api/projects -> proyectos enviados, decisiones del dueño y avances. Todo lleva firmas verificables.
import { readAll, send } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const [subs, decisions, updates, qa] = await Promise.all([readAll("submissions/"), readAll("decisions/"), readAll("updates/"), readAll("qa/")]);
    const byId = Object.fromEntries(decisions.map((d) => [d.data.id, d.data]));
    const ups = {};
    updates.forEach((u) => (ups[u.data.id] ||= []).push(u.data));
    Object.values(ups).forEach((l) => l.sort((a, b) => b.ts - a.ts));
    const projects = subs.map((s) => ({ ...s.data, decision: byId[s.data.project.id] || null, updates: ups[s.data.project.id] || [] }));
    const qaBy = {};
    qa.forEach((x) => (qaBy[x.data.id] ||= []).push(x.data));
    send(res, 200, { projects, qa: qaBy });
  } catch (e) {
    send(res, 500, { error: "Projects couldn't be loaded." });
  }
}
