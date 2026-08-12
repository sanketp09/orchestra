"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion, type Transition, type Variants } from "framer-motion";

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
  },
};

export const staggerFadeIn = {
  container: staggerContainer,
  item: staggerItem,
};

export interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
}

export function useCountUp(
  value: number,
  { duration = 600, decimals = 0 }: UseCountUpOptions = {}
): number {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;

    if (prefersReducedMotion || from === to) {
      setDisplayValue(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOut(progress);
      const current = from + (to - from) * eased;
      const factor = Math.pow(10, decimals);
      setDisplayValue(Math.round(current * factor) / factor);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, decimals, prefersReducedMotion]);

  return displayValue;
}

export const slideInPanelTransition: Transition = {
  duration: 0.25,
  ease: [0.16, 1, 0.3, 1],
};

export const slideInPanel: Variants = {
  hidden: {
    x: "100%",
    opacity: 0,
    transition: slideInPanelTransition,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: slideInPanelTransition,
  },
};

export function contentPushVariants(panelWidthPx: number): Variants {
  return {
    full: { marginRight: 0, transition: slideInPanelTransition },
    pushed: { marginRight: panelWidthPx, transition: slideInPanelTransition },
  };
}
