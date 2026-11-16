// POST /api/profile {address,name,photo,signature} guarda el perfil de trader (opcional, firmado por su wallet). GET devuelve todos.
import { body, send, save, readAll, signedBy, hashText } from "./_lib.js";
import { msgProfile, validProfile } from "../shared.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const all = await readAll("profiles/");
      return send(res, 200, { profiles: all.map((x) => x.data) });
    }
    if (req.method !== "POST") return send(res, 405, { error: "Use GET or POST." });
    const { address, name, photo = "", signature } = await body(req);
    if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) return send(res, 400, { error: "Invalid wallet." });
    const err = validProfile(name, photo);
    if (err) return send(res, 400, { error: err });
    if (!(await signedBy(address, msgProfile(address, name, hashText(photo)), signature))) return send(res, 401, { error: "The signature doesn't match your wallet." });
    await save(`profiles/${address.toLowerCase()}.json`, { address: address.toLowerCase(), name, photo, signature }, { overwrite: true });
    send(res, 200, { ok: true });
  } catch (e) {
    send(res, 500, { error: "The profile couldn't be saved." });
  }
}
