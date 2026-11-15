// Servidor local para pruebas: sirve la web y ejecuta /api/* como en Vercel.
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    const mod = await import(path.join(root, "api", path.basename(url.pathname) + ".js"));
    return mod.default(req, res);
  }
  if (url.pathname === "/config.js" && process.env.PEER_OWNER) {
    const src = (await fs.readFile(path.join(root, "config.js"), "utf8")).replace(/platform: "0x[0-9a-fA-F]{40}"/, `platform: "${process.env.PEER_OWNER}"`);
    res.setHeader("content-type", "text/javascript"); return res.end(src);
  }
  const file = path.join(root, url.pathname === "/" ? "index.html" : url.pathname);
  try { res.setHeader("content-type", types[path.extname(file)] || "text/plain"); res.end(await fs.readFile(file)); }
  catch { res.statusCode = 404; res.end("no encontrado"); }
}).listen(process.env.PORT || 8080, () => console.log("listo"));
