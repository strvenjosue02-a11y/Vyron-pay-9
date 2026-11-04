import manifest from "@/assets/food/manifest.json";

/** Recortes reales (Calco) en AVIF/WebP + mapa de profundidad. La build de un solo archivo omite WebP. */
const avifLg = import.meta.glob<string>("@/assets/food/*-lg.avif", { eager: true, import: "default" });
const avifSm = import.meta.glob<string>("@/assets/food/*-sm.avif", { eager: true, import: "default" });
const depth = import.meta.glob<string>("@/assets/food/*-depth.webp", { eager: true, import: "default" });
const webpLg: Record<string, string> = import.meta.env.MODE === "artifact" ? {} : import.meta.glob<string>("@/assets/food/*-lg.webp", { eager: true, import: "default" });
const webpSm: Record<string, string> = import.meta.env.MODE === "artifact" ? {} : import.meta.glob<string>("@/assets/food/*-sm.webp", { eager: true, import: "default" });

const pick = (map: Record<string, string>, name: string, suffix: string) =>
  Object.entries(map).find(([k]) => k.endsWith(`/${name}-${suffix}`))?.[1];

export type Photo = { avif: string; webp?: string; depth: string; small: string; smallWebp?: string; width: number; height: number };

export function photo(name: keyof typeof manifest): Photo {
  const m = manifest[name];
  return {
    avif: pick(avifLg, name, "lg.avif")!,
    webp: pick(webpLg, name, "lg.webp"),
    small: pick(avifSm, name, "sm.avif")!,
    smallWebp: pick(webpSm, name, "sm.webp"),
    depth: pick(depth, name, "depth.webp")!,
    width: m.w,
    height: m.h,
  };
}
