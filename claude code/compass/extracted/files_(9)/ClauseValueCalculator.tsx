"use client";

import * as React from "react";
import { motion, AnimatePresence, useSpring } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Clause definitions — mirrors clause_value_calculator.py exactly
// ---------------------------------------------------------------------------

type ClauseId =
  | "liquidated_damages_cap"
  | "termination_right"
  | "payment_term"
  | "warranty"
  | "escalation_clause";

type Unit = "usd" | "percent" | "days" | "months";

type ClauseDef = {
  id: ClauseId;
  name: string;
  clauseText: string;
  unit: Unit;
  min: number;
  max: number;
  step: number;
  presets: number[];
  current: number;
};

const CLAUSES: Record<ClauseId, ClauseDef> = {
  liquidated_damages_cap: {
    id: "liquidated_damages_cap",
    name: "Liquidated Damages Cap",
    clauseText:
      "In no event shall Contractor's aggregate liability for liquidated damages under this Agreement exceed One Hundred Thousand Dollars ($100,000), regardless of the duration of any delay in Substantial Completion.",
    unit: "usd",
    min: 50_000,
    max: 500_000,
    step: 10_000,
    presets: [100_000, 200_000, 300_000, 400_000],
    current: 100_000,
  },
  termination_right: {
    id: "termination_right",
    name: "Termination Right",
    clauseText:
      "Owner may terminate this Agreement for cause upon thirty (30) days' prior written notice to Contractor, provided such default remains uncured at the expiration of the notice period.",
    unit: "days",
    min: 0,
    max: 90,
    step: 15,
    presets: [15, 30, 45, 60],
    current: 30,
  },
  payment_term: {
    id: "payment_term",
    name: "Payment Term",
    clauseText:
      "Owner shall pay each undisputed invoice within forty-five (45) days of receipt. Amounts not paid when due shall not accrue interest.",
    unit: "days",
    min: 30,
    max: 90,
    step: 15,
    presets: [30, 45, 60, 75],
    current: 45,
  },
  warranty: {
    id: "warranty",
    name: "Warranty",
    clauseText:
      "Contractor warrants its work against defects in materials and workmanship for a period of twelve (12) months following Substantial Completion.",
    unit: "months",
    min: 6,
    max: 36,
    step: 6,
    presets: [12, 18, 24, 36],
    current: 12,
  },
  escalation_clause: {
    id: "escalation_clause",
    name: "Escalation Clause",
    clauseText:
      "Contract Sum shall be adjusted for increases in the producer price index for structural steel, provided that Owner's exposure under this clause shall not exceed three percent (3%) annually.",
    unit: "percent",
    min: 0,
    max: 10,
    step: 1,
    presets: [3, 5, 7, 9],
    current: 3,
  },
};

// ---------------------------------------------------------------------------
// Deterministic math — mirrors clause_value_calculator.py's named constants
// ---------------------------------------------------------------------------

const BEST_CASE_FRACTION = 1 / 6;
const EXPECTED_CASE_FRACTION = 0.5;

const LD_WORST_CASE_DELAY_DAYS = 60;
const LD_PER_DIEM_DELAY_COST = 7_000;
const LD_RECOMMENDED_CEILING_CAPTURE = 0.92;

const ESC_MATERIAL_PORTION = 3_000_000;
const ESC_WORST_CASE_PCT = 9.0;
const ESC_RECOMMENDED_CAP_PCT = 1.0;

const TERM_DAILY_LOCK_IN_COST = 4_500;
const TERM_RECOMMENDED_DAYS = 15;

const REFERENCE_CONTRACT_VALUE = 8_500_000;
const REFERENCE_CONTRACT_MONTHS = 14;
const PAY_COST_OF_CAPITAL_ANNUAL = 0.09;
const PAY_BASELINE_DAYS = 30;
const PAY_DAILY_BILLING = REFERENCE_CONTRACT_VALUE / (REFERENCE_CONTRACT_MONTHS * 30);
const PAY_QUADRATIC_COEFFICIENT = (PAY_DAILY_BILLING * PAY_COST_OF_CAPITAL_ANNUAL) / 365;
const PAY_RECOMMENDED_DAYS = PAY_BASELINE_DAYS;

const WAR_ANNUAL_DEFECT_COST = 95_000;
const WAR_OBSERVATION_WINDOW_MONTHS = 36;
const WAR_RECOMMENDED_MONTHS = 24;

function ceilingFor(id: ClauseId): number {
  switch (id) {
    case "liquidated_damages_cap":
      return LD_WORST_CASE_DELAY_DAYS * LD_PER_DIEM_DELAY_COST;
    case "escalation_clause":
      return (ESC_MATERIAL_PORTION * ESC_WORST_CASE_PCT) / 100;
    case "termination_right":
      return CLAUSES.termination_right.max * TERM_DAILY_LOCK_IN_COST;
    case "payment_term":
      return PAY_QUADRATIC_COEFFICIENT * (CLAUSES.payment_term.max - PAY_BASELINE_DAYS) ** 2;
    case "warranty":
      return (WAR_ANNUAL_DEFECT_COST * WAR_OBSERVATION_WINDOW_MONTHS) / 12;
  }
}

function protectedAmountFor(id: ClauseId, v: number): number {
  switch (id) {
    case "liquidated_damages_cap":
      return Math.min(Math.max(v, 0), ceilingFor(id));
    case "escalation_clause":
      return (ESC_MATERIAL_PORTION * Math.max(0, ESC_WORST_CASE_PCT - v)) / 100;
    case "termination_right":
      return ceilingFor(id) - v * TERM_DAILY_LOCK_IN_COST;
    case "payment_term": {
      const extra = Math.max(0, v - PAY_BASELINE_DAYS);
      return ceilingFor(id) - PAY_QUADRATIC_COEFFICIENT * extra ** 2;
    }
    case "warranty":
      return (WAR_ANNUAL_DEFECT_COST * v) / 12;
  }
}

function recommendedValueFor(id: ClauseId): number {
  switch (id) {
    case "liquidated_damages_cap":
      return Math.round((ceilingFor(id) * LD_RECOMMENDED_CEILING_CAPTURE) / 1000) * 1000;
    case "escalation_clause":
      return ESC_RECOMMENDED_CAP_PCT;
    case "termination_right":
      return TERM_RECOMMENDED_DAYS;
    case "payment_term":
      return PAY_RECOMMENDED_DAYS;
    case "warranty":
      return WAR_RECOMMENDED_MONTHS;
  }
}

type ComputedValue = {
  ceiling: number;
  gap: number;
  bestCase: number;
  expectedCase: number;
  worstCase: number;
  recommendedValue: number;
  negotiationValue: number;
};

function computeClauseValue(id: ClauseId, value: number): ComputedValue {
  const ceiling = ceilingFor(id);
  const currentProtected = protectedAmountFor(id, value);
  const gap = Math.max(0, ceiling - currentProtected);
  const recommendedValue = recommendedValueFor(id);
  const recommendedProtected = protectedAmountFor(id, recommendedValue);
  const negotiationValue = recommendedProtected - currentProtected;

  return {
    ceiling,
    gap,
    bestCase: ceiling * BEST_CASE_FRACTION,
    expectedCase: ceiling * EXPECTED_CASE_FRACTION,
    worstCase: ceiling,
    recommendedValue,
    negotiationValue,
  };
}

const ASSUMPTIONS: Record<ClauseId, string[]> = {
  liquidated_damages_cap: [
    `Worst-case delay of ${LD_WORST_CASE_DELAY_DAYS} days, based on this project's critical-path float.`,
    `Owner's actual per-diem delay cost estimated at $${LD_PER_DIEM_DELAY_COST.toLocaleString()}/day.`,
    `Recommended cap targets ${Math.round(LD_RECOMMENDED_CEILING_CAPTURE * 100)}% of full worst-case exposure.`,
  ],
  escalation_clause: [
    `$${ESC_MATERIAL_PORTION.toLocaleString()} of contract value is materials subject to price escalation.`,
    `Worst-case annual market escalation assumed at ${ESC_WORST_CASE_PCT}% (recent peak).`,
    `Recommended cap of ${ESC_RECOMMENDED_CAP_PCT}% reflects a tighter, still-bankable pass-through limit.`,
  ],
  termination_right: [
    `Estimated cost of lock-in with an underperforming vendor: $${TERM_DAILY_LOCK_IN_COST.toLocaleString()}/day.`,
    "Ceiling assumes the maximum notice period in the current negotiating range.",
    `Recommended notice period of ${TERM_RECOMMENDED_DAYS} days matches this owner's standard template.`,
  ],
  payment_term: [
    `Cost of capital assumed at ${Math.round(PAY_COST_OF_CAPITAL_ANNUAL * 100)}% annually.`,
    `Average daily billing of $${Math.round(PAY_DAILY_BILLING).toLocaleString()}, derived from the $${REFERENCE_CONTRACT_VALUE.toLocaleString()} contract over ${REFERENCE_CONTRACT_MONTHS} months.`,
    `Baseline market payment term assumed at Net ${PAY_BASELINE_DAYS}.`,
  ],
  warranty: [
    `Annual latent-defect remediation cost estimated at $${WAR_ANNUAL_DEFECT_COST.toLocaleString()}.`,
    `Latent defects assumed to emerge within a ${WAR_OBSERVATION_WINDOW_MONTHS}-month observation window.`,
    `Recommended coverage of ${WAR_RECOMMENDED_MONTHS} months matches this trade's typical negotiated extension.`,
  ],
};

const EVIDENCE: Record<ClauseId, { source: string; value: string; reliability: string }[]> = {
  liquidated_damages_cap: [
    { source: "Master schedule — critical path float", value: `${LD_WORST_CASE_DELAY_DAYS} days`, reliability: "Verified transaction" },
    { source: "Owner revenue-per-day model", value: `$${LD_PER_DIEM_DELAY_COST.toLocaleString()}/day`, reliability: "Third-party observed" },
  ],
  escalation_clause: [
    { source: "Steel & rebar spend schedule", value: `$${ESC_MATERIAL_PORTION.toLocaleString()}`, reliability: "Verified transaction" },
    { source: "Producer price index, 12-month peak", value: `${ESC_WORST_CASE_PCT}%`, reliability: "Third-party observed" },
  ],
  termination_right: [
    { source: "Program management overhead rate", value: `$${TERM_DAILY_LOCK_IN_COST.toLocaleString()}/day`, reliability: "Third-party observed" },
  ],
  payment_term: [
    { source: "Treasury cost-of-capital rate", value: `${Math.round(PAY_COST_OF_CAPITAL_ANNUAL * 100)}%`, reliability: "Third-party observed" },
    { source: "Contract billing schedule", value: `$${REFERENCE_CONTRACT_VALUE.toLocaleString()} / ${REFERENCE_CONTRACT_MONTHS} mo`, reliability: "Verified transaction" },
  ],
  warranty: [
    { source: "Trade-specific defect claims history", value: `$${WAR_ANNUAL_DEFECT_COST.toLocaleString()}/yr`, reliability: "Third-party observed" },
  ],
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatByUnit(unit: Unit, v: number): string {
  switch (unit) {
    case "usd":
      return `$${Math.round(v).toLocaleString()}`;
    case "percent":
      return `${Math.round(v)}%`;
    case "days":
      return `${Math.round(v)} days`;
    case "months":
      return `${Math.round(v)} months`;
  }
}

const currency = (v: number) => `$${Math.round(Math.abs(v)).toLocaleString()}`;

// ---------------------------------------------------------------------------
// Shared shell
// ---------------------------------------------------------------------------

function EmbossedCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Card
      className={cn("rounded-[12px] border-0 bg-[var(--surface-card)] p-5", className)}
      style={{ boxShadow: "-6px -6px 14px rgba(255,255,255,0.65), 8px 8px 18px rgba(12,9,4,0.10)" }}
    >
      {children}
    </Card>
  );
}

function AnimatedDollar({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(0, { stiffness: 65, damping: 17, mass: 0.8 });
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  React.useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  return <span className={className}>${display.toLocaleString()}</span>;
}

// ---------------------------------------------------------------------------
// Clause selector chips
// ---------------------------------------------------------------------------

function ClauseSelector({
  selected,
  onSelect,
}: {
  selected: ClauseId;
  onSelect: (id: ClauseId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.values(CLAUSES).map((c) => (
        <motion.button
          key={c.id}
          onClick={() => onSelect(c.id)}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "rounded-[12px] border px-3.5 py-2 text-sm font-medium transition-colors",
            selected === c.id
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--surface-card)]"
              : "border-[var(--muted)] bg-[var(--surface-card)] text-[var(--foreground)] hover:bg-[var(--muted)]/30"
          )}
        >
          {c.name}
        </motion.button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario bars (best / expected / worst)
// ---------------------------------------------------------------------------

function ScenarioBars({ computed }: { computed: ComputedValue }) {
  const maxVal = computed.worstCase || 1;
  const bars = [
    { label: "Best Case", value: computed.bestCase, tone: "var(--success)" },
    { label: "Expected", value: computed.expectedCase, tone: "var(--warning)" },
    { label: "Worst Case", value: computed.worstCase, tone: "var(--danger)" },
  ];

  return (
    <div className="flex items-end gap-6 pt-2">
      {bars.map((b, i) => (
        <div key={b.label} className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{currency(b.value)}</span>
          <div className="flex h-[120px] w-10 items-end overflow-hidden rounded-[8px] bg-[var(--muted)]/40">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(4, (b.value / maxVal) * 100)}%` }}
              transition={{ delay: i * 0.12, duration: 0.6, ease: "easeOut" }}
              className="w-full rounded-[8px]"
              style={{ backgroundColor: b.tone }}
            />
          </div>
          <span className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Negotiation slider
// ---------------------------------------------------------------------------

function NegotiationSlider({
  clause,
  value,
  onChange,
}: {
  clause: ClauseDef;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Adjust clause value
        </span>
        <span className="text-sm font-medium text-[var(--accent)]">{formatByUnit(clause.unit, value)}</span>
      </div>
      <input
        type="range"
        min={clause.min}
        max={clause.max}
        step={clause.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
      <div className="flex flex-wrap gap-1.5">
        {clause.presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "rounded-[8px] px-2.5 py-1 text-xs font-medium transition-colors",
              value === p
                ? "bg-[var(--accent)] text-[var(--surface-card)]"
                : "bg-[var(--muted)]/40 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60"
            )}
          >
            {formatByUnit(clause.unit, p)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence receipt drawer
// ---------------------------------------------------------------------------

function EvidenceDrawer({
  open,
  onClose,
  clause,
  computed,
}: {
  open: boolean;
  onClose: () => void;
  clause: ClauseDef;
  computed: ComputedValue;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[var(--foreground)]/20"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-[var(--surface-floating)] p-6 shadow-[var(--shadow-lg,0_8px_24px_rgba(12,9,4,0.1))]"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-medium text-[var(--foreground)]">Evidence Receipt</h3>
              <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                ✕
              </button>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-[var(--muted-foreground)]">
              Why is {clause.name.toLowerCase()} worth {currency(computed.gap)} in unmitigated exposure today?
            </p>

            <div className="mb-6 flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Assumptions
              </span>
              {ASSUMPTIONS[clause.id].map((a, i) => (
                <div key={i} className="rounded-[10px] bg-[var(--muted)]/25 px-3 py-2 text-sm text-[var(--foreground)]">
                  {a}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Evidence
              </span>
              {EVIDENCE[clause.id].map((e, i) => (
                <div key={i} className="rounded-[10px] border border-[var(--muted)] px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--foreground)]">{e.source}</span>
                    <span className="text-sm text-[var(--foreground)]">{e.value}</span>
                  </div>
                  <Badge className="mt-1 border-none bg-[var(--info)]/10 text-[10px] text-[var(--info)]">
                    {e.reliability}
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function ClauseValueCalculator() {
  const [clauseId, setClauseId] = React.useState<ClauseId>("liquidated_damages_cap");
  const clause = CLAUSES[clauseId];
  const [value, setValue] = React.useState<number>(clause.current);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const handleSelectClause = (id: ClauseId) => {
    setClauseId(id);
    setValue(CLAUSES[id].current);
  };

  const computed = React.useMemo(() => computeClauseValue(clauseId, value), [clauseId, value]);

  return (
    <div className="min-h-screen w-full bg-[var(--background)] p-6 font-[Inter,sans-serif] md:p-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">COMPASS</span>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Clause Value Calculator</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            What is this contract clause actually worth to us?
          </p>
        </div>

        <ClauseSelector selected={clauseId} onSelect={handleSelectClause} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr_280px]">
          {/* LEFT — clause text */}
          <EmbossedCard className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Clause Text
            </span>
            <AnimatePresence mode="wait">
              <motion.p
                key={clauseId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm leading-relaxed text-[var(--foreground)]"
              >
                {clause.clauseText}
              </motion.p>
            </AnimatePresence>
          </EmbossedCard>

          {/* CENTER — risk / value calculation */}
          <EmbossedCard
            className="flex flex-col gap-5 border border-[var(--surface-floating)]/60 bg-[var(--surface-floating)]/55 backdrop-blur-[12px]"
            style={{ boxShadow: "0 8px 24px rgba(12,9,4,0.10)" } as React.CSSProperties}
          >
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                {clause.name}
              </span>
              <h2 className="mt-1 text-lg font-bold text-[var(--foreground)]">Risk &amp; Value</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">Current</span>
                <div className="text-lg font-bold text-[var(--foreground)]">{formatByUnit(clause.unit, value)}</div>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                  Estimated exposure
                </span>
                <AnimatedDollar value={computed.ceiling} className="block text-lg font-bold text-[var(--danger)]" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                  Expected protection
                </span>
                <AnimatedDollar value={computed.gap} className="block text-lg font-bold text-[var(--warning)]" />
              </div>
            </div>

            <ScenarioBars computed={computed} />

            <NegotiationSlider clause={clause} value={value} onChange={setValue} />
          </EmbossedCard>

          {/* RIGHT — negotiation impact */}
          <EmbossedCard className="flex flex-col gap-4">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Negotiation Impact
            </span>

            <div>
              <span className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                Recommended
              </span>
              <div className="text-lg font-bold text-[var(--accent)]">
                {formatByUnit(clause.unit, computed.recommendedValue)}
              </div>
            </div>

            <div className="rounded-[10px] bg-[var(--success)]/10 p-3">
              <AnimatedDollar value={computed.negotiationValue} className="block text-2xl font-bold text-[var(--success)]" />
              <p className="mt-1 text-xs leading-relaxed text-[var(--foreground)]">
                This concession is worth approximately {currency(computed.negotiationValue)} to the project.
              </p>
            </div>

            <Button
              onClick={() => setDrawerOpen(true)}
              variant="outline"
              className="border-[var(--muted-foreground)]/30 text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/40"
            >
              View Receipt
            </Button>
          </EmbossedCard>
        </div>
      </div>

      <EvidenceDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} clause={clause} computed={computed} />
    </div>
  );
}
