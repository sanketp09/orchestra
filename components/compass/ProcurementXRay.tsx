import React, { useEffect, useMemo, useState } from "react";
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
  mutedForeground: "rgba(245, 243, 239, 0.45)",
  accent: "#7D39EB",
  surfaceCard: "#120E1C",
  surfaceFloating: "#1C172E",
  success: "#C6FF33",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#60A5FA",
  ai: "#7D39EB",
} as const;

const shadowEmboss = "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)";
const shadowLg = "0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.12)";

// ---------------------------------------------------------------------------
// Types (mirrors procurement_xray.py's Finding / XRayResult shapes)
// ---------------------------------------------------------------------------
type FindingType = "scope_gap" | "price_anomaly" | "clause_risk" | "vendor_risk" | "dependency_risk";
type Verdict = "confirmed" | "likely" | "watch";
type Impact = "low" | "medium" | "high";
type Layer = "scope" | "price" | "clauses" | "vendor" | "history" | "dependencies";

interface EvidenceItem {
  source: string;
  reliabilityTier: "self_reported" | "third_party_observed" | "verified_transaction";
  timestamp: string;
  rawRef: string;
}

interface Finding {
  id: string;
  type: FindingType;
  claim: string;
  verdict: Verdict;
  confidence: number;
  impact: Impact;
  estimatedCostUsd: number | null;
  recommendation: string;
  layer: Layer;
  documentRef: string;
  evidence: EvidenceItem[];
  reasoning: string;
  needsHuman: boolean;
}

const LAYERS: { id: Layer; label: string }[] = [
  { id: "scope", label: "SCOPE" },
  { id: "price", label: "PRICE" },
  { id: "clauses", label: "CLAUSES" },
  { id: "vendor", label: "VENDOR" },
  { id: "history", label: "HISTORY" },
  { id: "dependencies", label: "DEPENDENCIES" },
];

// ---------------------------------------------------------------------------
// Mock document + result — mirrors what procurement_xray.py would return
// ---------------------------------------------------------------------------
const MOCK_DOCUMENT_NAME = "Meridian_Steel_Quote_BlockC.pdf";

const MOCK_DOCUMENT_LINES = [
  { id: "l1", text: "VENDOR: Meridian Steel Fabrication — Structural Steel Package", highlightLayer: "vendor" as Layer },
  { id: "l2", text: "Scope: Structural steel columns, beams, base plates, erection & installation", highlightLayer: "scope" as Layer },
  { id: "l3", text: "Unit Price — Structural Steel Columns: $3,190 / ton", highlightLayer: "price" as Layer },
  { id: "l4", text: "Unit Price — Structural Steel Beams: $2,690 / ton", highlightLayer: "price" as Layer },
  { id: "l5", text: "Payment Terms: Net 60 from invoice date", highlightLayer: "clauses" as Layer },
  { id: "l6", text: "Dependency: Erection sequenced after Block C foundation pour", highlightLayer: "dependencies" as Layer },
  { id: "l7", text: "Delivery target: 2026-08-25", highlightLayer: "history" as Layer },
];

const MOCK_FINDINGS: Finding[] = [
  {
    id: "finding_scope_anchor_bolts",
    type: "scope_gap",
    claim: "'anchor bolts' is missing from the submitted scope.",
    verdict: "confirmed",
    confidence: 0.94,
    impact: "high",
    estimatedCostUsd: 38,
    recommendation: "Request the vendor confirm 'anchor bolts' is included or issue a scope clarification before award.",
    layer: "scope",
    documentRef: "Compared against S-402 Rev C — Block C Structural Steel Package",
    evidence: [
      {
        source: "project_boq",
        reliabilityTier: "verified_transaction",
        timestamp: "2026-08-11T10:00:00Z",
        rawRef: "S-402 Rev C: required item 'anchor bolts' not found in submitted scope",
      },
    ],
    reasoning:
      "The project BOQ (S-402 Rev C) requires 'anchor bolts', but it does not appear anywhere in the submitted document's extracted scope items.",
    needsHuman: false,
  },
  {
    id: "finding_price_structural_steel_columns",
    type: "price_anomaly",
    claim: "'structural steel columns' is quoted 11.9% above the portfolio benchmark.",
    verdict: "confirmed",
    confidence: 0.9,
    impact: "medium",
    estimatedCostUsd: 340,
    recommendation: "Request pricing justification or benchmark against a second bid before proceeding.",
    layer: "price",
    documentRef: "Quoted unit price: $3,190.00 per ton",
    evidence: [
      {
        source: "portfolio_price_benchmark",
        reliabilityTier: "verified_transaction",
        timestamp: "2026-08-11T10:00:00Z",
        rawRef: "Benchmark for 'structural steel columns': $2,850.00 per ton",
      },
    ],
    reasoning:
      "Quoted price of $3,190.00 deviates +11.9% from the $2,850.00 portfolio benchmark for 'structural steel columns', exceeding the 12% anomaly threshold.",
    needsHuman: false,
  },
  {
    id: "finding_clause_payment_terms_net_60",
    type: "clause_risk",
    claim: "Extended payment terms clause detected.",
    verdict: "likely",
    confidence: 0.72,
    impact: "medium",
    estimatedCostUsd: null,
    recommendation: "Negotiate this clause or flag it for legal review before signing.",
    layer: "clauses",
    documentRef: 'Clause: "payment terms: net 60"',
    evidence: [
      {
        source: "historical_clause_risk_library",
        reliabilityTier: "verified_transaction",
        timestamp: "2026-08-11T10:00:00Z",
        rawRef: "34% historical dispute rate for this clause pattern",
      },
    ],
    reasoning:
      "Net-60 terms have preceded a cash-flow-related dispute in 34% of past contracts carrying this clause on this portfolio.",
    needsHuman: false,
  },
  {
    id: "finding_vendor_trust_decline",
    type: "vendor_risk",
    claim: "Meridian Steel Fabrication's trust score has dropped 6 points recently.",
    verdict: "confirmed",
    confidence: 0.88,
    impact: "medium",
    estimatedCostUsd: null,
    recommendation: "Review the vendor's Trustline profile before proceeding; consider a comparison bid.",
    layer: "vendor",
    documentRef: "Vendor: Meridian Steel Fabrication",
    evidence: [
      {
        source: "trustline_vendor_profile",
        reliabilityTier: "third_party_observed",
        timestamp: "2026-08-11T10:00:00Z",
        rawRef: "Trust score 76, delta -6",
      },
      {
        source: "trustline_evidence_event",
        reliabilityTier: "verified_transaction",
        timestamp: "2026-03-14T00:00:00Z",
        rawRef: "Delivery ticket 6 days late",
      },
      {
        source: "trustline_evidence_event",
        reliabilityTier: "third_party_observed",
        timestamp: "2026-06-20T00:00:00Z",
        rawRef: "UCC filing appeared against entity",
      },
    ],
    reasoning:
      "Meridian Steel Fabrication's trust score fell from a recent high, coinciding with a late delivery and a new UCC filing.",
    needsHuman: false,
  },
  {
    id: "finding_dependency_erection",
    type: "dependency_risk",
    claim:
      "'structural steel erection' is dependent on 'concrete foundation pour (Block C)', which is currently delayed 5 days.",
    verdict: "likely",
    confidence: 0.82,
    impact: "high",
    estimatedCostUsd: null,
    recommendation: "Adjust the delivery schedule for this line item or negotiate a float buffer before committing.",
    layer: "dependencies",
    documentRef: "Dependency: structural steel erection → concrete foundation pour (Block C)",
    evidence: [
      {
        source: "procurement_dependency_graph",
        reliabilityTier: "third_party_observed",
        timestamp: "2026-08-11T10:00:00Z",
        rawRef: "concrete foundation pour (Block C): delayed 5 days (scheduled 2026-08-25)",
      },
    ],
    reasoning:
      "'structural steel erection' cannot proceed on schedule until 'concrete foundation pour (Block C)' completes, and that dependency is currently delayed 5 days.",
    needsHuman: true,
  },
];

const IMPACT_COLOR: Record<Impact, string> = {
  high: tokens.danger,
  medium: tokens.warning,
  low: tokens.info,
};

const TYPE_LABEL: Record<FindingType, string> = {
  scope_gap: "Scope Gap",
  price_anomaly: "Unusual Price",
  clause_risk: "High-Risk Clause",
  vendor_risk: "Vendor Risk",
  dependency_risk: "Dependency Risk",
};

type ScreenState = "idle" | "scanning" | "results";

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------
export default function ProcurementXRay({ data }: { data?: any }) {
  const [screen, setScreen] = useState<ScreenState>("idle");
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [revealedFindings, setRevealedFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const findings = useMemo(() => {
    if (!data?.findings) return MOCK_FINDINGS;
    return data.findings.map((f: any) => ({
      id: f.id,
      type: f.type,
      claim: f.claim,
      verdict: f.verdict,
      confidence: f.confidence,
      impact: f.impact,
      estimatedCostUsd: f.estimated_cost_usd ?? null,
      recommendation: f.recommendation,
      layer: f.layer,
      documentRef: f.document_ref ?? "",
      evidence: (f.evidence || []).map((e: any) => ({
        source: e.source,
        reliabilityTier: e.reliability_tier || e.reliabilityTier,
        timestamp: e.timestamp,
        rawRef: e.raw_ref || e.rawRef,
      })),
      reasoning: f.reasoning,
      needsHuman: f.needs_human ?? f.needsHuman ?? false,
    }));
  }, [data]);

  const documentName = data?.document_name ?? MOCK_DOCUMENT_NAME;

  const startScan = () => {
    setScreen("scanning");
    setActiveLayerIndex(0);
    setRevealedFindings([]);
  };

  useEffect(() => {
    if (screen !== "scanning") return;

    const layerInterval = setInterval(() => {
      setActiveLayerIndex((i) => (i < LAYERS.length - 1 ? i + 1 : i));
    }, 480);

    // Reveal findings progressively as their layer gets scanned.
    const findingTimers = findings.map((finding: any, idx: number) =>
      window.setTimeout(() => {
        setRevealedFindings((prev) => [...prev, finding]);
      }, 700 + idx * 480)
    );

    const finishTimer = window.setTimeout(() => {
      setScreen("results");
    }, 700 + findings.length * 480 + 500);

    return () => {
      clearInterval(layerInterval);
      findingTimers.forEach(window.clearTimeout);
      window.clearTimeout(finishTimer);
    };
  }, [screen, findings]);

  const futureDisputes = findings.filter(
    (f: any) => f.impact === "high" || (f.type === "clause_risk" && f.needsHuman)
  ).length;

  return (
    <div
      className="min-h-full w-full p-6"
      style={{ background: tokens.background, color: tokens.foreground, fontFamily: "Inter, sans-serif" }}
    >
      <div className="max-w-7xl mx-auto">
        <PageHeader screen={screen} onStart={startScan} />

        {screen === "idle" && <IdleUploadState onStart={startScan} />}

        {(screen === "scanning" || screen === "results") && (
          <div className="grid gap-4" style={{ gridTemplateColumns: "280px 1fr 340px" }}>
            <DocumentPreviewPanel
              activeLayer={screen === "scanning" ? LAYERS[activeLayerIndex].id : null}
              scanning={screen === "scanning"}
            />
            <XRayScanPanel screen={screen} activeLayerIndex={activeLayerIndex} findings={findings} />
            <FindingsPanel
              screen={screen}
              revealedFindings={screen === "scanning" ? revealedFindings : findings}
              onSelect={setSelectedFinding}
            />
          </div>
        )}

        <AnimatePresence>
          {screen === "results" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-4"
            >
              <DisputeBanner count={futureDisputes} onSelectFirst={() => setSelectedFinding(findings.find((f: any) => f.impact === "high") ?? null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <EvidenceDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function PageHeader({ screen, onStart }: { screen: ScreenState; onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-center justify-between mb-5"
    >
      <div>
        <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
          Sentinel · Procurement X-Ray
        </span>
        <h1 className="text-2xl font-semibold mt-1" style={{ color: tokens.foreground }}>
          What problems will this decision create before you commit?
        </h1>
      </div>
      {screen !== "idle" && (
        <Button
          onClick={onStart}
          className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: tokens.accent, color: tokens.surfaceFloating, borderRadius: 10 }}
        >
          Re-scan document
        </Button>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Idle upload state
// ---------------------------------------------------------------------------
function IdleUploadState({ onStart }: { onStart: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div
        className="flex flex-col items-center justify-center gap-4 p-16 text-center"
        style={{
          background: tokens.surfaceCard,
          borderRadius: 12,
          boxShadow: shadowEmboss,
          border: `1.5px dashed ${tokens.muted}`,
        }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: tokens.muted }}
        >
          <span style={{ color: tokens.accent, fontSize: 22, fontWeight: 700 }}>X</span>
        </div>
        <div>
          <p className="text-base font-medium" style={{ color: tokens.foreground }}>
            Upload a vendor quote, draft contract, proposal, or scope document
          </p>
          <p className="text-sm mt-1" style={{ color: tokens.mutedForeground }}>
            Sentinel will x-ray it against drawings, BOQ, vendor history, and pricing evidence.
          </p>
        </div>
        <Button
          onClick={onStart}
          className="mt-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: tokens.accent, color: tokens.surfaceFloating, borderRadius: 10 }}
        >
          Analyze {MOCK_DOCUMENT_NAME}
        </Button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// LEFT — document preview, with signature "x-ray" highlight
// ---------------------------------------------------------------------------
function DocumentPreviewPanel({ activeLayer, scanning }: { activeLayer: Layer | null; scanning: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4"
      style={{ background: tokens.surfaceCard, borderRadius: 12, boxShadow: shadowEmboss }}
    >
      <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
        Document
      </span>
      <p className="text-sm font-medium mt-1 mb-3 truncate" style={{ color: tokens.foreground }}>
        {MOCK_DOCUMENT_NAME}
      </p>
      <div
        className="p-3 space-y-2.5 text-xs leading-relaxed"
        style={{ background: tokens.surfaceFloating, borderRadius: 10, border: `1px solid ${tokens.muted}` }}
      >
        {MOCK_DOCUMENT_LINES.map((line) => {
          const isHighlighted = scanning && activeLayer === line.highlightLayer;
          return (
            <motion.div
              key={line.id}
              animate={{
                backgroundColor: isHighlighted ? "rgba(125,57,235,0.16)" : "rgba(125,57,235,0)",
                borderColor: isHighlighted ? tokens.accent : "rgba(0,0,0,0)",
              }}
              transition={{ duration: 0.3 }}
              className="px-2 py-1.5 rounded-md border"
              style={{ color: tokens.foreground }}
            >
              {line.text}
              {isHighlighted && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="block mt-1 text-[10px] font-medium"
                  style={{ color: tokens.accent }}
                >
                  Deviation detected
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// CENTER — animated x-ray scan through layers
// ---------------------------------------------------------------------------
function XRayScanPanel({
  screen,
  activeLayerIndex,
  findings,
}: {
  screen: ScreenState;
  activeLayerIndex: number;
  findings: Finding[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="p-5 flex flex-col"
      style={{
        background: tokens.surfaceCard,
        borderRadius: 12,
        boxShadow: shadowLg,
        backdropFilter: "blur(12px)",
        border: `1px solid ${tokens.muted}`,
        minHeight: 480,
      }}
    >
      <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
        {screen === "scanning" ? "Scanning…" : "Scan complete"}
      </span>

      {/* Layer stack visualization */}
      <div className="relative flex-1 flex items-center justify-center py-6">
        <div className="relative w-full max-w-[220px] aspect-square">
          {LAYERS.map((layer, i) => {
            const passed = screen === "results" || i < activeLayerIndex;
            const active = screen === "scanning" && i === activeLayerIndex;
            return (
              <motion.div
                key={layer.id}
                className="absolute inset-0 rounded-xl border flex items-center justify-center"
                style={{
                  borderColor: active ? tokens.accent : tokens.muted,
                  background: passed || active ? "rgba(125,57,235,0.06)" : "transparent",
                  transform: `translate(${i * 6}px, ${i * 6}px)`,
                  zIndex: LAYERS.length - i,
                }}
                animate={{
                  opacity: passed || active ? 1 : 0.35,
                  scale: active ? 1.03 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                {active && (
                  <motion.div
                    className="absolute inset-x-0"
                    style={{ height: 2, background: tokens.accent, boxShadow: `0 0 8px ${tokens.accent}` }}
                    initial={{ top: "0%" }}
                    animate={{ top: "100%" }}
                    transition={{ duration: 0.48, ease: "linear" }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Layer labels */}
      <div className="flex items-center justify-between gap-1">
        {LAYERS.map((layer, i) => {
          const passed = screen === "results" || i < activeLayerIndex;
          const active = screen === "scanning" && i === activeLayerIndex;
          return (
            <div key={layer.id} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: passed ? tokens.success : active ? tokens.accent : tokens.muted,
                }}
              />
              <span
                className="text-[9px] tracking-wide text-center truncate w-full"
                style={{ color: passed || active ? tokens.foreground : tokens.mutedForeground }}
              >
                {layer.label}
              </span>
            </div>
          );
        })}
      </div>

      {screen === "results" && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs text-center mt-4"
          style={{ color: tokens.mutedForeground }}
        >
          {findings.length} findings across {LAYERS.length} layers
        </motion.p>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// RIGHT — risk findings, appearing dynamically, clickable
// ---------------------------------------------------------------------------
function FindingsPanel({
  screen,
  revealedFindings,
  onSelect,
}: {
  screen: ScreenState;
  revealedFindings: Finding[];
  onSelect: (f: Finding) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="p-4 flex flex-col"
      style={{ background: tokens.surfaceCard, borderRadius: 12, boxShadow: shadowEmboss, minHeight: 480 }}
    >
      <span className="text-xs tracking-wide uppercase mb-2" style={{ color: tokens.mutedForeground }}>
        Findings
      </span>
      <div className="flex-1 space-y-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {revealedFindings.map((finding) => (
            <motion.button
              key={finding.id}
              onClick={() => onSelect(finding)}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full text-left p-3 rounded-lg transition-all hover:scale-[1.01]"
              style={{
                background: tokens.surfaceFloating,
                border: `1px solid ${tokens.muted}`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    className="text-sm flex-shrink-0"
                    style={{ color: IMPACT_COLOR[finding.impact] }}
                  >
                    ⚠
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: tokens.foreground }}>
                      {TYPE_LABEL[finding.type]}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: tokens.mutedForeground }}>
                      {finding.claim}
                    </p>
                  </div>
                </div>
                <Badge
                  style={{
                    background: IMPACT_COLOR[finding.impact],
                    color: tokens.surfaceFloating,
                    borderRadius: 6,
                    fontSize: 10,
                    padding: "2px 6px",
                    flexShrink: 0,
                  }}
                >
                  {finding.impact}
                </Badge>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {screen === "scanning" && revealedFindings.length < MOCK_FINDINGS.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-1 py-2"
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: tokens.accent }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-xs" style={{ color: tokens.mutedForeground }}>
              Scanning for more…
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// WOW MOMENT — future disputes banner
// ---------------------------------------------------------------------------
function DisputeBanner({ count, onSelectFirst }: { count: number; onSelectFirst: () => void }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 14 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    motionVal.set(count);
  }, [count, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  return (
    <div
      className="flex items-center justify-between p-5 rounded-xl"
      style={{ background: tokens.foreground, color: tokens.surfaceFloating }}
    >
      <div>
        <p className="text-lg font-semibold">
          {display} future dispute{count === 1 ? "" : "s"} detected
        </p>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
          Based on scope gaps, price deviation, and clause history for this vendor and portfolio.
        </p>
      </div>
      <Button
        onClick={onSelectFirst}
        className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: tokens.accent, color: tokens.surfaceFloating, borderRadius: 10 }}
      >
        Show me why
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence drawer
// ---------------------------------------------------------------------------
function EvidenceDrawer({ finding, onClose }: { finding: Finding | null; onClose: () => void }) {
  const confidencePct = finding ? Math.round(finding.confidence * 100) : 0;
  const confDisplay = useAnimatedNumber(confidencePct, !!finding);

  return (
    <AnimatePresence>
      {finding && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed top-0 right-0 h-full z-50 p-6 overflow-y-auto"
            style={{ width: 420, background: tokens.surfaceCard, boxShadow: "-8px 0 24px rgba(0,0,0,0.4)" }}
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <Badge
                  style={{
                    background: IMPACT_COLOR[finding.impact],
                    color: tokens.surfaceFloating,
                    borderRadius: 6,
                  }}
                >
                  {TYPE_LABEL[finding.type]}
                </Badge>
                <h3 className="text-lg font-semibold mt-2" style={{ color: tokens.foreground }}>
                  {finding.claim}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-sm transition-colors hover:opacity-60"
                style={{ color: tokens.mutedForeground }}
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <DrawerField label="Current Document">
                <p className="text-sm" style={{ color: tokens.foreground }}>
                  {finding.documentRef}
                </p>
              </DrawerField>

              <DrawerField label="Related Project">
                <p className="text-sm" style={{ color: tokens.foreground }}>
                  Block C — Structural Steel Package
                </p>
              </DrawerField>

              <DrawerField label="Confidence">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: tokens.muted }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: tokens.accent }}
                      initial={{ width: 0 }}
                      animate={{ width: `${confidencePct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: tokens.foreground }}>
                    {confDisplay}%
                  </span>
                </div>
              </DrawerField>

              <DrawerField label="Impact">
                <Badge
                  style={{
                    background: IMPACT_COLOR[finding.impact],
                    color: tokens.surfaceFloating,
                    borderRadius: 6,
                  }}
                >
                  {finding.impact}
                </Badge>
                {finding.estimatedCostUsd !== null && (
                  <span className="text-sm ml-2" style={{ color: tokens.mutedForeground }}>
                    ~${Math.abs(finding.estimatedCostUsd).toLocaleString()} exposure
                  </span>
                )}
              </DrawerField>

              <DrawerField label="Reasoning">
                <p className="text-sm leading-relaxed" style={{ color: tokens.foreground }}>
                  {finding.reasoning}
                </p>
              </DrawerField>

              <DrawerField label="Historical Evidence">
                <div className="space-y-2">
                  {finding.evidence.map((e, i) => (
                    <div
                      key={i}
                      className="p-2.5 text-xs"
                      style={{ background: tokens.surfaceFloating, borderRadius: 8, border: `1px solid ${tokens.muted}` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium" style={{ color: tokens.foreground }}>
                          {e.source.replace(/_/g, " ")}
                        </span>
                        <span style={{ color: tokens.mutedForeground }}>{e.reliabilityTier.replace(/_/g, " ")}</span>
                      </div>
                      <p style={{ color: tokens.mutedForeground }}>{e.rawRef}</p>
                    </div>
                  ))}
                </div>
              </DrawerField>

              <DrawerField label="Recommendation">
                <p className="text-sm leading-relaxed" style={{ color: tokens.foreground }}>
                  {finding.recommendation}
                </p>
              </DrawerField>

              <button
                className="w-full text-xs font-medium py-2.5 rounded-lg transition-colors hover:opacity-80"
                style={{ background: tokens.foreground, color: tokens.surfaceFloating }}
              >
                VIEW RECEIPT
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[11px] tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function useAnimatedNumber(target: number, active: boolean) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 16 });
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
