import { lazy, Suspense, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ChevronDown } from "lucide-react";
import { ease } from "@/lib/motion";
import { layers } from "./data";
import type { ScrollState } from "./burger-scene";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const BurgerScene = lazy(() => import("./burger-scene"));

// Captions walk the layers top → bottom while the burger opens.
const order = layers.map((_, i) => layers.length - 1 - i);
const CAPTION_START = 0.18;

export function BurgerHero() {
  const reduce = useReducedMotion() ?? false;
  const section = useRef<HTMLElement>(null);
  const state = useRef<ScrollState>({ progress: 0, active: -1 }).current;
  const [stage, setStage] = useState(-1); // -1 = intro, otherwise index into `order`

  useGSAP(
    () => {
      if (reduce) return;
      ScrollTrigger.create({
        trigger: section.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const p = self.progress;
          state.progress = p;
          const s = p < CAPTION_START ? -1 : Math.min(order.length - 1, Math.floor(((p - CAPTION_START) / (0.96 - CAPTION_START)) * order.length));
          state.active = s < 0 ? -1 : order[s];
          setStage((prev) => (prev === s ? prev : s));
        },
      });
    },
    { scope: section, dependencies: [reduce] },
  );

  const layer = stage >= 0 ? layers[order[stage]] : null;

  return (
    <section ref={section} aria-label="La Smash Doble, capa por capa" className={reduce ? "relative" : "relative h-[520svh]"}>
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Warm stage light behind the burger */}
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_48%,oklch(0.45_0.12_45/0.55),transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent" />

        <Suspense fallback={<div className="absolute inset-0 grid place-items-center"><div className="size-40 animate-pulse rounded-full bg-amber-900/30 blur-2xl" /></div>}>
          <BurgerScene state={state} still={reduce} />
        </Suspense>

        <header className="relative z-10 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
          <span className="font-display text-xl tracking-wide">Vyron<span className="text-primary">.</span></span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground backdrop-blur">Abierto · cierra 23:00</span>
        </header>

        <AnimatePresence>
          {stage < 0 && (
            <motion.div
              key="intro"
              className="absolute inset-x-0 top-[13svh] z-10 px-6 text-center"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: ease.outQuint }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Firma de la casa</p>
              <h1 className="mt-3 font-display text-5xl leading-[0.95] text-balance">La Smash Doble</h1>
            </motion.div>
          )}
        </AnimatePresence>

        {!reduce && (
          <AnimatePresence>
            {stage < 0 && (
              <motion.div
                key="hint"
                className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)] z-10 flex flex-col items-center gap-1 text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.8, duration: 0.4 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                Desliza para abrirla
                <ChevronDown className="nudge size-4" aria-hidden />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Layer caption — one at a time, keyed so it crossfades */}
        {!reduce && (
          <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] z-10 px-5" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              {layer && (
                <motion.div
                  key={layer.id}
                  className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-md"
                  initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  transition={{ duration: 0.3, ease: ease.outQuint }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-xl">{layer.name}</p>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {String(stage + 1).padStart(2, "0")}/{String(order.length).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{layer.detail}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Progress rail */}
        {!reduce && (
          <ol className="absolute top-1/2 right-3 z-10 flex -translate-y-1/2 flex-col gap-2" aria-hidden>
            {order.map((_, i) => (
              <li key={i} className="h-5 w-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full w-full origin-top rounded-full bg-primary transition-transform duration-300 ease-out-quint"
                  style={{ transform: `scaleY(${i <= stage ? 1 : 0})` }}
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      {reduce && (
        <ul className="relative z-10 mx-auto -mt-24 grid max-w-md gap-2 px-5 pb-12">
          {order.map((i) => (
            <li key={layers[i].id} className="rounded-xl border border-white/10 bg-card p-3">
              <p className="font-medium">{layers[i].name}</p>
              <p className="text-sm text-muted-foreground">{layers[i].detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
