"use client";

/**
 * Trustline — Auto Package Split
 *
 * Event-driven visualization: a failed/partial order gets automatically
 * redistributed across ranked backup vendors. The split animation is the
 * signature moment — segments visibly separate from a single bar and travel
 * out to their destination vendor.
 *
 * Demo data matches the centralized Trustline dataset (same vendor IDs/
 * numbers used across every Trustline file) and mirrors the numbers the
 * paired `/trustline/auto-package-split` endpoint returns for this exact
 * failed order, so the UI and API agree:
 *   200 units total → Meridian delivers 60% (120u) → shortfall 80u
 *   → Titan Fabricators 25% (50u) + Lonestar Metal Works 15% (30u)
 */

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Centralized Trustline demo data
// ---------------------------------------------------------------------------

const MERIDIAN = {
  id: "vendor_meridian_steel",
  name: "Meridian Steel Fabrication",
  trade: "Structural Steel",
  location: "Houston, TX",
};

const TITAN = { id: "vendor_titan_fab", name: "Titan Fabricators", trustScore: 88 };
const LONESTAR = { id: "vendor_lonestar_metal", name: "Lonestar Metal Works", trustScore: 79 };

const ORDER_TOTAL_UNITS = 200;
const ORDER_ITEM = "MS structural columns";
const ORDER_ID = "PO-4471";

type Segment = {
  id: string;
  label: string;
  role: string;
  units: number;
  fraction: number;
  color: string;
};

const SEGMENTS: Segment[] = [
  {
    id: MERIDIAN.id,
    label: MERIDIAN.name,
    role: "Original vendor — partial fulfillment",
    units: 120,
    fraction: 0.6,
    color: "var(--accent)",
  },
  {
    id: TITAN.id,
    label: TITAN.name,
    role: `Backup vendor — trust ${TITAN.trustScore}`,
    units: 50,
    fraction: 0.25,
    color: "var(--info)",
  },
  {
    id: LONESTAR.id,
    label: LONESTAR.name,
    role: `Backup vendor — trust ${LONESTAR.trustScore}`,
    units: 30,
    fraction: 0.15,
    color: "var(--success)",
  },
];

const ORIGINAL_RISK_DAYS = 12;
const PROJECTED_RISK_DAYS = 2;

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const THEME_VARS = {
  "--background": "#08070C",
  "--foreground": "#FFFFFF",
  "--muted": "rgba(255, 255, 255, 0.08)",
  "--muted-foreground": "rgba(255, 255, 255, 0.45)",
  "--accent": "#7D39EB",
  "--surface-card": "rgba(255, 255, 255, 0.02)",
  "--surface-floating": "rgba(255, 255, 255, 0.04)",
  "--success": "#C6FF33",
  "--warning": "#FBBF24",
  "--danger": "#F87171",
  "--info": "#38BDF8",
  "--ai": "#7D39EB",
} as CSSProperties;

const SOFT_SHADOW = "0 4px 12px rgba(0,0,0,0.3)";

// ---------------------------------------------------------------------------
// Count-up helper — every live metric animates in, never appears static
// ---------------------------------------------------------------------------

function useCountUp(target: number, playKey: number, delay = 0) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    motionValue.set(0);
    setDisplay(0);
    const startTimer = setTimeout(() => motionValue.set(target), delay);
    const unsubscribe = spring.on("change", (value) => setDisplay(Math.round(value)));
    return () => {
      clearTimeout(startTimer);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, playKey, delay]);

  return display;
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function AutoPackageSplit() {
  const [playKey, setPlayKey] = useState(0);
  const [split, setSplit] = useState(false);

  useEffect(() => {
    setSplit(false);
    const timer = setTimeout(() => setSplit(true), 500);
    return () => clearTimeout(timer);
  }, [playKey]);

  function replay() {
    setPlayKey((key) => key + 1);
  }

  const shortfall = ORDER_TOTAL_UNITS - SEGMENTS[0].units;

  return (
    <div className="w-full rounded-xl px-6 py-8" style={{ ...THEME_VARS }}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge
            className="mb-2 rounded-[8px] border-0 text-[11px] uppercase tracking-wide bg-white/5 text-white/60"
          >
            Trustline · Auto Package Split
          </Badge>
          <h2 className="text-xl font-semibold text-white">
            Redistributing {ORDER_ID} — {ORDER_ITEM}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/55">
            {MERIDIAN.name} confirmed it can only deliver 60% of the order. Here&apos;s how the
            remaining {shortfall} units get automatically redistributed to ranked backup vendors.
          </p>
        </div>
        <Button
          className="rounded-[8px] bg-white/5 hover:bg-white/10 text-white border border-white/10"
          onClick={replay}
        >
          Replay split
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <OriginalOrderCard shortfallUnits={shortfall} />
        <SplitAnimationCard split={split} playKey={playKey} />
        <ScheduleImpactCard playKey={playKey} split={split} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Original Order card — the failed order, one solid bar
// ---------------------------------------------------------------------------

function OriginalOrderCard({ shortfallUnits }: { shortfallUnits: number }) {
  return (
    <Card
      className={cn("col-span-1 flex flex-col justify-between rounded-xl border border-white/5 p-5")}
      style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
    >
      <div>
        <p className="text-[11px] uppercase tracking-wide text-white/40">
          Original order
        </p>
        <p className="mt-1 text-sm font-medium text-white">
          {MERIDIAN.name}
        </p>
        <p className="text-xs text-white/50 font-medium">
          {ORDER_TOTAL_UNITS} units · {ORDER_ITEM}
        </p>
      </div>

      <div className="mt-6">
        <div className="h-8 w-full overflow-hidden rounded-[8px]" style={{ background: "var(--muted)" }}>
          <motion.div
            className="h-full"
            style={{ background: "var(--danger)" }}
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span style={{ color: "var(--danger)" }} className="font-semibold">Failed — can only deliver 60%</span>
          <span className="text-white/45">{shortfallUnits}u short</span>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Split Animation card — the signature hero moment (one of exactly one glass
// treatment used on this screen)
// ---------------------------------------------------------------------------

function SplitAnimationCard({ split, playKey }: { split: boolean; playKey: number }) {
  return (
    <Card
      className={cn(
        "relative col-span-1 overflow-hidden rounded-xl border p-5 transition-shadow md:col-span-2",
        split && "shadow-[0_0_0_1px_var(--success)]"
      )}
      style={{
        background: "rgba(255,255,255,0.04)",
        borderColor: "rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
      }}
    >
      <p className="text-[11px] uppercase tracking-wide text-white/40">
        Redistribution
      </p>
      <p className="mt-1 text-sm font-medium text-white">
        Order split across ranked backup vendors
      </p>

      <div className="relative mt-8 flex h-10 gap-1">
        {SEGMENTS.map((segment) => (
          <motion.div
            key={`${segment.id}-${playKey}`}
            className="h-10 rounded-[8px]"
            style={{ background: segment.color }}
            animate={{
              width: split ? `${segment.fraction * 100}%` : segment.id === MERIDIAN.id ? "100%" : "0%",
            }}
            transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
          />
        ))}
      </div>

      <div className="relative mt-10 grid grid-cols-3 gap-3">
        {SEGMENTS.map((segment, index) => (
          <AnimatePresence key={`${segment.id}-label-${playKey}`}>
            {split && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.9 + index * 0.08, duration: 0.4, ease: EASE_OUT_EXPO }}
                className="relative pt-4"
              >
                <div
                  className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2"
                  style={{ background: segment.color }}
                />
                <p className="truncate text-xs font-medium text-white">
                  {segment.label}
                </p>
                <p className="truncate text-[11px] text-white/45 font-medium">
                  {segment.role}
                </p>
                <SegmentCount segment={segment} playKey={playKey} />
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </Card>
  );
}

function SegmentCount({ segment, playKey }: { segment: Segment; playKey: number }) {
  const units = useCountUp(segment.units, playKey, 900);
  return (
    <p className="mt-1 text-sm font-semibold" style={{ color: segment.color }}>
      {units} units{" "}
      <span className="font-normal text-white/40">
        · {Math.round(segment.fraction * 100)}%
      </span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Schedule Impact card — before / after, improved number in --success
// ---------------------------------------------------------------------------

function ScheduleImpactCard({ playKey, split }: { playKey: number; split: boolean }) {
  const projected = useCountUp(PROJECTED_RISK_DAYS, playKey, 1300);
  const daysSaved = ORIGINAL_RISK_DAYS - PROJECTED_RISK_DAYS;

  return (
    <Card
      className={cn("col-span-1 flex flex-col justify-between rounded-xl border border-white/5 p-5")}
      style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
    >
      <div>
        <p className="text-[11px] uppercase tracking-wide text-white/40">
          Schedule impact
        </p>
        <p className="mt-1 text-sm font-medium text-white">
          Delay risk, before vs. after
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-white/45">
            <span>Original risk</span>
            <span>{ORIGINAL_RISK_DAYS} days late</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--muted)" }}>
            <div className="h-full w-full" style={{ background: "var(--danger)" }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-white/45">
            <span>After split</span>
            <span style={{ color: "var(--success)" }}>{projected} days late</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--muted)" }}>
            <motion.div
              className="h-full"
              style={{ background: "var(--success)" }}
              initial={{ width: "100%" }}
              animate={{ width: split ? `${(PROJECTED_RISK_DAYS / ORIGINAL_RISK_DAYS) * 100}%` : "100%" }}
              transition={{ delay: 1.3, duration: 0.8, ease: EASE_OUT_EXPO }}
            />
          </div>
        </div>
      </div>

      <Badge
        className="mt-4 w-fit rounded-[8px] border-0 text-xs font-bold"
        style={{ background: "var(--success)", color: "#000000" }}
      >
        −{daysSaved} days recovered
      </Badge>
    </Card>
  );
}
