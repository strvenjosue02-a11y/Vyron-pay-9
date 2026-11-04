// Turns dist-artifact/index.html into an Artifact page body: the host wraps the
// page in its own <!doctype>/<head>/<body>, so we keep only <title>, <meta>
// description, inline <style>/<script> and the app root.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("dist-artifact/index.html", "utf8");
const head = html.match(/<head>([\s\S]*)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const keep = head
  .replace(/<meta charset[^>]*>/i, "")
  .replace(/<meta name="viewport"[^>]*>/i, "");
const page = `${keep.trim()}\n${body.trim()}\n`;
writeFileSync("dist-artifact/vyron-burger.html", page);
console.log(`artifact page: ${(page.length / 1024 / 1024).toFixed(2)} MB`);
