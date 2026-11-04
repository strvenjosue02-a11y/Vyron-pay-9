/**
 * Shared motion tokens for Motion (framer-motion), GSAP and CSS.
 * Curves follow Emil Kowalski's guidance: ease-out for enters, strong custom
 * curves instead of the browser defaults, short durations for UI.
 */
export const ease = {
  outQuint: [0.23, 1, 0.32, 1],
  inOutQuint: [0.86, 0, 0.07, 1],
  outExpo: [0.16, 1, 0.3, 1],
  drawer: [0.32, 0.72, 0, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Same curves as GSAP CustomEase-free strings (cubic-bezier via "power" equivalents). */
export const gsapEase = {
  out: "power4.out",
  inOut: "power3.inOut",
  expo: "expo.out",
} as const;

export const duration = {
  micro: 0.15, // press, hover
  ui: 0.25, // popovers, menus
  enter: 0.5, // section reveals
  hero: 0.9, // first-load choreography
} as const;

export const spring = {
  snappy: { type: "spring", stiffness: 400, damping: 30 },
  smooth: { type: "spring", duration: 0.5, bounce: 0.15 },
} as const;
