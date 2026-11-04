/**
 * Forja · materials — Blender Principled BSDF–style presets mapped onto
 * THREE.MeshPhysicalMaterial. Subsurface has no direct equivalent in the
 * WebGL physical material; it is approximated with sheen (soft rim) +
 * low clearcoat and warm vertex colours in crevices.
 */
import * as THREE from "three";

export type Principled = {
  baseColor?: THREE.ColorRepresentation;
  roughness?: number;
  metallic?: number;
  ior?: number;
  /** "Coat" in Blender 4.x. */
  coat?: number;
  coatRoughness?: number;
  sheen?: number;
  sheenTint?: THREE.ColorRepresentation;
  sheenRoughness?: number;
  /** Approximate subsurface: adds a warm sheen rim. 0–1. */
  subsurface?: number;
  subsurfaceColor?: THREE.ColorRepresentation;
  transmission?: number;
  thickness?: number;
  specular?: number;
  vertexColors?: boolean;
  map?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  normalScale?: number;
  roughnessMap?: THREE.Texture | null;
  side?: THREE.Side;
};

export function principled(p: Principled) {
  const sss = p.subsurface ?? 0;
  const m = new THREE.MeshPhysicalMaterial({
    color: p.baseColor ?? "#ffffff",
    roughness: p.roughness ?? 0.5,
    metalness: p.metallic ?? 0,
    ior: p.ior ?? 1.45,
    clearcoat: p.coat ?? 0,
    clearcoatRoughness: p.coatRoughness ?? 0.1,
    sheen: Math.min(1, (p.sheen ?? 0) + sss * 0.6),
    sheenColor: new THREE.Color(p.sheenTint ?? p.subsurfaceColor ?? "#ffffff"),
    sheenRoughness: p.sheenRoughness ?? 0.6,
    transmission: p.transmission ?? 0,
    thickness: p.thickness ?? 0,
    specularIntensity: p.specular ?? 1,
    vertexColors: p.vertexColors ?? false,
    map: p.map ?? null,
    normalMap: p.normalMap ?? null,
    roughnessMap: p.roughnessMap ?? null,
    side: p.side ?? THREE.FrontSide,
  });
  if (p.normalMap) m.normalScale.setScalar(p.normalScale ?? 1);
  return m;
}

/** Look-dev presets with values taken from the shared memory notes. */
export const presets = {
  friedBatter: { roughness: 0.62, coat: 0.12, coatRoughness: 0.45, subsurface: 0.25, subsurfaceColor: "#ffb35c", specular: 0.7, vertexColors: true },
  fry: { roughness: 0.45, coat: 0.25, coatRoughness: 0.4, subsurface: 0.5, subsurfaceColor: "#ffd27a", vertexColors: true },
  paper: { roughness: 0.82, sheen: 0.15, sheenTint: "#ffffff" },
  bone: { baseColor: "#e9dcc4", roughness: 0.6, subsurface: 0.3, subsurfaceColor: "#fff1d6" },
} satisfies Record<string, Principled>;
