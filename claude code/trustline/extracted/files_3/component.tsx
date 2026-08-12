"use client";

/**
 * Trustline — EMR & Safety Trend Watch
 *
 * Composite safety picture for a vendor: EMR trend vs. industry benchmark,
 * current EMR standing, OSHA incident history, and a composite safety
 * score gauge. Demo data matches the centralized Trustline dataset and the
 * paired `/trustline/vendor/{vendor_id}/safety-trend` endpoint's formula,
 * so the UI number and the API number agree (safety_score = 80).
 */

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Centralized Trustline demo data
// ---------------------------------------------------------------------------

const VENDOR = {
  id: "vendor_meridian_steel",
  name: "Meridian Steel Fabrication",
  trade: "Structural Steel",
  location: "Houston, TX",
};

const INDUSTRY_AVG_EMR = 1.0;

type EmrPoint = { period: string; emr: number; benchmark: number };

const EMR_HISTORY: EmrPoint[] = [
  { period: "Q1 '25", emr: 0.94, benchmark: INDUSTRY_AVG_EMR },
  { period: "Q2 '25", emr: 0.99, benchmark: INDUSTRY_AVG_EMR },
  { period: "Q3 '25", emr: 1.03, benchmark: INDUSTRY_AVG_EMR },
  { period: "Q4 '25 (Today)", emr: 1.08, benchmark: INDUSTRY_AVG_EMR },
];

const CURRENT_EMR = EMR_HISTORY[EMR_HISTORY.length - 1].emr;

type OshaPeriod = { period: string; incidents: number };

// One recordable incident in Q2 '25 — roughly 8 months before "today", matching
// the central dataset's "one OSHA recordable incident 8 months ago".
const OSHA_HISTORY: OshaPeriod[] = [
  { period: "Q1 '25", incidents: 0 },
  { period: "Q2 '25", incidents: 1 },
  { period: "Q3 '25", incidents: 0 },
  { period: "Q4 '25", incidents: 0 },
];

const MONTHS_SINCE_LAST_INCIDENT = 8;

// Same simplified formula as the paired route.py — kept identical so the
// number shown here matches the API's computed safety_score exactly.
const EMR_PENALTY_MULTIPLIER = 40;
const INCIDENT_LOOKBACK_MONTHS = 24;
const INCIDENT_PENALTY_MAX = 25;

const emrPenalty = EMR_PENALTY_MULTIPLIER * Math.max(0, CURRENT_EMR - 1.0);
const incidentPenalty =
  INCIDENT_PENALTY_MAX *
  Math.max(0, (INCIDENT_LOOKBACK_MONTHS - MONTHS_SINCE_LAST_INCIDENT) / INCIDENT_LOOKBACK_MONTHS);
const SAFETY_SCORE = Math.round(Math.max(0, Math.min(100, 100 - emrPenalty - incidentPenalty)));

const TREND_WORSENING =
  EMR_HISTORY[EMR_HISTORY.length - 1].emr > EMR_HISTORY[EMR_HISTORY.length - 2].emr;
const NEEDS_HUMAN = TREND_WORSENING && MONTHS_SINCE_LAST_INCIDENT < 12;

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const THEME_VARS = {
  "--background": "#08070C",
  "--foreground": "#FFFFFF",
  "--muted": "rgba(255, 255, 255, 0.08)",
  "--muted-foreground": "rgba(255, 255, 255, 0.45)",
  "--accent": "#7D39EB",
  "--surface-card": "rgba(255, 255, 255, 0.02)",
  "--surface-floating": "rgba(255, 255, 255, 0.04)",
  "--success": "#C6FF33",
  "--warning": "#FBBF24",
  "--danger": "#F87171",
  "--info": "#38BDF8",
  "--ai": "#7D39EB",
} as CSSProperties;

const SOFT_SHADOW = "0 4px 12px rgba(0,0,0,0.3)";

// ---------------------------------------------------------------------------
// Count-up helper
// ---------------------------------------------------------------------------

function useCountUp(target: number, decimals = 0, delay = 0) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 22 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const startTimer = setTimeout(() => motionValue.set(target), delay);
    const unsubscribe = spring.on("change", (value) => setDisplay(value));
    return () => {
      clearTimeout(startTimer);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, delay]);

  return display.toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function EmrSafetyTrendWatch() {
  return (
    <div className="w-full rounded-xl px-6 py-8" style={{ ...THEME_VARS }}>
      <header className="mb-5">
        <Badge
          className="mb-2 rounded-[8px] border-0 text-[11px] uppercase tracking-wide bg-white/5 text-white/60"
        >
          Trustline · EMR &amp; Safety Trend Watch
        </Badge>
        <h2 className="text-xl font-semibold text-white">
          {VENDOR.name}
        </h2>
        <p className="mt-1 text-sm text-white/55">
          {VENDOR.trade} · {VENDOR.location}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-2">
        <EmrTrendCard />
        <CurrentEmrCard />
        <OshaIncidentsCard />
        <SafetyScoreCard />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero — EMR trend vs. industry benchmark (the one glass element)
// ---------------------------------------------------------------------------

function EmrTrendCard() {
  return (
    <Card
      className="relative col-span-1 row-span-2 overflow-hidden rounded-xl border p-5 md:col-span-2"
      style={{
        background: "rgba(255,255,255,0.04)",
        borderColor: "rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-white/40">
            EMR trend
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            Experience Modification Rate vs. industry average
          </p>
        </div>
        {NEEDS_HUMAN && (
          <Badge
            className="shrink-0 rounded-[8px] border-0 text-[11px] font-bold"
            style={{ background: "var(--danger)", color: "#000000" }}
          >
            Trending worse — flagged for review
          </Badge>
        )}
      </div>

      <div className="mt-4 h-64 w-full md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={EMR_HISTORY} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" opacity={0.6} vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0.85, 1.15]}
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-floating)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive
              animationDuration={800}
              animationEasing="ease-out"
              name="Industry avg"
            />
            <Line
              type="monotone"
              dataKey="emr"
              stroke="var(--accent)"
              strokeWidth={3}
              dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive
              animationDuration={800}
              animationEasing="ease-out"
              name="Meridian EMR"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex items-center gap-4 text-[11px] text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: "var(--accent)" }} />
          Meridian EMR
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-3 rounded-full"
            style={{ background: "rgba(255,255,255,0.3)", opacity: 0.7 }}
          />
          Industry avg (1.00)
        </span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Current EMR — big number, warning tint since above benchmark
// ---------------------------------------------------------------------------

function CurrentEmrCard() {
  const emr = useCountUp(CURRENT_EMR, 2, 200);

  return (
    <Card
      className="col-span-1 row-span-1 flex flex-col justify-between rounded-xl border border-white/5 p-5"
      style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
    >
      <p className="text-[11px] uppercase tracking-wide text-white/40">
        Current EMR
      </p>
      <div className="mt-2">
        <span className="text-4xl font-bold tabular-nums" style={{ color: "var(--warning)" }}>
          {emr}
        </span>
      </div>
      <p className="mt-1 text-xs text-white/50">
        vs. {INDUSTRY_AVG_EMR.toFixed(2)} industry avg
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// OSHA Incidents — small staggered bar chart, mostly clean
// ---------------------------------------------------------------------------

function OshaIncidentsCard() {
  const maxIncidents = Math.max(1, ...OSHA_HISTORY.map((p) => p.incidents));

  return (
    <Card
      className="col-span-1 row-span-1 flex flex-col justify-between rounded-xl border border-white/5 p-5"
      style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
    >
      <div>
        <p className="text-[11px] uppercase tracking-wide text-white/40">
          OSHA recordables
        </p>
        <p className="mt-1 text-xs text-white/50">
          Last incident {MONTHS_SINCE_LAST_INCIDENT} months ago
        </p>
      </div>

      <div className="mt-4 flex h-16 items-end gap-2">
        {OSHA_HISTORY.map((point, index) => {
          const hasIncident = point.incidents > 0;
          return (
            <div key={point.period} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-12 w-full items-end overflow-hidden rounded-[6px]" style={{ background: "var(--muted)" }}>
                <motion.div
                  className="w-full rounded-[6px]"
                  style={{ background: hasIncident ? "var(--danger)" : "var(--muted)" }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, (point.incidents / maxIncidents) * 100)}%` }}
                  transition={{ duration: 0.5, delay: index * 0.08, ease: EASE_OUT_EXPO }}
                />
              </div>
              <span className="text-[10px] text-white/45">
                {point.period.replace(" '25", "")}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Safety Score — composite radial gauge, animated sweep-fill
// ---------------------------------------------------------------------------

function SafetyScoreCard() {
  const scoreDisplay = useCountUp(SAFETY_SCORE, 0, 300);
  const scoreColor =
    SAFETY_SCORE >= 85 ? "var(--success)" : SAFETY_SCORE >= 65 ? "var(--warning)" : "var(--danger)";

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - SAFETY_SCORE / 100);

  return (
    <Card
      className={cn("col-span-1 row-span-1 flex items-center gap-5 rounded-xl border border-white/5 p-5 md:col-span-2")}
      style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
    >
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--muted)" strokeWidth="8" />
          <motion.circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={scoreColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: targetOffset }}
            transition={{ duration: 1, delay: 0.3, ease: EASE_OUT_EXPO }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-semibold tabular-nums" style={{ color: scoreColor }}>
            {scoreDisplay}
          </span>
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wide text-white/40">
          Composite safety score
        </p>
        <p className="mt-1 text-xs text-white/50">
          Weighs EMR trend against benchmark and incident recency. Simplified model, not an
          actuarial calculation.
        </p>
      </div>
    </Card>
  );
}
