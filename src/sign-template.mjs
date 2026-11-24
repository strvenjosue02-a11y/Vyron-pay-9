import { readFileSync } from "node:fs";

export const SIGN_TEMPLATE = readFileSync(new URL("./sign.html", import.meta.url), "utf8");
const DATA = /^const TX=.*$/m;
export const COLLECT_TEMPLATE = readFileSync(new URL("./collect.html", import.meta.url), "utf8");
const DATA_COLLECT = /^const INFO=.*$/m;

/** Rellena la plantilla con los datos del lanzamiento. */
export function renderSign(tx, info) {
  if (info.image && !isImageDataUri(info.image))
    throw new Error("imagen no válida: usa PNG, JPG, GIF o WEBP de hasta 300 KB");
  return SIGN_TEMPLATE.replace("__TX__", () => JSON.stringify(tx)).replace("__INFO__", () =>
    JSON.stringify(info),
  );
}

/** Rellena la página de cobro de comisiones (segunda plantilla fija). */
export function renderCollect(info) {
  if (info.image && !isImageDataUri(info.image)) throw new Error("imagen no válida");
  return COLLECT_TEMPLATE.replace("__INFO__", () => JSON.stringify(info));
}
export const normalizeCollect = (html) => html.replace(DATA_COLLECT, "DATA");

/** Quita lo único que puede variar (los datos) para comparar el resto, carácter por carácter. */
export const normalizeSign = (html) => html.replace(DATA, "DATA");

const MAGIC = [
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/gif", [0x47, 0x49, 0x46, 0x38]],
];
const MAX_IMAGE = 300_000;
export const IMAGE_URI = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Convierte un archivo de imagen en data URI comprobando sus primeros bytes y su tamaño. */
export function imageDataUri(buf) {
  if (buf.length > MAX_IMAGE)
    throw new Error(`la imagen pesa ${Math.round(buf.length / 1000)} KB; el máximo es 300 KB`);
  const hit =
    MAGIC.find(([, m]) => m.every((b, i) => buf[i] === b)) ||
    (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP"
      ? ["image/webp"]
      : null);
  if (!hit) throw new Error("la imagen debe ser PNG, JPG, GIF o WEBP (no SVG)");
  return `data:${hit[0]};base64,${buf.toString("base64")}`;
}

/** ¿Es una imagen válida? (formato del data URI, tamaño y cabecera real del archivo) */
export function isImageDataUri(uri) {
  if (typeof uri !== "string" || !IMAGE_URI.test(uri)) return false;
  try {
    return imageDataUri(Buffer.from(uri.split(",")[1], "base64")) === uri;
  } catch {
    return false;
  }
}
