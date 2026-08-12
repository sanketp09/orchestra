import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Priority = "low" | "medium" | "high" | "critical";
type ScreenState = "loading" | "ready" | "error";

interface Deadline {
  id: string;
  claimant: string;
  claimType: string;
  jurisdiction: string;
  filingDate: string; // ISO
  deadlineDate: string; // ISO
  daysRemaining: number;
  priority: Priority;
  requiredAction: string;
  statuteRef: string;
  draftSeed: string; // seed text the "LLM" would expand on
}

// ---------------------------------------------------------------------------
// Mock data — construction procurement / statutory notice deadlines
// ---------------------------------------------------------------------------

const MOCK_DEADLINES: Deadline[] = [
  {
    id: "dl-1042",
    claimant: "Meridian Steel Fabricators",
    claimType: "Notice of Intent to Lien",
    jurisdiction: "TX",
    filingDate: "2026-06-02",
    deadlineDate: "2026-08-11",
    daysRemaining: 1,
    priority: "critical",
    requiredAction: "File preliminary notice with county clerk before close of business",
    statuteRef: "Tex. Prop. Code § 53.056",
    draftSeed:
      "Draft a preliminary notice of intent to lien referencing the unpaid subcontractor balance on the Meridian Steel Fabricators account, citing the statutory notice period under Tex. Prop. Code § 53.056.",
  },
  {
    id: "dl-1039",
    claimant: "Ironclad Concrete Pumping",
    claimType: "Prompt Payment Demand",
    jurisdiction: "CA",
    filingDate: "2026-07-22",
    deadlineDate: "2026-08-13",
    daysRemaining: 3,
    priority: "high",
    requiredAction: "Send formal demand letter to GC citing prompt payment statute",
    statuteRef: "Cal. Civ. Code § 8800",
    draftSeed:
      "Draft a prompt payment demand letter to the general contractor invoking Cal. Civ. Code § 8800, referencing the retention amount withheld past the statutory release window.",
  },
  {
    id: "dl-1051",
    claimant: "Bayview Electrical Co.",
    claimType: "Stop Payment Notice",
    jurisdiction: "CA",
    filingDate: "2026-07-30",
    deadlineDate: "2026-08-19",
    daysRemaining: 9,
    priority: "medium",
    requiredAction: "Prepare bonded stop notice for delivery to construction lender",
    statuteRef: "Cal. Civ. Code § 8506",
    draftSeed:
      "Draft a bonded stop payment notice addressed to the construction lender, identifying the unpaid electrical work and the statutory basis under Cal. Civ. Code § 8506.",
  },
  {
    id: "dl-1028",
    claimant: "Harrow & Doyle Site Logistics",
    claimType: "Mechanic's Lien Filing",
    jurisdiction: "NY",
    filingDate: "2026-05-14",
    deadlineDate: "2026-08-02",
    daysRemaining: -8,
    priority: "critical",
    requiredAction: "Escalate to counsel — statutory window has lapsed",
    statuteRef: "N.Y. Lien Law § 10",
    draftSeed:
      "Draft an internal escalation memo to counsel noting the mechanic's lien filing window under N.Y. Lien Law § 10 has lapsed, and requesting an assessment of remaining remedies.",
  },
  {
    id: "dl-1055",
    claimant: "Cascade Roofing Systems",
    claimType: "Notice to Owner",
    jurisdiction: "FL",
    filingDate: "2026-07-28",
    deadlineDate: "2026-09-11",
    daysRemaining: 32,
    priority: "low",
    requiredAction: "No action required yet — monitor for owner response",
    statuteRef: "Fla. Stat. § 713.06",
    draftSeed:
      "Draft a routine notice-to-owner confirmation referencing Fla. Stat. § 713.06, noting the claim is timely and no further action is currently required.",
  },
];

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_BADGE_CLASS: Record<Priority, string> = {
  critical: "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/30",
  high: "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/30",
  medium: "bg-[var(--info)]/10 text-[var(--info)] border-[var(--info)]/30",
  low: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30",
};

function daysColor(days: number): string {
  if (days < 0) return "var(--danger)";
  if (days < 3) return "var(--danger)";
  if (days < 7) return "var(--warning)";
  return "var(--success)";
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Animated countdown number
// ---------------------------------------------------------------------------

function AnimatedDays({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 120, damping: 20, mass: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  return <span>{display}</span>;
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function DeadlineRow({
  deadline,
  index,
  expanded,
  onToggle,
  onMarkHandled,
  onEscalate,
}: {
  deadline: Deadline;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onMarkHandled: (id: string) => void;
  onEscalate: (id: string) => void;
}) {
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);
  const [escalated, setEscalated] = useState(false);

  const color = daysColor(deadline.daysRemaining);
  const overdue = deadline.daysRemaining < 0;

  const handleDraft = () => {
    setDrafting(true);
    setDraft(null);
    // Stub LLM call — in production this would hit a /draft-response endpoint
    // that forwards deadline.draftSeed as context to the model.
    window.setTimeout(() => {
      setDraft(
        `Subject: ${deadline.claimType} — ${deadline.claimant}\n\n` +
          `This letter serves as formal notice under ${deadline.statuteRef} regarding the above-referenced ` +
          `claim. ${deadline.draftSeed.replace(/^Draft (a|an) /, "We are submitting ")} ` +
          `Please treat this communication as time-sensitive given the statutory window closing ${formatDate(
            deadline.deadlineDate
          )}.`
      );
      setDrafting(false);
    }, 1400);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "border border-[var(--muted)]/60 bg-[var(--surface-card)] transition-all duration-200",
          "hover:shadow-[var(--shadow-md)] hover:border-[var(--accent)]/40"
        )}
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <button
          onClick={onToggle}
          className={cn(
            "w-full text-left px-5 py-4 flex items-center gap-4 rounded-[12px]",
            "transition-colors duration-150 hover:bg-[var(--muted)]/15",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-[var(--foreground)] text-[15px] truncate">
                {deadline.claimant}
              </span>
              <span className="text-[var(--muted-foreground)] text-[13px]">
                {deadline.claimType}
              </span>
            </div>
            <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5 truncate">
              {deadline.requiredAction}
            </p>
          </div>

          <div className="hidden sm:flex flex-col items-end w-28 shrink-0">
            <span className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
              Deadline
            </span>
            <span className="text-[13px] text-[var(--foreground)] font-medium">
              {formatDate(deadline.deadlineDate)}
            </span>
          </div>

          <div className="flex flex-col items-end w-20 shrink-0">
            <span className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
              {overdue ? "Overdue" : "Days Left"}
            </span>
            <span
              className="text-2xl font-bold tabular-nums leading-none"
              style={{ color }}
            >
              {overdue ? "+" : ""}
              <AnimatedDays value={Math.abs(deadline.daysRemaining)} />
            </span>
          </div>

          <div className="w-24 shrink-0 flex justify-end">
            <Badge
              variant="neutral"
              className={cn("font-medium text-[12px] px-2.5 py-0.5", PRIORITY_BADGE_CLASS[deadline.priority])}
            >
              {PRIORITY_LABEL[deadline.priority]}
            </Badge>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-1 border-t border-[var(--muted)]/50">
                <div className="flex items-start justify-between gap-4 flex-wrap mt-3">
                  <div className="text-[13px] text-[var(--muted-foreground)]">
                    <span className="font-medium text-[var(--foreground)]">Statutory basis: </span>
                    {deadline.statuteRef}
                    <span className="mx-2 text-[var(--muted)]">·</span>
                    <span className="font-medium text-[var(--foreground)]">Filed: </span>
                    {formatDate(deadline.filingDate)}
                    <span className="mx-2 text-[var(--muted)]">·</span>
                    <span className="font-medium text-[var(--foreground)]">Jurisdiction: </span>
                    {deadline.jurisdiction}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleDraft}
                    disabled={drafting}
                    className="hover:brightness-95 transition-all duration-150"
                  >
                    {drafting ? "Drafting…" : "Draft Response"}
                  </Button>
                  <Button
                    size="sm"
                    variant={handled ? "secondary" : "primary"}
                    disabled={handled}
                    onClick={() => {
                      setHandled(true);
                      onMarkHandled(deadline.id);
                    }}
                    className={cn(
                      "transition-all duration-150",
                      !handled && "bg-[var(--success)] hover:brightness-95 text-white"
                    )}
                  >
                    {handled ? "Marked Handled" : "Mark Handled"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={escalated}
                    onClick={() => {
                      setEscalated(true);
                      onEscalate(deadline.id);
                    }}
                    className={cn(
                      "transition-all duration-150 border-[var(--danger)]/40 text-[var(--danger)]",
                      "hover:bg-[var(--danger)]/10"
                    )}
                  >
                    {escalated ? "Escalated" : "Escalate"}
                  </Button>
                </div>

                <AnimatePresence>
                  {drafting && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 rounded-[10px] border border-[var(--muted)]/60 bg-[var(--muted)]/10 px-4 py-3"
                    >
                      <p className="text-[13px] text-[var(--muted-foreground)]">
                        Retrieving statute context and generating response starter…
                      </p>
                    </motion.div>
                  )}
                  {draft && !drafting && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 rounded-[10px] border border-[var(--muted)]/60 bg-[var(--surface-floating)] px-4 py-3"
                      style={{ boxShadow: "var(--shadow-sm)" }}
                    >
                      <span className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                        Draft starter
                      </span>
                      <p className="text-[13px] text-[var(--foreground)] mt-1.5 whitespace-pre-line leading-relaxed">
                        {draft}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function StatutoryDeadlineTracker() {
  const [screenState, setScreenState] = useState<ScreenState>("loading");
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());
  const [statusIndex, setStatusIndex] = useState(0);

  const scanStatuses = [
    "Connecting to statutory deadline registry…",
    "Cross-referencing jurisdiction rule sets…",
    "Calculating response windows for active claims…",
    "Ranking by urgency…",
  ];

  useEffect(() => {
    if (screenState !== "loading") return;
    const interval = window.setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, scanStatuses.length - 1));
    }, 550);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setDeadlines(MOCK_DEADLINES);
      setScreenState("ready");
    }, 2400);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenState]);

  const sorted = useMemo(
    () =>
      [...deadlines].sort((a, b) => {
        if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        }
        return a.daysRemaining - b.daysRemaining;
      }),
    [deadlines]
  );

  const retry = () => {
    setScreenState("loading");
    setStatusIndex(0);
  };

  const simulateError = () => setScreenState("error");

  return (
    <div
      className="min-h-full w-full"
      style={{
        // Design tokens
        // @ts-expect-error CSS custom properties
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
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">
              Statutory Deadline Tracker
            </h1>
            <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
              SENTINEL · Active lien, notice, and payment-demand windows
            </p>
          </div>
          {screenState === "ready" && (
            <button
              onClick={simulateError}
              className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--danger)] transition-colors underline underline-offset-2"
            >
              Simulate connection error
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {screenState === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-[12px] border border-[var(--muted)]/60 bg-[var(--surface-card)] px-6 py-10 flex flex-col items-center text-center"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <div className="w-8 h-8 rounded-full border-2 border-[var(--muted)] border-t-[var(--accent)] animate-spin mb-5" />
              <AnimatePresence mode="wait">
                <motion.p
                  key={statusIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="text-[13px] text-[var(--muted-foreground)]"
                >
                  {scanStatuses[statusIndex]}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          )}

          {screenState === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-[12px] border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-6 py-8 text-center"
            >
              <p className="text-[15px] font-medium text-[var(--danger)]">
                Couldn't reach the deadline registry
              </p>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1.5 max-w-sm mx-auto">
                The connection to the statutory rule service timed out. Tracked deadlines may be
                out of date until this reconnects.
              </p>
              <Button
                size="sm"
                onClick={retry}
                className="mt-5 bg-[var(--accent)] hover:brightness-95 text-white transition-all duration-150"
              >
                Retry connection
              </Button>
            </motion.div>
          )}

          {screenState === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              {sorted.map((d, i) => (
                <DeadlineRow
                  key={d.id}
                  deadline={d}
                  index={i}
                  expanded={expandedId === d.id}
                  onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  onMarkHandled={(id) =>
                    setHandledIds((prev) => new Set(prev).add(id))
                  }
                  onEscalate={() => {}}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
