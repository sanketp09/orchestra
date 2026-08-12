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
  background: "#08070C",
  foreground: "#FFFFFF",
  muted: "rgba(255, 255, 255, 0.08)",
  mutedForeground: "rgba(255, 255, 255, 0.45)",
  accent: "#7D39EB",
  surfaceCard: "rgba(255, 255, 255, 0.02)",
  surfaceFloating: "rgba(255, 255, 255, 0.04)",
  success: "#C6FF33",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#38BDF8",
  ai: "#7D39EB",
} as const;

const shadowEmboss = "0 6px 18px rgba(0,0,0,0.4)";

// ---------------------------------------------------------------------------
// Centralized demo data — Meridian Steel Fabrication
// ---------------------------------------------------------------------------
const VENDOR_NAME = "Meridian Steel Fabrication";

interface CheckEntry {
  id: string;
  checkedAgo: string;
  samStatus: "active_eligible";
  licenseStatus: "active";
  result: "pass" | "flag";
}

const BASE_CHECK_HISTORY: CheckEntry[] = [
  { id: "chk_1", checkedAgo: "21 days ago", samStatus: "active_eligible", licenseStatus: "active", result: "pass" },
  { id: "chk_2", checkedAgo: "14 days ago", samStatus: "active_eligible", licenseStatus: "active", result: "pass" },
  { id: "chk_3", checkedAgo: "7 days ago", samStatus: "active_eligible", licenseStatus: "active", result: "pass" },
  { id: "chk_4", checkedAgo: "6 hours ago", samStatus: "active_eligible", licenseStatus: "active", result: "pass" },
];

const LICENSE_DAYS_TOTAL = 45; // days remaining until renewal, per seed
const LICENSE_CYCLE_DAYS = 365; // renewal cycle length, for gauge proportion

// ---------------------------------------------------------------------------
// Motion helpers
// ---------------------------------------------------------------------------
function useCountUp(target: number, active: boolean) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 55, damping: 16 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (active) motionVal.set(target);
  }, [active, target, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  return display;
}

const bentoVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------
export default function SamLicensingWatchScreen() {
  const [mounted, setMounted] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [lastVerifiedLabel, setLastVerifiedLabel] = useState("6 hours ago");
  const [history, setHistory] = useState(BASE_CHECK_HISTORY);

  useEffect(() => {
    setMounted(true);
  }, []);

  const runRecheck = () => {
    if (rechecking) return;
    setRechecking(true);
    window.setTimeout(() => {
      setLastVerifiedLabel("just now");
      setHistory((prev) => [
        ...prev.slice(-3),
        {
          id: `chk_${Date.now()}`,
          checkedAgo: "just now",
          samStatus: "active_eligible",
          licenseStatus: "active",
          result: "pass",
        },
      ]);
      setRechecking(false);
    }, 1300);
  };

  return (
    <div
      className="w-full px-6 py-8"
      style={{ color: tokens.foreground, fontFamily: "Inter, sans-serif" }}
    >
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-5"
        >
          <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
            Trustline · SAM.gov Exclusion &amp; Licensing Watch
          </span>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: tokens.foreground }}>
            {VENDOR_NAME}
          </h1>
        </motion.div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "180px" }}
        >
          <BentoCell index={0} colSpan={2} rowSpan={2}>
            <HeroStatusCard
              rechecking={rechecking}
              onRecheck={runRecheck}
              lastVerifiedLabel={lastVerifiedLabel}
            />
          </BentoCell>

          <BentoCell index={1} colSpan={1} rowSpan={1}>
            <LicenseExpiryCard mounted={mounted} />
          </BentoCell>

          <BentoCell index={2} colSpan={1} rowSpan={1}>
            <CheckHistoryCard history={history} />
          </BentoCell>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bento cell wrapper
// ---------------------------------------------------------------------------
function BentoCell({
  index,
  colSpan,
  rowSpan,
  children,
}: {
  index: number;
  colSpan: number;
  rowSpan: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={bentoVariants}
      style={{ gridColumn: `span ${colSpan}`, gridRow: `span ${rowSpan}` }}
    >
      {children}
    </motion.div>
  );
}

function EmbossCard({
  className,
  glass,
  children,
}: {
  className?: string;
  glass?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("h-full w-full p-5 flex flex-col", className)}
      style={{
        borderRadius: 12,
        background: glass ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
        boxShadow: shadowEmboss,
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero status card — glass treatment, the one per screen
// ---------------------------------------------------------------------------
function HeroStatusCard({
  rechecking,
  onRecheck,
  lastVerifiedLabel,
}: {
  rechecking: boolean;
  onRecheck: () => void;
  lastVerifiedLabel: string;
}) {
  return (
    <EmbossCard glass className="justify-between">
      <div className="flex items-start justify-between">
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Compliance Status
        </span>
        <Button
          onClick={onRecheck}
          disabled={rechecking}
          className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "#7D39EB",
            color: "#FFFFFF",
            borderRadius: 10,
            opacity: rechecking ? 0.75 : 1,
            fontSize: 13,
            padding: "6px 14px",
            height: "auto",
          }}
        >
          {rechecking ? "Checking…" : "Re-check now"}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {rechecking ? (
          <motion.div
            key="checking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-center gap-3"
          >
            <div className="flex items-center gap-3">
              <motion.div
                className="w-3 h-3 rounded-full"
                style={{ background: tokens.accent }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="text-sm" style={{ color: tokens.foreground }}>
                Querying SAM.gov entity registration…
              </span>
            </div>
            <div className="flex items-center gap-3">
              <motion.div
                className="w-3 h-3 rounded-full"
                style={{ background: tokens.accent }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              />
              <span className="text-sm" style={{ color: tokens.foreground }}>
                Confirming state license standing…
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-center gap-5"
          >
            <div className="flex items-center gap-4">
              <GlowDot color={tokens.success} />
              <div>
                <p className="text-lg font-semibold" style={{ color: tokens.foreground }}>
                  SAM.gov: Active &amp; Eligible
                </p>
                <p className="text-sm mt-0.5" style={{ color: tokens.mutedForeground }}>
                  No active exclusions found for this entity.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <GlowDot color={tokens.success} />
              <div>
                <p className="text-lg font-semibold" style={{ color: tokens.foreground }}>
                  State License: Active
                </p>
                <p className="text-sm mt-0.5" style={{ color: tokens.mutedForeground }}>
                  Texas structural steel contractor license, in good standing.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-xs" style={{ color: tokens.mutedForeground }}>
        Last verified {lastVerifiedLabel}
      </p>
    </EmbossCard>
  );
}

function GlowDot({ color }: { color: string }) {
  return (
    <span className="relative flex items-center justify-center w-6 h-6 flex-shrink-0">
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: color, opacity: 0.25 }}
        animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// License Expiry card — countdown ring, sweep-fill gauge
// ---------------------------------------------------------------------------
function LicenseExpiryCard({ mounted }: { mounted: boolean }) {
  const daysDisplay = useCountUp(LICENSE_DAYS_TOTAL, mounted);
  const pctRemaining = Math.min(100, (LICENSE_DAYS_TOTAL / LICENSE_CYCLE_DAYS) * 100 * 6); // scaled for visible arc within a year-ish window

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const [dashOffset, setDashOffset] = useState(circumference);
  const isWatchWindow = LICENSE_DAYS_TOTAL <= 60;
  const ringColor = isWatchWindow ? tokens.warning : tokens.success;

  useEffect(() => {
    if (!mounted) return;
    const t = window.setTimeout(() => {
      const fillFraction = Math.min(1, LICENSE_DAYS_TOTAL / 90); // visual proportion within a 90-day watch horizon
      setDashOffset(circumference - fillFraction * circumference);
    }, 100);
    return () => window.clearTimeout(t);
  }, [mounted, circumference]);

  return (
    <EmbossCard className="items-center justify-between">
      <span className="text-xs tracking-wide uppercase self-start" style={{ color: tokens.mutedForeground }}>
        License Expiry
      </span>
      <div className="relative w-[84px] h-[84px]">
        <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
          <circle cx="42" cy="42" r={radius} fill="none" stroke={tokens.muted} strokeWidth={8} />
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums" style={{ color: tokens.foreground }}>
            {daysDisplay}
          </span>
          <span className="text-[10px]" style={{ color: tokens.mutedForeground }}>
            days
          </span>
        </div>
      </div>
      <p className="text-xs self-start" style={{ color: isWatchWindow ? tokens.warning : tokens.mutedForeground }}>
        {isWatchWindow ? "Renewal approaching" : "Renewal on track"}
      </p>
    </EmbossCard>
  );
}

// ---------------------------------------------------------------------------
// Check History card — vertical timeline
// ---------------------------------------------------------------------------
function CheckHistoryCard({ history }: { history: CheckEntry[] }) {
  return (
    <EmbossCard className="justify-between">
      <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
        Check History
      </span>
      <div className="flex-1 flex flex-col justify-center gap-0 mt-1">
        <AnimatePresence initial={false}>
          {history.map((entry, i) => (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-2.5 py-1.5"
            >
              <div className="flex flex-col items-center pt-0.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: entry.result === "pass" ? tokens.success : tokens.danger }}
                />
                {i < history.length - 1 && (
                  <span className="w-px flex-1 mt-1" style={{ background: tokens.muted, minHeight: 14 }} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: tokens.foreground }}>
                  {entry.result === "pass" ? "Passed" : "Flagged"}
                </p>
                <p className="text-[11px]" style={{ color: tokens.mutedForeground }}>
                  {entry.checkedAgo}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </EmbossCard>
  );
}
