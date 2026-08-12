import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock data — mirrors decision_debt_ledger.py exactly (same seeded debts,
// same TODAY, same computed statuses)
// ---------------------------------------------------------------------------

const COMPANY_NAME = "Coastal Bay Builders";
const TODAY = new Date(2026, 7, 11); // Aug 11, 2026
const AGING_WINDOW_DAYS = 14;
const CRITICAL_EXPOSURE_USD = 150_000;
const CRITICAL_URGENCY_DAYS = 7;

type Status = "open" | "aging" | "overdue" | "resolved";

interface DecisionDebt {
  id: string;
  project: string;
  decision: string;
  reason: string;
  owner: string;
  deadline: Date;
  exposure: number;
  risk: string;
  evidence: string[];
  dependencies: string[];
  impact: string;
  createdDate: Date;
}

const RAW_DEBTS: DecisionDebt[] = [
  {
    id: "debt-001",
    project: "Riverside Commons — Phase 2",
    decision: "Proceed without final supplier certification",
    reason: "Certification lab has a 3-week backlog and the structural steel is needed to hold the foundation schedule.",
    owner: "Marcus Webb, Procurement Lead",
    deadline: new Date(2026, 7, 18),
    exposure: 180_000,
    risk: "Steel installed before certification could fail inspection",
    evidence: ["Lab quote confirms 3-week certification backlog (Jul 30)", "Structural engineer sign-off is pending certification (Aug 2)"],
    dependencies: ["Foundation pour schedule", "City inspection sign-off"],
    impact: "If certification fails after installation, may require partial demolition and re-fabrication of placed steel.",
    createdDate: new Date(2026, 6, 10),
  },
  {
    id: "debt-002",
    project: "Bayview Tower",
    decision: "Award electrical subcontract without a third competitive bid",
    reason: "Only two of three invited vendors responded by the bid deadline; the schedule couldn't absorb another extension.",
    owner: "Priya Anand, Project Manager",
    deadline: new Date(2026, 7, 5),
    exposure: 95_000,
    risk: "Contract price may exceed competitive market rate",
    evidence: ["Bid log shows 2 of 3 invited vendors responded (Jul 28)", "Vendor C requested a 10-day extension (Jul 30)"],
    dependencies: ["Electrical rough-in start date"],
    impact: "Without competitive pressure, contract price may land 8-12% above market rate.",
    createdDate: new Date(2026, 6, 15),
  },
  {
    id: "debt-003",
    project: "Harbor District Retail",
    decision: "Accept concrete supplier's delivery schedule despite a missed pour window",
    reason: "The alternate supplier's lead time is 3 weeks longer, and the pour window is already tight.",
    owner: "Owen Reyes, Site Superintendent",
    deadline: new Date(2026, 6, 28),
    exposure: 60_000,
    risk: "Liquidated damages clause exposure from continued schedule slip",
    evidence: ["Delivery schedule email shows a 2-day slip (Jul 18)", "Supplier confirmed no alternate slot before September (Jul 22)"],
    dependencies: ["Slab pour sequencing", "Rebar delivery"],
    impact: "Continued slip risks triggering the liquidated damages clause at 30 days.",
    createdDate: new Date(2026, 6, 1),
  },
  {
    id: "debt-004",
    project: "Harbor District Retail",
    decision: "Proceed with HVAC ductwork order despite a missing insurance certificate",
    reason: "The vendor's insurance renewal is delayed at their carrier, and ductwork lead time is on the critical path.",
    owner: "Marcus Webb, Procurement Lead",
    deadline: new Date(2026, 7, 25),
    exposure: 40_000,
    risk: "Uninsured vendor on site before renewal clears",
    evidence: ["Vendor certificate expired Jul 31, renewal pending (Aug 1)", "Broker confirmed renewal is in process (Aug 5)"],
    dependencies: ["HVAC rough-in start"],
    impact: "Uninsured vendor on site exposes the company to liability if an incident occurs before renewal clears.",
    createdDate: new Date(2026, 7, 1),
  },
  {
    id: "debt-005",
    project: "Harbor District Retail",
    decision: "Single-source copper wiring despite a pending antitrust inquiry disclosure",
    reason: "This vendor is the only qualified supplier within the required lead time; the inquiry is preliminary and unconfirmed.",
    owner: "Priya Anand, Project Manager",
    deadline: new Date(2026, 8, 30),
    exposure: 25_000,
    risk: "Reputational exposure if the inquiry becomes public",
    evidence: ["Industry trade alert flags a preliminary inquiry (Aug 3)", "Vendor legal counsel denies wrongdoing (Aug 6)"],
    dependencies: ["Electrical trim-out"],
    impact: "Low direct cost exposure, but reputational risk if the inquiry becomes public during the project.",
    createdDate: new Date(2026, 7, 6),
  },
  {
    id: "debt-006",
    project: "Bayview Tower",
    decision: "Start structural steel fabrication before final shop drawing approval",
    reason: "Fabrication must start now to hit the steel erection date; architect review is 90% complete.",
    owner: "Owen Reyes, Site Superintendent",
    deadline: new Date(2026, 7, 14),
    exposure: 210_000,
    risk: "Fabricated steel may not match final approved drawings",
    evidence: ["Architect redlines returned with 2 open items remaining (Aug 4)", "Fabricator confirmed the slot is reserved only through Aug 14 (Aug 5)"],
    dependencies: ["Steel erection schedule", "Crane mobilization"],
    impact: "If final drawings require design changes, fabricated steel may need costly rework or scrap.",
    createdDate: new Date(2026, 6, 20),
  },
  {
    id: "debt-007",
    project: "Riverside Commons — Phase 2",
    decision: "Approve drywall subcontractor despite an unresolved lien from a prior project",
    reason: "This subcontractor is the only available crew for the schedule window; the lien is against a different developer.",
    owner: "Marcus Webb, Procurement Lead",
    deadline: new Date(2026, 7, 1),
    exposure: 30_000,
    risk: "Subcontractor's bonding capacity could be frozen mid-project",
    evidence: ["Lien filing pulled from county records (Jul 25)", "Subcontractor's attorney provided a dispute letter (Jul 29)"],
    dependencies: ["Drywall start date", "Paint schedule"],
    impact: "If the lien escalates to judgment, the subcontractor's bonding could be frozen, forcing an emergency replacement.",
    createdDate: new Date(2026, 6, 18),
  },
];

const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

function computeStatus(deadline: Date, asOf: Date): { status: Status; daysRemaining: number } {
  const daysRemaining = daysBetween(deadline, asOf);
  if (daysRemaining < 0) return { status: "overdue", daysRemaining };
  if (daysRemaining <= AGING_WINDOW_DAYS) return { status: "aging", daysRemaining };
  return { status: "open", daysRemaining };
}

function computeCritical(status: Status, exposure: number, daysRemaining: number): boolean {
  return (status === "aging" || status === "overdue") && exposure >= CRITICAL_EXPOSURE_USD && daysRemaining <= CRITICAL_URGENCY_DAYS;
}

function computeNextBestAction(owner: string, status: Status, critical: boolean, daysRemaining: number, dependencies: string[]): string {
  const ownerFirst = owner.split(",")[0];
  if (status === "overdue" && critical) {
    return `Escalate immediately — schedule an emergency review with ${ownerFirst} before any further procurement proceeds on dependent work: ${dependencies.join(", ")}.`;
  }
  if (status === "overdue") {
    return `Deadline has passed — ${ownerFirst} must resolve this or formally accept the residual risk this week.`;
  }
  if (status === "aging" && critical) {
    return `${ownerFirst} should close this out in the next ${Math.max(daysRemaining, 0)} day(s) — exposure and urgency are both high.`;
  }
  if (status === "aging") {
    return `Set a reminder — confirm the resolution path with ${ownerFirst} before the ${daysRemaining}-day window closes.`;
  }
  return "Monitor — no action needed yet, deadline is not imminent.";
}

const STATUS_META: Record<Status, { label: string; color: string; size: number }> = {
  open: { label: "OPEN", color: "var(--info)", size: 28 },
  aging: { label: "AGING", color: "var(--warning)", size: 38 },
  overdue: { label: "OVERDUE", color: "var(--danger)", size: 50 },
  resolved: { label: "RESOLVED", color: "var(--success)", size: 24 },
};

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const moneyK = (n: number) => `$${Math.round(n / 1000)}K`;

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 70, damping: 18 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    motionVal.set(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(v.toFixed(decimals)));
    return () => unsub();
  }, [spring, decimals]);

  return <span>{display}</span>;
}

// ---------------------------------------------------------------------------
// Timeline node
// ---------------------------------------------------------------------------

function DebtNode({
  debt,
  status,
  critical,
  leftPct,
  selected,
  onClick,
}: {
  debt: DecisionDebt;
  status: Status;
  critical: boolean;
  leftPct: number;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = STATUS_META[status];

  return (
    <motion.button
      onClick={onClick}
      className="absolute flex flex-col items-center cursor-pointer group"
      style={{ left: `${leftPct}%`, top: "50%", transform: "translate(-50%, -50%)" }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <motion.div
        className="rounded-full flex items-center justify-center relative"
        animate={{ width: meta.size, height: meta.size }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          background: `color-mix(in srgb, ${meta.color} 20%, var(--surface-card))`,
          border: `2px solid ${meta.color}`,
          boxShadow: selected ? `0 0 0 4px color-mix(in srgb, ${meta.color} 25%, transparent)` : undefined,
        }}
      >
        {status === "overdue" && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${meta.color}` }}
            animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {critical && <span className="text-[10px] font-bold" style={{ color: meta.color }}>!</span>}
      </motion.div>
      <span className="text-[10px] font-bold mt-1.5 whitespace-nowrap" style={{ color: meta.color }}>
        {meta.label}
      </span>
      <span className="text-[10px] text-[var(--muted-foreground)] whitespace-nowrap">{fmtDate(debt.deadline)}</span>
      <div className="absolute -bottom-14 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[var(--foreground)] text-[var(--background)] text-[10px] rounded-[6px] px-2 py-1 whitespace-nowrap z-10">
        {debt.decision.length > 36 ? debt.decision.slice(0, 34) + "…" : debt.decision}
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function DebtDetailPanel({
  debt,
  status,
  daysRemaining,
  critical,
  nextBestAction,
  simState,
  onSimulate,
}: {
  debt: DecisionDebt;
  status: Status;
  daysRemaining: number;
  critical: boolean;
  nextBestAction: string;
  simState: Status[] | null;
  onSimulate: () => void;
}) {
  const meta = STATUS_META[status];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
      <Card
        className="rounded-[12px] p-5 bg-[var(--surface-card)] border-none"
        style={{ boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)" }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[11px] text-[var(--muted-foreground)] mb-1">{debt.project}</p>
            <h3 className="text-[16px] font-bold text-[var(--foreground)] leading-snug">{debt.decision}</h3>
          </div>
          <Badge
            className="text-[10px] px-2 py-0.5 rounded-[6px] font-bold shrink-0"
            style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
          >
            {meta.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">Owner</p>
            <p className="text-[12px] font-medium text-[var(--foreground)]">{debt.owner}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">Deadline</p>
            <p className="text-[12px] font-medium text-[var(--foreground)]">
              {fmtDate(debt.deadline)} ({daysRemaining >= 0 ? `${daysRemaining}d left` : `${Math.abs(daysRemaining)}d overdue`})
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">Exposure</p>
            <p className="text-[12px] font-bold" style={{ color: meta.color }}>
              {money(debt.exposure)}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">Status</p>
            <p className="text-[12px] font-medium text-[var(--foreground)]">
              {meta.label}
              {critical && " · CRITICAL"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Why deferred</p>
            <p className="text-[12px] text-[var(--foreground)] leading-relaxed">{debt.reason}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Evidence</p>
            <ul className="flex flex-col gap-1">
              {debt.evidence.map((e, i) => (
                <li key={i} className="text-[12px] text-[var(--muted-foreground)] flex gap-1.5">
                  <span className="text-[var(--accent)]">•</span> {e}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Dependencies</p>
            <div className="flex flex-wrap gap-1.5">
              {debt.dependencies.map((d) => (
                <Badge key={d} className="text-[10px] px-2 py-0.5 rounded-[6px] font-medium bg-[var(--muted)]/40 text-[var(--foreground)]">
                  {d}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Impact if unresolved</p>
            <p className="text-[12px] text-[var(--foreground)] leading-relaxed">{debt.impact}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[10px] p-3 border" style={{ borderColor: meta.color, background: `color-mix(in srgb, ${meta.color} 6%, var(--surface-floating))` }}>
          <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: meta.color }}>
            Next best action
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={nextBestAction}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-[12px] text-[var(--foreground)] font-medium leading-relaxed"
            >
              {nextBestAction}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            className="border border-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-colors"
            onClick={onSimulate}
          >
            Simulate deadline
          </Button>
          <AnimatePresence>
            {simState && (
              <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                {simState.map((s, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-[11px] text-[var(--muted-foreground)]">→</span>}
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-[6px]"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${STATUS_META[s].color} 16%, transparent)`,
                        color: STATUS_META[s].color,
                      }}
                    >
                      {STATUS_META[s].label}
                    </span>
                  </React.Fragment>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DecisionDebtLedger({ data }: { data?: any }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { asOf: Date; transition: Status[] }>>({});
  const [loaded, setLoaded] = useState(false);

  const debts = useMemo(() => {
    if (!data?.debts) return RAW_DEBTS;
    return data.debts.map((d: any) => ({
      id: d.id,
      project: d.project || d.project_name || "Project",
      decision: d.decision,
      reason: d.reason,
      owner: d.owner,
      deadline: new Date(d.deadline),
      exposure: d.exposure,
      risk: d.risk,
      evidence: d.evidence || [],
      dependencies: d.dependencies || [],
      impact: d.impact,
      createdDate: new Date(d.created_date || d.createdDate || TODAY),
    }));
  }, [data]);

  useEffect(() => {
    if (debts.length > 0) {
      setSelectedId(debts[0].id);
    }
  }, [debts]);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 250);
    return () => clearTimeout(t);
  }, []);

  const hydrated = useMemo(() => {
    return debts.map((debt: any) => {
      const override = overrides[debt.id];
      const asOf = override?.asOf ?? TODAY;
      const { status, daysRemaining } = computeStatus(debt.deadline, asOf);
      const critical = computeCritical(status, debt.exposure, daysRemaining);
      const nextBestAction = computeNextBestAction(debt.owner, status, critical, daysRemaining, debt.dependencies);
      return { debt, status, daysRemaining, critical, nextBestAction, transition: override?.transition ?? null };
    });
  }, [debts, overrides]);

  const stack = useMemo(() => {
    const open = hydrated.filter((h: any) => h.status !== "resolved");
    return {
      openDecisions: open.length,
      totalExposure: open.reduce((s: number, h: any) => s + h.debt.exposure, 0),
      overdueCount: open.filter((h: any) => h.status === "overdue").length,
      criticalCount: open.filter((h: any) => h.critical).length,
    };
  }, [hydrated]);

  const timelineRange = useMemo(() => {
    const times = debts.map((d: any) => d.deadline.getTime());
    const min = Math.min(...times, TODAY.getTime());
    const max = Math.max(...times, TODAY.getTime());
    return { min, max: max === min ? min + 1 : max };
  }, [debts]);

  function leftPctFor(date: Date) {
    const pct = ((date.getTime() - timelineRange.min) / (timelineRange.max - timelineRange.min)) * 86 + 7;
    return Math.min(Math.max(pct, 4), 96);
  }

  function handleSimulate(debtId: string) {
    const debt = debts.find((d: any) => d.id === debtId)!;
    const asOf = new Date(debt.deadline.getTime() + 86_400_000);
    const path: Status[] = [];
    for (const candidate of [TODAY, new Date(debt.deadline.getTime() - AGING_WINDOW_DAYS * 86_400_000 + 86_400_000), asOf]) {
      const { status } = computeStatus(debt.deadline, candidate);
      if (!path.length || path[path.length - 1] !== status) path.push(status);
    }
    setOverrides((prev) => ({ ...prev, [debtId]: { asOf, transition: path } }));
  }

  const selected = hydrated.find((h: any) => h.debt.id === selectedId) ?? hydrated[0];

  return (
    <div
      className="w-full min-h-[780px] rounded-[12px] p-6 sm:p-8"
      style={{
        // @ts-ignore css custom properties
        "--background": "#08070C",
        "--foreground": "#FFFFFF",
        "--muted": "rgba(255, 255, 255, 0.08)",
        "--muted-foreground": "rgba(245, 243, 239, 0.45)",
        "--accent": "#7D39EB",
        "--surface-card": "#120E1C",
        "--surface-floating": "#1C172E",
        "--success": "#C6FF33",
        "--warning": "#FBBF24",
        "--danger": "#F87171",
        "--info": "#60A5FA",
        "--ai": "#7D39EB",
        background: "var(--background)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
        <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">COMPASS · Decision Debt Ledger</p>
        <h1 className="text-[22px] font-bold text-[var(--foreground)] leading-tight">{COMPANY_NAME}</h1>
        <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
          What risk did we knowingly postpone, who owns it, and when must it be resolved?
        </p>
      </motion.div>

      {/* Debt stack */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Open decisions", value: stack.openDecisions, color: "var(--info)", decimals: 0 },
          { label: "Total exposure", value: stack.totalExposure, color: "var(--foreground)", decimals: 0, isMoney: true },
          { label: "Overdue", value: stack.overdueCount, color: "var(--danger)", decimals: 0 },
          { label: "Critical", value: stack.criticalCount, color: "var(--danger)", decimals: 0 },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.35 }}
            className="rounded-[12px] p-4 bg-[var(--surface-card)]"
            style={{ boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)" }}
          >
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">{s.label}</p>
            <p className="text-[24px] font-bold tabular-nums" style={{ color: s.color }}>
              {s.isMoney ? "$" : ""}
              <AnimatedNumber value={s.value} />
              {s.isMoney ? "" : ""}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Timeline */}
      <div className="mb-8">
        <h2 className="text-[13px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-4">Decision debt timeline</h2>
        <div
          className="relative rounded-[12px] px-6 pt-14 pb-8 bg-[var(--surface-card)]"
          style={{ boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)", minHeight: 160 }}
        >
          <div className="absolute left-6 right-6 top-1/2 h-px bg-[var(--muted)]" />
          {/* today marker */}
          <div className="absolute flex flex-col items-center" style={{ left: `${leftPctFor(TODAY)}%`, top: 8, transform: "translateX(-50%)" }}>
            <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-wide">Today</span>
            <div className="w-px h-8 bg-[var(--accent)] mt-1" style={{ opacity: 0.5 }} />
          </div>
          {loaded &&
            hydrated.map(({ debt, status, critical }: any) => (
              <DebtNode
                key={debt.id}
                debt={debt}
                status={status}
                critical={critical}
                leftPct={leftPctFor(debt.deadline)}
                selected={selectedId === debt.id}
                onClick={() => setSelectedId(debt.id)}
              />
            ))}
        </div>
      </div>

      {/* Debt cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6">
        <div>
          <h2 className="text-[13px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">All decisions</h2>
          <div className="flex flex-col gap-2">
            {hydrated
              .slice()
              .sort((a: any, b: any) => (b.critical ? 1 : 0) - (a.critical ? 1 : 0) || b.debt.exposure - a.debt.exposure)
              .map(({ debt, status, critical, daysRemaining }: any, i: number) => {
                const meta = STATUS_META[status as Status];
                return (
                  <motion.button
                    key={debt.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.25 }}
                    onClick={() => setSelectedId(debt.id)}
                    className={cn(
                      "text-left rounded-[10px] px-4 py-3 bg-[var(--surface-card)] transition-all hover:translate-x-0.5",
                      selectedId === debt.id && "ring-2"
                    )}
                    style={{
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.06)",
                      borderLeft: `3px solid ${meta.color}`,
                      ...(selectedId === debt.id ? { ["--tw-ring-color" as any]: meta.color } : {}),
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-[var(--foreground)] leading-snug">{debt.decision}</p>
                      {critical && (
                        <Badge className="text-[9px] px-1.5 py-0.5 rounded-[6px] font-bold shrink-0 bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger)]">
                          CRITICAL
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] font-bold" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">{moneyK(debt.exposure)}</span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {daysRemaining >= 0 ? `${daysRemaining}d left` : `${Math.abs(daysRemaining)}d overdue`}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
          </div>
        </div>

        <div>
          <h2 className="text-[13px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Detail</h2>
          <AnimatePresence mode="wait">
            {selected && (
              <DebtDetailPanel
                key={selected.debt.id + String(selected.transition?.length ?? 0)}
                debt={selected.debt}
                status={selected.status}
                daysRemaining={selected.daysRemaining}
                critical={selected.critical}
                nextBestAction={selected.nextBestAction}
                simState={selected.transition}
                onSimulate={() => handleSimulate(selected.debt.id)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
