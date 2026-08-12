"use client";

import { useMemo, useState, useRef } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import {
  Search, FileText, FileStack, ScanLine,
  ChevronRight, ShieldCheck, AlertCircle, Sparkles,
  Truck, CloudSun, Scale,
} from "lucide-react";
import { MOCK_EVIDENCE } from "@/lib/mock-data";
import { EvidenceItem } from "@/types";

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

const SUCCESS  = "#C6FF33";  /* Lime */
const WARNING  = "#FBBF24";  /* Amber */
const DANGER   = "#F87171";  /* Red */
const AI       = "#7D39EB";  /* Violet */

const TYPE_ICON: Record<string, typeof FileText> = {
  document: FileText, invoice: Scale, inspection: ScanLine,
  dispute: AlertCircle, manifest: Truck,
};

const DEFAULT_STAGES = [
  { step: 1, icon: FileText, node: "Contract",  title: "Contract & Subcontract Terms (§7.2)",     detail: "Master Agreement required $2.0M GL coverage & Net-30 payment terms.",               confidence: 99 },
  { step: 2, icon: Scale,    node: "Invoice",   title: "Submitted Invoice & Pricing Line Items",   detail: "Line item #882 switchgear quoted at $282,000 (+18% above regional baseline).",   confidence: 94 },
  { step: 3, icon: Truck,    node: "Shipment",  title: "Shipment & GPS Manifest Log",              detail: "Chiller unit departed origin distribution warehouse 6 days behind PO date.",     confidence: 91 },
  { step: 4, icon: CloudSun, node: "Weather",   title: "On-Site Inspection & Local Weather Audit", detail: "Site 4 crane stand-down correlated with 34 knot gust event on audit log.",      confidence: 98 },
  { step: 5, icon: Sparkles, node: "Decision",  title: "ORCHESTRA Final AI Recommendation",        detail: "Hold payment release until COI renewal & renegotiate $44k switchgear variance.", confidence: 96 },
];

function ConfBar({ pct, color }: { pct: number; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${pct}%` } : { width: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10.5px] font-bold font-mono shrink-0" style={{ color }}>{pct}%</span>
    </div>
  );
}

function ProofChain({ item }: { item: EvidenceItem }) {
  const statusColor = item.status === "verified" ? SUCCESS : DANGER;
  const statusLabel = item.status === "verified" ? "AI Verified" : "Audit Exception";
  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border overflow-hidden glass-panel"
      style={{ borderColor: BORDER }}
    >
      {/* Header band — dark ink */}
      <div className="px-5 py-4 border-b flex items-start justify-between gap-4"
        style={{ background: "rgba(0, 0, 0, 0.35)", borderColor: BORDER }}>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
              style={{ background: `${statusColor}25`, color: statusColor }}>
              {statusLabel}
            </span>
            <span className="text-[10.5px] font-mono text-white/50">{item.source}</span>
          </div>
          <h3 className="text-[15px] font-bold text-white leading-snug">{item.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: BROWN_MD }}>{item.summary}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[28px] font-bold font-mono leading-none" style={{ color: SUCCESS }}>
            {item.confidencePct}
          </span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: BROWN_LT }}>confidence</span>
        </div>
      </div>

      {/* Proof chain */}
      <div className="px-5 py-4" style={{ background: SURFACE }}>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] mb-4" style={{ color: BROWN_LT }}>
          Proof Chain · {DEFAULT_STAGES.length} nodes verified
        </p>
        <div className="relative">
          <div className="absolute left-[17px] top-5 bottom-5 w-[1px]" style={{ background: BORDER }} />
          <div className="space-y-0">
            {DEFAULT_STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const nodeColor = i === DEFAULT_STAGES.length - 1 ? AI : "rgba(255, 255, 255, 0.1)";
              const iconColor = i === DEFAULT_STAGES.length - 1 ? "#FFFFFF" : SUCCESS;
              return (
                <motion.div key={stage.step}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.3 }}
                  className="relative flex gap-4 pb-5 last:pb-0"
                >
                  <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white border"
                    style={{ background: nodeColor, borderColor: BORDER }}>
                    <Icon size={14} style={{ color: iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-0.5" style={{ color: BROWN_LT }}>{stage.node}</p>
                        <p className="text-[14px] font-semibold leading-snug text-white">{stage.title}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: BROWN_MD }}>{stage.detail}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold font-mono px-2 py-0.5 rounded mt-0.5 border"
                        style={{ background: "rgba(198, 255, 51, 0.08)", color: SUCCESS, borderColor: "rgba(198, 255, 51, 0.2)" }}>{stage.confidence}%</span>
                    </div>
                    {i < DEFAULT_STAGES.length - 1 && (
                      <div className="mt-4 h-px" style={{ background: BORDER }} />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: BORDER, background: "rgba(0,0,0,0.15)" }}>
        <span className="text-[11.5px] font-mono" style={{ color: BROWN_LT }}>{item.date} · {item.source}</span>
        <button className="flex items-center gap-1 text-[12.5px] font-semibold hover:text-white transition-colors" style={{ color: BROWN_MD }}>
          Full audit trail <ChevronRight size={13} />
        </button>
      </div>
    </motion.div>
  );
}

export default function EvidencePage() {
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EvidenceItem | null>(MOCK_EVIDENCE[0]);

  const filtered = useMemo(() =>
    MOCK_EVIDENCE.filter(item => {
      const matchF = filter === "all" || item.status === filter;
      const matchQ = item.title.toLowerCase().includes(query.toLowerCase()) ||
                     item.summary.toLowerCase().includes(query.toLowerCase());
      return matchF && matchQ;
    }),
    [filter, query]
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="px-6 md:px-10 pt-8 pb-5 border-b"
        style={{ borderColor: BORDER }}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded border"
                style={{ background: "rgba(125, 57, 235, 0.1)", borderColor: "rgba(125, 57, 235, 0.25)", color: "#A855F7" }}>
                Receipt &amp; Evidence Center
              </span>
              <span className="text-[12px] font-mono" style={{ color: BROWN_LT }}>Every number has receipts.</span>
            </div>
            <h1 className="text-[30px] font-bold tracking-tight leading-none text-white">Evidence Explorer</h1>
            <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: BROWN_MD }}>
              Unfold connected proof chains from contracts, manifests, and site logs.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: BROWN_LT }} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search evidence records…"
              className="w-full rounded-lg border pl-9 pr-4 py-2 text-[13.5px] outline-none transition-colors"
              style={{ background: SURFACE, borderColor: BORDER, color: INK }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(125, 57, 235, 0.5)")}
              onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
            />
          </div>
        </div>
      </motion.div>

      {/* Body — two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-5 divide-x" style={{ borderColor: BORDER }}>

        {/* LEFT — file list */}
        <div className="lg:col-span-2 pr-0 lg:pr-6">
          <div className="flex border-b" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-1 px-4 py-2.5 border-r" style={{ borderColor: BORDER }}>
              <FileStack size={13} style={{ color: BROWN_LT }} />
              <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: BROWN_LT }}>
                Records ({filtered.length})
              </span>
            </div>
            <div className="flex flex-1">
              {(["all", "verified", "flagged"] as const).map((f, i, arr) => (
                <button key={f} onClick={() => setFilter(f)}
                  className="flex-1 py-2.5 text-[12px] font-semibold border-b-2 transition-all"
                  style={{
                    color: filter === f ? SUCCESS : BROWN_LT,
                    borderBottomColor: filter === f ? SUCCESS : "transparent",
                    borderRight: i < arr.length - 1 ? `1px solid ${BORDER}` : "none",
                  }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-[14px]" style={{ color: BROWN_LT }}>No evidence items match.</div>
            ) : filtered.map((item, i) => {
              const isSelected = selected?.id === item.id;
              const TypeIcon = TYPE_ICON[item.type] ?? FileText;
              const statusColor = item.status === "verified" ? SUCCESS : DANGER;
              return (
                <motion.button key={item.id} onClick={() => setSelected(item)}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="group w-full text-left relative border rounded-xl overflow-hidden transition-all duration-200"
                  style={{
                    borderColor: isSelected ? SUCCESS : BORDER,
                    background: isSelected ? "rgba(198, 255, 51, 0.04)" : "rgba(255, 255, 255, 0.01)"
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.01)"; }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ background: isSelected ? SUCCESS : "transparent" }} />
                  <div className="flex items-start gap-3 px-5 py-4 pl-6">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5"
                      style={{ background: `${statusColor}12`, border: `1px solid ${statusColor}28` }}>
                      <TypeIcon size={15} style={{ color: statusColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: statusColor }}>{item.status}</span>
                        <span className="text-[11px] font-mono shrink-0" style={{ color: BROWN_LT }}>{item.date}</span>
                      </div>
                      <p className="text-[13.5px] font-semibold leading-snug text-white">{item.title}</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed line-clamp-2" style={{ color: BROWN_MD }}>{item.summary}</p>
                      <ConfBar pct={item.confidencePct} color={statusColor} />
                    </div>
                    <ChevronRight size={14} className="shrink-0 mt-3 transition-transform group-hover:translate-x-0.5"
                      style={{ color: isSelected ? SUCCESS : BORDER }} />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* RIGHT — proof chain */}
        <div className="lg:col-span-3 pl-0 lg:pl-6 mt-6 lg:mt-0">
          <div className="sticky top-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: BORDER }}>
              <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: BROWN_LT }}>
                Unfolded Proof Chain
              </span>
              {selected && <span className="text-[11px] font-mono text-white/40">· {DEFAULT_STAGES.length} nodes</span>}
            </div>
            <AnimatePresence mode="wait">
              {selected ? (
                <ProofChain key={selected.id} item={selected} />
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="py-24 text-center border rounded-xl glass-panel" style={{ borderColor: BORDER }}>
                  <FileStack size={28} className="mx-auto mb-3 text-white/30 animate-pulse" />
                  <p className="text-[14px]" style={{ color: BROWN_LT }}>Select a record to inspect its proof chain.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
