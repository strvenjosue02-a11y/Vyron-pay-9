import { lazy, Suspense, useEffect, useRef, useState, type ComponentType, type LazyExoticComponent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ease } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export type ShowcaseState = { progress: number };
type SceneProps = { state: ShowcaseState; still?: boolean };

export const FriesScene = lazy(() => import("./fries-scene"));
export const ChickenScene = lazy(() => import("./chicken-scene"));

type Beat = { at: number; title: string; body: string };

/**
 * Pinned scroll chapter with a 3D scene behind copy beats. The scene mounts
 * only when the chapter is within one viewport (keeps ≤2 WebGL contexts alive)
 * and reads scroll progress from a mutable object — no React state per frame.
 */
export function Showcase({
  id, eyebrow, Scene, beats, cta, onCta,
}: {
  id: string;
  eyebrow: string;
  Scene: LazyExoticComponent<ComponentType<SceneProps>>;
  beats: Beat[];
  cta: string;
  onCta: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const section = useRef<HTMLElement>(null);
  const state = useRef<ShowcaseState>({ progress: 0 }).current;
  const [beat, setBeat] = useState(0);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "100% 0px 100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useGSAP(
    () => {
      if (reduce) return;
      ScrollTrigger.create({
        trigger: section.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          state.progress = self.progress;
          let b = 0;
          beats.forEach((x, i) => { if (self.progress >= x.at) b = i; });
          setBeat((prev) => (prev === b ? prev : b));
        },
      });
    },
    { scope: section, dependencies: [reduce] },
  );

  const current = beats[reduce ? beats.length - 1 : beat];

  return (
    <section ref={section} id={id} aria-label={eyebrow} className={reduce ? "relative h-svh" : "relative h-[320svh]"}>
      <div className="sticky top-0 h-svh overflow-hidden">
        {near && (
          <Suspense fallback={null}>
            <Scene state={state} still={reduce} />
          </Suspense>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-background via-background/70 to-transparent" />

        <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-10 px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{eyebrow}</p>
        </div>

        <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+1.75rem)] z-10 px-6" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={current.title}
              className="mx-auto max-w-md text-center"
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
              transition={{ duration: 0.4, ease: ease.outQuint }}
            >
              <h2 className="font-display text-4xl leading-[0.95] text-balance">{current.title}</h2>
              <p className="mt-3 text-muted-foreground text-pretty">{current.body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-5 flex justify-center">
            <button type="button" onClick={onCta} className="tap h-11 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-medium backdrop-blur">
              {cta}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
