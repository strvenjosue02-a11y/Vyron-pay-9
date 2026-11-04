import { lazy, Suspense } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowRight, ShieldCheck, Zap, Globe } from "lucide-react";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { Button } from "@/components/ui/button";

const HeroOrb = lazy(() => import("@/components/three/hero-orb"));

const features = [
  { icon: Zap, title: "Pagos instantáneos", body: "Liquidación en segundos, sin esperas de días hábiles." },
  { icon: ShieldCheck, title: "Seguridad bancaria", body: "Cifrado de extremo a extremo y verificación en cada paso." },
  { icon: Globe, title: "Global desde el día uno", body: "Cobra y paga en más de 40 monedas con tipo de cambio real." },
];

export default function App() {
  const reduce = useReducedMotion();

  return (
    <SmoothScroll>
      <main>
        <section className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 text-center">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_40%,color-mix(in_oklch,var(--primary)_25%,transparent),transparent)]" />
          {!reduce && (
            <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(closest-side,black_55%,transparent)]">
              <Suspense fallback={null}>
                <HeroOrb />
              </Suspense>
            </div>
          )}
          <SplitHeading className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
            Pagos que se sienten instantáneos
          </SplitHeading>
          <Reveal delay={0.35} className="mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
            Vyron Pay mueve tu dinero a la velocidad de tu negocio.
          </Reveal>
          <Reveal delay={0.5} className="mt-10 flex flex-wrap justify-center gap-3">
            <Button size="lg">
              Empezar gratis <ArrowRight className="size-4" />
            </Button>
            <Button size="lg" variant="ghost">
              Ver demo
            </Button>
          </Reveal>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-4 py-32 sm:grid-cols-3">
          {features.map((f, i) => (
            <Reveal
              key={f.title}
              delay={i * 0.08}
              className="rounded-xl border bg-card p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
            >
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-4 font-medium">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </Reveal>
          ))}
        </section>
      </main>
    </SmoothScroll>
  );
}
