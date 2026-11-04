import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let instance: Lenis | null = null;

/** Scroll to a target with Lenis when active, native smooth/instant scroll otherwise. */
export function scrollToTarget(target: HTMLElement, offset = 0) {
  if (instance) {
    instance.scrollTo(target, { offset, duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 4) });
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const y = target.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
}

/**
 * Lenis smooth scroll driven by GSAP's ticker so ScrollTrigger stays in sync.
 * Disabled entirely for users who prefer reduced motion.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 1 });
    instance = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      instance = null;
    };
  }, []);

  return <>{children}</>;
}
