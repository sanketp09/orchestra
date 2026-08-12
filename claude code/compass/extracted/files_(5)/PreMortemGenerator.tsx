"use client";

/**
 * COMPASS — Pre-Mortem Generator
 * "If this procurement decision fails, how could it fail?"
 *
 * Center: the current decision. Branches: SUPPLIER / TECHNICAL / SCHEDULE /
 * FINANCIAL / LOGISTICS / COMPLIANCE, each holding a failure scenario with a
 * historical-data-backed probability. "Run Pre-Mortem" builds the tree
 * progressively (branch by branch, not all at once) and finishes by
 * surfacing the highest-priority failure modes — actionable, not generic
 * brainstorming.
 *
 * Mirrors the response shape of POST /api/compass/pre-mortem
 * (pre_mortem_generator.py). Falls back to the same seeded demo data if
 * that endpoint isn't reachable, so this demos standalone too.
 */

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror pre_mortem_generator.py's response schema
// ---------------------------------------------------------------------------

type FailureCategory = "supplier" | "technical" | "schedule" | "financial" | "logistics" | "compliance";
type Severity = "low" | "medium" | "high";
type EvidenceType =
  | "historical_record"
  | "vendor_record"
  | "financial_signal"
  | "production_report"
  | "logistics_record"
  | "compliance_record";

type EvidenceRef = { type: EvidenceType; label: string };

type FailureScenario = {
  id: string;
  category: FailureCategory;
  title: string;
  probability_pct: number;
  severity: Severity;
  risk_score: number;
  is_high_priority: boolean;
  schedule_days_impact: number | null;
  cost_usd_impact: number | null;
  trigger: string;
  failure: string;
  impact: string;
  early_warning: string;
  mitigation: string;
  evidence: EvidenceRef[];
  narrative_source: "llm" | "template_fallback";
};

type PreMortemSummary = {
  scenarios_generated: number;
  high_priority_count: number;
  highest_probability_category: FailureCategory;
  total_schedule_exposure_days: number;
  total_cost_exposure_usd: number;
};

type Decision = {
  id: string;
  label: string;
  vendor_name: string;
  package: string;
  package_value_usd: number;
};

type PreMortemResponse = {
  decision: Decision;
  linked_dependencies: string[];
  scenarios: FailureScenario[];
  summary: PreMortemSummary;
  confidence: number;
  reasoning: string;
};

// ---------------------------------------------------------------------------
// Local fallback — mirrors exactly what /api/compass/pre-mortem returns for
// decision_id "switchgear_vendor_a". Kept in sync by hand with
// pre_mortem_generator.py's seeded historical data and fallback narratives.
// ---------------------------------------------------------------------------

const FALLBACK_DATA: PreMortemResponse = {
  decision: {
    id: "switchgear_vendor_a",
    label: "Award switchgear package to Vendor A",
    vendor_name: "Vantage Switchgear Corp",
    package: "Bid Package 07 — Main Switchgear",
    package_value_usd: 410000,
  },
  linked_dependencies: [
    "Electrical Rough-In Milestone",
    "Switchgear Room Buildout",
    "Utility Interconnection Application",
  ],
  scenarios: [
    {
      id: "failure_schedule",
      category: "schedule",
      title: "Delivery Delay",
      probability_pct: 21,
      severity: "high",
      risk_score: 63,
      is_high_priority: true,
      schedule_days_impact: 14,
      cost_usd_impact: null,
      trigger: "Raw material lead times compound with the vendor's existing backlog.",
      failure: "Switchgear ships later than the contracted delivery date.",
      impact: "Up to 14 days of schedule impact to electrical rough-in.",
      early_warning: "Vendor's confirmed ship date slips during a monthly production check-in call.",
      mitigation: "Build 10 days of float into the master schedule around this delivery; set a hard escalation trigger at first slip.",
      evidence: [
        { type: "historical_record", label: "9 of last 42 comparable orders shipped late (21%)" },
        { type: "vendor_record", label: "Vantage's last delivery to this GC ran 6 days late" },
      ],
      narrative_source: "template_fallback",
    },
    {
      id: "failure_supplier",
      category: "supplier",
      title: "Factory Capacity Crunch",
      probability_pct: 12,
      severity: "medium",
      risk_score: 24,
      is_high_priority: true,
      schedule_days_impact: 10,
      cost_usd_impact: null,
      trigger: "Vendor takes on additional large orders this quarter, straining production capacity.",
      failure: "Vantage's fabrication line falls behind on this order to prioritize other backlog.",
      impact: "Up to 10 days of schedule slip on Bid Package 07 delivery.",
      early_warning: "Factory utilization reports show sustained >90% capacity over two consecutive months.",
      mitigation: "Lock a firm production slot in the PO with liquidated damages; request monthly capacity attestations.",
      evidence: [
        { type: "historical_record", label: "5 of 42 comparable orders hit factory capacity delays (12%)" },
        { type: "production_report", label: "Factory utilization report, Q3 2025: 94% average" },
      ],
      narrative_source: "template_fallback",
    },
    {
      id: "failure_financial",
      category: "financial",
      title: "Financial Distress",
      probability_pct: 6,
      severity: "high",
      risk_score: 18,
      is_high_priority: true,
      schedule_days_impact: 30,
      cost_usd_impact: 65000,
      trigger: "Vendor's working capital position tightens due to unrelated project losses.",
      failure: "Vendor can't fund materials procurement or fabrication labor, stalling the order.",
      impact: "$65,000 exposure and up to 30 days to re-source and re-award if full replacement is needed.",
      early_warning: "A UCC filing appears against the vendor, or payment terms shift from net-30 to deposit-required.",
      mitigation: "Require a payment/performance bond; monitor for UCC filings and D&B rating changes monthly.",
      evidence: [
        { type: "historical_record", label: "2 of 33 vendors with financial review showed distress signs (6%)" },
        { type: "financial_signal", label: "D&B rating: Fair, trending down over the last two quarters" },
      ],
      narrative_source: "template_fallback",
    },
    {
      id: "failure_technical",
      category: "technical",
      title: "Specification Mismatch",
      probability_pct: 8,
      severity: "medium",
      risk_score: 16,
      is_high_priority: false,
      schedule_days_impact: 5,
      cost_usd_impact: 8000,
      trigger: "Vendor's standard product line doesn't fully match the arc-flash rating in spec section 26 24 13.",
      failure: "Submittal is rejected or requires field modification after fabrication has already started.",
      impact: "5 days rework plus $8,000 in submittal re-engineering costs.",
      early_warning: "Submittal review flags a deviation request or substitution note on first pass.",
      mitigation: "Require a pre-submittal technical clarification call before PO issuance; lock spec compliance as a contract exhibit.",
      evidence: [
        { type: "historical_record", label: "3 of 38 submittal reviews required rework for rating mismatches (8%)" },
        { type: "vendor_record", label: "Standard product line's arc-flash rating differs from spec 26 24 13" },
      ],
      narrative_source: "template_fallback",
    },
    {
      id: "failure_compliance",
      category: "compliance",
      title: "Certification Gap",
      probability_pct: 7,
      severity: "medium",
      risk_score: 14,
      is_high_priority: false,
      schedule_days_impact: 12,
      cost_usd_impact: 6000,
      trigger: "Switchgear line's UL/ETL listing doesn't cover the specific configuration ordered for this project.",
      failure: "Equipment arrives without valid third-party certification for the jurisdiction, blocking inspection sign-off.",
      impact: "12 days for re-certification/testing; $6,000 in testing costs.",
      early_warning: "Certification documentation submitted with shop drawings doesn't list the exact model/configuration.",
      mitigation: "Confirm listing coverage for the exact configuration before PO issuance; request the certificate of compliance upfront.",
      evidence: [
        { type: "historical_record", label: "3 of 44 vendor cert packages flagged incomplete listing coverage (7%)" },
        { type: "compliance_record", label: "UL listing on file doesn't confirm this exact configuration" },
      ],
      narrative_source: "template_fallback",
    },
    {
      id: "failure_logistics",
      category: "logistics",
      title: "Freight & Customs Delay",
      probability_pct: 10,
      severity: "low",
      risk_score: 10,
      is_high_priority: false,
      schedule_days_impact: 9,
      cost_usd_impact: 4000,
      trigger: "Key components are imported and subject to customs inspection or port congestion.",
      failure: "Shipment clears customs later than planned, or the carrier reroutes due to capacity constraints.",
      impact: "9 days of schedule slip; $4,000 in expedite/demurrage fees.",
      early_warning: "Bill of lading shows an unplanned transshipment port, or the forwarder flags a customs hold.",
      mitigation: "Pre-clear customs documentation early; add a freight buffer to the delivery milestone.",
      evidence: [
        { type: "historical_record", label: "4 of 40 tracked import shipments held at customs (10%)" },
        { type: "logistics_record", label: "Key breaker components are imported; no pre-cleared customs docs on file" },
      ],
      narrative_source: "template_fallback",
    },
  ],
  summary: {
    scenarios_generated: 6,
    high_priority_count: 3,
    highest_probability_category: "schedule",
    total_schedule_exposure_days: 80,
    total_cost_exposure_usd: 83000,
  },
  confidence: 0.83,
  reasoning:
    "Generated 6 failure scenarios from historical precedent across 6 categories. 3 scored as high priority: Delivery Delay, Factory Capacity Crunch, Financial Distress.",
};

async function fetchPreMortem(decisionId: string): Promise<PreMortemResponse> {
  try {
    const res = await fetch("/api/compass/pre-mortem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision_id: decisionId }),
    });
    if (!res.ok) throw new Error(`Pre-mortem failed: ${res.status}`);
    return (await res.json()) as PreMortemResponse;
  } catch {
    return FALLBACK_DATA;
  }
}

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const THEME_VARS = {
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
} as CSSProperties;

const SOFT_SHADOW = "-4px -4px 10px rgba(255,255,255,0.6), 6px 6px 16px rgba(12,9,4,0.08)";

const CATEGORY_LABEL: Record<FailureCategory, string> = {
  supplier: "Supplier",
  technical: "Technical",
  schedule: "Schedule",
  financial: "Financial",
  logistics: "Logistics",
  compliance: "Compliance",
};

const CATEGORY_ORDER: FailureCategory[] = [
  "supplier",
  "technical",
  "schedule",
  "financial",
  "logistics",
  "compliance",
];

const SEVERITY_COLOR: Record<Severity, string> = {
  low: "var(--info)",
  medium: "var(--warning)",
  high: "var(--danger)",
};

const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  historical_record: "Historical record",
  vendor_record: "Vendor record",
  financial_signal: "Financial signal",
  production_report: "Production report",
  logistics_record: "Logistics record",
  compliance_record: "Compliance record",
};

const EXPANSION_STEPS: { key: keyof FailureScenario; label: string }[] = [
  { key: "trigger", label: "Trigger" },
  { key: "failure", label: "Failure" },
  { key: "impact", label: "Impact" },
  { key: "early_warning", label: "Early warning" },
  { key: "mitigation", label: "Mitigation" },
];

// SVG canvas
const VB_W = 760;
const VB_H = 560;
const CENTER = { x: VB_W / 2, y: VB_H / 2 - 10 };

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

type RunState = "idle" | "running" | "done";

export default function PreMortemGenerator() {
  const [data, setData] = useState<PreMortemResponse | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [revealedCount, setRevealedCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandStep, setExpandStep] = useState(0);

  const orderedScenarios = useMemo(() => {
    if (!data) return [];
    const byCategory = new Map(data.scenarios.map((s) => [s.category, s]));
    return CATEGORY_ORDER.map((c) => byCategory.get(c)).filter((s): s is FailureScenario => Boolean(s));
  }, [data]);

  const selected = orderedScenarios.find((s) => s.id === selectedId) ?? null;

  function runPreMortem() {
    setRunState("running");
    setRevealedCount(0);
    setSelectedId(null);
    setData(null);

    fetchPreMortem("switchgear_vendor_a").then((response) => {
      setData(response);
      const total = response.scenarios.length;
      let count = 0;
      const timer = setInterval(() => {
        count += 1;
        setRevealedCount(count);
        if (count >= total) {
          clearInterval(timer);
          setRunState("done");
        }
      }, 420);
    });
  }

  function selectScenario(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    setExpandStep(0);
  }

  useEffect(() => {
    if (!selected) return;
    setExpandStep(0);
    const timer = setInterval(() => {
      setExpandStep((step) => {
        if (step >= EXPANSION_STEPS.length - 1) {
          clearInterval(timer);
          return step;
        }
        return step + 1;
      });
    }, 260);
    return () => clearInterval(timer);
  }, [selected?.id]);

  return (
    <div className="w-full rounded-xl p-6" style={{ ...THEME_VARS, background: "var(--background)" }}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge
            className="mb-2 rounded-[8px] border-0 text-[11px] uppercase tracking-wide"
            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            COMPASS · Pre-Mortem Generator
          </Badge>
          <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            If this decision fails, how could it fail?
          </h2>
          <p className="mt-1 max-w-lg text-sm" style={{ color: "var(--muted-foreground)" }}>
            {FALLBACK_DATA.decision.label} — {FALLBACK_DATA.decision.package} ·{" "}
            {FALLBACK_DATA.decision.vendor_name}
          </p>
        </div>

        <Button
          onClick={runPreMortem}
          disabled={runState === "running"}
          className="rounded-[8px] px-4"
          style={{ background: "var(--accent)", color: "var(--surface-floating)" }}
        >
          {runState === "running" ? "Running pre-mortem…" : "Run Pre-Mortem"}
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Hero — failure tree, the one glass element on this screen */}
        <Card
          className="relative col-span-1 overflow-hidden rounded-xl border p-4 lg:col-span-2"
          style={{
            background: "rgba(255,255,255,0.55)",
            borderColor: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 8px 30px rgba(12,9,4,0.10)",
          }}
        >
          <FailureTree
            scenarios={orderedScenarios}
            revealedCount={revealedCount}
            runState={runState}
            selectedId={selectedId}
            onSelect={selectScenario}
          />
        </Card>

        {/* Right column: summary + expansion panel */}
        <div className="col-span-1 flex flex-col gap-4">
          <Card
            className="rounded-xl border-0 p-5"
            style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
          >
            <p className="mb-3 text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              Pre-mortem summary
            </p>

            <AnimatePresence mode="wait">
              {runState === "done" && data ? (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                >
                  <p className="text-3xl font-semibold tabular-nums" style={{ color: "var(--danger)" }}>
                    {data.summary.high_priority_count}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    high-priority failure mode{data.summary.high_priority_count === 1 ? "" : "s"} detected
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-[8px] p-3" style={{ background: "var(--muted)" }}>
                      <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                        {data.summary.scenarios_generated}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        scenarios generated
                      </p>
                    </div>
                    <div className="rounded-[8px] p-3" style={{ background: "var(--muted)" }}>
                      <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--warning)" }}>
                        +{data.summary.total_schedule_exposure_days}d
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        combined schedule exposure
                      </p>
                    </div>
                    <div className="col-span-2 rounded-[8px] p-3" style={{ background: "var(--muted)" }}>
                      <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--danger)" }}>
                        +${(data.summary.total_cost_exposure_usd / 1000).toFixed(0)}K
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        combined cost exposure
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.p
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {runState === "running"
                    ? "Building the failure tree…"
                    : "Run the pre-mortem to generate evidence-backed failure scenarios for this decision."}
                </motion.p>
              )}
            </AnimatePresence>
          </Card>

          {/* Scenario expansion */}
          <Card
            className="min-h-[300px] flex-1 rounded-xl border-0 p-5"
            style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
          >
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className="rounded-[6px] border-0 text-[10px] uppercase tracking-wide"
                          style={{ background: SEVERITY_COLOR[selected.severity], color: "var(--surface-floating)" }}
                        >
                          {selected.severity} severity
                        </Badge>
                        {selected.is_high_priority && (
                          <Badge
                            className="rounded-[6px] border-0 text-[10px] uppercase tracking-wide"
                            style={{ background: "var(--foreground)", color: "var(--surface-floating)" }}
                          >
                            High priority
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {selected.title}
                      </p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {CATEGORY_LABEL[selected.category]} · {selected.probability_pct}% probability
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="text-xs shrink-0"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Close
                    </button>
                  </div>

                  {/* Trigger -> Failure -> Impact -> Early warning -> Mitigation, staged reveal */}
                  <div className="mt-4 space-y-0">
                    {EXPANSION_STEPS.map((step, i) => (
                      <AnimatePresence key={step.key as string}>
                        {expandStep >= i && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                          >
                            <div className="flex gap-3 py-2">
                              <div className="flex flex-col items-center">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: i === 2 ? SEVERITY_COLOR[selected.severity] : "var(--accent)" }}
                                />
                                {i < EXPANSION_STEPS.length - 1 && (
                                  <span className="mt-1 h-6 w-px" style={{ background: "var(--muted)" }} />
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                                  {step.label}
                                </p>
                                <p className="text-xs leading-snug" style={{ color: "var(--foreground)" }}>
                                  {selected[step.key] as string}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ))}
                  </div>

                  {expandStep >= EXPANSION_STEPS.length - 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.15 }}
                      className="mt-3"
                    >
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                        Evidence
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {selected.evidence.map((ref, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--foreground)" }}>
                            <span
                              className="shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px]"
                              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                            >
                              {EVIDENCE_LABEL[ref.type]}
                            </span>
                            {ref.label}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-full min-h-[240px] flex-col items-center justify-center text-center"
                >
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Click a failure node to expand it: trigger, failure, impact, early warning, mitigation.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Failure Tree — the signature visualization
// ---------------------------------------------------------------------------

function FailureTree({
  scenarios,
  revealedCount,
  runState,
  selectedId,
  onSelect,
}: {
  scenarios: FailureScenario[];
  revealedCount: number;
  runState: RunState;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const step = 360 / Math.max(scenarios.length, 1);

  return (
    <div className="relative h-[420px] w-full sm:h-[520px]">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-full w-full">
        {/* Center decision node */}
        <circle cx={CENTER.x} cy={CENTER.y} r={38} fill="var(--foreground)" />
        <text
          x={CENTER.x}
          y={CENTER.y - 4}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="var(--surface-floating)"
        >
          Award switchgear
        </text>
        <text
          x={CENTER.x}
          y={CENTER.y + 12}
          textAnchor="middle"
          fontSize={10}
          fill="var(--surface-floating)"
          opacity={0.75}
        >
          to Vendor A
        </text>

        {scenarios.map((scenario, i) => {
          const angle = i * step;
          const p = polar(CENTER.x, CENTER.y, 210, angle);
          const revealed = runState !== "idle" && i < revealedCount;
          const isSelected = selectedId === scenario.id;
          const color = SEVERITY_COLOR[scenario.severity];

          return (
            <g key={scenario.id}>
              <motion.line
                x1={CENTER.x}
                y1={CENTER.y}
                x2={p.x}
                y2={p.y}
                stroke={isSelected ? "var(--accent)" : color}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeOpacity={isSelected ? 0.9 : 0.45}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={revealed ? { pathLength: 1, opacity: isSelected ? 0.9 : 0.45 } : { pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
              />

              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={revealed ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay: revealed ? 0.15 : 0 }}
                style={{ cursor: revealed ? "pointer" : "default", transformOrigin: `${p.x}px ${p.y}px` }}
                onClick={() => revealed && onSelect(scenario.id)}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={scenario.is_high_priority && runState === "done" ? 30 : 26}
                  fill="var(--surface-floating)"
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 2}
                />
                <text x={p.x} y={p.y - 4} textAnchor="middle" fontSize={13} fontWeight={700} fill={color}>
                  {scenario.probability_pct}%
                </text>
                <text x={p.x} y={p.y + 9} textAnchor="middle" fontSize={8} fill="var(--muted-foreground)">
                  {CATEGORY_LABEL[scenario.category]}
                </text>
                <text
                  x={p.x}
                  y={p.y + (scenario.is_high_priority && runState === "done" ? 46 : 42)}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={500}
                  fill="var(--foreground)"
                >
                  {scenario.title}
                </text>
                {scenario.is_high_priority && runState === "done" && (
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r={30}
                    fill="none"
                    stroke={color}
                    strokeWidth={1}
                    initial={{ opacity: 0.5, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.4 }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
              </motion.g>
            </g>
          );
        })}
      </svg>

      {runState === "idle" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="max-w-[200px] text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
            Click &quot;Run Pre-Mortem&quot; to build the failure tree.
          </p>
        </div>
      )}
    </div>
  );
}
