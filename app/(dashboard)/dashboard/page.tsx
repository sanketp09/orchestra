"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView } from "framer-motion";
import {
  AlertTriangle, ArrowRight, ChevronRight, ShieldAlert,
  Sparkles, TrendingDown, TrendingUp, Activity, Clock,
  Info, Zap, FileText, Search
} from "lucide-react";
import { MOCK_VENDORS, MOCK_DECISIONS, MOCK_ACTIVITIES } from "@/lib/mock-data";
import { Decision, Severity } from "@/types";
import { Badge } from "@/components/ui/badge";

/* ── PALETTE ──────────────────────────────────────────────
   Black, Violet, Lime, White
──────────────────────────────────────────────────────────── */
const INK      = "#FFFFFF";
const BROWN_MD = "rgba(255, 255, 255, 0.7)";
const BROWN_LT = "rgba(255, 255, 255, 0.45)";
const SAND     = "rgba(255, 255, 255, 0.25)";
const CREAM    = "rgba(255, 255, 255, 0.08)";
const RECESSED = "rgba(8, 7, 12, 0.8)";
const CANVAS   = "#08070C";
const SURFACE  = "rgba(255, 255, 255, 0.03)";
const BORDER   = "rgba(255, 255, 255, 0.08)";

const SUCCESS = "#C6FF33";  /* Lime */
const WARNING = "#FBBF24";  /* Amber */
const DANGER  = "#F87171";  /* Red */
const INFO    = "#60A5FA";  /* Light Blue */
const AI      = "#7D39EB";  /* Violet */

const SEVERITY_MAP: Record<Severity, { icon: typeof ShieldAlert; color: string; bg: string; border: string; label: string }> = {
  danger:  { icon: ShieldAlert,   color: DANGER,  bg: `${DANGER}15`,  border: `${DANGER}30`,  label: "Critical"   },
  warning: { icon: AlertTriangle, color: WARNING, bg: `${WARNING}15`, border: `${WARNING}30`, label: "At Risk"    },
  info:    { icon: Info,          color: INFO,    bg: `${INFO}15`,    border: `${INFO}30`,    label: "Info"       },
  success: { icon: Sparkles,      color: SUCCESS, bg: `${SUCCESS}15`, border: `${SUCCESS}30`, label: "Verified"   },
  ai:      { icon: Sparkles,      color: AI,      bg: `${AI}15`,      border: `${AI}30`,      label: "AI Insight" },
};

const KPI_METRICS = [
  { label: "Active Exceptions", value: 4,  suffix: "",  delta: "+2",  up: false, severity: "danger"  as Severity },
  { label: "Monitored Vendors", value: 3,  suffix: "",  delta: "—",   up: null,  severity: "info"    as Severity },
  { label: "Avg Trust Score",   value: 72, suffix: "",  delta: "−8",  up: false, severity: "warning" as Severity },
  { label: "AI Confidence",     value: 96, suffix: "%", delta: "+1%", up: true,  severity: "success" as Severity },
];

/* ── TRUST RING ─────────────────────────────────────────── */
function TrustRing({ score, size = 48 }: { score: number; size?: number }) {
  const sw = 4; const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? SUCCESS : score >= 55 ? WARNING : DANGER;
  const ref = useRef<SVGCircleElement>(null);
  const inView = useInView(ref as any, { once: true });
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
      <motion.circle
        ref={ref} cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={inView ? { strokeDashoffset: circ - (score / 100) * circ } : {}}
        transition={{ duration: 0.9, ease: [0.16,1,0.3,1] }}
      />
    </svg>
  );
}

/* ── KPI TILE ───────────────────────────────────────────── */
function KpiTile({ m, i }: { m: typeof KPI_METRICS[0]; i: number }) {
  const s = SEVERITY_MAP[m.severity];
  const TrendIcon = m.up === true ? TrendingUp : m.up === false ? TrendingDown : null;
  const trendColor = m.up === true ? SUCCESS : m.up === false ? DANGER : BROWN_LT;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16,1,0.3,1] }}
      className="relative overflow-hidden rounded-xl border glass-panel glass-hover"
      style={{ borderColor: BORDER }}
    >
      {/* Colored top edge */}
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: s.color }} />

      <div className="p-5 pt-6">
        {/* Status pill */}
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border mb-3"
          style={{ background: s.bg, color: s.color, borderColor: s.border }}
        >
          {s.label}
        </span>

        {/* Value */}
        <div className="flex items-end justify-between">
          <span className="text-[36px] font-bold font-mono leading-none text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]">
            {m.value}{m.suffix}
          </span>
          {TrendIcon && (
            <span
              className="flex items-center gap-0.5 text-[13px] font-semibold font-mono mb-1"
              style={{ color: trendColor }}
            >
              <TrendIcon size={13} />{m.delta}
            </span>
          )}
        </div>

        {/* Label */}
        <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/50">
          {m.label}
        </p>

        {/* Animated bar */}
        <div className="mt-3 h-[3px] rounded-full overflow-hidden bg-white/5">
          <motion.div
            className="h-full rounded-full"
            style={{ background: s.color }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, m.value)}%` }}
            transition={{ duration: 0.8, delay: 0.2 + i * 0.07, ease: "easeOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ── EXCEPTION ROW ──────────────────────────────────────── */
function ExceptionRow({ decision, index, isLast }: { decision: Decision; index: number; isLast: boolean }) {
  const s = SEVERITY_MAP[decision.severity];
  const Icon = s.icon;
  const urgency = decision.urgency ?? 50;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.16,1,0.3,1] }}
    >
      <Link href={decision.href} className="group block">
        <div
          className={`relative flex ${!isLast ? "border-b" : ""} transition-colors duration-[150ms] hover:bg-white/[0.04]`}
          style={{ borderColor: BORDER }}
        >
          {/* Severity accent bar */}
          <div className="w-[3px] shrink-0 self-stretch" style={{ background: s.color }} />

          {/* Icon */}
          <div className="flex w-12 shrink-0 items-start justify-center pt-5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <Icon size={13} style={{ color: s.color }} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 py-4 pr-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: s.color }}>
                    {s.label}
                  </span>
                  {decision.trustScore !== undefined && (
                    <span className="font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${s.color}20`, color: s.color }}>
                      {decision.trustScore} trust
                    </span>
                  )}
                </div>
                <h3 className="text-[14.5px] font-semibold leading-snug text-white group-hover:text-[#C6FF33] transition-colors">
                  {decision.title}
                </h3>
                <p className="mt-0.5 text-[13px] leading-relaxed text-white/60">
                  {decision.context}
                </p>
              </div>
              {/* Urgency score */}
              <div className="shrink-0 text-right pt-0.5">
                <span className="block text-[22px] font-bold font-mono leading-none text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.15)]">{urgency}</span>
                <span className="text-[9.5px] uppercase tracking-wider text-white/40">urgency</span>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-3 h-[2px] w-full rounded-full overflow-hidden bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: s.color }}
                initial={{ width: 0 }}
                animate={{ width: `${urgency}%` }}
                transition={{ duration: 0.7, delay: index * 0.06 + 0.2, ease: "easeOut" }}
              />
            </div>

            {/* Action */}
            <div className="mt-2 flex items-center gap-1">
              <span className="text-[12px] font-semibold text-white/80 group-hover:text-[#C6FF33] transition-colors">{decision.actionLabel}</span>
              <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5 text-white/60 group-hover:text-[#C6FF33]" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── MAIN PAGE ──────────────────────────────────────────── */
export default function DashboardPage() {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() =>
    filter === "all" ? MOCK_DECISIONS : MOCK_DECISIONS.filter(d => d.severity === filter),
    [filter]
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-white/5" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-white/5 shimmer" />)}
        </div>
        <div className="h-64 rounded-xl bg-white/5 shimmer" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-8">

      {/* ── PAGE HEADER ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b"
        style={{ borderColor: BORDER }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] bg-white/5 border-white/10 text-white/80"
            >
              <Zap size={9} className="text-[#C6FF33]" /> Decision Intelligence
            </span>
            <span className="flex items-center gap-1.5 text-[12px] font-mono text-[#C6FF33] drop-shadow-[0_0_6px_rgba(198,255,51,0.2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C6FF33] animate-pulse" />
              {MOCK_DECISIONS.length} actions pending
            </span>
          </div>
          <h1 className="text-[30px] font-bold tracking-tight leading-none text-white">
            Decision Center
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">
            Real-time procurement exceptions across active subcontracts.
          </p>
        </div>

        <Link
          href="/xray"
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[14px] font-bold transition-all hover:-translate-y-0.5 btn-lime border-0"
        >
          <Search size={15} /> Run Sentinel <ArrowRight size={15} />
        </Link>
      </motion.div>

      {/* ── KPI TILES ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_METRICS.map((m, i) => <KpiTile key={m.label} m={m} i={i} />)}
      </div>

      {/* ── MAIN GRID ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── EXCEPTIONS ─────────────────────────────────── */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-xl border overflow-hidden glass-panel"
            style={{ borderColor: BORDER }}
          >
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-white/2" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-[#7D39EB]" />
                <h2 className="text-[13px] font-bold uppercase tracking-[0.09em] text-white">
                  Active Exceptions
                </h2>
                <span className="font-mono text-[12px] text-white/50">({filtered.length})</span>
              </div>

              {/* Filter tabs */}
              <div className="flex rounded-lg overflow-hidden border border-white/10" style={{ background: "rgba(255, 255, 255, 0.02)" }}>
                {(["all","danger","warning","info"] as const).map((f, i, arr) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-3 py-1.5 text-[11.5px] font-semibold transition-all duration-[120ms]"
                    style={{
                      background: filter === f ? "#7D39EB" : "transparent",
                      color: filter === f ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)",
                      borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Rows */}
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="py-16 text-center text-[14px] text-white/50">
                  No exceptions match this filter.
                </motion.div>
              ) : (
                filtered.map((d, i) => (
                  <ExceptionRow key={d.id} decision={d} index={i} isLast={i === filtered.length - 1} />
                ))
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── SIDEBAR ────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Vendor Trustline */}
          <motion.div
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-xl border overflow-hidden glass-panel"
            style={{ borderColor: BORDER }}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-white/2" style={{ borderColor: BORDER }}>
              <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-white">
                Monitored Vendors
              </span>
              <span className="font-mono text-[11px] text-white/50">
                {MOCK_VENDORS.length} active
              </span>
            </div>

            {MOCK_VENDORS.map((vendor, i) => {
              const trustColor = vendor.trustScore >= 80 ? SUCCESS : vendor.trustScore >= 55 ? WARNING : DANGER;
              return (
                <motion.div key={vendor.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 + i * 0.07 }}
                >
                  <Link
                    href={`/vendor/${vendor.id}`}
                    className="group flex items-center gap-3 px-5 py-3.5 border-b transition-all duration-[120ms] hover:bg-white/[0.04]"
                    style={{ borderColor: BORDER }}
                  >
                    <div className="relative shrink-0">
                      <TrustRing score={vendor.trustScore} size={44} />
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[11px] font-bold font-mono"
                        style={{ color: trustColor }}
                      >
                        {vendor.trustScore}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate text-white group-hover:text-[#C6FF33] transition-colors">{vendor.name}</p>
                      <p className="text-[11.5px] truncate mt-0.5 text-white/50">{vendor.category}</p>
                    </div>
                    <span
                      className="flex items-center gap-0.5 text-[12px] font-bold font-mono shrink-0"
                      style={{ color: vendor.scoreChange >= 0 ? SUCCESS : DANGER }}
                    >
                      {vendor.scoreChange >= 0 ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                      {vendor.scoreChange >= 0 ? "+" : ""}{vendor.scoreChange}
                    </span>
                  </Link>
                </motion.div>
              );
            })}

            <div className="px-5 py-2.5 flex justify-end">
              <Link href="/vendor/v1" className="flex items-center gap-1 text-[11.5px] font-semibold text-white/60 hover:text-[#C6FF33] transition-colors">
                View all vendors <ChevronRight size={12} />
              </Link>
            </div>
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-xl border overflow-hidden glass-panel"
            style={{ borderColor: BORDER }}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-white/2" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-[#C6FF33]" />
                <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-white">Audit Feed</span>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-[#C6FF33]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C6FF33] animate-pulse" /> Live
              </span>
            </div>

            <div className="scrollbar-cyber" style={{ maxHeight: 260, overflowY: "auto" }}>
              {MOCK_ACTIVITIES.map((a, i) => {
                const isSys = a.actor === "ORCHESTRA";
                return (
                  <motion.div key={a.id}
                    initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative flex items-start gap-3 px-5 py-3 border-b last:border-0"
                    style={{ borderColor: BORDER }}
                  >
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-[#7D39EB]" />
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold mt-0.5 bg-white/5 text-white border border-white/10"
                    >
                      {isSys ? <Zap size={9} className="text-[#C6FF33]" /> : a.actor.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium leading-snug text-white/90">{a.text}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-white/60">{a.actor}</span>
                        <span className="flex items-center gap-1 text-[10.5px] font-mono text-white/40">
                          <Clock size={9} />{a.timestamp}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
