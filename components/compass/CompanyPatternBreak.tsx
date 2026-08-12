import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Design tokens — ORCHESTRA system
// ---------------------------------------------------------------------------
const tokens = {
  background: "#08070C",
  foreground: "#FFFFFF",
  muted: "rgba(255, 255, 255, 0.08)",
  mutedForeground: "rgba(245, 243, 239, 0.45)",
  accent: "#7D39EB",
  surfaceCard: "#120E1C",
  surfaceFloating: "#1C172E",
  success: "#C6FF33",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#60A5FA",
  ai: "#7D39EB",
} as const;

const shadowEmboss = "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)";
const shadowLg = "0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.12)";

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
export default function CompanyPatternBreak({ data }: { data?: any }) {
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

  const cohort = useMemo(() => {
    if (!data?.supporting_decisions) return COHORT;
    return data.supporting_decisions.map((d: any) => ({
      id: d.id,
      project: d.project || d.project_name || "Historical Project",
      decidedOn: d.decided_on || d.decidedOn || "Past Date",
      prioritized: d.prioritized,
      weights: {
        cost: d.weights?.cost ?? 0.25,
        schedule: d.weights?.schedule ?? 0.25,
        quality: d.weights?.quality ?? 0.25,
        risk: d.weights?.risk ?? 0.25,
      },
      narrative: d.narrative || d.summary || "",
    }));
  }, [data]);

  const currentDecision = useMemo(() => {
    if (!data?.current_decision) return CURRENT_DECISION;
    const cd = data.current_decision;
    return {
      project: cd.project_name || "Current Project",
      weights: {
        cost: cd.weights?.cost ?? 0.25,
        schedule: cd.weights?.schedule ?? 0.25,
        quality: cd.weights?.quality ?? 0.25,
        risk: cd.weights?.risk ?? 0.25,
      },
      prioritized: cd.prioritized,
      summary: cd.summary || "",
    };
  }, [data]);

  const historicalPattern = useMemo(() => {
    if (!data?.historical_pattern) return HISTORICAL_PATTERN;
    const hp = data.historical_pattern;
    return {
      dominantFactor: hp.dominant_factor,
      dominantShare: hp.dominant_factor_share,
      cohortSize: hp.comparable_decision_count,
    };
  }, [data]);

  const deviationScore = data?.deviation_score ?? DEVIATION_SCORE;
  const deviationLabel = (data?.deviation_label ?? DEVIATION_LABEL) as DeviationLabel;
  const supporting = useMemo(() => {
    return cohort.filter((d: any) => d.prioritized === historicalPattern.dominantFactor);
  }, [cohort, historicalPattern]);

  const sharePct = useCountUp(Math.round(historicalPattern.dominantShare * 100), phase !== "cloud");

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
            {currentDecision.project} — {currentDecision.summary}
          </p>
        </motion.div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
          <FingerprintCard
            phase={phase}
            onSelectHistorical={setSelectedDecision}
            cohort={cohort}
            currentDecision={currentDecision}
            deviationLabel={deviationLabel}
          />
          <ExplanationPanel
            phase={phase}
            sharePct={sharePct}
            onSelectHistorical={setSelectedDecision}
            currentDecision={currentDecision}
            historicalPattern={historicalPattern}
            deviationLabel={deviationLabel}
            deviationScore={deviationScore}
            supporting={supporting}
          />
        </div>

        <AnimatePresence>
          {phase === "settled" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="mt-4"
            >
              <WowBanner
                historicalPattern={historicalPattern}
                deviationLabel={deviationLabel}
                supporting={supporting}
              />
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
  cohort,
  currentDecision,
  deviationLabel,
}: {
  phase: "cloud" | "current" | "settled";
  onSelectHistorical: (d: HistoricalDecision) => void;
  cohort: HistoricalDecision[];
  currentDecision: any;
  deviationLabel: DeviationLabel;
}) {
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-6 flex flex-col items-center"
      style={{
        background: tokens.surfaceCard,
        borderRadius: 12,
        boxShadow: shadowLg,
        backdropFilter: "blur(12px)",
        border: `1px solid ${tokens.muted}`,
      }}
    >
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Company Decision Fingerprint
        </span>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: tokens.mutedForeground }}>
          <LegendDot color={tokens.info} label="Comparable decisions" />
          <LegendDot color={DEVIATION_COLOR[deviationLabel]} label="Current decision" />
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
        {cohort.map((d, i) => (
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
        {cohort.map((d) => {
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
              points={polygonPoints(currentDecision.weights)}
              fill={DEVIATION_COLOR[deviationLabel]}
              fillOpacity={0.12}
              stroke={DEVIATION_COLOR[deviationLabel]}
              strokeWidth={2.5}
              strokeLinejoin="round"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ transformOrigin: `${RADAR_CENTER}px ${RADAR_CENTER}px` }}
            />
          )}
        </AnimatePresence>

        {/* Highlight ring on the deviating vertex (cost or prioritized) */}
        <AnimatePresence>
          {phase === "settled" && (
            <motion.circle
              cx={pointFor(currentDecision.prioritized, currentDecision.weights[currentDecision.prioritized])[0]}
              cy={pointFor(currentDecision.prioritized, currentDecision.weights[currentDecision.prioritized])[1]}
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
  currentDecision,
  historicalPattern,
  deviationLabel,
  deviationScore,
  supporting,
}: {
  phase: "cloud" | "current" | "settled";
  sharePct: string;
  onSelectHistorical: (d: HistoricalDecision) => void;
  currentDecision: any;
  historicalPattern: any;
  deviationLabel: DeviationLabel;
  deviationScore: number;
  supporting: HistoricalDecision[];
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
          <span className="font-medium">{historicalPattern.dominantFactor} certainty</span>.
        </p>
      </div>

      <div>
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Current
        </span>
        <p className="text-sm mt-1.5" style={{ color: tokens.foreground }}>
          Prioritizes <span className="font-medium">{currentDecision.prioritized} savings</span>.
        </p>
      </div>

      <div>
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Pattern Deviation
        </span>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge
            style={{
              background: DEVIATION_COLOR[deviationLabel],
              color: tokens.surfaceFloating,
              borderRadius: 6,
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: 0.5,
            }}
          >
            {deviationLabel}
          </Badge>
          <span className="text-xs tabular-nums" style={{ color: tokens.mutedForeground }}>
            score {deviationScore.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t" style={{ borderColor: tokens.muted }}>
        <span className="text-xs tracking-wide uppercase mb-2 block" style={{ color: tokens.mutedForeground }}>
          Supporting Decisions ({supporting.length})
        </span>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {supporting.map((d) => (
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
function WowBanner({
  historicalPattern,
  deviationLabel,
  supporting,
}: {
  historicalPattern: any;
  deviationLabel: DeviationLabel;
  supporting: HistoricalDecision[];
}) {
  return (
    <div
      className="flex items-center justify-between p-5 rounded-xl"
      style={{ background: tokens.foreground, color: tokens.surfaceFloating }}
    >
      <div>
        <p className="text-lg font-semibold">
          {supporting.length} of {historicalPattern.cohortSize} comparable decisions prioritized schedule certainty.
        </p>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
          This decision prioritizes cost savings instead — a break from established organizational behavior.
        </p>
      </div>
      <Badge
        style={{
          background: DEVIATION_COLOR[deviationLabel],
          color: tokens.surfaceFloating,
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Pattern deviation: {deviationLabel}
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
