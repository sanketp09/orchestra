import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { LineChart, Line, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock data — mirrors what GET /atlas/currency-exposure/shipment_4471 returns
// (live Frankfurter/ECB rates server-side; PO amount + booking date seeded)
// ---------------------------------------------------------------------------

const SHIPMENT = {
  id: "shipment_4471",
  name: "Switchgear Shipment #4471",
  vendorName: "Meridian Steel Fabrication",
  projectName: "Austin Semiconductor Fab",
  budgetLine: "Structural Steel",
  budgetLineAmountUsd: 2_100_000,
};

const POAmountKrw = 246_000_000;
const bookingDate = "Jun 15";
const bookingRate = 1336.96; // KRW per 1 USD, at booking
const currentRate = 1285.27; // KRW per 1 USD, today

const originalUsdValue = POAmountKrw / bookingRate; // ≈ 184,000
const currentUsdValue = POAmountKrw / currentRate; // ≈ 191,400
const deltaUsd = currentUsdValue - originalUsdValue;
const deltaPct = (deltaUsd / originalUsdValue) * 100;
const DELTA_THRESHOLD_PCT = 3.0;
const needsHuman = Math.abs(deltaPct) >= DELTA_THRESHOLD_PCT;

const RATE_TREND = [
  { date: "Jun 15", rate: 1336.96 },
  { date: "Jun 29", rate: 1325.4 },
  { date: "Jul 13", rate: 1318.75 },
  { date: "Jul 27", rate: 1301.2 },
  { date: "Aug 4", rate: 1292.6 },
  { date: "Aug 11", rate: 1285.27 },
];

const loadingSteps = [
  "Looking up Shipment #4471's PO details…",
  "Calling Frankfurter for today's KRW/USD rate…",
  "Pulling the booking-date rate and trend…",
  "Recalculating exposure against the budget line…",
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function AnimatedNumber({ value, decimals = 0, prefix = "" }: { value: number; decimals?: number; prefix?: string }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 70, damping: 20 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    motionVal.set(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = spring.on("change", (v) =>
      setDisplay(v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }))
    );
    return () => unsub();
  }, [spring, decimals]);

  return (
    <span>
      {prefix}
      {display}
    </span>
  );
}

function BentoCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className={cn("rounded-[12px] p-4 border border-[var(--muted)]/50 bg-[var(--surface-card)]", className)}
      style={{ boxShadow: "-3px -3px 8px rgba(255,255,255,0.55), 4px 4px 10px rgba(12,9,4,0.08)" }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type ScreenState = "loading" | "results" | "error";

export default function CurrencyExposure() {
  const [screen, setScreen] = useState<ScreenState>("loading");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (screen !== "loading") return;
    if (stepIndex >= loadingSteps.length) {
      const t = setTimeout(() => setScreen("results"), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIndex((i) => i + 1), 480);
    return () => clearTimeout(t);
  }, [screen, stepIndex]);

  function retry() {
    setScreen("loading");
    setStepIndex(0);
  }
  function forceError() {
    setScreen("error");
  }

  const severityColor = needsHuman ? "var(--danger)" : "var(--success)";
  const rateMin = Math.min(...RATE_TREND.map((p) => p.rate), bookingRate) - 10;
  const rateMax = Math.max(...RATE_TREND.map((p) => p.rate), bookingRate) + 10;

  return (
    <div
      className="w-full min-h-[640px] rounded-[12px] p-6 sm:p-8"
      style={{
        // @ts-ignore css custom properties — shared ORCHESTRA tokens, not redefined
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
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
        <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Atlas · Currency &amp; Exchange Rate Exposure</p>
        <h1 className="text-[22px] font-bold text-[var(--foreground)] leading-tight">{SHIPMENT.name}</h1>
        <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
          {SHIPMENT.vendorName} → {SHIPMENT.projectName} · priced in KRW · {SHIPMENT.budgetLine} budget line
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {screen === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-[440px] gap-6">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-[var(--muted)]" />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)]"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-medium text-[var(--foreground)]">Atlas is checking currency exposure</p>
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
                    {loadingSteps[Math.min(stepIndex, loadingSteps.length - 1)]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
            <button onClick={forceError} className="text-[11px] text-[var(--muted-foreground)] underline underline-offset-2 hover:text-[var(--foreground)] transition-colors">
              Simulate a rate provider failure (demo)
            </button>
          </motion.div>
        )}

        {screen === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-[440px] gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] flex items-center justify-center">
              <span className="text-[var(--danger)] text-[20px] leading-none">!</span>
            </div>
            <div>
              <p className="text-[15px] font-medium text-[var(--foreground)]">Couldn't reach the exchange-rate provider</p>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1 max-w-[380px]">
                Shipment #4471's PO loaded, but the Frankfurter KRW/USD rate request timed out before exposure could be recalculated.
              </p>
            </div>
            <button className="text-[13px] text-white bg-[var(--accent)] hover:brightness-110 transition-all rounded-[8px] px-4 py-2" onClick={retry}>
              Retry
            </button>
          </motion.div>
        )}

        {screen === "results" && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Hero: KRW/USD trend since booking, col-span-2 */}
            <BentoCard delay={0 * 0.1} className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">KRW/USD since booking ({bookingDate})</p>
                <Badge className="text-[10px] px-2 py-0.5 rounded-[6px] font-bold bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]">
                  {deltaPct >= 0 ? "USD cost ↑" : "USD cost ↓"} {Math.abs(deltaPct).toFixed(1)}%
                </Badge>
              </div>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={RATE_TREND} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <YAxis domain={[rateMin, rateMax]} hide />
                    <ReferenceLine y={bookingRate} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "var(--accent)" }}
                      isAnimationActive
                      animationDuration={800}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between mt-1">
                {RATE_TREND.map((p) => (
                  <span key={p.date} className="text-[10px] text-[var(--muted-foreground)]">
                    {p.date}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-2">
                Dashed line marks the locked-in booking rate ({bookingRate.toFixed(2)} KRW/USD) — the gap to today's rate
                ({currentRate.toFixed(2)}) is the drift driving the cost delta.
              </p>
            </BentoCard>

            {/* Cost Impact */}
            <BentoCard delay={1 * 0.1} className="flex flex-col justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-2">Cost impact</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">Priced at (booking-date rate)</p>
                <p className="text-[18px] font-bold text-[var(--foreground)] tabular-nums mb-2">
                  $<AnimatedNumber value={originalUsdValue} decimals={0} />
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)]">Currently (today's rate)</p>
                <p className="text-[18px] font-bold tabular-nums" style={{ color: severityColor }}>
                  $<AnimatedNumber value={currentUsdValue} decimals={0} />
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--muted)]/50">
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Delta</p>
                <p className="text-[20px] font-bold tabular-nums" style={{ color: severityColor }}>
                  {deltaUsd >= 0 ? "+" : "−"}$
                  <AnimatedNumber value={Math.abs(deltaUsd)} decimals={0} />
                </p>
              </div>
            </BentoCard>

            {/* Hedge Suggestion — full width */}
            <BentoCard delay={2 * 0.1} className="sm:col-span-3 flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${severityColor} 16%, transparent)` }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={severityColor} strokeWidth="1.8">
                  <path d="M3 17l6-6 4 4 8-8" />
                  <path d="M17 7h4v4" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[12px] font-bold text-[var(--foreground)]">
                    {needsHuman ? "Hedge suggestion" : "No hedging action needed"}
                  </p>
                  <Badge
                    className="text-[9px] px-1.5 py-0.5 rounded-[6px] font-bold"
                    style={{ backgroundColor: `color-mix(in srgb, ${severityColor} 16%, transparent)`, color: severityColor }}
                  >
                    {needsHuman ? "ACTION NEEDED" : "INFO"}
                  </Badge>
                </div>
                <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed">
                  {needsHuman
                    ? `Consider locking this rate for remaining payment milestones on ${SHIPMENT.name} — KRW/USD drift has added $${Math.round(
                        deltaUsd
                      ).toLocaleString()} to the ${SHIPMENT.budgetLine} budget line since booking (${(
                        (deltaUsd / SHIPMENT.budgetLineAmountUsd) *
                        100
                      ).toFixed(2)}% of the $${(SHIPMENT.budgetLineAmountUsd / 1_000_000).toFixed(1)}M budgeted).`
                    : `The ${Math.abs(deltaPct).toFixed(1)}% movement since booking is within the ${DELTA_THRESHOLD_PCT}% threshold Atlas watches — no rate-locking action is warranted yet.`}
                </p>
              </div>
            </BentoCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
