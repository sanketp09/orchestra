"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  ShieldCheck, TrendingDown, TrendingUp, AlertTriangle,
  FileText, Clock, Sparkles, CheckCircle2, XCircle,
  Building2, ArrowRight, ShieldAlert, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReceiptCard } from "@/components/receipt-card";
import { MOCK_VENDORS, MOCK_TIMELINE_EVENTS } from "@/lib/mock-data";

/* ── COLOUR TOKENS ─────────────────────────────────────── */
const NAVY      = "#08070C";
const NAVY_MID  = "rgba(255, 255, 255, 0.7)";
const BEIGE     = "#7D39EB";
const CREAM     = "rgba(255, 255, 255, 0.08)";
const CANVAS    = "#08070C";
const CARD_BG   = "rgba(255, 255, 255, 0.03)";
const BORDER    = "rgba(255, 255, 255, 0.08)";
const MUTED     = "rgba(255, 255, 255, 0.45)";
const INK       = "#FFFFFF";
const SUCCESS   = "#C6FF33";
const DANGER    = "#F87171";
const WARNING   = "#FBBF24";

/* ── DATA ──────────────────────────────────────────────── */
const TRAJECTORY = [
  { month: "Nov", score: 92 },
  { month: "Dec", score: 88 },
  { month: "Jan", score: 85 },
  { month: "Feb", score: 64 },
  { month: "Mar", score: 42 },
];

const COMPLIANCE_ITEMS = [
  { check: "SAM.gov registration active status", passed: true,  detail: "Registry checked today 10:45 AM. Active through Dec 2026." },
  { check: "Lien waiver signature verified",      passed: true,  detail: "Waiver matching prime subcontract filed under PO-88213." },
  { check: "EMR Rating safety benchmark check",   passed: true,  detail: "Current rating 0.82 meets owner safety threshold (< 0.90)." },
  { check: "General umbrella COI certificate",    passed: false, detail: "Certificate expired 43 days prior on historical audit records." },
];

/* ── TRUST RING ────────────────────────────────────────── */
function TrustRing({ score, size = 96 }: { score: number; size?: number }) {
  const strokeW = 7;
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 75 ? SUCCESS : score >= 50 ? WARNING : DANGER;
  const ref = useRef<SVGCircleElement>(null);
  const inView = useInView(ref as any, { once: true });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeW} />
      <motion.circle
        ref={ref}
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={inView ? { strokeDashoffset: circ - fill } : { strokeDashoffset: circ }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

/* ── TRUST CHART ───────────────────────────────────────── */
function TrustChart({ hoveredIdx, setHoveredIdx }: {
  hoveredIdx: number | null;
  setHoveredIdx: (i: number | null) => void;
}) {
  const W = 500; const H = 160; const PAD = { t: 16, r: 20, b: 32, l: 36 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const minScore = 30; const maxScore = 100;
  const ref = useRef<SVGGElement>(null);
  const inView = useInView(ref as any, { once: true });

  const pts = TRAJECTORY.map((d, i) => ({
    x: PAD.l + (i / (TRAJECTORY.length - 1)) * chartW,
    y: PAD.t + chartH - ((d.score - minScore) / (maxScore - minScore)) * chartH,
    ...d,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length-1].x},${PAD.t+chartH} L ${pts[0].x},${PAD.t+chartH} Z`;
  const gridLines = [30, 55, 70, 85, 100];

  return (
    <div className="relative h-48 w-full select-none">
      <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="trustGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7D39EB" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#7D39EB" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {gridLines.map(val => {
          const gy = PAD.t + chartH - ((val - minScore) / (maxScore - minScore)) * chartH;
          return (
            <g key={val}>
              <line x1={PAD.l} y1={gy} x2={W-PAD.r} y2={gy} stroke={BORDER} strokeDasharray="4 4" strokeWidth="1" />
              <text x={PAD.l - 6} y={gy + 4} textAnchor="end" fill={MUTED} fontSize="10">{val}</text>
            </g>
          );
        })}

        {/* Area fill */}
        <motion.path d={areaPath} fill="url(#trustGrad)"
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }} />

        {/* Line */}
        <motion.path d={linePath} fill="none" stroke="#7D39EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 1.0, ease: "easeInOut", delay: 0.1 }}
        />

        {/* Nodes */}
        <g ref={ref}>
          {pts.map((p, i) => (
            <g key={p.month}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: "crosshair" }}
            >
              <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
              <motion.circle cx={p.x} cy={p.y} r={hoveredIdx === i ? 6 : 4}
                fill={hoveredIdx === i ? "#7D39EB" : "rgba(255, 255, 255, 0.2)"}
                stroke="#7D39EB" strokeWidth="2.5"
                initial={{ scale: 0 }}
                animate={inView ? { scale: 1 } : { scale: 0 }}
                transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 300 }}
              />
              <text x={p.x} y={PAD.t + chartH + 18} textAnchor="middle" fill={MUTED} fontSize="11" fontFamily="monospace">
                {p.month}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredIdx !== null && (
          <motion.div
            key={hoveredIdx}
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute top-1 right-2 rounded-[8px] border px-3 py-2 text-[12px] shadow-lg pointer-events-none"
            style={{ background: "#120E1C", borderColor: BORDER, color: "#fff" }}
          >
            <p className="font-bold font-mono text-[16px]">{TRAJECTORY[hoveredIdx].score}<span className="text-[11px] font-normal opacity-70">/100</span></p>
            <p className="text-[10px] opacity-70 uppercase tracking-wider">{TRAJECTORY[hoveredIdx].month} Trust Score</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── COMPLIANCE SCORE BAR ──────────────────────────────── */
function ComplianceScoreBar({ items }: { items: typeof COMPLIANCE_ITEMS }) {
  const passed = items.filter(i => i.passed).length;
  const pct = (passed / items.length) * 100;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const color = pct >= 75 ? SUCCESS : pct >= 50 ? WARNING : DANGER;
  return (
    <div ref={ref} className="rounded-[10px] border p-5 mb-4 glass-panel" style={{ borderColor: BORDER }}>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED }}>Compliance Score</p>
          <p className="text-[28px] font-bold font-mono leading-none" style={{ color }}>
            {passed}<span className="text-[16px] font-normal opacity-60">/{items.length}</span>
          </p>
        </div>
        <span className="text-[12px] font-semibold px-2.5 py-1 rounded-[6px]"
          style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
          {pct === 100 ? "Fully Compliant" : pct >= 75 ? "Minor Issues" : "Action Required"}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${pct}%` } : { width: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

/* ── MAIN PAGE ─────────────────────────────────────────── */
export default function VendorProfilePage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState<"overview" | "evidence" | "compliance" | "trend">("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const vendor = MOCK_VENDORS.find((v) => v.id === params.id) || MOCK_VENDORS[0];
  const scoreColor = vendor.trustScore >= 75 ? SUCCESS : vendor.trustScore >= 50 ? WARNING : DANGER;

  if (isLoading) {
    return (
      <div className="animate-pulse p-8 max-w-7xl mx-auto space-y-5">
        <div className="h-28 rounded-[12px]" style={{ background: "rgba(255, 255, 255, 0.05)" }} />
        <div className="h-10 rounded-[8px]" style={{ background: CREAM }} />
        <div className="h-[380px] rounded-[12px]" style={{ background: CARD_BG }} />
      </div>
    );
  }

  const TABS = ["overview", "evidence", "compliance", "trend"] as const;

  return (
    <div className="max-w-7xl mx-auto" style={{ perspective: "1200px" }}>

      {/* ── VENDOR IDENTITY HERO ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="sticky top-0 z-20 px-6 md:px-10 pt-5 pb-4 backdrop-blur-md"
        style={{ background: "rgba(8, 7, 12, 0.85)", borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          {/* Left: avatar + name */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-[12px] text-[22px] font-black border"
                style={{ background: "rgba(125, 57, 235, 0.12)", color: "#FFFFFF", borderColor: BORDER }}>
                {vendor.name.charAt(0)}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2"
                style={{
                  background: vendor.status === "verified" ? SUCCESS : DANGER,
                  borderColor: CANVAS,
                }}>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[24px] font-bold tracking-tight text-white">{vendor.name}</h1>
                <Badge variant={vendor.status === "verified" ? "success" : "danger"}>
                  {vendor.status.toUpperCase()}
                </Badge>
                {vendor.openDisputesCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[4px]"
                    style={{ background: `${WARNING}15`, color: WARNING, border: `1px solid ${WARNING}30` }}>
                    <AlertTriangle size={10} />
                    {vendor.openDisputesCount} open dispute{vendor.openDisputesCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-[12.5px] mt-0.5" style={{ color: MUTED }}>
                {vendor.category} · <span className="font-mono">{vendor.code}</span>
              </p>
            </div>
          </div>

          {/* Right: score + actions */}
          <div className="flex items-center gap-5">
            {/* Score composite */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <TrustRing score={vendor.trustScore} size={60} />
                <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold font-mono text-white">
                  {vendor.trustScore}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Trust Score</p>
                <p className="flex items-center gap-1 text-[13px] font-bold font-mono"
                  style={{ color: vendor.scoreChange >= 0 ? SUCCESS : DANGER }}>
                  {vendor.scoreChange >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {vendor.scoreChange >= 0 ? "+" : ""}{vendor.scoreChange} pts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">Generate Audit Report</Button>
              <Button size="sm"
                className="font-semibold shadow-[0_3px_12px_rgba(28,25,23,0.18)]"
                style={{ background: SUCCESS, color: "#000" } as any}>
                Contact Vendor
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── TABS ─────────────────────────────────────────── */}
      <div className="px-6 md:px-10 mt-5">
        <div className="flex gap-1 rounded-[10px] p-1.5" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="relative flex-1 rounded-[7px] py-2 text-[13px] font-semibold transition-all duration-150 whitespace-nowrap"
              style={{
                color: activeTab === tab ? "#000" : MUTED,
                background: activeTab === tab ? SUCCESS : "transparent",
              }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────── */}
      <div className="p-6 md:p-10 pt-6 space-y-6">
        <AnimatePresence mode="wait">

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <motion.div key="overview"
              initial={{ opacity: 0, y: 12, rotateX: 4 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {/* Mini KPI strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Active Contracts", value: vendor.activeContractsCount, color: INK },
                  { label: "Open Disputes",    value: vendor.openDisputesCount,    color: vendor.openDisputesCount > 0 ? WARNING : SUCCESS },
                  { label: "MSA Status",       value: vendor.msaStatus,            color: NAVY_MID, isText: true },
                ].map((item) => (
                  <div key={item.label} className="rounded-[10px] border p-4 glass-panel"
                    style={{ borderColor: BORDER }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: MUTED }}>
                      {item.label}
                    </p>
                    <p className="text-[22px] font-bold font-mono leading-none"
                      style={{ color: item.color, fontSize: (item as any).isText ? "15px" : undefined }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Chart — spans 2 cols */}
                <div className="lg:col-span-2 rounded-[12px] border overflow-hidden glass-panel"
                  style={{ borderColor: BORDER }}>
                  {/* Chart header */}
                  <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <div>
                      <h3 className="text-[14px] font-bold text-white">Historical Trust Curve</h3>
                      <p className="text-[12px] mt-0.5 text-white/50">6-month trajectory · Hover nodes for detail</p>
                    </div>
                    <span className="text-[12px] font-semibold font-mono px-2.5 py-1 rounded-[6px]"
                      style={{ background: `${scoreColor}12`, color: scoreColor, border: `1px solid ${scoreColor}25` }}>
                      {vendor.trustScore}/100
                    </span>
                  </div>
                  <div className="p-6">
                    <TrustChart hoveredIdx={hoveredIdx} setHoveredIdx={setHoveredIdx} />
                  </div>
                </div>

                {/* COI status sidebar */}
                <div className="space-y-3">
                  <div className="rounded-[12px] border overflow-hidden glass-panel" style={{ borderColor: BORDER }}>
                    <div className="px-5 py-3.5" style={{ background: "rgba(125, 57, 235, 0.12)", borderBottom: `1px solid ${BORDER}` }}>
                      <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
                        <ShieldCheck size={14} style={{ color: SUCCESS }} />
                        Compliance Quick View
                      </h3>
                    </div>
                    <div className="p-5 space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED }}>COI Status</p>
                        <p className="text-[13.5px] font-bold" style={{ color: DANGER }}>{vendor.coiStatus}</p>
                      </div>
                      <div className="border-t pt-3" style={{ borderColor: BORDER }}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED }}>Last Activity</p>
                        <p className="text-[13px] font-semibold flex items-center gap-1.5 text-white">
                          <Clock size={12} style={{ color: MUTED }} />
                          {vendor.lastActivity}
                        </p>
                      </div>
                      <div className="border-t pt-3" style={{ borderColor: BORDER }}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED }}>Score Delta</p>
                        <p className="text-[13px] font-bold font-mono flex items-center gap-1"
                          style={{ color: vendor.scoreChange >= 0 ? SUCCESS : DANGER }}>
                          {vendor.scoreChange >= 0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
                          {vendor.scoreChange >= 0 ? "+" : ""}{vendor.scoreChange} pts this week
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* EVIDENCE TAB */}
          {activeTab === "evidence" && (
            <motion.div key="evidence"
              initial={{ opacity: 0, y: 12, rotateX: 4 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[16px] font-bold text-white">Evidence Transactions</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px]"
                  style={{ background: `${DANGER}12`, color: DANGER, border: `1px solid ${DANGER}25` }}>
                  2 active flags
                </span>
              </div>
              <ReceiptCard
                title="Expired COI umbrella certificate — ABC Steel"
                subtitle="Mandatory subcontract insurance liability gap §4.2"
                badgeText="Expired" badgeVariant="danger" defaultOpen={true}
              />
              <ReceiptCard
                title="Riverside Subcontract Bid variance — ABC Steel"
                subtitle="Comparison against regional RSMeans benchmark"
                badgeText="Variance Alert" badgeVariant="warning" defaultOpen={false}
              />
            </motion.div>
          )}

          {/* COMPLIANCE TAB */}
          {activeTab === "compliance" && (
            <motion.div key="compliance"
              initial={{ opacity: 0, y: 12, rotateX: 4 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <h3 className="text-[16px] font-bold text-white">Registry Compliance Checklist</h3>
              <ComplianceScoreBar items={COMPLIANCE_ITEMS} />

              <div className="rounded-[12px] border overflow-hidden glass-panel" style={{ borderColor: BORDER }}>
                {COMPLIANCE_ITEMS.map((item, idx) => (
                  <motion.div key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08, duration: 0.3 }}
                    className="flex items-start gap-4 px-6 py-4 border-b last:border-0"
                    style={{ borderColor: BORDER }}
                  >
                    {/* Pass/fail icon */}
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ background: item.passed ? `${SUCCESS}15` : `${DANGER}12`, border: `1px solid ${item.passed ? SUCCESS : DANGER}30` }}>
                      {item.passed
                        ? <CheckCircle2 size={14} style={{ color: SUCCESS }} />
                        : <XCircle size={14} style={{ color: DANGER }} />}
                    </div>

                    <div className="flex-1">
                      <p className="text-[13.5px] font-bold text-white">{item.check}</p>
                      <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: MUTED }}>{item.detail}</p>
                    </div>

                    {/* Status tag */}
                    <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-[4px]"
                      style={{
                        background: item.passed ? `${SUCCESS}10` : `${DANGER}10`,
                        color: item.passed ? SUCCESS : DANGER,
                        border: `1px solid ${item.passed ? SUCCESS : DANGER}25`,
                      }}>
                      {item.passed ? "Passed" : "Failed"}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TREND TAB */}
          {activeTab === "trend" && (
            <motion.div key="trend"
              initial={{ opacity: 0, y: 12, rotateX: 4 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <h3 className="text-[16px] font-bold text-white">Response & Engagement Trend</h3>

              {/* Response curve card */}
              <div className="rounded-[12px] border overflow-hidden glass-panel" style={{ borderColor: BORDER }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <div>
                    <h4 className="text-[13.5px] font-bold text-white">Vendor Response Decay & Delay</h4>
                    <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>Measured against 30-day rolling window</p>
                  </div>
                  <span className="text-[12px] font-semibold font-mono px-2.5 py-1 rounded-[6px]"
                    style={{ background: `${SUCCESS}12`, color: SUCCESS, border: `1px solid ${SUCCESS}25` }}>
                    Median 2.1 hrs
                  </span>
                </div>
                <div className="p-6">
                  <div className="relative h-44 w-full">
                    <svg className="h-full w-full overflow-visible" viewBox="0 0 500 130">
                      <defs>
                        <linearGradient id="responseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={SUCCESS} stopOpacity="0.18" />
                          <stop offset="100%" stopColor={SUCCESS} stopOpacity="0.01" />
                        </linearGradient>
                      </defs>
                      {[20, 65, 110].map(y => (
                        <line key={y} x1="20" y1={y} x2="490" y2={y} stroke={BORDER} strokeDasharray="4 3" strokeWidth="1" />
                      ))}
                      <text x="12" y="24" textAnchor="end" fill={MUTED} fontSize="10">4h</text>
                      <text x="12" y="69" textAnchor="end" fill={MUTED} fontSize="10">2h</text>
                      <text x="12" y="114" textAnchor="end" fill={MUTED} fontSize="10">0h</text>

                      <motion.path
                        d="M 20,110 Q 120,100 180,60 T 320,30 T 490,20"
                        fill="url(#responseGrad)"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                      />
                      <motion.path
                        d="M 20,110 Q 120,100 180,60 T 320,30 T 490,20"
                        fill="none" stroke={SUCCESS} strokeWidth="2.5" strokeLinecap="round"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                        transition={{ duration: 1.0, ease: "easeInOut" }}
                      />
                      <circle cx="250" cy="48" r="5" fill={SUCCESS} />
                      <text x="260" y="44" fill={INK} fontSize="10" fontWeight="bold" fontFamily="monospace">Median 2.1 hrs</text>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Trend data table */}
              <div className="rounded-[12px] border overflow-hidden glass-panel" style={{ borderColor: BORDER }}>
                <div className="px-6 py-3.5" style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${BORDER}` }}>
                  <h4 className="text-[13px] font-bold text-white">Monthly Breakdown</h4>
                </div>
                <div className="divide-y" style={{ borderColor: BORDER }}>
                  {TRAJECTORY.map((pt, i) => {
                    const prevScore = i > 0 ? TRAJECTORY[i - 1].score : pt.score;
                    const delta = pt.score - prevScore;
                    return (
                      <motion.div key={pt.month}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07, duration: 0.3 }}
                        className="flex items-center justify-between px-6 py-3.5"
                      >
                        <span className="text-[13px] font-semibold font-mono text-white/50">{pt.month} 2026</span>
                        <div className="flex items-center gap-4">
                          <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <motion.div className="h-full rounded-full"
                              style={{ background: pt.score >= 75 ? SUCCESS : pt.score >= 50 ? WARNING : DANGER }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pt.score}%` }}
                              transition={{ duration: 0.7, delay: 0.2 + i * 0.07 }}
                            />
                          </div>
                          <span className="text-[13.5px] font-bold font-mono w-12 text-right text-white">{pt.score}</span>
                          {i > 0 && (
                            <span className="text-[11.5px] font-mono w-10 text-right flex items-center gap-0.5"
                              style={{ color: delta >= 0 ? SUCCESS : DANGER }}>
                              {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                              {delta >= 0 ? "+" : ""}{delta}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
