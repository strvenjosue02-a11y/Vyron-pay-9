import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, animate, m, useDragControls, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { createPortal } from "react-dom";

/**
 * Hoja inferior al estilo iOS: entra y sale por abajo (mismo camino), muelle sin rebote,
 * arrastre 1:1 desde el asa o la cabecera, proyección de impulso al soltar
 * (Apple: d = 0.998) y gomita si se tira hacia arriba. Interrumpible en cualquier momento.
 */
const project = (v: number, d = 0.998) => ((v / 1000) * d) / (1 - d);

export function Sheet({ open, onClose, children, label, header }: { open: boolean; onClose: () => void; children: ReactNode; label: string; header?: ReactNode }) {
  const reduce = useReducedMotion();
  const y = useMotionValue(0);
  const panel = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const scrim = useTransform(y, [0, 600], [1, 0]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    document.documentElement.style.overflow = "hidden";
    panel.current?.focus({ preventScroll: true });
    return () => {
      removeEventListener("keydown", key);
      document.documentElement.style.overflow = "";
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  const end = (_: unknown, info: PanInfo) => {
    const h = panel.current?.offsetHeight ?? 600;
    const landing = y.get() + project(info.velocity.y);
    if (landing > h * 0.45) onClose();
    else animate(y, 0, { type: "spring", bounce: 0, duration: 0.35, velocity: info.velocity.y });
  };

  const spring = reduce ? { duration: 0.2 } : { type: "spring" as const, bounce: 0, duration: 0.42 };

  return createPortal(
    <AnimatePresence onExitComplete={() => y.set(0)}>
      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <m.div
            className="absolute inset-0 bg-black/70"
            style={{ opacity: scrim }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <m.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className="sheet absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-[var(--panel)] outline-none"
            style={{ y }}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={spring}
            drag={reduce ? false : "y"}
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.06, bottom: 1 }}
            dragMomentum={false}
            onDragEnd={end}
          >
            <div className="drag-zone shrink-0 cursor-grab touch-none select-none pt-2.5 active:cursor-grabbing" onPointerDown={(e) => controls.start(e)}>
              <div className="mx-auto h-1.5 w-11 rounded-full bg-white/20" />
              {header}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
