import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  ONBOARDING_STEPS,
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_VERSION,
  type OnboardingStep,
} from "@/_core/onboarding";

type OnboardingContextValue = {
  active: boolean;
  stepIndex: number;
  step: OnboardingStep | null;
  total: number;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function persistDone() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_VERSION);
  } catch {
    /* localStorage unavailable — tour just won't be remembered */
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [, setLocation] = useLocation();

  const goToStep = useCallback(
    (i: number) => {
      const step = ONBOARDING_STEPS[i];
      if (!step) return;
      setStepIndex(i);
      setLocation(step.path);
    },
    [setLocation],
  );

  const start = useCallback(() => {
    goToStep(0);
    setActive(true);
  }, [goToStep]);

  const finish = useCallback(() => {
    setActive(false);
    persistDone();
  }, []);

  const next = useCallback(() => {
    if (stepIndex >= ONBOARDING_STEPS.length - 1) {
      finish();
    } else {
      goToStep(stepIndex + 1);
    }
  }, [stepIndex, goToStep, finish]);

  const prev = useCallback(() => {
    if (stepIndex > 0) goToStep(stepIndex - 1);
  }, [stepIndex, goToStep]);

  return (
    <OnboardingContext.Provider
      value={{
        active,
        stepIndex,
        step: active ? (ONBOARDING_STEPS[stepIndex] ?? null) : null,
        total: ONBOARDING_STEPS.length,
        start,
        next,
        prev,
        skip: finish,
        complete: finish,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
