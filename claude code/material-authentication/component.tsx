import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (mirror the EvidenceResult contract from route.py)
// ---------------------------------------------------------------------------

type ReliabilityTier = "self_reported" | "third_party_observed" | "verified_transaction";

interface EvidenceItem {
  source: string;
  reliability_tier: ReliabilityTier;
  timestamp: string;
  raw_ref: string;
}

interface UnderpaymentAlert {
  worker_classification: string;
  shortfall_per_hour: number;
  total_exposure: number;
}

interface PayrollRowResult {
  worker_id: string;
  worker_classification: string;
  project_state: string;
  hourly_rate: number;
  required_rate: number | null;
  hours: number;
  underpaid: boolean;
  shortfall_per_hour: number;
  row_exposure: number;
  note: string;
}

interface PaymentWageIntegrityResult {
  confidence: number;
  evidence: EvidenceItem[];
  reasoning: string;
  needs_human: boolean;
  writes_to: string[];
  payment_compliance: boolean;
  underpayment_alerts: UnderpaymentAlert[];
  compliance_report: string;
}

type ScreenState = "idle" | "scanning" | "results" | "error";

// ---------------------------------------------------------------------------
// Mock data — realistic construction-procurement payroll scenario
// ---------------------------------------------------------------------------

const MOCK_ROWS: PayrollRowResult[] = [
  {
    worker_id: "W-1042",
    worker_classification: "Electrician",
    project_state: "CA",
    hourly_rate: 56.25,
    required_rate: 58.75,
    hours: 40,
    underpaid: true,
    shortfall_per_hour: 2.5,
    row_exposure: 100.0,
    note: "Underpaid vs. wage determination",
  },
  {
    worker_id: "W-1043",
    worker_classification: "Electrician",
    project_state: "CA",
    hourly_rate: 56.25,
    required_rate: 58.75,
    hours: 38,
    underpaid: true,
    shortfall_per_hour: 2.5,
    row_exposure: 95.0,
    note: "Underpaid vs. wage determination",
  },
  {
    worker_id: "W-1044",
    worker_classification: "Electrician",
    project_state: "CA",
    hourly_rate: 56.25,
    required_rate: 58.75,
    hours: 42,
    underpaid: true,
    shortfall_per_hour: 2.5,
    row_exposure: 105.0,
    note: "Underpaid vs. wage determination",
  },
  {
    worker_id: "W-2011",
    worker_classification: "Carpenter",
    project_state: "CA",
    hourly_rate: 52.30,
    required_rate: 52.30,
    hours: 40,
    underpaid: false,
    shortfall_per_hour: 0,
    row_exposure: 0,
    note: "Meets or exceeds required rate",
  },
  {
    worker_id: "W-2012",
    worker_classification: "Laborer",
    project_state: "CA",
    hourly_rate: 41.20,
    required_rate: 41.20,
    hours: 40,
    underpaid: false,
    shortfall_per_hour: 0,
    row_exposure: 0,
    note: "Meets or exceeds required rate",
  },
  {
    worker_id: "W-2013",
    worker_classification: "Plumber",
    project_state: "CA",
    hourly_rate: 55.00,
    required_rate: 55.00,
    hours: 36,
    underpaid: false,
    shortfall_per_hour: 0,
    row_exposure: 0,
    note: "Meets or exceeds required rate",
  },
];

const MOCK_RESULT: PaymentWageIntegrityResult = {
  confidence: 0.5,
  evidence: [
    {
      source: "wage_determination_table",
      reliability_tier: "third_party_observed",
      timestamp: "2026-08-10T14:02:11Z",
      raw_ref: "rows_checked:6",
    },
    {
      source: "payroll_submission",
      reliability_tier: "self_reported",
      timestamp: "2026-08-10T14:02:11Z",
      raw_ref: "payroll_batch:6_rows",
    },
    {
      source: "lien_waiver_payment_match",
      reliability_tier: "verified_transaction",
      timestamp: "2026-08-10T14:02:11Z",
      raw_ref: "waiver:48200.0_payment:48200.0",
    },
  ],
  reasoning:
    "Checked 6 payroll row(s) against 6 seeded wage determinations. Underpayment detected: 3 electricians underpaid by $2.50/hr — total exposure $300.00. Lien waiver matches payment. payment_compliance=False, needs_human=True (threshold: any underpayment OR lien waiver mismatch).",
  needs_human: true,
  writes_to: ["payroll_compliance_log", "wage_audit_queue"],
  payment_compliance: false,
  underpayment_alerts: [
    { worker_classification: "Electrician", shortfall_per_hour: 2.5, total_exposure: 300.0 },
  ],
  compliance_report:
    "Reviewed 6 payroll row(s) against seeded wage determinations. 3 row(s) flagged as underpaid; total wage exposure $300.00. Lien waiver amount matches payment amount. Overall payment compliance: FAIL.",
};

const PROJECT_NAME = "Willow Creek Bridge Retrofit — Certified Payroll, Week 14";

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const toneStyles: Record<"success" | "danger" | "warning" | "info", { bg: string; fg: string; border: string }> = {
  success: { bg: "rgba(74,122,92,0.10)", fg: "#4A7A5C", border: "rgba(74,122,92,0.30)" },
  danger: { bg: "rgba(166,67,47,0.10)", fg: "#A6432F", border: "rgba(166,67,47,0.30)" },
  warning: { bg: "rgba(184,135,58,0.10)", fg: "#B8873A", border: "rgba(184,135,58,0.30)" },
  info: { bg: "rgba(74,106,138,0.10)", fg: "#4A6A8A", border: "rgba(74,106,138,0.30)" },
};

function reliabilityTone(tier: ReliabilityTier): "success" | "info" | "warning" {
  if (tier === "verified_transaction") return "success";
  if (tier === "third_party_observed") return "info";
  return "warning";
}

function reliabilityLabel(tier: ReliabilityTier): string {
  if (tier === "verified_transaction") return "Verified transaction";
  if (tier === "third_party_observed") return "Third-party observed";
  return "Self-reported";
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Animated dollar readout using useSpring, not an instant swap.
function AnimatedCurrency({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 90, damping: 22, mass: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [spring]);

  return <span>{formatCurrency(display)}</span>;
}

// ---------------------------------------------------------------------------
// Section wrapper with staggered mount animation
// ---------------------------------------------------------------------------

function Section({
  index,
  children,
  className,
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Loading / scanning state
// ---------------------------------------------------------------------------

const SCAN_STEPS = [
  "Loading certified payroll rows…",
  "Matching worker classifications to wage determinations…",
  "Comparing paid rates against required rates…",
  "Reconciling lien waiver against payment amount…",
  "Computing exposure and compliance status…",
];

function ScanningState() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => (i < SCAN_STEPS.length - 1 ? i + 1 : i));
    }, 850);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto py-16 px-6 flex flex-col items-center text-center">
      <div className="relative w-16 h-16 mb-6">
        <motion.div
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-3 rounded-full" style={{ backgroundColor: "var(--muted)" }} />
      </div>
      <h2 className="text-lg font-medium mb-1" style={{ color: "var(--foreground)" }}>
        Auditing payroll and payment records
      </h2>
      <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>
        Cross-checking against wage determinations on file.
      </p>
      <div className="w-full flex flex-col gap-2.5 text-left">
        {SCAN_STEPS.map((step, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: i <= stepIndex ? 1 : 0.35, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 text-sm"
            >
              <span
                className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-[10px] font-medium"
                style={{
                  backgroundColor: done ? "rgba(74,122,92,0.15)" : active ? "var(--muted)" : "transparent",
                  color: done ? "#4A7A5C" : "var(--muted-foreground)",
                  border: done ? "none" : `1px solid var(--muted)`,
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)" }}>{step}</span>
              {active && (
                <span className="ml-auto flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: "var(--accent)" }}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                    />
                  ))}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="w-full max-w-lg mx-auto py-16 px-6 text-center">
      <div
        className="w-12 h-12 rounded-full mx-auto mb-5 flex items-center justify-center text-lg font-medium"
        style={{ backgroundColor: "rgba(166,67,47,0.10)", color: "#A6432F" }}
      >
        !
      </div>
      <h2 className="text-lg font-medium mb-2" style={{ color: "var(--foreground)" }}>
        Audit couldn't be completed
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
        The payroll batch didn't load correctly, or the wage determination table was
        unreachable. No compliance result was recorded.
      </p>
      <Button onClick={onRetry} className="transition-transform active:scale-[0.97]">
        Retry Audit
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment Compliance badge
// ---------------------------------------------------------------------------

function ComplianceBadge({ pass: passed }: { pass: boolean }) {
  const t = passed ? toneStyles.success : toneStyles.danger;
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-sm font-medium border"
      style={{ backgroundColor: t.bg, color: t.fg, borderColor: t.border }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.fg }} />
      {passed ? "Compliant" : "Non-Compliant"}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Payroll table row
// ---------------------------------------------------------------------------

type FlagState = "none" | "flagged";

function PayrollRowLine({
  row,
  onFlag,
  flagState,
}: {
  row: PayrollRowResult;
  onFlag: (workerId: string) => void;
  flagState: FlagState;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="grid grid-cols-[1.3fr_1fr_0.8fr_0.8fr_0.9fr_auto] items-center gap-3 px-3.5 py-3 rounded-[10px] text-sm transition-colors"
      style={{
        backgroundColor: hovered ? "var(--surface-floating)" : "transparent",
        boxShadow: hovered ? "var(--shadow-sm)" : "none",
        borderLeft: row.underpaid ? "3px solid var(--danger)" : "3px solid transparent",
      }}
    >
      <div className="min-w-0">
        <div className="font-medium truncate" style={{ color: "var(--foreground)" }}>
          {row.worker_classification}
        </div>
        <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
          {row.worker_id} · {row.project_state}
        </div>
      </div>
      <div style={{ color: row.underpaid ? "#A6432F" : "var(--foreground)" }}>
        ${row.hourly_rate.toFixed(2)}/hr
      </div>
      <div style={{ color: "var(--muted-foreground)" }}>
        {row.required_rate !== null ? `$${row.required_rate.toFixed(2)}/hr` : "—"}
      </div>
      <div style={{ color: "var(--muted-foreground)" }}>{row.hours}h</div>
      <div>
        {row.underpaid ? (
          <Badge
            className="rounded-[8px] font-medium"
            style={{ backgroundColor: "rgba(166,67,47,0.10)", color: "#A6432F" }}
          >
            Underpaid
          </Badge>
        ) : (
          <Badge
            className="rounded-[8px] font-medium"
            style={{ backgroundColor: "rgba(74,122,92,0.10)", color: "#4A7A5C" }}
          >
            OK
          </Badge>
        )}
      </div>
      <div>
        {row.underpaid && (
          <motion.button
            whileHover={flagState === "flagged" ? undefined : { y: -1 }}
            whileTap={flagState === "flagged" ? undefined : { scale: 0.96 }}
            disabled={flagState === "flagged"}
            onClick={() => onFlag(row.worker_id)}
            className={cn(
              "text-xs font-medium px-2.5 py-1.5 rounded-[8px] border transition-colors whitespace-nowrap",
              flagState === "flagged" && "cursor-not-allowed"
            )}
            style={{
              backgroundColor: flagState === "flagged" ? "rgba(184,135,58,0.10)" : "var(--surface-floating)",
              color: flagState === "flagged" ? "#B8873A" : "var(--foreground)",
              borderColor: flagState === "flagged" ? "rgba(184,135,58,0.30)" : "var(--muted)",
            }}
          >
            {flagState === "flagged" ? "Flagged ✓" : "Flag for Correction"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Evidence row
// ---------------------------------------------------------------------------

function EvidenceRow({ item, index }: { item: EvidenceItem; index: number }) {
  const [hovered, setHovered] = useState(false);
  const tone = toneStyles[reliabilityTone(item.reliability_tier)];
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-between gap-4 px-3.5 py-3 rounded-[10px] cursor-default transition-colors"
      style={{
        backgroundColor: hovered ? "var(--surface-floating)" : "transparent",
        boxShadow: hovered ? "var(--shadow-sm)" : "none",
      }}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
          {item.source.replace(/_/g, " ")}
        </span>
        <span className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
          {item.raw_ref} · {formatTimestamp(item.timestamp)}
        </span>
      </div>
      <span
        className="text-[11px] font-medium px-2 py-1 rounded-[8px] shrink-0 border"
        style={{ backgroundColor: tone.bg, color: tone.fg, borderColor: tone.border }}
      >
        {reliabilityLabel(item.reliability_tier)}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Results state
// ---------------------------------------------------------------------------

type ActionKind = "approve" | "hold";

function ResultsState({
  result,
  rows,
  onAction,
  actionTaken,
}: {
  result: PaymentWageIntegrityResult;
  rows: PayrollRowResult[];
  onAction: (kind: ActionKind) => void;
  actionTaken: ActionKind | null;
}) {
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [exported, setExported] = useState(false);

  function handleFlag(workerId: string) {
    setFlagged((prev) => new Set(prev).add(workerId));
  }

  function handleExport() {
    setExported(true);
    window.setTimeout(() => setExported(false), 2200);
  }

  const totalExposure = result.underpayment_alerts.reduce((sum, a) => sum + a.total_exposure, 0);

  // Count underpaid rows per classification for the alert callout copy.
  const countByClass: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.underpaid) countByClass[r.worker_classification] = (countByClass[r.worker_classification] ?? 0) + 1;
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      {/* Header */}
      <Section index={0} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-medium tracking-wide uppercase mb-1" style={{ color: "var(--muted-foreground)" }}>
            SENTINEL · Payment &amp; Wage Integrity
          </p>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
            {PROJECT_NAME}
          </h1>
        </div>
        <div>
          <p className="text-xs mb-1.5" style={{ color: "var(--muted-foreground)" }}>
            Payment Compliance
          </p>
          <ComplianceBadge pass={result.payment_compliance} />
        </div>
      </Section>

      {/* Confidence */}
      <Section index={1}>
        <Card className="p-5 rounded-[12px] border-0" style={{ backgroundColor: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Audit Confidence
            </span>
            <span className="text-2xl font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
              {Math.round(result.confidence * 100)}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: "var(--accent)" }}
              initial={{ width: 0 }}
              animate={{ width: `${result.confidence * 100}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
          </div>
          {result.needs_human && (
            <p className="text-xs mt-3" style={{ color: "var(--warning)" }}>
              Underpayment or payment mismatch found — flagged for human review.
            </p>
          )}
        </Card>
      </Section>

      {/* Wage Verification table */}
      <Section index={2}>
        <Card className="p-5 rounded-[12px] border-0" style={{ backgroundColor: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--foreground)" }}>
            Wage Verification
          </h3>
          <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.8fr_0.9fr_auto] gap-3 px-3.5 pb-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
            <span>Classification / Worker</span>
            <span>Paid Rate</span>
            <span>Required</span>
            <span>Hours</span>
            <span>Status</span>
            <span></span>
          </div>
          <div className="flex flex-col gap-1">
            {rows.map((row) => (
              <PayrollRowLine
                key={row.worker_id}
                row={row}
                onFlag={handleFlag}
                flagState={flagged.has(row.worker_id) ? "flagged" : "none"}
              />
            ))}
          </div>
        </Card>
      </Section>

      {/* Underpayment Alerts */}
      {result.underpayment_alerts.length > 0 && (
        <Section index={3}>
          <Card
            className="p-5 rounded-[12px] border-0"
            style={{ backgroundColor: "rgba(166,67,47,0.06)", boxShadow: "var(--shadow-sm)", border: "1px solid rgba(166,67,47,0.20)" }}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: "#A6432F" }}>
              Underpayment Alerts
            </h3>
            <div className="flex flex-col gap-2">
              {result.underpayment_alerts.map((alert) => (
                <div key={alert.worker_classification} className="flex items-start gap-2.5 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "#A6432F" }} />
                  <span style={{ color: "var(--foreground)" }}>
                    {countByClass[alert.worker_classification] ?? 0} {alert.worker_classification.toLowerCase()}
                    {(countByClass[alert.worker_classification] ?? 0) !== 1 ? "s" : ""} underpaid by{" "}
                    <span className="font-medium">${alert.shortfall_per_hour.toFixed(2)}/hr</span> — total exposure{" "}
                    <span className="font-medium">
                      <AnimatedCurrency value={alert.total_exposure} />
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 flex items-center justify-between text-xs" style={{ borderTop: "1px solid rgba(166,67,47,0.20)" }}>
              <span style={{ color: "var(--muted-foreground)" }}>Total exposure across all alerts</span>
              <span className="font-semibold" style={{ color: "#A6432F" }}>
                <AnimatedCurrency value={totalExposure} />
              </span>
            </div>
          </Card>
        </Section>
      )}

      {/* Compliance Report */}
      <Section index={4}>
        <Card className="p-5 rounded-[12px] border-0" style={{ backgroundColor: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Compliance Report
            </h3>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleExport}
              className="text-xs font-medium px-2.5 py-1.5 rounded-[8px] border transition-colors"
              style={{
                backgroundColor: exported ? "rgba(74,122,92,0.10)" : "var(--surface-floating)",
                color: exported ? "#4A7A5C" : "var(--foreground)",
                borderColor: exported ? "rgba(74,122,92,0.30)" : "var(--muted)",
              }}
            >
              {exported ? "Exported ✓" : "Export Report"}
            </motion.button>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            {result.compliance_report}
          </p>
        </Card>
      </Section>

      {/* Actions */}
      <Section index={5} className="flex flex-wrap gap-3">
        <ActionButton
          label="Approve Payroll"
          activeLabel="Approved"
          tone="success"
          active={actionTaken === "approve"}
          disabled={actionTaken !== null}
          onClick={() => onAction("approve")}
        />
        <ActionButton
          label="Hold Payment"
          activeLabel="On Hold"
          tone="warning"
          active={actionTaken === "hold"}
          disabled={actionTaken !== null}
          onClick={() => onAction("hold")}
        />
      </Section>

      {/* Evidence receipt */}
      <Section index={6}>
        <Card className="p-5 rounded-[12px] border-0" style={{ backgroundColor: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Evidence Receipt
            </h3>
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {result.evidence.length} sources
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {result.evidence.map((item, i) => (
              <EvidenceRow item={item} index={i} key={item.raw_ref} />
            ))}
          </div>
          <div className="mt-4 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ borderTop: "1px solid var(--muted)" }}>
            <span style={{ color: "var(--muted-foreground)" }}>Writes to: {result.writes_to.join(", ")}</span>
            <span
              className="px-2 py-1 rounded-[8px] font-medium"
              style={{
                backgroundColor: result.needs_human ? "rgba(184,135,58,0.10)" : "rgba(74,122,92,0.10)",
                color: result.needs_human ? "#B8873A" : "#4A7A5C",
              }}
            >
              {result.needs_human ? "Needs human review" : "Auto-cleared"}
            </span>
          </div>
        </Card>
      </Section>
    </div>
  );
}

function ActionButton({
  label,
  activeLabel,
  active,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  activeLabel: string;
  active: boolean;
  tone: "success" | "danger" | "warning";
  onClick: () => void;
  disabled: boolean;
}) {
  const t = toneStyles[tone];
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-4 py-2.5 rounded-[12px] text-sm font-medium border transition-colors",
        disabled && !active && "opacity-40 cursor-not-allowed"
      )}
      style={{
        backgroundColor: active ? t.bg : "var(--surface-floating)",
        color: active ? t.fg : "var(--foreground)",
        borderColor: active ? t.border : "var(--muted)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {active ? `${activeLabel} ✓` : label}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function SentinelPaymentWageIntegrity() {
  const [screen, setScreen] = useState<ScreenState>("idle");
  const [actionTaken, setActionTaken] = useState<ActionKind | null>(null);
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeouts.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  function runAudit(forceError = false) {
    setActionTaken(null);
    setScreen("scanning");
    const id = window.setTimeout(() => {
      setScreen(forceError ? "error" : "results");
    }, 4300);
    timeouts.current.push(id);
  }

  function handleAction(kind: ActionKind) {
    setActionTaken(kind);
  }

  return (
    <div
      className="min-h-screen w-full font-sans"
      style={{
        // Design tokens
        // @ts-ignore - CSS custom properties
        "--background": "transparent",
        "--foreground": "#FFFFFF",
        "--muted": "rgba(255, 255, 255, 0.08)",
        "--muted-foreground": "rgba(255, 255, 255, 0.45)",
        "--accent": "#7D39EB",
        "--surface-card": "transparent",
        "--surface-floating": "#1C172E",
        "--shadow-sm": "0 1px 3px rgba(0,0,0,.3)",
        "--shadow-md": "0 2px 6px rgba(0,0,0,.4)",
        "--shadow-lg": "0 8px 24px rgba(0,0,0,.5)",
        "--success": "#C6FF33",
        "--warning": "#FBBF24",
        "--danger": "#F87171",
        "--info": "#60A5FA",
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {screen === "idle" && (
        <div className="max-w-2xl mx-auto py-24 px-6 text-center">
          <p className="text-xs font-medium tracking-wide uppercase mb-2" style={{ color: "var(--muted-foreground)" }}>
            SENTINEL
          </p>
          <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
            Payment &amp; Wage Integrity
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>
            {PROJECT_NAME} · 6 workers on this payroll batch
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => runAudit(false)}>Run Payroll Audit</Button>
            <Button
              onClick={() => runAudit(true)}
              className="opacity-70"
              style={{ backgroundColor: "var(--surface-floating)", color: "var(--foreground)", border: "1px solid var(--muted)" }}
            >
              Simulate Error
            </Button>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {screen === "scanning" && (
          <motion.div key="scanning" exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <ScanningState />
          </motion.div>
        )}
        {screen === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <ErrorState onRetry={() => setScreen("idle")} />
          </motion.div>
        )}
        {screen === "results" && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <ResultsState result={MOCK_RESULT} rows={MOCK_ROWS} onAction={handleAction} actionTaken={actionTaken} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
