import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { duration, ease } from "@/lib/motion";

type RevealProps = HTMLMotionProps<"div"> & { delay?: number; y?: number };

/** Fades + lifts content into view once. Opacity-only when reduced motion is on. */
export function Reveal({ delay = 0, y = 16, children, ...props }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : y, filter: reduce ? "none" : "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: duration.enter, ease: ease.outQuint, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
