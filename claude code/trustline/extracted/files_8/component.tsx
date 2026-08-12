"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useMotionValueEvent } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Design tokens — ORCHESTRA system (Dark Glassmorphic Neo-Industrial Theme)
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
};

const RESPONSE_TIME_DATA = [
  { month: "Oct", days: 1.0 },
  { month: "Nov", days: 1.2 },
  { month: "Dec", days: 1.1 },
  { month: "Jan", days: 1.9 },
  { month: "Feb", days: 3.1 },
  { month: "Mar (Today)", days: 4.0 }
];

function AnimatedCounter({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 60, damping: 15 });
  const [display, setDisplay] = useState(0);

  useMotionValueEvent(spring, "change", (latest) => setDisplay(Math.round(latest)));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <span>{display}</span>;
}

export default function RelationshipDecayWarning() {
  const decayScore = 68; // composite relationship decay score
  const threshold = 50;
  const isDecaying = decayScore > threshold;

  const CARD_EMBOSSED =
    "border border-white/5 rounded-[12px] bg-white/[0.02] backdrop-blur-md shadow-lg";

  const HERO_GLASS =
    "border border-white/10 rounded-[12px] bg-white/[0.04] backdrop-blur-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.2)]";

  // SVG dimensions for custom response time chart
  const W = 500;
  const H = 220;
  const PAD = { t: 20, r: 20, b: 30, l: 40 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const maxVal = 5.0;
  const thresholdVal = 2.5;

  const pts = RESPONSE_TIME_DATA.map((d, i) => ({
    x: PAD.l + (i / (RESPONSE_TIME_DATA.length - 1)) * chartW,
    y: PAD.t + chartH - (d.days / maxVal) * chartH,
    ...d
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1].x},${PAD.t + chartH} L ${pts[0].x},${PAD.t + chartH} Z`;

  // Y coordinate of threshold
  const thresholdY = PAD.t + chartH - (thresholdVal / maxVal) * chartH;

  return (
    <div className="w-full px-6 py-8 text-foreground" style={{
      "--background": tokens.background,
      "--foreground": tokens.foreground,
      "--muted": tokens.muted,
      "--muted-foreground": tokens.mutedForeground,
      "--accent": tokens.accent,
    } as any}>
      <div className="mx-auto max-w-[1000px] flex flex-col gap-6">
        {/* Banner Alert */}
        <AnimatePresence>
          {isDecaying && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border border-[#FBBF24]/20 rounded-[12px] bg-[#FBBF24]/5 p-4 flex items-start gap-3 text-[#FBBF24] shadow-sm"
            >
              <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[14px]">Relationship Health Warning</span>
                <p className="text-[13px] opacity-90 text-white/70">
                  This relationship has been quietly declining for 3 months — before it becomes a missed delivery.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex flex-col gap-2">
          <Badge className="self-start rounded-[4px] border border-white/10 px-2 py-0.5 text-[11.5px] font-medium bg-white/5 text-[var(--accent)]">
            Communication Audit
          </Badge>
          <h1 className="text-[28px] font-bold leading-tight">Relationship Decay Warning</h1>
          <p className="text-[14px] text-muted-foreground">
            Meridian Steel Fabrication — trend analysis of response speeds, submission completeness, and engagement touchpoints.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Hero Card - Response time chart */}
          <div className={cn(HERO_GLASS, "md:col-span-2 md:row-span-2 p-6 flex flex-col justify-between")}>
            <div className="flex flex-col gap-1 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-white">Average Response Lag</h3>
                <Badge className="bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] text-[11px] font-normal px-2 py-0">
                  Warning: Above Threshold
                </Badge>
              </div>
              <span className="text-[12px] text-muted-foreground">Average calendar days to resolve coordination messages</span>
            </div>

            {/* Custom SVG Area Chart with Warning Zone */}
            <div className="relative w-full h-[220px]">
              <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`}>
                {/* Shaded Warning Zone Band */}
                <rect
                  x={PAD.l}
                  y={PAD.t}
                  width={chartW}
                  height={thresholdY - PAD.t}
                  fill="url(#warningZoneGrad)"
                  opacity={0.15}
                />

                <defs>
                  <linearGradient id="warningZoneGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tokens.danger} />
                    <stop offset="100%" stopColor={tokens.warning} />
                  </linearGradient>
                  <linearGradient id="chartLineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tokens.accent} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={tokens.accent} stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                {/* Y-Axis Grid Lines & Labels */}
                {[0, 1.25, 2.5, 3.75, 5.0].map((val) => {
                  const gy = PAD.t + chartH - (val / maxVal) * chartH;
                  return (
                    <g key={val}>
                      <line x1={PAD.l} y1={gy} x2={W - PAD.r} y2={gy} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                      <text x={PAD.l - 8} y={gy + 4} textAnchor="end" fontSize="10" fill={tokens.mutedForeground} className="font-mono">
                        {val}d
                      </text>
                    </g>
                  );
                })}

                {/* Threshold Line */}
                <line
                  x1={PAD.l}
                  y1={thresholdY}
                  x2={W - PAD.r}
                  y2={thresholdY}
                  stroke={tokens.danger}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text x={W - PAD.r - 8} y={thresholdY - 6} textAnchor="end" fontSize="9" fill={tokens.danger} className="font-bold uppercase tracking-wider">
                  SLA Max: 2.5 Days
                </text>

                {/* Area Fill */}
                <motion.path
                  d={areaPath}
                  fill="url(#chartLineGrad)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                />

                {/* Line Path */}
                <motion.path
                  d={linePath}
                  fill="none"
                  stroke={tokens.accent}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                />

                {/* Data Points */}
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#12151A" stroke={tokens.accent} strokeWidth="2" />
                    <text x={p.x} y={PAD.t + chartH + 18} textAnchor="middle" fontSize="10" fill={tokens.mutedForeground} className="font-mono">
                      {p.month}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Decay Score Card */}
          <div className={cn(CARD_EMBOSSED, "col-span-1 p-6 flex flex-col justify-between")}>
            <div className="flex flex-col gap-1">
              <h3 className="text-[14px] uppercase tracking-wider text-muted-foreground font-semibold">Relationship Health</h3>
              <span className="text-[12px] text-muted-foreground">Composite communication health rating</span>
            </div>

            <div className="flex flex-col items-center my-6">
              <div className="relative flex items-center justify-center">
                {/* Gauge ring */}
                <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={tokens.warning}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 50}
                    initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 50 - (decayScore / 100) * 2 * Math.PI * 50 }}
                    transition={{ duration: 1.0, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[32px] font-bold leading-none text-white">
                    <AnimatedCounter value={decayScore} />
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium uppercase mt-0.5">Score</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-center text-[#FBBF24] bg-[#FBBF24]/5 py-1.5 px-3 rounded-lg border border-[#FBBF24]/10">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
              <span className="text-[12px] font-bold">Down 14% this quarter</span>
            </div>
          </div>

          {/* Answer Quality Card */}
          <div className={cn(CARD_EMBOSSED, "col-span-1 p-6 flex flex-col justify-between")}>
            <div className="flex flex-col gap-1">
              <h3 className="text-[14px] uppercase tracking-wider text-muted-foreground font-semibold">Submittal Completeness</h3>
              <span className="text-[12px] text-muted-foreground">Completeness accuracy on first submission</span>
            </div>

            <div className="flex flex-col gap-4 my-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[12px] font-bold">
                  <span className="text-white">Current Quarter</span>
                  <span className="text-[#FBBF24]">62%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[#FBBF24]"
                    initial={{ width: 0 }}
                    animate={{ width: "62%" }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[12px] font-medium text-muted-foreground">
                  <span>3 Months Ago</span>
                  <span>88%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[#C6FF33]"
                    initial={{ width: 0 }}
                    animate={{ width: "88%" }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>

            <span className="text-[11px] text-muted-foreground leading-relaxed">
              Completeness metrics are weighted by drawing references, certified stamps, and document attachments.
            </span>
          </div>

          {/* Missed Touchpoints Card */}
          <div className={cn(CARD_EMBOSSED, "col-span-1 p-6 flex flex-col justify-between")}>
            <div className="flex flex-col gap-1">
              <h3 className="text-[14px] uppercase tracking-wider text-muted-foreground font-semibold">Unanswered Touchpoints</h3>
              <span className="text-[12px] text-muted-foreground">Outstanding RFIs or notifications with no response</span>
            </div>

            <div className="flex flex-col items-center gap-3 my-4">
              <div className="text-[48px] font-extrabold leading-none text-[#F87171] font-mono">
                <AnimatedCounter value={3} />
              </div>
              <div className="flex gap-2">
                {[1, 2, 3].map((dot) => (
                  <motion.span
                    key={dot}
                    className="h-2.5 w-2.5 rounded-full bg-[#F87171]"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: dot * 0.4 }}
                  />
                ))}
              </div>
            </div>

            <span className="text-[11px] text-muted-foreground leading-relaxed text-center font-medium">
              Requires immediate action: Subcontractor has not acknowledged 3 separate submittal comments.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
