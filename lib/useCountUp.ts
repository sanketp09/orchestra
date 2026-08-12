"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

/**
 * Animates a displayed integer from its previous value to `target`
 * whenever `target` changes, over `durationSec` with an ease-out curve.
 *
 * This backs the single most important motion detail in the product: the
 * Trust Badge number easing between values. It is intentionally its own
 * hook (rather than inlined) so any "big number" surface — trust score,
 * risk score — gets the exact same feel.
 */
export function useCountUp(target: number, durationSec = 0.6): number {
  const [displayValue, setDisplayValue] = useState(target);
  const previousTarget = useRef(target);

  useEffect(() => {
    const from = previousTarget.current;
    const to = target;

    if (from === to) return;

    const controls = animate(from, to, {
      duration: durationSec,
      ease: "easeOut",
      onUpdate: (latest) => {
        setDisplayValue(Math.round(latest));
      },
      onComplete: () => {
        previousTarget.current = to;
      },
    });

    return () => controls.stop();
  }, [target, durationSec]);

  return displayValue;
}
