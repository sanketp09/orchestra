import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Design tokens — reused exactly as established across Sentinel / Trustline /
// Compass / Precedent. Not redefined here.
// ---------------------------------------------------------------------------
const tokens = {
  background: "#F3EDE7",
  foreground: "#0C0904",
  muted: "#DBC3B3",
  mutedForeground: "#AA8D74",
  accent: "#AC723E",
  surfaceCard: "#FAF7F3",
  surfaceFloating: "#FFFFFF",
  success: "#4A7A5C",
  warning: "#B8873A",
  danger: "#A6432F",
  info: "#4A6A8A",
  ai: "#6B5A7A",
} as const;

const shadowEmboss = "-4px -4px 10px rgba(255,255,255,0.65), 6px 8px 18px rgba(12,9,4,0.08)";
const shadowLg = "0 8px 24px rgba(12,9,4,0.10)";

// ---------------------------------------------------------------------------
// Types (mirrors commodity_intelligence_route.py's CommodityTrack shape)
// ---------------------------------------------------------------------------
type Recommendation = "lock" | "hold";

interface PricePoint {
  date: string;
  price: number;
}

interface CommodityTrack {
  commodity: string;
  unit: string;
  projectName: string;
  budgetedUsd: number;
  thresholdPricePerUnit: number;
  currentPrice: number;
  priceHistory: PricePoint[];
  pctOfThreshold: number;
  trendPct5d: number;
  recommendation: Recommendation;
  recommendationReason: string;
  estimatedCostOfWaitingUsd: number | null;
}

// ---------------------------------------------------------------------------
// Mock data — mirrors what /atlas/commodity-intelligence would return for
// project_austin_fab (verified against the seeded backend math)
// ---------------------------------------------------------------------------
const STEEL_HISTORY: number[] = [
  2733.64, 2741.94, 2747.93, 2750.09, 2748.24, 2743.62, 2738.42, 2735.04, 2735.24, 2739.53,
  2747.0, 2755.61, 2762.94, 2767.02, 2766.99, 2763.45, 2758.22, 2753.7, 2752.06, 2754.45,
  2760.61, 2768.98, 2777.21, 2783.01, 2784.94, 2814.51, 2841.42, 2867.88, 2896.28, 2940.0,
];

const COPPER_HISTORY: number[] = [
  10.5, 10.48, 10.44, 10.4, 10.38, 10.37, 10.39, 10.42, 10.45, 10.47, 10.49, 10.5, 10.52,
  10.51, 10.48, 10.45, 10.43, 10.41, 10.4, 10.41, 10.43, 10.45, 10.44, 10.41, 10.38, 10.35,
  10.31, 10.27, 10.23, 10.2,
];

const STRUCTURAL_STEEL: CommodityTrack = {
  commodity: "Structural Steel",
  unit: "per ton",
  projectName: "Austin Semiconductor Fab",
  budgetedUsd: 2_100_000,
  thresholdPricePerUnit: 3000,
  currentPrice: 2940,
  priceHistory: STEEL_HISTORY.map((price, i) => ({ date: `d${i}`, price })),
  pctOfThreshold: 0.98,
  trendPct5d: 0.06,
  recommendation: "lock",
  recommendationReason:
    "Price is within 10% of the budget threshold and has risen 6.0% over the last 5 days.",
  estimatedCostOfWaitingUsd: 126000,
};

const COPPER_WIRING: CommodityTrack = {
  commodity: "Copper Wiring",
  unit: "per lb",
  projectName: "Austin Semiconductor Fab",
  budgetedUsd: 480_000,
  thresholdPricePerUnit: 12,
  currentPrice: 10.2,
  priceHistory: COPPER_HISTORY.map((price, i) => ({ date: `d${i}`, price })),
  pctOfThreshold: 0.85,
  trendPct5d: -0.0145,
  recommendation: "hold",
  recommendationReason:
    "Price sits 15.0% below the budget threshold — still comfortable room before this budget line is at risk.",
  estimatedCostOfWaitingUsd: null,
};

const AFFECTED_LABEL = "Meridian Steel · Switchgear Shipment #4471 · Austin Semiconductor Fab";

// ---------------------------------------------------------------------------
// Motion helpers
// ---------------------------------------------------------------------------
function useCountUp(target: number, active: boolean, decimals = 0) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 55, damping: 16 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (active) motionVal.set(target);
  }, [active, target, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [spring]);

  return decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();
}

const bentoVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, delay: i * 0.08, ease: "easeOut" },
  }),
};

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------
export default function CommodityIntelligence() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className="min-h-full w-full p-6"
      style={{ background: tokens.background, color: tokens.foreground, fontFamily: "Inter, sans-serif" }}
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-5"
        >
          <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
            Atlas · Commodity Intelligence
          </span>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: tokens.foreground }}>
            Austin Semiconductor Fab
          </h1>
          <p className="text-xs mt-1" style={{ color: tokens.mutedForeground }}>
            Tracking exposure through {AFFECTED_LABEL}
          </p>
        </motion.div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "220px" }}
        >
          <BentoCell index={0} colSpan={2} rowSpan={2}>
            <SteelHeroCard mounted={mounted} />
          </BentoCell>

          <BentoCell index={1} colSpan={1} rowSpan={1}>
            <LockRecommendationCard track={STRUCTURAL_STEEL} mounted={mounted} />
          </BentoCell>

          <BentoCell index={2} colSpan={1} rowSpan={1}>
            <CopperCard track={COPPER_WIRING} mounted={mounted} />
          </BentoCell>
        </div>
      </div>
    </div>
  );
}

function BentoCell({
  index,
  colSpan,
  rowSpan,
  children,
}: {
  index: number;
  colSpan: number;
  rowSpan: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={bentoVariants}
      style={{ gridColumn: `span ${colSpan}`, gridRow: `span ${rowSpan}` }}
    >
      {children}
    </motion.div>
  );
}

function EmbossCard({
  className,
  glass,
  children,
}: {
  className?: string;
  glass?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("h-full w-full p-4 flex flex-col", className)}
      style={{
        borderRadius: 12,
        background: glass ? "rgba(255,255,255,0.55)" : tokens.surfaceCard,
        boxShadow: glass ? shadowLg : shadowEmboss,
        backdropFilter: glass ? "blur(12px)" : undefined,
        border: glass ? "1px solid rgba(255,255,255,0.6)" : "none",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero card — structural steel price chart with budget threshold line
// ---------------------------------------------------------------------------
function SteelHeroCard({ mounted }: { mounted: boolean }) {
  const track = STRUCTURAL_STEEL;
  const priceDisplay = useCountUp(track.currentPrice, mounted);
  const pctDisplay = useCountUp(track.pctOfThreshold * 100, mounted);

  const prices = track.priceHistory.map((p) => p.price);
  const chartMin = Math.min(...prices) * 0.985;
  const chartMax = Math.max(track.thresholdPricePerUnit, ...prices) * 1.02;
  const w = 100;
  const h = 100;

  const xAt = (i: number) => (i / (prices.length - 1)) * w;
  const yAt = (v: number) => h - ((v - chartMin) / (chartMax - chartMin)) * h;

  const linePoints = prices.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const areaPoints = `0,${h} ${linePoints} ${w},${h}`;
  const thresholdY = yAt(track.thresholdPricePerUnit);

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (mounted) {
      const t = window.setTimeout(() => setDrawn(true), 100);
      return () => window.clearTimeout(t);
    }
  }, [mounted]);

  return (
    <EmbossCard glass className="justify-between">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
            Structural Steel — 30 Day Trend
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-semibold tabular-nums" style={{ color: tokens.foreground }}>
              ${priceDisplay}
            </span>
            <span className="text-xs" style={{ color: tokens.mutedForeground }}>
              {track.unit}
            </span>
            <span
              className="text-xs font-medium ml-1"
              style={{ color: track.trendPct5d >= 0 ? tokens.danger : tokens.success }}
            >
              {track.trendPct5d >= 0 ? "▲" : "▼"} {Math.abs(track.trendPct5d * 100).toFixed(1)}% / 5d
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs tabular-nums font-medium" style={{ color: tokens.danger }}>
            {pctDisplay}%
          </span>
          <p className="text-[10px]" style={{ color: tokens.mutedForeground }}>
            of budget threshold
          </p>
        </div>
      </div>

      <div className="flex-1 relative min-h-0 my-2">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="steelFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tokens.accent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={tokens.accent} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Budget threshold reference line */}
          <line
            x1={0}
            y1={thresholdY}
            x2={w}
            y2={thresholdY}
            stroke={tokens.danger}
            strokeWidth={0.6}
            strokeDasharray="2,1.5"
            vectorEffect="non-scaling-stroke"
          />

          {/* Area fill */}
          <motion.polygon
            points={areaPoints}
            fill="url(#steelFill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: drawn ? 1 : 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          />

          {/* Drawn line */}
          <motion.polyline
            points={linePoints}
            fill="none"
            stroke={tokens.accent}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: drawn ? 1 : 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <span
          className="absolute text-[9px] font-medium px-1 rounded"
          style={{
            right: 0,
            top: `calc(${(thresholdY / h) * 100}% - 14px)`,
            color: tokens.danger,
            background: "rgba(255,255,255,0.7)",
          }}
        >
          Budget threshold — ${track.thresholdPricePerUnit.toLocaleString()}
        </span>
      </div>

      <p className="text-xs" style={{ color: tokens.mutedForeground }}>
        ${track.budgetedUsd.toLocaleString()} budgeted for {track.projectName}
      </p>
    </EmbossCard>
  );
}

// ---------------------------------------------------------------------------
// Lock Recommendation card
// ---------------------------------------------------------------------------
function LockRecommendationCard({ track, mounted }: { track: CommodityTrack; mounted: boolean }) {
  const isLock = track.recommendation === "lock";
  const color = isLock ? tokens.danger : tokens.success;
  const costDisplay = useCountUp(track.estimatedCostOfWaitingUsd ?? 0, mounted);

  return (
    <EmbossCard className="justify-between">
      <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
        Recommendation
      </span>
      <div className="flex-1 flex flex-col justify-center gap-2">
        <Badge
          style={{
            background: color,
            color: tokens.surfaceFloating,
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            padding: "6px 12px",
            alignSelf: "flex-start",
          }}
        >
          {isLock ? "Lock price now" : "Hold — trending favorably"}
        </Badge>
        <p className="text-xs leading-relaxed" style={{ color: tokens.mutedForeground }}>
          {track.recommendationReason}
        </p>
      </div>
      {isLock && track.estimatedCostOfWaitingUsd !== null && (
        <p className="text-xs" style={{ color: tokens.foreground }}>
          A further {Math.abs(track.trendPct5d * 100).toFixed(0)}% rise would cost an additional{" "}
          <span className="font-semibold tabular-nums">${costDisplay}</span>
        </p>
      )}
    </EmbossCard>
  );
}

// ---------------------------------------------------------------------------
// Copper card — compact secondary version of the same pattern
// ---------------------------------------------------------------------------
function CopperCard({ track, mounted }: { track: CommodityTrack; mounted: boolean }) {
  const priceDisplay = useCountUp(track.currentPrice, mounted, 2);
  const isLock = track.recommendation === "lock";
  const color = isLock ? tokens.danger : tokens.success;

  const prices = track.priceHistory.map((p) => p.price);
  const chartMin = Math.min(...prices) * 0.995;
  const chartMax = Math.max(track.thresholdPricePerUnit, ...prices) * 1.01;
  const w = 100;
  const h = 40;
  const xAt = (i: number) => (i / (prices.length - 1)) * w;
  const yAt = (v: number) => h - ((v - chartMin) / (chartMax - chartMin)) * h;
  const linePoints = prices.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (mounted) {
      const t = window.setTimeout(() => setDrawn(true), 200);
      return () => window.clearTimeout(t);
    }
  }, [mounted]);

  return (
    <EmbossCard className="justify-between">
      <div className="flex items-start justify-between">
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Copper Wiring
        </span>
        <Badge
          style={{
            background: color,
            color: tokens.surfaceFloating,
            borderRadius: 6,
            fontSize: 10,
            padding: "2px 7px",
          }}
        >
          {isLock ? "Lock" : "Hold"}
        </Badge>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tabular-nums" style={{ color: tokens.foreground }}>
          ${priceDisplay}
        </span>
        <span className="text-[10px]" style={{ color: tokens.mutedForeground }}>
          {track.unit}
        </span>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-8 my-1">
        <motion.polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: drawn ? 1 : 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </svg>

      <p className="text-[11px]" style={{ color: tokens.mutedForeground }}>
        {Math.round(track.pctOfThreshold * 100)}% of ${track.thresholdPricePerUnit}/{track.unit.split(" ")[1]} threshold
        · ${track.budgetedUsd.toLocaleString()} budget
      </p>
    </EmbossCard>
  );
}
