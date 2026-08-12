"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Truck, CloudSun, Scale, Sparkles, ShieldCheck, AlertCircle, HelpCircle, type LucideIcon } from "lucide-react";

/* ── PALETTE ─────────────────────────────────────────────── */
const INK      = "#291C0E";
const BROWN_MD = "#6E473B";
const BROWN_LT = "#A78D78";
const CREAM    = "#E1D4C2";
const RECESSED = "#EDE6DC";
const CANVAS   = "#F5F0EB";
const SURFACE  = "#FBF8F5";
const BORDER   = "#D9CEBD";
const SUCCESS  = "#3A6A4E";

export interface ReceiptStage {
  step: number;
  node: string;
  title: string;
  icon?: LucideIcon;
  detail: string;
  confidence: string;
}

interface ReceiptCardProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeVariant?: "neutral" | "success" | "warning" | "danger" | "info" | "ai";
  stages?: ReceiptStage[];
  defaultOpen?: boolean;
}

const DEFAULT_STAGES: ReceiptStage[] = [
  { step: 1, node: "Contract",  icon: FileText, title: "1. Contract & Subcontract Terms (§7.2)",    detail: "Master Agreement required $2.0M GL coverage & Net-30 payment terms.",               confidence: "99%" },
  { step: 2, node: "Invoice",   icon: Scale,    title: "2. Submitted Invoice & Pricing Line Items", detail: "Line item #882 switchgear quoted at $282,000 (+18% above regional baseline).",   confidence: "94%" },
  { step: 3, node: "Shipment",  icon: Truck,    title: "3. Shipment & GPS Manifest Log",            detail: "Chiller unit departed origin distribution warehouse 6 days behind PO date.",     confidence: "91%" },
  { step: 4, node: "Weather",   icon: CloudSun, title: "4. On-Site Inspection & Local Weather Audit",detail: "Site 4 crane stand-down correlated with 34 knot gust event on audit log.",    confidence: "98%" },
  { step: 5, node: "Decision",  icon: Sparkles, title: "5. ORCHESTRA Final AI Recommendation",      detail: "Hold payment release until COI renewal & renegotiate $44k switchgear variance.", confidence: "96.4%" },
];

const NODE_ICONS: Record<string, LucideIcon> = {
  contract: FileText, invoice: Scale, shipment: Truck,
  weather: CloudSun,  decision: Sparkles, ai: Sparkles,
  verify: ShieldCheck, alert: AlertCircle,
};

const BADGE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  success: { bg: "#3A6A4E14", color: "#3A6A4E", border: "#3A6A4E28" },
  warning: { bg: "#B8873A14", color: "#B8873A", border: "#B8873A28" },
  danger:  { bg: "#A6432F14", color: "#A6432F", border: "#A6432F28" },
  info:    { bg: "#4A6B7C14", color: "#4A6B7C", border: "#4A6B7C28" },
  ai:      { bg: "#6B5A7A14", color: "#6B5A7A", border: "#6B5A7A28" },
  neutral: { bg: "#291C0E0A", color: "#6E473B", border: "#D9CEBD"   },
};

export function ReceiptCard({
  title,
  subtitle,
  badgeText = "AI Verified",
  badgeVariant = "ai",
  stages = DEFAULT_STAGES,
  defaultOpen = false,
}: ReceiptCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const bs = BADGE_STYLES[badgeVariant] ?? BADGE_STYLES.neutral;

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all duration-200"
      style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 1px 4px rgba(41,28,14,0.07)" }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-5 text-left transition-colors"
        onMouseEnter={e => { e.currentTarget.style.background = `${INK}04`; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles size={13} style={{ color: BROWN_MD }} />
            <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: BROWN_MD }}>
              Interactive Evidence Receipt
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider border"
              style={{ background: bs.bg, color: bs.color, borderColor: bs.border }}
            >
              {badgeText}
            </span>
          </div>
          <h4 className="text-[15px] font-bold tracking-tight" style={{ color: INK }}>{title}</h4>
          {subtitle && <p className="text-[13px]" style={{ color: BROWN_LT }}>{subtitle}</p>}
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ml-4"
          style={{ borderColor: BORDER, color: BROWN_MD }}
        >
          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="text-[14px] font-bold leading-none">
            ↓
          </motion.span>
        </div>
      </button>

      {/* Unfolding chain */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="border-t overflow-hidden"
            style={{ borderColor: BORDER }}
          >
            <div className="relative p-6 pl-12 space-y-5"
              style={{
                background: CANVAS,
                borderLeft: `1px solid ${BORDER}`,
              }}
            >
              {/* Vertical connector */}
              <div className="absolute left-[27px] top-6 bottom-6 w-px" style={{ background: BORDER }} />

              {stages.map((stage, idx) => {
                const NodeIcon = stage.icon ?? NODE_ICONS[stage.node.toLowerCase()] ?? HelpCircle;
                return (
                  <motion.div
                    key={stage.step}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.12, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="relative"
                  >
                    {/* Node dot */}
                    <div
                      className="absolute -left-[30px] top-[6px] flex h-5 w-5 items-center justify-center rounded-full border"
                      style={{ background: SURFACE, borderColor: BROWN_MD }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: BROWN_MD }} />
                    </div>

                    <div
                      className="rounded-lg border p-3.5 transition-colors"
                      style={{ background: SURFACE, borderColor: BORDER }}
                      onMouseEnter={e => { e.currentTarget.style.background = RECESSED; }}
                      onMouseLeave={e => { e.currentTarget.style.background = SURFACE; }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <NodeIcon size={14} style={{ color: BROWN_MD, flexShrink: 0 }} />
                          <span className="text-[13.5px] font-bold" style={{ color: INK }}>{stage.title}</span>
                        </div>
                        <span
                          className="shrink-0 text-[11px] font-mono font-semibold px-2 py-0.5 rounded"
                          style={{ background: `${SUCCESS}14`, color: SUCCESS }}
                        >
                          {stage.confidence}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed pl-5" style={{ color: BROWN_MD }}>
                        {stage.detail}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
