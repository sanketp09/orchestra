import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock data — mirrors procurement_opportunity.py exactly (same company,
// same seeded procurement plan, same computed numbers)
// ---------------------------------------------------------------------------

const COMPANY_NAME = "Coastal Bay Builders";
const PORTFOLIO_CURRENT_COST = 1_146_100; // sum of all seeded plan lines for this company

type OppType = "consolidate" | "cross_project" | "buy_early" | "wait" | "renegotiate";

interface Opportunity {
  id: string;
  type: OppType;
  title: string;
  projects: string[];
  items: string[];
  current: number;
  optimized: number;
  savings: number;
  savingsPct: number;
  reasoning: string;
  steps: string[];
}

const OPPORTUNITIES: Opportunity[] = [
  {
    id: "consolidate-structural_steel",
    type: "consolidate",
    title: "Consolidate Structural Steel",
    projects: ["Riverside Commons — Phase 2", "Bayview Tower"],
    items: ["structural_steel"],
    current: 820_260,
    optimized: 740_996,
    savings: 79_264,
    savingsPct: 9.7,
    reasoning: "2 separate orders for structural steel across 2 projects qualify for a lower bulk rate placed as one order.",
    steps: [
      "Current: 2 separate orders across Bayview Tower, Riverside Commons — Phase 2.",
      "  Riverside Commons — Phase 2: 420 tons @ $980.00 = $411,600.00",
      "  Bayview Tower: 417 tons @ $980.00 = $408,660.00",
      "Combined volume: 837 tons qualifies for $885.30/unit tier rate.",
      "Combined total: 837 × $885.30 = $740,996.10",
      "Savings: $820,260.00 − $740,996.10 = $79,263.90",
    ],
  },
  {
    id: "cross-project-electrical-bundle",
    type: "cross_project",
    title: "Bundle Electrical Trades Across Projects",
    projects: ["Bayview Tower", "Riverside Commons — Phase 2", "Harbor District Retail"],
    items: ["electrical_panel_400a", "pvc_conduit_25mm", "hvac_ductwork"],
    current: 249_840,
    optimized: 234_850,
    savings: 14_990,
    savingsPct: 6.0,
    reasoning: "Panels, conduit, and ductwork across 3 projects are ordered piecemeal from multiple vendors. Packaging them under one vendor unlocks a logistics discount.",
    steps: [
      "Bundle scope: electrical panels + conduit + ductwork across 3 projects.",
      "  Bayview Tower — electrical panel 400a: 44 units = $184,800.00",
      "  Riverside Commons — Phase 2 — electrical panel 400a: 8 units = $29,600.00",
      "  Riverside Commons — Phase 2 — pvc conduit 25mm: 1,200 meters = $3,840.00",
      "  Bayview Tower — pvc conduit 25mm: 1,000 meters = $3,200.00",
      "  Harbor District Retail — pvc conduit 25mm: 1,000 meters = $3,200.00",
      "  Harbor District Retail — hvac ductwork: 900 meters = $25,200.00",
      "Total bundled spend: $249,840.00",
      "Single-vendor package discount (6%): −$14,990.40",
      "Optimized total: $234,849.60",
    ],
  },
  {
    id: "renegotiate-pl-003",
    type: "renegotiate",
    title: "Renegotiate Electrical Panel 400A — Bayview Tower",
    projects: ["Bayview Tower", "Riverside Commons — Phase 2"],
    items: ["electrical_panel_400a"],
    current: 184_800,
    optimized: 162_800,
    savings: 22_000,
    savingsPct: 11.9,
    reasoning: "Circuit & Pipe Co is charging $500.00 more per unit than Volthouse Electrical charges this same company for the identical panel elsewhere in the portfolio.",
    steps: [
      "Bayview Tower is paying $4,200.00/unit to Circuit & Pipe Co for electrical panel 400a.",
      "Riverside Commons — Phase 2 sources the same item from Volthouse Electrical at $3,700.00/unit.",
      "Current: 44 × $4,200.00 = $184,800.00",
      "At the lower internal rate: 44 × $3,700.00 = $162,800.00",
      "Savings: $184,800.00 − $162,800.00 = $22,000.00",
    ],
  },
  {
    id: "timing-ready_mix_concrete",
    type: "buy_early",
    title: "Buy Early: Ready Mix Concrete",
    projects: ["Riverside Commons — Phase 2", "Bayview Tower"],
    items: ["ready_mix_concrete"],
    current: 312_000,
    optimized: 284_000,
    savings: 28_000,
    savingsPct: 9.0,
    reasoning: "Market price for ready mix concrete is rising — buy now is $142.00/yard vs. wait 1 month at $156.00.",
    steps: [
      "Quantity needed: 2,000 cubic_yards across Riverside Commons — Phase 2, Bayview Tower.",
      "Price trend — buy now: $142.00, wait 2 weeks: $148.00, wait 1 month: $156.00.",
      "Earliest need-by date allows waiting up to 40 days.",
      "Baseline plan (wait 1 month): 2,000 × $156.00 = $312,000.00",
      "Recommended (buy now): 2,000 × $142.00 = $284,000.00",
      "Savings: $312,000.00 − $284,000.00 = $28,000.00",
    ],
  },
  {
    id: "timing-copper_wiring_4mm2",
    type: "wait",
    title: "Wait to Buy: Copper Wiring 4mm²",
    projects: ["Harbor District Retail"],
    items: ["copper_wiring_4mm2"],
    current: 29_000,
    optimized: 27_000,
    savings: 2_000,
    savingsPct: 6.9,
    reasoning: "Market price for copper wiring 4mm² is falling — wait 1 month is $2.70/meter vs. buy now at $2.90.",
    steps: [
      "Quantity needed: 10,000 meters across Harbor District Retail.",
      "Price trend — buy now: $2.90, wait 2 weeks: $2.80, wait 1 month: $2.70.",
      "Earliest need-by date allows waiting up to 65 days.",
      "Baseline plan (buy now): 10,000 × $2.90 = $29,000.00",
      "Recommended (wait 1 month): 10,000 × $2.70 = $27,000.00",
      "Savings: $29,000.00 − $27,000.00 = $2,000.00",
    ],
  },
];

const RANKED = [...OPPORTUNITIES].sort((a, b) => b.savings - a.savings);
const TOTAL_POTENTIAL_VALUE = RANKED.reduce((sum, o) => sum + o.savings, 0);

const scanSteps = [
  "Reading current procurement plan…",
  "Grouping line items by company…",
  "Checking bulk pricing tiers…",
  "Comparing vendor rates…",
  "Scoring timing opportunities…",
];

const TYPE_META: Record<OppType, { label: string; color: string; short: string }> = {
  consolidate: { label: "CONSOLIDATE", color: "var(--accent)", short: "Combine same item across projects" },
  cross_project: { label: "COMBINE", color: "var(--info)", short: "Bundle trades across projects" },
  renegotiate: { label: "RENEGOTIATE", color: "var(--danger)", short: "Match a cheaper internal vendor rate" },
  buy_early: { label: "BUY EARLY", color: "var(--success)", short: "Lock price before it rises" },
  wait: { label: "WAIT", color: "var(--warning)", short: "Let price fall before ordering" },
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const moneyK = (n: number) => `$${Math.round(n / 1000)}K`;

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function AnimatedNumber({ value, prefix = "", decimals = 0 }: { value: number; prefix?: string; decimals?: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 18 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    motionVal.set(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })));
    return () => unsub();
  }, [spring, decimals]);

  return (
    <span>
      {prefix}
      {display}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Opportunity Radar — center node + orbiting opportunity nodes
// ---------------------------------------------------------------------------

function OpportunityRadar({
  visibleOpportunities,
  onSelect,
  sweeping,
}: {
  visibleOpportunities: Opportunity[];
  onSelect: (id: string) => void;
  sweeping: boolean;
}) {
  const size = 460;
  const cx = size / 2;
  const cy = size / 2;
  const orbitRadius = 175;
  const centerRadius = 62;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[460px] mx-auto h-auto">
      {/* orbit ring */}
      <circle cx={cx} cy={cy} r={orbitRadius} fill="none" stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 6" opacity={0.6} />

      {/* radar sweep during scanning */}
      {sweeping && (
        <motion.g style={{ transformOrigin: `${cx}px ${cy}px` }} animate={{ rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}>
          <path d={`M ${cx} ${cy} L ${cx} ${cy - orbitRadius} A ${orbitRadius} ${orbitRadius} 0 0 1 ${cx + orbitRadius * Math.sin(0.6)} ${cy - orbitRadius * Math.cos(0.6)} Z`} fill="var(--accent)" opacity={0.12} />
        </motion.g>
      )}

      {/* connecting lines to visible nodes */}
      {visibleOpportunities.map((o, i) => {
        const angle = (-90 + (360 / OPPORTUNITIES.length) * RANKED.findIndex((r) => r.id === o.id)) * (Math.PI / 180);
        const x = cx + orbitRadius * Math.cos(angle);
        const y = cy + orbitRadius * Math.sin(angle);
        return (
          <motion.line
            key={`line-${o.id}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={TYPE_META[o.type].color}
            strokeWidth={1.5}
            strokeDasharray={orbitRadius}
            initial={{ strokeDashoffset: orbitRadius, opacity: 0 }}
            animate={{ strokeDashoffset: 0, opacity: 0.55 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}

      {/* center node */}
      <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <circle cx={cx} cy={cy} r={centerRadius} fill="var(--surface-floating)" stroke="var(--foreground)" strokeWidth={1.5} />
        <text x={cx} y={cy - 10} textAnchor="middle" className="fill-[var(--muted-foreground)]" style={{ fontSize: 9, fontWeight: 500, letterSpacing: 0.5 }}>
          CURRENT PLAN
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-[var(--foreground)]" style={{ fontSize: 13, fontWeight: 700 }}>
          {moneyK(PORTFOLIO_CURRENT_COST)}
        </text>
      </motion.g>

      {/* orbit nodes */}
      {visibleOpportunities.map((o) => {
        const rankIndex = RANKED.findIndex((r) => r.id === o.id);
        const angle = (-90 + (360 / OPPORTUNITIES.length) * rankIndex) * (Math.PI / 180);
        const x = cx + orbitRadius * Math.cos(angle);
        const y = cy + orbitRadius * Math.sin(angle);
        const meta = TYPE_META[o.type];
        return (
          <motion.g
            key={o.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "backOut" }}
            className="cursor-pointer"
            onClick={() => onSelect(o.id)}
          >
            <motion.circle
              cx={x}
              cy={y}
              r={40}
              fill="var(--surface-card)"
              stroke={meta.color}
              strokeWidth={2}
              whileHover={{ scale: 1.08 }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
            <text x={x} y={y - 3} textAnchor="middle" className="fill-[var(--foreground)]" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>
              {meta.label}
            </text>
            <text x={x} y={y + 12} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: meta.color }}>
              +{moneyK(o.savings)}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Opportunity card — visually distinct per type
// ---------------------------------------------------------------------------

function OpportunityCard({ opportunity, index }: { opportunity: Opportunity; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[opportunity.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35 }}
    >
      <Card
        className="rounded-[12px] p-0 overflow-hidden bg-[var(--surface-card)] border-none"
        style={{ boxShadow: "-3px -3px 8px rgba(255,255,255,0.55), 4px 4px 10px rgba(12,9,4,0.08)" }}
      >
        <div className="p-4" style={{ borderLeft: `4px solid ${meta.color}` }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge
              className="text-[10px] px-2 py-0.5 rounded-[6px] font-bold tracking-wide"
              style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
            >
              {meta.label}
            </Badge>
            <span className="text-[11px] text-[var(--muted-foreground)]">{opportunity.savingsPct}% savings</span>
          </div>

          <h3 className="text-[14px] font-bold text-[var(--foreground)] leading-snug mb-1">{opportunity.title}</h3>
          <p className="text-[11px] text-[var(--muted-foreground)] mb-3">{opportunity.projects.join(" + ")}</p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <p className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">Current</p>
              <p className="text-[13px] font-bold text-[var(--foreground)] tabular-nums">{money(opportunity.current)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">Optimized</p>
              <p className="text-[13px] font-bold text-[var(--foreground)] tabular-nums">{money(opportunity.optimized)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">Savings</p>
              <p className="text-[13px] font-bold tabular-nums" style={{ color: meta.color }}>
                +{money(opportunity.savings)}
              </p>
            </div>
          </div>

          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[11px] font-medium text-[var(--foreground)] underline underline-offset-2 hover:text-[var(--accent)] transition-colors"
          >
            {expanded ? "Hide calculation" : "Show calculation"}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-[8px] bg-[var(--surface-floating)] border border-[var(--muted)]/50 p-3 flex flex-col gap-1">
                  {opportunity.steps.map((s, i) => (
                    <p key={i} className="text-[11px] text-[var(--muted-foreground)] font-mono leading-relaxed">
                      {s}
                    </p>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Timing trajectory — BUY NOW / WAIT 2 WEEKS / WAIT 1 MONTH
// ---------------------------------------------------------------------------

function TimingTrajectory({ opportunity }: { opportunity: Opportunity }) {
  // Reconstruct the three trend points from the calculation steps' known trend line.
  const trendLine = opportunity.steps.find((s) => s.startsWith("Price trend"));
  const match = trendLine?.match(/buy now: \$([\d.]+), wait 2 weeks: \$([\d.]+), wait 1 month: \$([\d.]+)/);
  const [buyNow, wait2, wait1m] = match ? [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])] : [0, 0, 0];
  const points = [
    { label: "BUY NOW", price: buyNow },
    { label: "WAIT 2 WEEKS", price: wait2 },
    { label: "WAIT 1 MONTH", price: wait1m },
  ];
  const best = points.reduce((min, p) => (p.price < min.price ? p : min), points[0]);
  const maxPrice = Math.max(...points.map((p) => p.price));
  const minPrice = Math.min(...points.map((p) => p.price));
  const range = maxPrice - minPrice || 1;

  return (
    <div className="flex items-end justify-between gap-3 px-2 pt-6 pb-2">
      {points.map((p, i) => {
        const heightPct = 30 + ((p.price - minPrice) / range) * 55;
        const isBest = p.label === best.label;
        return (
          <React.Fragment key={p.label}>
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-[11px] font-bold tabular-nums" style={{ color: isBest ? "var(--success)" : "var(--foreground)" }}>
                ${p.price.toFixed(2)}
              </span>
              <motion.div
                className="w-full rounded-t-[6px]"
                style={{ background: isBest ? "var(--success)" : "var(--muted)" }}
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}px` }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
              />
              <span className={cn("text-[10px] font-medium tracking-wide", isBest ? "text-[var(--success)]" : "text-[var(--muted-foreground)]")}>
                {p.label}
                {isBest && " ✓"}
              </span>
            </div>
            {i < points.length - 1 && <div className="h-px w-6 bg-[var(--muted)] mb-8" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type ScreenState = "idle" | "scanning" | "results" | "error";

export default function ProcurementOpportunity() {
  const [screen, setScreen] = useState<ScreenState>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (screen !== "scanning") return;
    if (stepIndex >= scanSteps.length) {
      const t = setTimeout(() => setScreen("results"), 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIndex((i) => i + 1), 480);
    return () => clearTimeout(t);
  }, [screen, stepIndex]);

  useEffect(() => {
    if (screen !== "results") return;
    setVisibleCount(0);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= RANKED.length) clearInterval(interval);
    }, 350);
    return () => clearInterval(interval);
  }, [screen]);

  function startScan() {
    setScreen("scanning");
    setStepIndex(0);
  }
  function forceError() {
    setScreen("error");
  }
  function retry() {
    setScreen("scanning");
    setStepIndex(0);
  }

  const visibleOpportunities = RANKED.slice(0, visibleCount);
  const timingOpportunities = OPPORTUNITIES.filter((o) => o.type === "buy_early" || o.type === "wait");

  return (
    <div
      className="w-full min-h-[760px] rounded-[12px] p-6 sm:p-8"
      style={{
        // @ts-ignore css custom properties
        "--background": "#F3EDE7",
        "--foreground": "#0C0904",
        "--muted": "#DBC3B3",
        "--muted-foreground": "#AA8D74",
        "--accent": "#AC723E",
        "--surface-card": "#FAF7F3",
        "--surface-floating": "#FFFFFF",
        "--success": "#4A7A5C",
        "--warning": "#B8873A",
        "--danger": "#A6432F",
        "--info": "#4A6A8A",
        "--ai": "#6B5A7A",
        background: "var(--background)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">COMPASS · Procurement Opportunity Engine</p>
          <h1 className="text-[22px] font-bold text-[var(--foreground)] leading-tight">{COMPANY_NAME}</h1>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-1">How could we make this procurement decision better, not merely safer?</p>
        </div>
        {screen === "idle" && (
          <Button className="bg-[var(--accent)] text-white hover:brightness-110 transition-all shrink-0" onClick={startScan}>
            Find opportunities
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {screen === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-[560px] gap-4">
            <OpportunityRadar visibleOpportunities={[]} onSelect={() => {}} sweeping={false} />
            <p className="text-[13px] text-[var(--muted-foreground)] text-center max-w-[360px]">
              Click "Find opportunities" to scan the current procurement plan for savings the team hasn't considered yet.
            </p>
          </motion.div>
        )}

        {screen === "scanning" && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-[560px] gap-6">
            <OpportunityRadar visibleOpportunities={[]} onSelect={() => {}} sweeping />
            <div className="text-center">
              <p className="text-[15px] font-medium text-[var(--foreground)]">Scanning procurement portfolio</p>
              <div className="h-5 mt-2 relative">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={stepIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="text-[13px] text-[var(--muted-foreground)]"
                  >
                    {scanSteps[Math.min(stepIndex, scanSteps.length - 1)]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
            <button onClick={forceError} className="text-[11px] text-[var(--muted-foreground)] underline underline-offset-2 hover:text-[var(--foreground)] transition-colors">
              Simulate a scan failure (demo)
            </button>
          </motion.div>
        )}

        {screen === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-[560px] gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] flex items-center justify-center">
              <span className="text-[var(--danger)] text-[20px] leading-none">!</span>
            </div>
            <div>
              <p className="text-[15px] font-medium text-[var(--foreground)]">Couldn't complete the scan</p>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1 max-w-[380px]">
                The procurement plan loaded, but the pricing and vendor-rate lookups timed out before opportunities could be ranked.
              </p>
            </div>
            <Button className="bg-[var(--accent)] text-white hover:brightness-110 transition-all mt-2" onClick={retry}>
              Retry scan
            </Button>
          </motion.div>
        )}

        {screen === "results" && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8">
            {/* Radar + total */}
            <div className="flex flex-col items-center gap-3">
              <OpportunityRadar
                visibleOpportunities={visibleOpportunities}
                sweeping={false}
                onSelect={(id) => {
                  setHighlighted(id);
                  cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
                  setTimeout(() => setHighlighted(null), 1200);
                }}
              />
              <AnimatePresence>
                {visibleCount >= RANKED.length && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">Potential value identified</p>
                    <p className="text-[32px] font-bold tabular-nums" style={{ color: "var(--success)" }}>
                      +<AnimatedNumber value={TOTAL_POTENTIAL_VALUE} prefix="$" />
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Opportunity cards */}
            <div>
              <h2 className="text-[13px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
                Ranked opportunities ({visibleOpportunities.length}/{RANKED.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleOpportunities.map((o, i) => (
                  <div
                    key={o.id}
                    ref={(el) => (cardRefs.current[o.id] = el)}
                    className={cn("rounded-[12px] transition-shadow", highlighted === o.id && "ring-2 ring-[var(--accent)]")}
                  >
                    <OpportunityCard opportunity={o} index={i} />
                  </div>
                ))}
              </div>
            </div>

            {/* Timing visual */}
            {visibleCount >= RANKED.length && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <h2 className="text-[13px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Timing optimization</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {timingOpportunities.map((o) => (
                    <Card
                      key={o.id}
                      className="rounded-[12px] p-4 bg-[var(--surface-card)] border-none"
                      style={{ boxShadow: "-3px -3px 8px rgba(255,255,255,0.55), 4px 4px 10px rgba(12,9,4,0.08)" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[12px] font-bold text-[var(--foreground)]">{o.items[0].replace(/_/g, " ")}</p>
                        <Badge
                          className="text-[10px] px-2 py-0.5 rounded-[6px] font-bold"
                          style={{ backgroundColor: `color-mix(in srgb, ${TYPE_META[o.type].color} 16%, transparent)`, color: TYPE_META[o.type].color }}
                        >
                          {TYPE_META[o.type].label}
                        </Badge>
                      </div>
                      <TimingTrajectory opportunity={o} />
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Evidence-style receipt */}
            {visibleCount >= RANKED.length && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="bg-[var(--surface-floating)] border-[var(--muted)] shadow-[0_2px_6px_rgba(12,9,4,.06)] rounded-[10px] p-5">
                  <h3 className="text-[13px] font-medium text-[var(--foreground)] mb-3">Scan summary</h3>
                  <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed mb-4">
                    Scanned {COMPANY_NAME}'s current procurement plan — {RANKED.length} opportunities found across{" "}
                    {new Set(OPPORTUNITIES.flatMap((o) => o.projects)).size} projects, combining only line items that
                    share this company. No LLM was used — every figure above is bulk-tier, vendor-rate, or
                    price-trend arithmetic.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Portfolio spend</p>
                      <p className="text-[14px] font-bold text-[var(--foreground)] tabular-nums">{money(PORTFOLIO_CURRENT_COST)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Potential value</p>
                      <p className="text-[14px] font-bold text-[var(--success)] tabular-nums">{money(TOTAL_POTENTIAL_VALUE)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Opportunities</p>
                      <p className="text-[14px] font-bold text-[var(--foreground)] tabular-nums">{RANKED.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Top pick</p>
                      <p className="text-[13px] font-bold text-[var(--foreground)]">{RANKED[0].title}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
