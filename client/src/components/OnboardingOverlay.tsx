import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { CactiLogo } from "./CactiLogo";
import { useOnboarding } from "@/_core/hooks/useOnboarding";

const RING_PAD = 8;
const CARD_W = 360;
const GAP = 16;

export function OnboardingOverlay() {
  const { active, step, stepIndex, total, next, prev, skip } = useOnboarding();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [progress, setProgress] = useState(0);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);

  // Locate + measure the highlighted element (retries while the route mounts).
  useEffect(() => {
    if (!active || !step?.highlightSelector) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let tries = 0;
    const selector = step.highlightSelector;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        window.setTimeout(() => {
          if (!cancelled) setRect(el.getBoundingClientRect());
        }, 280);
      } else if (tries < 20) {
        tries += 1;
        window.setTimeout(find, 150);
      } else {
        setRect(null); // give up gracefully → centered card
      }
    };
    find();
    return () => {
      cancelled = true;
    };
  }, [active, step?.id, step?.highlightSelector]);

  // Keep the ring aligned on resize/scroll.
  useEffect(() => {
    if (!active || !step?.highlightSelector) return;
    const selector = step.highlightSelector;
    const remeasure = () => {
      const el = document.querySelector(selector);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [active, step?.id, step?.highlightSelector]);

  // Auto-advance with a pause-on-hover progress bar.
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    if (!active || !step || step.readingTimeMs == null) return;
    const duration = step.readingTimeMs;
    const tick = 50;
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      elapsedRef.current += tick;
      const p = Math.min(1, elapsedRef.current / duration);
      setProgress(p);
      if (p >= 1) {
        window.clearInterval(id);
        next();
      }
    }, tick);
    return () => window.clearInterval(id);
  }, [active, step?.id, next]);

  if (!active || !step) return null;

  const isCentered = !step.highlightSelector || !rect;
  const isFinale = !!step.isFinale;

  let cardStyle: CSSProperties;
  if (isCentered) {
    cardStyle = {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: CARD_W,
    };
  } else {
    const ringBottom = rect.bottom + RING_PAD;
    const ringTop = rect.top - RING_PAD;
    const placeAbove = ringBottom > window.innerHeight - 240;
    const centerX = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(GAP, centerX - CARD_W / 2),
      window.innerWidth - CARD_W - GAP,
    );
    cardStyle = placeAbove
      ? { position: "fixed", left, top: ringTop - GAP, width: CARD_W, transform: "translateY(-100%)" }
      : { position: "fixed", left, top: ringBottom + GAP, width: CARD_W };
  }

  const overlay = (
    <div className="fixed inset-0 z-[100]" style={{ pointerEvents: "none" }}>
      {/* Dim + spotlight */}
      {isCentered ? (
        <div className="absolute inset-0 bg-black/75" style={{ pointerEvents: "auto" }} />
      ) : (
        <div
          className="rounded-lg"
          style={{
            position: "fixed",
            left: rect.left - RING_PAD,
            top: rect.top - RING_PAD,
            width: rect.width + RING_PAD * 2,
            height: rect.height + RING_PAD * 2,
            boxShadow:
              "0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 2px var(--color-cacti-cyan), 0 0 24px 4px var(--color-cacti-glow)",
            transition: "all 0.3s ease",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Narration card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          style={{ ...cardStyle, pointerEvents: "auto" }}
          onMouseEnter={() => {
            pausedRef.current = true;
          }}
          onMouseLeave={() => {
            pausedRef.current = false;
          }}
          className="rounded-xl border border-primary/30 bg-background shadow-2xl overflow-hidden"
        >
          {/* Progress bar (auto-advance) */}
          {step.readingTimeMs != null && (
            <div className="h-0.5 w-full bg-primary/10">
              <div
                className="h-full bg-primary/70"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}

          <div className="p-4">
            <div className="flex items-start gap-3">
              {(isCentered || isFinale) && (
                <CactiLogo size={28} className="shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    className="text-sm font-semibold text-primary"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {step.title}
                  </h3>
                  <button
                    onClick={skip}
                    className="p-1 -mr-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                    aria-label="Skip tour"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                  {step.narration}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span
                className="text-[10px] uppercase tracking-wider text-muted-foreground/70"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {stepIndex + 1} / {total}
              </span>
              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <button
                    onClick={prev}
                    className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}
                <button
                  onClick={next}
                  className="flex items-center gap-1 rounded-md bg-primary/15 border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 transition-colors"
                >
                  {isFinale ? "Finish & add key" : stepIndex === 0 ? "Take the tour" : "Next"}
                  {!isFinale && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(overlay, document.body);
}
