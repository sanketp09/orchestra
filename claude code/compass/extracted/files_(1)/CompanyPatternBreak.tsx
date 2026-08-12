import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Design tokens — ORCHESTRA system
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
// Types (mirrors company_pattern_break.py's shapes)
// ---------------------------------------------------------------------------
type Factor = "cost" | "schedule" | "quality" | "risk";
type DeviationLabel = "low" | "medium" | "high";

interface Weights {
  cost: number;
  schedule: number;
  quality: number;
  risk: number;
}

interface HistoricalDecision {
  id: string;
  project: string;
  decidedOn: string;
  prioritized: Factor;
  weights: Weights;
  narrative: string;
}

// ---------------------------------------------------------------------------
// Mock data — mirrors what company_pattern_break.py would return for the
// "Block C exterior cladding: lower-quality supplier for 7% savings" example
// ---------------------------------------------------------------------------
const FACTORS: { key: Factor; label: string; angle: number }[] = [
  { key: "cost", label: "COST", angle: -90 },
  { key: "schedule", label: "SCHEDULE", angle: 0 },
  { key: "quality", label: "QUALITY", angle: 90 },
  { key: "risk", label: "RISK", angle: 180 },
];

const COHORT: HistoricalDecision[] = [
  { id: "dec_001", project: "Riverside Tower — Curtain Wall", decidedOn: "Feb 2024", prioritized: "schedule", weights: { cost: 0.15, schedule: 0.55, quality: 0.25, risk: 0.05 }, narrative: "Retained certified glazing vendor despite an 8% premium to protect the tower delivery date." },
  { id: "dec_002", project: "Harbor Point — MEP Package", decidedOn: "May 2024", prioritized: "schedule", weights: { cost: 0.10, schedule: 0.60, quality: 0.25, risk: 0.05 }, narrative: "Declined a 6% cheaper subcontractor with a longer lead time to hold the commissioning schedule." },
  { id: "dec_003", project: "Delta Logistics Hub — Structural Steel", decidedOn: "Jul 2024", prioritized: "quality", weights: { cost: 0.10, schedule: 0.20, quality: 0.65, risk: 0.05 }, narrative: "Selected a higher-cost fabricator with a stronger QA record for primary load-bearing members." },
  { id: "dec_004", project: "Northgate Data Center — Cooling Systems", decidedOn: "Sep 2024", prioritized: "schedule", weights: { cost: 0.12, schedule: 0.58, quality: 0.24, risk: 0.06 }, narrative: "Paid a premium to secure a vendor slot ahead of a competing project to avoid a commissioning slip." },
  { id: "dec_005", project: "Summit Ridge — Elevator Package", decidedOn: "Nov 2024", prioritized: "schedule", weights: { cost: 0.14, schedule: 0.56, quality: 0.25, risk: 0.05 }, narrative: "Chose the incumbent vendor over a cheaper new entrant to avoid re-qualification delays." },
  { id: "dec_006", project: "Coastal Bridge Retrofit — Bearings", decidedOn: "Jan 2025", prioritized: "schedule", weights: { cost: 0.13, schedule: 0.57, quality: 0.24, risk: 0.06 }, narrative: "Held the original vendor to protect the lane-closure schedule despite a cheaper alternative bid." },
  { id: "dec_007", project: "Ashford Campus — Fire Suppression", decidedOn: "Mar 2025", prioritized: "schedule", weights: { cost: 0.11, schedule: 0.59, quality: 0.24, risk: 0.06 }, narrative: "Accepted a 5% premium to lock a fabrication slot before a seasonal capacity crunch." },
  { id: "dec_008", project: "Meridian Yards — Precast Facade", decidedOn: "Jun 2025", prioritized: "quality", weights: { cost: 0.09, schedule: 0.19, quality: 0.66, risk: 0.06 }, narrative: "Rejected the lowest bid over documented QC failures on a comparable prior project." },
  { id: "dec_009", project: "Union Terminal — Roofing System", decidedOn: "Aug 2025", prioritized: "schedule", weights: { cost: 0.13, schedule: 0.55, quality: 0.26, risk: 0.06 }, narrative: "Kept the qualified vendor to avoid a re-bid cycle ahead of the winter weather window." },
];

const SUPPORTING = COHORT.filter((d) => d.prioritized === "schedule"); // 7 of 9

const CURRENT_DECISION = {
  project: "Block C — Exterior Cladding",
  weights: { cost: 0.55, schedule: 0.15, quality: 0.20, risk: 0.10 } as Weights,
  prioritized: "cost" as Factor,
  summary: "Accept a lower-quality supplier for a 7% cost saving on a mission-critical package.",
};

const HISTORICAL_PATTERN = {
  dominantFactor: "schedule" as Factor,
  dominantShare: 0.78,
  cohortSize: 9,
};

const DEVIATION_SCORE = 0.42;
const DEVIATION_LABEL: DeviationLabel = "high";
const PATTERN_BROKEN = true;

const DEVIATION_COLOR: Record<DeviationLabel, string> = {
  low: tokens.success,
  medium: tokens.warning,
  high: tokens.danger,
};

// ---------------------------------------------------------------------------
// Radar geometry helpers
// ---------------------------------------------------------------------------
const RADAR_SIZE = 300;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_MAX_RADIUS = RADAR_CENTER - 44;

function pointFor(factor: Factor, value: number, angleOverride?: number): [number, number] {
  const def = FACTORS.find((f) => f.key === factor)!;
  const angle = ((angleOverride ?? def.angle) * Math.PI) / 180;
  const r = value * RADAR_MAX_RADIUS;
  return [RADAR_CENTER + r * Math.cos(angle), RADAR_CENTER + r * Math.sin(angle)];
}

function polygonPoints(weights: Weights): string {
  return FACTORS.map((f) => pointFor(f.key, weights[f.key]).join(",")).join(" ");
}

// ---------------------------------------------------------------------------
// Motion helper
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

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------
export default function CompanyPatternBreak() {
  const [phase, setPhase] = useState<"cloud" | "current" | "settled">("cloud");
  const [selectedDecision, setSelectedDecision] = useState<HistoricalDecision | null>(null);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("current"), 700);
    const t2 = window.setTimeout(() => setPhase("settled"), 1600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const sharePct = useCountUp(Math.round(HISTORICAL_PATTERN.dominantShare * 100), phase !== "cloud");

  return (
    <div
      className="min-h-full w-full p-6"
      style={{ background: tokens.background, color: tokens.foreground, fontFamily: "Inter, sans-serif" }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-5"
        >
          <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
            Compass · Company Pattern-Break Flag
          </span>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: tokens.foreground }}>
            Does this decision break how we normally make this trade-off?
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.mutedForeground }}>
            {CURRENT_DECISION.project} — {CURRENT_DECISION.summary}
          </p>
        </motion.div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
          <FingerprintCard phase={phase} onSelectHistorical={setSelectedDecision} />
          <ExplanationPanel phase={phase} sharePct={sharePct} onSelectHistorical={setSelectedDecision} />
        </div>

        <AnimatePresence>
          {phase === "settled" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="mt-4"
            >
              <WowBanner sharePct={Math.round(HISTORICAL_PATTERN.dominantShare * 100)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DecisionDetailDrawer decision={selectedDecision} onClose={() => setSelectedDecision(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fingerprint radar card (hero, glass treatment)
// ---------------------------------------------------------------------------
function FingerprintCard({
  phase,
  onSelectHistorical,
}: {
  phase: "cloud" | "current" | "settled";
  onSelectHistorical: (d: HistoricalDecision) => void;
}) {
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-6 flex flex-col items-center"
      style={{
        background: "rgba(255,255,255,0.55)",
        borderRadius: 12,
        boxShadow: shadowLg,
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.6)",
      }}
    >
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Company Decision Fingerprint
        </span>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: tokens.mutedForeground }}>
          <LegendDot color={tokens.info} label="Comparable decisions" />
          <LegendDot color={DEVIATION_COLOR[DEVIATION_LABEL]} label="Current decision" />
        </div>
      </div>

      <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="w-full max-w-[420px]">
        {/* Grid rings */}
        {rings.map((r) => (
          <circle
            key={r}
            cx={RADAR_CENTER}
            cy={RADAR_CENTER}
            r={r * RADAR_MAX_RADIUS}
            fill="none"
            stroke={tokens.muted}
            strokeWidth={1}
            opacity={0.6}
          />
        ))}
        {/* Spokes + labels */}
        {FACTORS.map((f) => {
          const [x, y] = pointFor(f.key, 1.12);
          const [gx, gy] = pointFor(f.key, 1);
          return (
            <g key={f.key}>
              <line x1={RADAR_CENTER} y1={RADAR_CENTER} x2={gx} y2={gy} stroke={tokens.muted} strokeWidth={1} />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight={500}
                fill={tokens.mutedForeground}
                style={{ letterSpacing: 0.5 }}
              >
                {f.label}
              </text>
            </g>
          );
        })}

        {/* Historical cloud — each comparable decision as a faint polygon */}
        {COHORT.map((d, i) => (
          <motion.polygon
            key={d.id}
            points={polygonPoints(d.weights)}
            fill={d.prioritized === "schedule" ? tokens.info : tokens.ai}
            stroke={d.prioritized === "schedule" ? tokens.info : tokens.ai}
            strokeWidth={1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.08 }}
            transition={{ duration: 0.5, delay: i * 0.04 }}
            onClick={() => onSelectHistorical(d)}
            style={{ cursor: "pointer" }}
          />
        ))}

        {/* Historical decision vertex dots (subtle, on the dominant schedule axis mainly) */}
        {COHORT.map((d) => {
          const [x, y] = pointFor(d.prioritized, d.weights[d.prioritized]);
          return (
            <motion.circle
              key={`${d.id}-dot`}
              cx={x}
              cy={y}
              r={3}
              fill={d.prioritized === "schedule" ? tokens.info : tokens.ai}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              onClick={() => onSelectHistorical(d)}
              style={{ cursor: "pointer" }}
            />
          );
        })}

        {/* Current decision — animates in, clearly outside the cloud on the cost axis */}
        <AnimatePresence>
          {phase !== "cloud" && (
            <motion.polygon
              points={polygonPoints(CURRENT_DECISION.weights)}
              fill={DEVIATION_COLOR[DEVIATION_LABEL]}
              fillOpacity={0.12}
              stroke={DEVIATION_COLOR[DEVIATION_LABEL]}
              strokeWidth={2.5}
              strokeLinejoin="round"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ transformOrigin: `${RADAR_CENTER}px ${RADAR_CENTER}px` }}
            />
          )}
        </AnimatePresence>

        {/* Highlight ring on the deviating vertex (cost) */}
        <AnimatePresence>
          {phase === "settled" && (
            <motion.circle
              cx={pointFor("cost", CURRENT_DECISION.weights.cost)[0]}
              cy={pointFor("cost", CURRENT_DECISION.weights.cost)[1]}
              r={6}
              fill="none"
              stroke={tokens.danger}
              strokeWidth={2}
              initial={{ opacity: 0, r: 4 }}
              animate={{ opacity: [0, 1, 0.4], r: [4, 12, 9] }}
              transition={{ duration: 1.4, repeat: Infinity, repeatType: "loop" }}
            />
          )}
        </AnimatePresence>
      </svg>

      <p className="text-xs mt-2 text-center max-w-sm" style={{ color: tokens.mutedForeground }}>
        Each faint shape is a comparable past decision. The current decision (outlined) sits well outside
        the cloud on the cost axis.
      </p>
    </motion.div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Explanation panel
// ---------------------------------------------------------------------------
function ExplanationPanel({
  phase,
  sharePct,
  onSelectHistorical,
}: {
  phase: "cloud" | "current" | "settled";
  sharePct: string;
  onSelectHistorical: (d: HistoricalDecision) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="p-5 flex flex-col gap-4"
      style={{ background: tokens.surfaceCard, borderRadius: 12, boxShadow: shadowEmboss }}
    >
      <div>
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Historical Pattern
        </span>
        <p className="text-sm mt-1.5" style={{ color: tokens.foreground }}>
          <span className="font-semibold tabular-nums">{sharePct}%</span> of similar decisions prioritized{" "}
          <span className="font-medium">{HISTORICAL_PATTERN.dominantFactor} certainty</span>.
        </p>
      </div>

      <div>
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Current
        </span>
        <p className="text-sm mt-1.5" style={{ color: tokens.foreground }}>
          Prioritizes <span className="font-medium">{CURRENT_DECISION.prioritized} savings</span>.
        </p>
      </div>

      <div>
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Pattern Deviation
        </span>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge
            style={{
              background: DEVIATION_COLOR[DEVIATION_LABEL],
              color: tokens.surfaceFloating,
              borderRadius: 6,
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: 0.5,
            }}
          >
            {DEVIATION_LABEL}
          </Badge>
          <span className="text-xs tabular-nums" style={{ color: tokens.mutedForeground }}>
            score {DEVIATION_SCORE.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t" style={{ borderColor: tokens.muted }}>
        <span className="text-xs tracking-wide uppercase mb-2 block" style={{ color: tokens.mutedForeground }}>
          Supporting Decisions ({SUPPORTING.length})
        </span>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {SUPPORTING.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelectHistorical(d)}
              className="w-full text-left p-2 rounded-lg transition-colors hover:bg-black/5"
              style={{ border: `1px solid ${tokens.muted}` }}
            >
              <p className="text-xs font-medium truncate" style={{ color: tokens.foreground }}>
                {d.project}
              </p>
              <p className="text-[11px]" style={{ color: tokens.mutedForeground }}>
                {d.decidedOn} · prioritized {d.prioritized}
              </p>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// WOW MOMENT banner
// ---------------------------------------------------------------------------
function WowBanner({ sharePct }: { sharePct: number }) {
  return (
    <div
      className="flex items-center justify-between p-5 rounded-xl"
      style={{ background: tokens.foreground, color: tokens.surfaceFloating }}
    >
      <div>
        <p className="text-lg font-semibold">
          {SUPPORTING.length} of {HISTORICAL_PATTERN.cohortSize} comparable decisions prioritized schedule certainty.
        </p>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
          This decision prioritizes cost savings instead — a break from established organizational behavior.
        </p>
      </div>
      <Badge
        style={{
          background: DEVIATION_COLOR[DEVIATION_LABEL],
          color: tokens.surfaceFloating,
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Pattern deviation: {DEVIATION_LABEL}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decision detail drawer (for clicking cloud points / supporting list)
// ---------------------------------------------------------------------------
function DecisionDetailDrawer({
  decision,
  onClose,
}: {
  decision: HistoricalDecision | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {decision && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(12,9,4,0.35)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed top-0 right-0 h-full z-50 p-6 overflow-y-auto"
            style={{ width: 380, background: tokens.surfaceCard, boxShadow: "-8px 0 24px rgba(12,9,4,0.15)" }}
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <Badge
                  style={{
                    background: decision.prioritized === "schedule" ? tokens.info : tokens.ai,
                    color: tokens.surfaceFloating,
                    borderRadius: 6,
                  }}
                >
                  prioritized {decision.prioritized}
                </Badge>
                <h3 className="text-base font-semibold mt-2" style={{ color: tokens.foreground }}>
                  {decision.project}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: tokens.mutedForeground }}>
                  {decision.decidedOn}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-sm transition-colors hover:opacity-60"
                style={{ color: tokens.mutedForeground }}
              >
                Close
              </button>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: tokens.foreground }}>
              {decision.narrative}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {FACTORS.map((f) => (
                <div
                  key={f.key}
                  className="p-2 rounded-lg"
                  style={{ background: tokens.surfaceFloating, border: `1px solid ${tokens.muted}` }}
                >
                  <p className="text-[10px] uppercase" style={{ color: tokens.mutedForeground }}>
                    {f.label}
                  </p>
                  <p className="text-sm font-medium tabular-nums" style={{ color: tokens.foreground }}>
                    {Math.round(decision.weights[f.key] * 100)}%
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
