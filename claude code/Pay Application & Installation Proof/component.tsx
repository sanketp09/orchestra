import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock data — a realistic overclaim scenario
// ---------------------------------------------------------------------------

const DIFFERENCE_THRESHOLD = 15;

const submission = {
  projectName: "Riverside Commons — Phase 2",
  workItem: "Pay Application #7",
  scopeDescription: "Electrical installation, floors 3–5",
  contractor: "Voltline Electrical Contractors",
  submittedAt: "Aug 8, 2026",
  claimedPercent: 90,
  verifiedPercent: 68,
  claimedAmount: 184500,
  photoUrl:
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=640&q=80",
  photoCaption: "Floor 4 electrical closet, submitted with pay application",
  visualReasoning:
    "Conduit and boxes are roughed in and most panels are mounted, but several device plates are missing and no panels show energized indicator lights — consistent with mid rough-in, not near-complete work.",
};

const scanSteps = [
  "Reading pay application…",
  "Loading submitted site photo…",
  "Comparing against scope of work…",
  "Estimating verified completion…",
  "Checking against approval threshold…",
];

const difference = Math.round((submission.claimedPercent - submission.verifiedPercent) * 10) / 10;
const exceedsThreshold = Math.abs(difference) > DIFFERENCE_THRESHOLD;
const verifiedAmount = Math.round(submission.claimedAmount * (submission.verifiedPercent / submission.claimedPercent));

function paymentRecommendation(): string {
  if (difference > DIFFERENCE_THRESHOLD) {
    return `Recommend approving ${submission.verifiedPercent}%, not the claimed ${submission.claimedPercent}%, pending review.`;
  }
  if (difference < -DIFFERENCE_THRESHOLD) {
    return `Claimed ${submission.claimedPercent}% is more conservative than verified ${submission.verifiedPercent}%. Recommend approving the claimed amount.`;
  }
  return `Claimed ${submission.claimedPercent}% is within tolerance of verified ${submission.verifiedPercent}%. Recommend approving the claimed amount.`;
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function AnimatedPercent({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 85, damping: 18 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    motionVal.set(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  return <span>{display}%</span>;
}

type Decision = "approve_full" | "approve_partial" | "reject" | null;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type ScreenState = "scanning" | "results" | "error";

export default function PayApplicationVerifier() {
  const [screen, setScreen] = useState<ScreenState>("scanning");
  const [stepIndex, setStepIndex] = useState(0);
  const [decision, setDecision] = useState<Decision>(null);
  const [partialAmount, setPartialAmount] = useState(verifiedAmount);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    if (screen !== "scanning") return;
    if (stepIndex >= scanSteps.length) {
      const t = setTimeout(() => setScreen("results"), 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIndex((i) => i + 1), 550);
    return () => clearTimeout(t);
  }, [screen, stepIndex]);

  function retry() {
    setScreen("scanning");
    setStepIndex(0);
    setDecision(null);
  }

  function forceError() {
    setScreen("error");
  }

  function handleApproveFull() {
    setShowRejectForm(false);
    setDecision("approve_full");
  }

  function handleApprovePartial() {
    setShowRejectForm(false);
    setDecision("approve_partial");
  }

  function handleReject() {
    setDecision("reject");
    setShowRejectForm(true);
  }

  return (
    <div
      className="w-full min-h-[600px] rounded-[12px] p-6 sm:p-8"
      style={{
        // @ts-ignore css custom properties
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
        background: "var(--background)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <AnimatePresence mode="wait">
        {screen === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[520px] gap-6"
          >
            <div className="relative w-14 h-14">
              <motion.div className="absolute inset-0 rounded-full border-2 border-[var(--muted)]" />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)]"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-medium text-[var(--foreground)]">SENTINEL is verifying this pay application</p>
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
            <button
              onClick={forceError}
              className="text-[11px] text-[var(--muted-foreground)] underline underline-offset-2 hover:text-[var(--foreground)] transition-colors mt-4"
            >
              Simulate a verification failure (demo)
            </button>
          </motion.div>
        )}

        {screen === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[520px] gap-4 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] flex items-center justify-center">
              <span className="text-[var(--danger)] text-[20px] leading-none">!</span>
            </div>
            <div>
              <p className="text-[15px] font-medium text-[var(--foreground)]">Couldn't analyze the submitted photo</p>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1 max-w-[380px]">
                The pay application loaded, but the vision analysis step timed out before a verified progress estimate could be produced.
              </p>
            </div>
            <Button className="bg-[var(--accent)] text-white hover:brightness-110 transition-all mt-2" onClick={retry}>
              Retry verification
            </Button>
          </motion.div>
        )}

        {screen === "results" && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 * 0.1, duration: 0.35 }}
              className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
            >
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
                  {submission.projectName} · {submission.contractor}
                </p>
                <h1 className="text-[22px] font-bold text-[var(--foreground)] leading-tight">{submission.workItem}</h1>
                <p className="text-[12px] text-[var(--muted-foreground)] mt-1">{submission.scopeDescription} · submitted {submission.submittedAt}</p>
              </div>
              {exceedsThreshold && (
                <Badge className="bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger)] text-[11px] px-2.5 py-1 rounded-[6px] font-medium w-fit">
                  {Math.abs(difference)}pt gap — exceeds threshold
                </Badge>
              )}
            </motion.div>

            {/* Photo + comparison */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 * 0.1, duration: 0.35 }}
              className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4"
            >
              <div className="rounded-[10px] overflow-hidden border border-[var(--muted)] shadow-[var(--shadow-sm)] bg-[var(--surface-card)]">
                <img src={submission.photoUrl} alt={submission.photoCaption} className="w-full h-[180px] object-cover" />
                <p className="text-[11px] text-[var(--muted-foreground)] px-3 py-2">{submission.photoCaption}</p>
              </div>

              <Card className="bg-[var(--surface-card)] border-[var(--muted)] shadow-[var(--shadow-sm)] rounded-[10px] p-5">
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Claimed progress</p>
                    <p className="text-[28px] font-bold text-[var(--foreground)] tabular-nums">
                      <AnimatedPercent value={submission.claimedPercent} />
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Verified progress</p>
                    <p className="text-[28px] font-bold text-[var(--accent)] tabular-nums">
                      <AnimatedPercent value={submission.verifiedPercent} />
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Difference</p>
                    <Badge
                      className={cn(
                        "text-[15px] font-bold px-2.5 py-1 rounded-[6px] tabular-nums",
                        exceedsThreshold
                          ? "bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger)]"
                          : "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)]"
                      )}
                    >
                      {difference > 0 ? "−" : "+"}
                      {Math.abs(difference)}pt
                    </Badge>
                  </div>
                </div>

                {/* progress bars */}
                <div className="mt-4 flex flex-col gap-2">
                  <div className="h-2 rounded-full bg-[var(--muted)]/40 overflow-hidden">
                    <motion.div
                      className="h-full bg-[var(--muted-foreground)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${submission.claimedPercent}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <div className="h-2 rounded-full bg-[var(--muted)]/40 overflow-hidden">
                    <motion.div
                      className="h-full bg-[var(--accent)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${submission.verifiedPercent}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                    />
                  </div>
                </div>

                <p className="text-[12px] text-[var(--muted-foreground)] mt-4 leading-relaxed">{submission.visualReasoning}</p>
              </Card>
            </motion.div>

            {/* Payment recommendation */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2 * 0.1, duration: 0.35 }}
              className={cn(
                "rounded-[10px] border px-4 py-3.5 flex items-start gap-3",
                exceedsThreshold
                  ? "border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface-card))]"
                  : "border-[var(--success)]/30 bg-[color-mix(in_srgb,var(--success)_8%,var(--surface-card))]"
              )}
            >
              <span
                className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", exceedsThreshold ? "bg-[var(--danger)]" : "bg-[var(--success)]")}
              />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-0.5">Payment recommendation</p>
                <p className="text-[14px] text-[var(--foreground)] font-medium">{paymentRecommendation()}</p>
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3 * 0.1, duration: 0.35 }}>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <Button
                  className={cn(
                    "flex-1 transition-all",
                    decision === "approve_full"
                      ? "bg-[var(--success)] text-white"
                      : "bg-[var(--surface-floating)] border border-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--success)] hover:text-white hover:border-[var(--success)]"
                  )}
                  onClick={handleApproveFull}
                >
                  Approve Payment — ${submission.claimedAmount.toLocaleString()}
                </Button>
                <Button
                  className={cn(
                    "flex-1 transition-all",
                    decision === "approve_partial"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface-floating)] border border-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)]"
                  )}
                  onClick={handleApprovePartial}
                >
                  Approve Partial — ${verifiedAmount.toLocaleString()}
                </Button>
                <Button
                  className={cn(
                    "flex-1 transition-all",
                    decision === "reject"
                      ? "bg-[var(--danger)] text-white"
                      : "bg-[var(--surface-floating)] border border-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--danger)] hover:text-white hover:border-[var(--danger)]"
                  )}
                  onClick={handleReject}
                >
                  Reject — Request Site Revisit
                </Button>
              </div>

              <AnimatePresence>
                {decision === "approve_partial" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-[10px] border border-[var(--muted)] bg-[var(--surface-floating)] p-4 shadow-[var(--shadow-sm)] flex items-center gap-3 flex-wrap">
                      <span className="text-[13px] text-[var(--foreground)]">Partial payment amount</span>
                      <input
                        type="number"
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(Number(e.target.value))}
                        className="text-[13px] text-[var(--foreground)] py-1.5 px-3 rounded-[8px] bg-[var(--surface-card)] border border-[var(--muted)] outline-none focus:border-[var(--accent)] transition-colors w-[140px]"
                      />
                      <span className="text-[12px] text-[var(--muted-foreground)]">
                        pre-filled to verified progress ({submission.verifiedPercent}% of claimed amount)
                      </span>
                    </div>
                  </motion.div>
                )}

                {showRejectForm && decision === "reject" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-[10px] border border-[var(--muted)] bg-[var(--surface-floating)] p-4 shadow-[var(--shadow-sm)]">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[13px] text-[var(--foreground)]">Note for site revisit request</span>
                        <textarea
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          placeholder="e.g. Panel closets on floor 4 need a follow-up photo showing energized devices."
                          rows={2}
                          className="text-[13px] text-[var(--foreground)] py-2 px-3 rounded-[8px] bg-[var(--surface-card)] border border-[var(--muted)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                        />
                      </label>
                      <Button size="sm" className="bg-[var(--danger)] text-white hover:brightness-110 transition-all mt-3" onClick={() => setShowRejectForm(false)}>
                        Send revisit request
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {decision && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[12px] text-[var(--muted-foreground)] mt-2"
                >
                  {decision === "approve_full" && "Full claimed payment approved and logged."}
                  {decision === "approve_partial" && `Partial payment of $${partialAmount.toLocaleString()} approved and logged.`}
                  {decision === "reject" && !showRejectForm && "Site revisit requested."}
                </motion.p>
              )}
            </motion.div>

            {/* Evidence receipt */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4 * 0.1, duration: 0.35 }}>
              <Card className="bg-[var(--surface-floating)] border-[var(--muted)] shadow-[var(--shadow-md)] rounded-[10px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-medium text-[var(--foreground)]">Evidence receipt</h3>
                  <Badge
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-[6px] font-medium",
                      exceedsThreshold
                        ? "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning)]"
                        : "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)]"
                    )}
                  >
                    {exceedsThreshold ? "Needs human review" : "No review required"}
                  </Badge>
                </div>
                <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed mb-4">
                  Claimed {submission.claimedPercent}% compared against a {submission.verifiedPercent}% vision-based
                  estimate from the submitted photo — a {Math.abs(difference)}-point gap against a {DIFFERENCE_THRESHOLD}-point
                  threshold, so this {exceedsThreshold ? "was" : "was not"} flagged for review.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Confidence</p>
                    <p className="text-[15px] font-bold text-[var(--foreground)] tabular-nums">0.82</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Evidence items</p>
                    <p className="text-[15px] font-bold text-[var(--foreground)] tabular-nums">2</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Writes to</p>
                    <p className="text-[12px] text-[var(--foreground)]">pay_applications, finance_dashboard</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Source</p>
                    <p className="text-[12px] text-[var(--foreground)]">self_reported + third_party_observed</p>
                  </div>
                </div>
                <div className="border-t border-[var(--muted)] mt-4 pt-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                    <span>Pay application claim</span>
                    <span className="tabular-nums">self_reported · {submission.submittedAt}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                    <span>Site photo vision analysis</span>
                    <span className="tabular-nums">third_party_observed · {submission.submittedAt}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
