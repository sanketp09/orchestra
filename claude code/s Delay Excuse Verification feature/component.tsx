import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Design tokens (as specified)
// ---------------------------------------------------------------------------
const tokens = {
  background: "transparent",
  foreground: "#FFFFFF",
  muted: "rgba(255, 255, 255, 0.08)",
  mutedForeground: "rgba(255, 255, 255, 0.45)",
  accent: "#7D39EB",
  surfaceCard: "transparent",
  surfaceFloating: "#1C172E",
  shadowSm: "0 1px 3px rgba(0,0,0,.3)",
  shadowMd: "0 2px 6px rgba(0,0,0,.4)",
  shadowLg: "0 8px 24px rgba(0,0,0,.5)",
  success: "#C6FF33",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#60A5FA",
} as const;

// ---------------------------------------------------------------------------
// NOTE: This screen's "evidence" is simulated IoT/factory-feed data — there
// is no live MES/IoT integration behind it. See the matching route.py's
// header comment for the same caveat on the backend side.
// ---------------------------------------------------------------------------

type ScreenState = "loading" | "results" | "error";

interface FactoryStatus {
  orderId: string;
  factory: string;
  item: string;
  machine: string;
  stage: string;
  percentComplete: number;
  dispatchDateEstimate: string;
  originalExpectedDate: string;
  delayRisk: boolean;
  confidence: number;
  reasoning: string;
}

const MOCK_STATUS: FactoryStatus = {
  orderId: "ORD-4471",
  factory: "Shreeji Metal Works, Bhiwandi",
  item: "MS structural columns — Block C, qty 40",
  machine: "Machine #12",
  stage: "final assembly",
  percentComplete: 80,
  dispatchDateEstimate: "2026-08-27",
  originalExpectedDate: "2026-08-20",
  delayRisk: true,
  confidence: 0.9,
  reasoning:
    "Observed progress rate over recent readings is slower than the pace required to hit the original expected dispatch date of Aug 20. Projected dispatch has slipped to Aug 27.",
};

const SCAN_STEPS = [
  "Connecting to factory feed…",
  "Reading latest progress reading…",
  "Comparing recent pace to required pace…",
  "Projecting dispatch date…",
];

// ---------------------------------------------------------------------------
// Animated numeric / progress helpers
// ---------------------------------------------------------------------------
function AnimatedPercent({ value, active }: { value: number; active: boolean }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 50, damping: 16 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (active) motionVal.set(value);
  }, [active, value, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  return <span>{display}%</span>;
}

function ProgressBar({ value, active, riskColor }: { value: number; active: boolean; riskColor: string }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 45, damping: 18 });
  const [widthPct, setWidthPct] = useState(0);

  useEffect(() => {
    if (active) motionVal.set(value);
  }, [active, value, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setWidthPct(v));
    return () => unsub();
  }, [spring]);

  return (
    <div
      className="w-full h-2.5 overflow-hidden"
      style={{ background: tokens.muted, borderRadius: 12 }}
    >
      <div
        className="h-full"
        style={{
          width: `${widthPct}%`,
          background: riskColor,
          borderRadius: 12,
          transition: "background 0.3s ease",
        }}
      />
    </div>
  );
}

export default function FactoryStatusScreen() {
  const [screen, setScreen] = useState<ScreenState>("loading");
  const [status, setStatus] = useState<FactoryStatus | null>(null);
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [reminderState, setReminderState] = useState<"idle" | "confirming" | "set">("idle");
  const [reminderDate, setReminderDate] = useState("2026-08-25");
  const [escalated, setEscalated] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const loadStatus = (simulateError = false) => {
    setStatus(null);
    setScreen("loading");
    setReminderState("idle");
    setEscalated(false);
  };

  useEffect(() => {
    loadStatus(false);
  }, []);

  useEffect(() => {
    if (screen !== "loading") return;
    setScanStepIndex(0);
    const interval = setInterval(() => {
      setScanStepIndex((i) => (i < SCAN_STEPS.length - 1 ? i + 1 : i));
    }, 500);
    const timeout = window.setTimeout(() => {
      setStatus(MOCK_STATUS);
      setScreen("results");
    }, 2200);
    return () => {
      clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [screen]);

  const triggerError = () => {
    setScreen("loading");
    setReminderState("idle");
    setEscalated(false);
    window.setTimeout(() => setScreen("error"), 1200);
  };

  const confirmReminder = () => {
    setReminderState("set");
  };

  const escalate = () => {
    setEscalating(true);
    window.setTimeout(() => {
      setEscalated(true);
      setEscalating(false);
    }, 700);
  };

  return (
    <div
      className="min-h-full w-full flex items-center justify-center p-6"
      style={{ background: tokens.background, color: tokens.foreground, fontFamily: "Inter, sans-serif" }}
    >
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {screen === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <LoadingScreen stepIndex={scanStepIndex} />
            </motion.div>
          )}

          {screen === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <ErrorScreen onRetry={() => loadStatus(false)} />
            </motion.div>
          )}

          {screen === "results" && status && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ResultsScreen
                status={status}
                reminderState={reminderState}
                reminderDate={reminderDate}
                setReminderDate={setReminderDate}
                onOpenReminder={() => setReminderState("confirming")}
                onCancelReminder={() => setReminderState("idle")}
                onConfirmReminder={confirmReminder}
                escalated={escalated}
                escalating={escalating}
                onEscalate={escalate}
                onRefresh={() => loadStatus(false)}
                onSimulateError={triggerError}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / scanning screen
// ---------------------------------------------------------------------------
function LoadingScreen({ stepIndex }: { stepIndex: number }) {
  return (
    <Card
      className="p-8 border-0"
      style={{ background: tokens.surfaceCard, boxShadow: tokens.shadowMd, borderRadius: 12 }}
    >
      <div className="flex items-center gap-3 mb-6">
        <motion.div
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: tokens.accent }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="text-sm font-medium" style={{ color: tokens.foreground }}>
          Pulling live production status…
        </span>
      </div>

      <div className="space-y-2.5">
        {SCAN_STEPS.map((step, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: i <= stepIndex ? 1 : 0.25, x: 0 }}
            transition={{ duration: 0.25 }}
            className="text-sm flex items-center gap-2"
            style={{ color: i <= stepIndex ? tokens.foreground : tokens.mutedForeground }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: i < stepIndex ? tokens.success : i === stepIndex ? tokens.accent : tokens.muted }}
            />
            {step}
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Error screen
// ---------------------------------------------------------------------------
function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Card
      className="p-8 border-0"
      style={{ background: tokens.surfaceCard, boxShadow: tokens.shadowMd, borderRadius: 12 }}
    >
      <Badge style={{ background: tokens.danger, color: tokens.surfaceFloating, borderRadius: 8 }} className="mb-4">
        Feed Unavailable
      </Badge>
      <h3 className="text-lg font-semibold mb-2" style={{ color: tokens.foreground }}>
        Couldn't reach the factory feed
      </h3>
      <p className="text-sm mb-6" style={{ color: tokens.mutedForeground }}>
        The production status stream didn't respond. Progress and dispatch projections couldn't be
        refreshed — try again in a moment.
      </p>
      <Button
        onClick={onRetry}
        className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: tokens.accent, color: tokens.surfaceFloating, borderRadius: 10 }}
      >
        Retry
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Results screen
// ---------------------------------------------------------------------------
function ResultsScreen({
  status,
  reminderState,
  reminderDate,
  setReminderDate,
  onOpenReminder,
  onCancelReminder,
  onConfirmReminder,
  escalated,
  escalating,
  onEscalate,
  onRefresh,
  onSimulateError,
}: {
  status: FactoryStatus;
  reminderState: "idle" | "confirming" | "set";
  reminderDate: string;
  setReminderDate: (v: string) => void;
  onOpenReminder: () => void;
  onCancelReminder: () => void;
  onConfirmReminder: () => void;
  escalated: boolean;
  escalating: boolean;
  onEscalate: () => void;
  onRefresh: () => void;
  onSimulateError: () => void;
}) {
  const progressColor = status.delayRisk ? tokens.warning : tokens.accent;

  const sections = [
    // Section 0: header / order identity
    <div key="header" className="flex items-start justify-between">
      <div>
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Sentinel · Factory Cloud
        </span>
        <h2 className="text-xl font-semibold mt-1" style={{ color: tokens.foreground }}>
          {status.orderId} — {status.item}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: tokens.mutedForeground }}>
          {status.factory}
        </p>
      </div>
      {status.delayRisk && (
        <Badge style={{ background: tokens.warning, color: tokens.surfaceFloating, borderRadius: 8 }}>
          Delay Risk
        </Badge>
      )}
    </div>,

    // Section 1: manufacturing progress
    <div key="progress">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: tokens.foreground }}>
          Manufacturing Progress
        </span>
        <span className="text-lg font-semibold tabular-nums" style={{ color: progressColor }}>
          <AnimatedPercent value={status.percentComplete} active={true} />
        </span>
      </div>
      <ProgressBar value={status.percentComplete} active={true} riskColor={progressColor} />
    </div>,

    // Section 2: production status line
    <div key="production-status">
      <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
        Production Status
      </span>
      <p className="text-sm mt-1.5" style={{ color: tokens.foreground }}>
        {status.machine} — {status.stage}
      </p>
    </div>,

    // Section 3: dispatch prediction
    <div key="dispatch">
      <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
        Dispatch Prediction
      </span>
      <div className="flex items-baseline gap-2 mt-1.5">
        <p className="text-sm font-medium" style={{ color: tokens.foreground }}>
          {formatDate(status.dispatchDateEstimate)}
        </p>
        {status.delayRisk && (
          <span className="text-xs" style={{ color: tokens.warning }}>
            (originally {formatDate(status.originalExpectedDate)})
          </span>
        )}
      </div>
      {status.delayRisk && (
        <p className="text-xs mt-1" style={{ color: tokens.mutedForeground }}>
          Confidence in this projection: {Math.round(status.confidence * 100)}% — pace has slowed against
          the schedule needed to hit the original date.
        </p>
      )}
    </div>,
  ];

  return (
    <Card
      className="p-8 border-0"
      style={{ background: tokens.surfaceCard, boxShadow: tokens.shadowLg, borderRadius: 12 }}
    >
      <div className="space-y-5">
        {sections.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.1 }}
          >
            {section}
          </motion.div>
        ))}

        {/* Delay risk warning banner */}
        <AnimatePresence>
          {status.delayRisk && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, delay: sections.length * 0.1 }}
              className="p-3.5 text-sm"
              style={{
                background: "rgba(184,135,58,0.10)",
                border: `1px solid ${tokens.warning}`,
                borderRadius: 10,
                color: tokens.foreground,
              }}
            >
              {status.reasoning}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: sections.length * 0.1 + 0.15 }}
          className="flex flex-wrap gap-3 pt-1"
        >
          <Button
            onClick={onOpenReminder}
            disabled={reminderState === "set"}
            className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: reminderState === "set" ? tokens.success : tokens.accent,
              color: tokens.surfaceFloating,
              borderRadius: 10,
              opacity: reminderState === "set" ? 1 : 1,
            }}
          >
            {reminderState === "set" ? "Reminder Set" : "Set Delivery Reminder"}
          </Button>

          {status.delayRisk && (
            <Button
              onClick={onEscalate}
              disabled={escalated || escalating}
              variant="outline"
              className="transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: escalated ? tokens.danger : tokens.surfaceFloating,
                color: escalated ? tokens.surfaceFloating : tokens.danger,
                border: `1px solid ${tokens.danger}`,
                borderRadius: 10,
                opacity: escalating ? 0.7 : 1,
              }}
            >
              {escalating ? "Escalating…" : escalated ? "Escalated to Vendor" : "Escalate to Vendor"}
            </Button>
          )}

          <button
            onClick={onSimulateError}
            className="text-xs underline underline-offset-2 transition-colors hover:opacity-70 ml-auto self-center"
            style={{ color: tokens.mutedForeground }}
          >
            Simulate feed failure
          </button>
        </motion.div>

        {/* Reminder confirmation panel */}
        <AnimatePresence>
          {reminderState === "confirming" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="p-4 overflow-hidden"
              style={{ background: tokens.surfaceFloating, border: `1px solid ${tokens.muted}`, borderRadius: 10 }}
            >
              <p className="text-sm font-medium mb-3" style={{ color: tokens.foreground }}>
                Notify me before dispatch
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="text-sm px-3 py-2 outline-none"
                  style={{ border: `1px solid ${tokens.muted}`, borderRadius: 8, color: tokens.foreground }}
                />
                <Button
                  onClick={onConfirmReminder}
                  className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: tokens.accent, color: tokens.surfaceFloating, borderRadius: 8 }}
                >
                  Confirm
                </Button>
                <button
                  onClick={onCancelReminder}
                  className="text-xs underline underline-offset-2 transition-colors hover:opacity-70"
                  style={{ color: tokens.mutedForeground }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {reminderState === "set" && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs"
              style={{ color: tokens.mutedForeground }}
            >
              You'll be notified on {formatDate(reminderDate)}, ahead of the projected dispatch date.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Evidence receipt — this feature's evidence is simulated IoT-style
            telemetry, not a live factory/MES integration. See route.py header. */}
        <div className="pt-4 border-t" style={{ borderColor: tokens.muted }}>
          <span className="text-xs tracking-wide uppercase mb-2 block" style={{ color: tokens.mutedForeground }}>
            Evidence Receipt
          </span>
          <div className="text-xs space-y-1" style={{ color: tokens.mutedForeground }}>
            <div>Source: factory_iot_feed_simulated · third_party_observed (simulated telemetry)</div>
            <div>Source: procurement_order_record · verified_transaction</div>
            <div>writes_to: procurement.order_tracking, vendor.production_log</div>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="text-xs underline underline-offset-2 transition-colors hover:opacity-70"
          style={{ color: tokens.mutedForeground }}
        >
          Refresh status
        </button>
      </div>
    </Card>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
