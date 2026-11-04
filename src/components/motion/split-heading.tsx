import { useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(SplitText, useGSAP);

/** Word-by-word masked reveal using GSAP SplitText (free since GSAP 3.13). */
export function SplitHeading({ children, className }: { children: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(ref.current!, { type: "words", mask: "words" });
        gsap.from(split.words, {
          yPercent: 110,
          duration: 0.9,
          ease: "expo.out",
          stagger: 0.06,
        });
        return () => split.revert();
      });
    },
    { scope: ref },
  );

  return (
    <h1 ref={ref} className={className}>
      {children}
    </h1>
  );
}
