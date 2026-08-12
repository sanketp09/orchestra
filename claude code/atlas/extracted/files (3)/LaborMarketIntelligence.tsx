import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Design tokens — reused exactly as established across the repo. Not redefined.
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

// ---------------------------------------------------------------------------
// Types (mirrors route.py's TradeTrend / LaborMarketResponse shapes)
// ---------------------------------------------------------------------------
interface MonthlyPoint {
  month: string;
  avgWage: number;
  availabilityIndex: number;
}

interface TradeTrend {
  trade: string;
  label: string;
  history: MonthlyPoint[];
  wageTrendPct: number;
  availabilityTrendPct: number;
  riskScore: number;
  staffingRisk: boolean;
}

// ---------------------------------------------------------------------------
// Mock data — mirrors what /atlas/labor-market?region=austin_tx&trade=electrician
// would return (verified against the seeded backend math)
// ---------------------------------------------------------------------------
const MONTHS = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];

const ELECTRICIAN: TradeTrend = {
  trade: "electrician",
  label: "Electrician",
  history: [
    { month: "2026-02", avgWage: 34.0, availabilityIndex: 82 },
    { month: "2026-03", avgWage: 34.8, availabilityIndex: 78 },
    { month: "2026-04", avgWage: 35.9, availabilityIndex: 72 },
    { month: "2026-05", avgWage: 37.1, availabilityIndex: 66 },
    { month: "2026-06", avgWage: 38.2, availabilityIndex: 61 },
    { month: "2026-07", avgWage: 39.1, availabilityIndex: 58 },
  ],
  wageTrendPct: 0.15,
  availabilityTrendPct: -0.2927,
  riskScore: 0.4427,
  staffingRisk: true,
};

const COMPARABLE_TRADES: TradeTrend[] = [
  {
    trade: "hvac_technician",
    label: "HVAC Technician",
    history: [],
    wageTrendPct: 0.0968,
    availabilityTrendPct: -0.1899,
    riskScore: 0.2866,
    staffingRisk: true,
  },
  {
    trade: "plumber",
    label: "Plumber",
    history: [],
    wageTrendPct: 0.0455,
    availabilityTrendPct: -0.075,
    riskScore: 0.1205,
    staffingRisk: false,
  },
  {
    trade: "ironworker",
    label: "Structural Ironworker",
    history: [],
    wageTrendPct: 0.0333,
    availabilityTrendPct: -0.0286,
    riskScore: 0.0619,
    staffingRisk: false,
  },
  {
    trade: "general_laborer",
    label: "General Laborer",
    history: [],
    wageTrendPct: 0.0136,
    availabilityTrendPct: -0.0111,
    riskScore: 0.0247,
    staffingRisk: false,
  },
];

const AFFECTED_LABEL = "Austin Semiconductor Fab · Switchgear Shipment #4471";

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
export default function LaborMarketIntelligence() {
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
            Atlas · Labor Market Intelligence
          </span>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: tokens.foreground }}>
            Austin, TX — Electrician Trade
          </h1>
          <p className="text-xs mt-1" style={{ color: tokens.mutedForeground }}>
            Scoped to {AFFECTED_LABEL}
          </p>
        </motion.div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "220px" }}>
          <BentoCell index={0} colSpan={2} rowSpan={1}>
            <WageAvailabilityChartCard mounted={mounted} />
          </BentoCell>

          <BentoCell index={1} colSpan={1} rowSpan={1}>
            <StaffingRiskCard mounted={mounted} />
          </BentoCell>

          <BentoCell index={2} colSpan={3} rowSpan={1}>
            <ComparableTradesCard mounted={mounted} />
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

function EmbossCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("h-full w-full p-4 flex flex-col", className)}
      style={{ borderRadius: 12, background: tokens.surfaceCard, boxShadow: shadowEmboss }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero card — dual-line wage / availability chart
// ---------------------------------------------------------------------------
function WageAvailabilityChartCard({ mounted }: { mounted: boolean }) {
  const wages = ELECTRICIAN.history.map((p) => p.avgWage);
  const availability = ELECTRICIAN.history.map((p) => p.availabilityIndex);

  const w = 100;
  const h = 100;
  const xAt = (i: number) => (i / (ELECTRICIAN.history.length - 1)) * w;

  const wageMin = Math.min(...wages) * 0.96;
  const wageMax = Math.max(...wages) * 1.04;
  const yWage = (v: number) => h - ((v - wageMin) / (wageMax - wageMin)) * h;

  const availMin = Math.min(...availability) * 0.9;
  const availMax = Math.max(...availability) * 1.05;
  const yAvail = (v: number) => h - ((v - availMin) / (availMax - availMin)) * h;

  const wagePoints = wages.map((v, i) => `${xAt(i)},${yWage(v)}`).join(" ");
  const availPoints = availability.map((v, i) => `${xAt(i)},${yAvail(v)}`).join(" ");

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (mounted) {
      const t = window.setTimeout(() => setDrawn(true), 100);
      return () => window.clearTimeout(t);
    }
  }, [mounted]);

  const wageDisplay = useCountUp(wages[wages.length - 1], mounted, 2);
  const availDisplay = useCountUp(availability[availability.length - 1], mounted);

  return (
    <EmbossCard>
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Electrician — Wage vs. Availability
        </span>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: tokens.mutedForeground }}>
          <LegendItem color={tokens.danger} label="Avg wage ($/hr)" />
          <LegendItem color={tokens.info} label="Availability index" />
        </div>
      </div>

      <div className="flex items-baseline gap-4 mb-1">
        <span className="text-2xl font-semibold tabular-nums" style={{ color: tokens.danger }}>
          ${wageDisplay}
          <span className="text-xs font-normal ml-1" style={{ color: tokens.mutedForeground }}>
            /hr
          </span>
        </span>
        <span className="text-2xl font-semibold tabular-nums" style={{ color: tokens.info }}>
          {availDisplay}
          <span className="text-xs font-normal ml-1" style={{ color: tokens.mutedForeground }}>
            avail. idx
          </span>
        </span>
      </div>

      <div className="flex-1 relative min-h-0">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
          <motion.polyline
            points={wagePoints}
            fill="none"
            stroke={tokens.danger}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: drawn ? 1 : 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <motion.polyline
            points={availPoints}
            fill="none"
            stroke={tokens.info}
            strokeWidth={1.6}
            strokeDasharray="3,2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: drawn ? 1 : 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          />
        </svg>
      </div>
      <div className="flex justify-between mt-1">
        {MONTHS.map((m) => (
          <span key={m} className="text-[10px]" style={{ color: tokens.mutedForeground }}>
            {m}
          </span>
        ))}
      </div>
    </EmbossCard>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-0.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Staffing Risk card
// ---------------------------------------------------------------------------
function StaffingRiskCard({ mounted }: { mounted: boolean }) {
  const t = ELECTRICIAN;
  const wageDisplay = useCountUp(t.wageTrendPct * 100, mounted, 1);
  const availDisplay = useCountUp(Math.abs(t.availabilityTrendPct) * 100, mounted, 1);

  if (!t.staffingRisk) {
    return (
      <EmbossCard className="justify-center items-center text-center">
        <span className="text-sm" style={{ color: tokens.mutedForeground }}>
          No staffing risk detected for this trade.
        </span>
      </EmbossCard>
    );
  }

  return (
    <EmbossCard className="justify-between">
      <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
        Staffing Risk
      </span>
      <div className="flex-1 flex flex-col justify-center gap-2">
        <Badge
          style={{
            background: tokens.danger,
            color: tokens.surfaceFloating,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            padding: "5px 10px",
            alignSelf: "flex-start",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          Action needed
        </Badge>
        <p className="text-sm leading-relaxed" style={{ color: tokens.foreground }}>
          This trade may be harder and more expensive to staff than planned.
        </p>
      </div>
      <p className="text-xs" style={{ color: tokens.mutedForeground }}>
        Wage up <span className="font-semibold tabular-nums" style={{ color: tokens.danger }}>{wageDisplay}%</span>,
        availability down{" "}
        <span className="font-semibold tabular-nums" style={{ color: tokens.info }}>{availDisplay}%</span> over 6 months.
      </p>
    </EmbossCard>
  );
}

// ---------------------------------------------------------------------------
// Comparable Trades card
// ---------------------------------------------------------------------------
function ComparableTradesCard({ mounted }: { mounted: boolean }) {
  const ranked = [ELECTRICIAN, ...COMPARABLE_TRADES].sort((a, b) => b.riskScore - a.riskScore);
  const maxScore = Math.max(...ranked.map((t) => t.riskScore));

  return (
    <EmbossCard>
      <span className="text-xs tracking-wide uppercase mb-2" style={{ color: tokens.mutedForeground }}>
        Comparable Trades on This Project
      </span>
      <div className="flex-1 flex flex-col justify-center gap-2.5">
        {ranked.map((t, i) => (
          <TradeRow key={t.trade} trade={t} index={i} maxScore={maxScore} mounted={mounted} isPrimary={t.trade === "electrician"} />
        ))}
      </div>
    </EmbossCard>
  );
}

function TradeRow({
  trade,
  index,
  maxScore,
  mounted,
  isPrimary,
}: {
  trade: TradeTrend;
  index: number;
  maxScore: number;
  mounted: boolean;
  isPrimary: boolean;
}) {
  const widthPct = (trade.riskScore / maxScore) * 100;
  const color = trade.staffingRisk ? tokens.danger : tokens.mutedForeground;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: mounted ? 1 : 0, x: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + index * 0.06 }}
      className="grid items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/5"
      style={{ gridTemplateColumns: "160px 1fr 60px" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium truncate" style={{ color: tokens.foreground }}>
          {trade.label}
        </span>
        {isPrimary && (
          <Badge
            style={{
              background: tokens.muted,
              color: tokens.accent,
              borderRadius: 4,
              fontSize: 9,
              padding: "1px 5px",
            }}
          >
            this trade
          </Badge>
        )}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: tokens.muted }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: mounted ? `${widthPct}%` : 0 }}
          transition={{ duration: 0.6, delay: 0.2 + index * 0.06, ease: "easeOut" }}
        />
      </div>
      <span className="text-[11px] text-right tabular-nums" style={{ color }}>
        {trade.staffingRisk ? "at risk" : "stable"}
      </span>
    </motion.div>
  );
}
