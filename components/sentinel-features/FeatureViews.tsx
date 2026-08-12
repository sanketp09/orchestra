"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CopyCheck,
  CloudRain,
  PackageSearch,
  ShieldAlert,
  BadgeCheck,
  Factory,
  Scale,
  Camera,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Database,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap,
  Activity
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface EvidenceItem {
  source: string;
  reliability_tier: "self_reported" | "third_party_observed" | "verified_transaction";
  timestamp: string;
  raw_ref: string;
}

export interface EvidenceResult {
  feature_id: string;
  feature_name: string;
  claim: string;
  verdict: "verified" | "contradicted" | "uncertain";
  confidence: number;
  evidence: EvidenceItem[];
  reasoning: string;
  writes_to: string[];
  needs_human: boolean;
  payload_details?: Record<string, any>;
}

// ============================================================================
// AI Typewriter Streaming Text Component
// ============================================================================
export function TypewriterText({
  text,
  speed = 14,
  className = ""
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setDisplayedText("");
    setIsDone(false);
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => text.slice(0, i + 1));
        i++;
      } else {
        setIsDone(true);
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span className={className}>
      {displayedText}
      {!isDone && (
        <span className="inline-block w-2 h-4 ml-1 bg-[#AC723E] animate-pulse align-middle" />
      )}
    </span>
  );
}

// ============================================================================
// Dark Coffee Evidence Receipt Box with AI Streaming Transitions
// ============================================================================

export function EvidenceReceiptBox({ result }: { result: EvidenceResult }) {
  const [showEvidenceList, setShowEvidenceList] = useState(true);

  const verdictConfig = {
    verified: {
      label: "VERIFIED",
      bg: "bg-[#3A6A4E]/25 text-[#4ADE80] border-[#3A6A4E]/60",
      icon: CheckCircle2
    },
    contradicted: {
      label: "CONTRADICTED",
      bg: "bg-[#A6432F]/25 text-[#F87171] border-[#A6432F]/60",
      icon: XCircle
    },
    uncertain: {
      label: "UNCERTAIN / NEEDS REVIEW",
      bg: "bg-[#B8873A]/25 text-[#FBBF24] border-[#B8873A]/60",
      icon: AlertTriangle
    }
  }[result.verdict] || {
    label: result.verdict.toUpperCase(),
    bg: "bg-stone-800 text-white border-stone-700",
    icon: AlertTriangle
  };

  const VerdictIcon = verdictConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <Card className="mt-6 border-2 border-[#AC723E]/40 bg-[#0C0904] text-white p-6 shadow-2xl rounded-[14px] relative overflow-hidden">
        {/* Glowing top line accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#AC723E] to-transparent" />

        {/* Contract Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#28231D] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-[#AC723E]">
                ⚡ SENTINEL VERIFICATION CONTRACT
              </span>
              <span className="text-[11px] font-mono text-[#3A6A4E] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3A6A4E] animate-pulse" />
                Ledger Synchronized
              </span>
            </div>
            <h3 className="text-[17px] font-bold text-white mt-1 leading-snug">
              <TypewriterText text={result.claim} speed={12} />
            </h3>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] border text-[12px] font-bold tracking-wider uppercase ${verdictConfig.bg}`}
            >
              <VerdictIcon className="w-4 h-4" />
              {verdictConfig.label}
            </div>
            <div className="text-right pl-3 border-l border-[#28231D]">
              <span className="block text-[22px] font-bold font-mono text-[#AC723E] leading-none">
                {Math.round(result.confidence * 100)}%
              </span>
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#A89887]">
                CONFIDENCE
              </span>
            </div>
          </div>
        </div>

        {/* AI Reasoning Trace with Streaming Typewriter */}
        <div className="py-4 border-b border-[#28231D]">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#AC723E] block mb-2">
            AI REASONING TRACE (LIVE GENERATION)
          </span>
          <p className="text-[14px] leading-relaxed text-[#EBE5DC] font-mono">
            <TypewriterText text={result.reasoning} speed={10} />
          </p>
        </div>

        {/* Evidence Chain Accordion */}
        <div className="pt-4">
          <button
            onClick={() => setShowEvidenceList(!showEvidenceList)}
            className="flex items-center justify-between w-full text-[12px] font-bold text-[#EBE5DC] uppercase tracking-wider hover:text-[#AC723E] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#AC723E]" />
              Supporting Evidence Chains ({result.evidence.length} verified sources)
            </span>
            {showEvidenceList ? (
              <ChevronUp className="w-4 h-4 text-[#AC723E]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#AC723E]" />
            )}
          </button>

          <AnimatePresence>
            {showEvidenceList && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 space-y-2.5 overflow-hidden"
              >
                {result.evidence.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + idx * 0.12 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-[#1C1917] rounded-[8px] border border-[#332C24] text-[13px]"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#AC723E]" />
                        {item.source}
                      </div>
                      <div className="text-[11px] font-mono text-[#A89887] pl-3">
                        {item.raw_ref}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pl-3 sm:pl-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wide border ${
                          item.reliability_tier === "verified_transaction"
                            ? "bg-[#3A6A4E]/20 text-[#4ADE80] border-[#3A6A4E]/40"
                            : item.reliability_tier === "third_party_observed"
                            ? "bg-[#3B6A8A]/20 text-[#60A5FA] border-[#3B6A8A]/40"
                            : "bg-[#B8873A]/20 text-[#FBBF24] border-[#B8873A]/40"
                        }`}
                      >
                        {item.reliability_tier.replace("_", " ")}
                      </span>
                      <span className="text-[11px] font-mono text-[#A89887]">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ledger Footer */}
        <div className="mt-5 pt-3 border-t border-[#28231D] flex flex-wrap items-center justify-between gap-3 text-[11.5px]">
          <div className="flex items-center gap-2 text-[#A89887]">
            <Database className="w-3.5 h-3.5 text-[#AC723E]" />
            <span>Target Ledger Writes:</span>
            <span className="font-mono text-white font-semibold">
              {result.writes_to.join(", ")}
            </span>
          </div>
          {result.needs_human && (
            <Badge className="bg-[#B8873A]/20 text-[#FBBF24] border border-[#B8873A]/50 font-bold px-3 py-1">
              ⚡ Human Auditor Escalation Active
            </Badge>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ============================================================================
// 1. Duplicate & Conflicting Order UI (Dark Coffee Theme)
// ============================================================================
export function DuplicateOrderView({ result }: { result: EvidenceResult }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#28231D] pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#AC723E]">FEATURE MODULE 02</span>
          <h2 className="text-[22px] font-bold text-white">Duplicate & Conflicting Order Catcher</h2>
          <p className="text-[13.5px] text-[#A89887]">Scans purchase orders against active project ledgers to flag double-booked materials.</p>
        </div>
        <Badge variant="danger" className="bg-[#A6432F]/30 text-[#F87171] border border-[#A6432F]/60 text-[12px] px-3 py-1 font-bold">
          PO-1042 vs PO-0988 Flagged
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 border border-[#332C24] bg-[#1C1917] text-white rounded-[12px]">
          <div className="text-[11px] font-bold uppercase text-[#AC723E] mb-3 flex items-center justify-between">
            <span>NEW ORDER SUBMISSION (PO-1042)</span>
            <span className="w-2 h-2 rounded-full bg-[#AC723E] animate-ping" />
          </div>
          <div className="space-y-2.5 text-[14px]">
            <div className="flex justify-between border-b border-[#28231D] pb-2">
              <span className="text-[#A89887]">Item Specification</span>
              <span className="font-bold text-white">Reinforcing steel rods, Grade 60</span>
            </div>
            <div className="flex justify-between border-b border-[#28231D] pb-2">
              <span className="text-[#A89887]">Quantity & Unit</span>
              <span className="font-semibold text-white">18 tons</span>
            </div>
            <div className="flex justify-between border-b border-[#28231D] pb-2">
              <span className="text-[#A89887]">Supplier</span>
              <span className="font-semibold text-white">Meridian Steelworks</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A89887]">Order Total Value</span>
              <span className="font-mono font-bold text-[#AC723E] text-[16px]">$156,000</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-[#A6432F]/40 bg-[#A6432F]/10 text-white rounded-[12px]">
          <div className="text-[11px] font-bold uppercase text-[#F87171] mb-3">EXISTING CONFLICTING PO (PO-0988)</div>
          <div className="space-y-2.5 text-[14px]">
            <div className="flex justify-between border-b border-[#A6432F]/20 pb-2">
              <span className="text-[#A89887]">Item Specification</span>
              <span className="font-bold text-white">Reinforcement bars (rebar), Grade 60</span>
            </div>
            <div className="flex justify-between border-b border-[#A6432F]/20 pb-2">
              <span className="text-[#A89887]">Quantity & Unit</span>
              <span className="font-semibold text-white">16 tons</span>
            </div>
            <div className="flex justify-between border-b border-[#A6432F]/20 pb-2">
              <span className="text-[#A89887]">Existing Supplier</span>
              <span className="font-semibold text-white">Apex Rebar Supply</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A89887]">Conflict Exposure</span>
              <span className="font-mono font-bold text-[#F87171] text-[16px]">$142,000 at risk</span>
            </div>
          </div>
        </Card>
      </div>

      <EvidenceReceiptBox result={result} />
    </div>
  );
}

// ============================================================================
// 2. Delay Excuse Verification UI
// ============================================================================
export function DelayExcuseView({ result }: { result: EvidenceResult }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#28231D] pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#AC723E]">FEATURE MODULE 03</span>
          <h2 className="text-[22px] font-bold text-white">Delay Excuse Verification</h2>
          <p className="text-[13.5px] text-[#A89887]">Audits contractor weather & supply chain delay extension requests against independent site archives.</p>
        </div>
        <Badge className="bg-[#A6432F]/30 text-[#F87171] border border-[#A6432F]/60 text-[12px] px-3 py-1 font-bold">
          Claim Disproven
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border border-[#332C24] bg-[#1C1917] text-center">
          <span className="text-[11px] font-bold uppercase text-[#A89887]">CLAIMED DELAY</span>
          <div className="text-[32px] font-bold text-[#F87171] font-mono mt-1">14 Days</div>
          <span className="text-[12px] text-[#A89887]">Monsoon Rain Excuse</span>
        </Card>
        <Card className="p-5 border border-[#332C24] bg-[#1C1917] text-center">
          <span className="text-[11px] font-bold uppercase text-[#A89887]">VERIFIED RAINFALL</span>
          <div className="text-[32px] font-bold text-[#4ADE80] font-mono mt-1">3.2 mm</div>
          <span className="text-[12px] text-[#A89887]">Station #402 Archives</span>
        </Card>
        <Card className="p-5 border border-[#332C24] bg-[#1C1917] text-center">
          <span className="text-[11px] font-bold uppercase text-[#A89887]">AUDIT VERDICT</span>
          <div className="text-[32px] font-bold text-[#F87171] font-mono mt-1">0 Days</div>
          <span className="text-[12px] text-[#A89887]">Unexcused Delay</span>
        </Card>
      </div>

      <EvidenceReceiptBox result={result} />
    </div>
  );
}

// ============================================================================
// 3. Missing Purchase Detector UI
// ============================================================================
export function MissingPurchaseView({ result }: { result: EvidenceResult }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#28231D] pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#AC723E]">FEATURE MODULE 04</span>
          <h2 className="text-[22px] font-bold text-white">Missing Purchase Detector</h2>
          <p className="text-[13.5px] text-[#A89887]">Cross-references physical site work and installed materials against approved PO logs to catch unbooked inventory.</p>
        </div>
        <Badge className="bg-[#B8873A]/25 text-[#FBBF24] border border-[#B8873A]/60 text-[12px] px-3 py-1 font-bold">
          Unbooked Work Detected
        </Badge>
      </div>

      <Card className="p-5 border border-[#332C24] bg-[#1C1917] text-white space-y-4">
        <div className="flex items-center justify-between border-b border-[#28231D] pb-3">
          <div className="font-bold text-white">Floor 4 Block B — HVAC Ducting Installation</div>
          <span className="font-mono text-[14px] font-bold text-[#F87171]">$38,500 Unbooked Liability</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
          <div>
            <span className="text-[#A89887] block text-[11px]">PHYSICAL COUNT</span>
            <span className="font-bold text-white">500 meters</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">APPROVED PO COUNT</span>
            <span className="font-bold text-[#F87171]">0 meters</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">SPECIFICATION</span>
            <span className="font-bold text-white">24-inch HVAC Duct</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">STATUS</span>
            <span className="font-bold text-[#FBBF24]">Unmatched In Situ</span>
          </div>
        </div>
      </Card>

      <EvidenceReceiptBox result={result} />
    </div>
  );
}

// ============================================================================
// 4. Bid Integrity & Collusion Check UI
// ============================================================================
export function BidIntegrityView({ result }: { result: EvidenceResult }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#28231D] pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#AC723E]">FEATURE MODULE 05</span>
          <h2 className="text-[22px] font-bold text-white">Bid Integrity & Collusion Check</h2>
          <p className="text-[13.5px] text-[#A89887]">Analyzes bid packages for complementary bidding, identical pricing, and shared vendor ownership.</p>
        </div>
        <Badge className="bg-[#A6432F]/30 text-[#F87171] border border-[#A6432F]/60 text-[12px] px-3 py-1 font-bold">
          Collusion Detected
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border border-[#332C24] bg-[#1C1917]">
          <div className="text-[11px] font-bold uppercase text-[#A89887]">BIDDER A</div>
          <div className="font-bold text-white text-[15px] mt-1">Meridian Steelworks</div>
          <div className="text-[14px] font-mono text-[#AC723E] font-bold mt-2">$1,240,000</div>
          <div className="text-[11px] text-[#4ADE80] mt-1 font-medium">✓ Independent Bid</div>
        </Card>
        <Card className="p-4 border border-[#A6432F]/50 bg-[#A6432F]/10">
          <div className="text-[11px] font-bold uppercase text-[#F87171]">BIDDER B (FLAGGED)</div>
          <div className="font-bold text-white text-[15px] mt-1">Apex Rebar Supply</div>
          <div className="text-[14px] font-mono text-[#F87171] font-bold mt-2">$1,295,000</div>
          <div className="text-[11px] text-[#F87171] mt-1 font-bold">⚠ Shared Workstation & PDF Author</div>
        </Card>
        <Card className="p-4 border border-[#A6432F]/50 bg-[#A6432F]/10">
          <div className="text-[11px] font-bold uppercase text-[#F87171]">BIDDER C (FLAGGED)</div>
          <div className="font-bold text-white text-[15px] mt-1">Coastal Metal Works</div>
          <div className="text-[14px] font-mono text-[#F87171] font-bold mt-2">$1,310,000</div>
          <div className="text-[11px] text-[#F87171] mt-1 font-bold">⚠ Shared Director ID #88491</div>
        </Card>
      </div>

      <EvidenceReceiptBox result={result} />
    </div>
  );
}

// ============================================================================
// 5. Material Authentication UI
// ============================================================================
export function MaterialAuthView({ result }: { result: EvidenceResult }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#28231D] pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#AC723E]">FEATURE MODULE 06</span>
          <h2 className="text-[22px] font-bold text-white">Material Authentication</h2>
          <p className="text-[13.5px] text-[#A89887]">Validates mill test certificates, heat stamps, and physical material photos against authentic mill reference databases.</p>
        </div>
        <Badge className="bg-[#3A6A4E]/30 text-[#4ADE80] border border-[#3A6A4E]/60 text-[12px] px-3 py-1 font-bold">
          Authentic Steel Confirmed
        </Badge>
      </div>

      <Card className="p-5 border border-[#3A6A4E]/40 bg-[#3A6A4E]/10 space-y-3">
        <div className="flex items-center justify-between border-b border-[#3A6A4E]/30 pb-2.5">
          <div className="font-bold text-white">Heat Stamp #74829 — Meridian Steelworks</div>
          <Badge className="bg-[#3A6A4E] text-white">98% Match Score</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
          <div>
            <span className="text-[#A89887] block text-[11px]">STEEL GRADE</span>
            <span className="font-bold text-white">Grade 60 (ASTM A615)</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">TENSILE STRENGTH</span>
            <span className="font-bold text-[#4ADE80]">68,500 psi (Passed)</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">MILL CERTIFICATE</span>
            <span className="font-bold text-white">MTC-88392 Verified</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">PHYSICAL STAMP</span>
            <span className="font-bold text-[#4ADE80]">OCR Pattern Authenticated</span>
          </div>
        </div>
      </Card>

      <EvidenceReceiptBox result={result} />
    </div>
  );
}

// ============================================================================
// 6. Factory Cloud UI
// ============================================================================
export function FactoryCloudView({ result }: { result: EvidenceResult }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#28231D] pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#AC723E]">FEATURE MODULE 07</span>
          <h2 className="text-[22px] font-bold text-white">Factory Cloud</h2>
          <p className="text-[13.5px] text-[#A89887]">Connects to offsite fabricator machine telemetry and IoT streams to track manufacturing progress.</p>
        </div>
        <Badge className="bg-[#B8873A]/30 text-[#FBBF24] border border-[#B8873A]/60 text-[12px] px-3 py-1 font-bold">
          7-Day Dispatch Slippage
        </Badge>
      </div>

      <Card className="p-5 border border-[#332C24] bg-[#1C1917] text-white space-y-4">
        <div className="flex items-center justify-between border-b border-[#28231D] pb-3">
          <div>
            <div className="font-bold text-white">ORD-4471 — Shreeji Metal Works, Bhiwandi</div>
            <div className="text-[12px] text-[#A89887]">MS Structural Columns — Machine #12</div>
          </div>
          <div className="text-right">
            <div className="text-[24px] font-bold font-mono text-[#AC723E]">80.0%</div>
            <div className="text-[10px] uppercase font-bold text-[#A89887]">Assembly Progress</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[12px] font-bold">
            <span>Fabrication Progress</span>
            <span className="text-[#FBBF24]">Slower than required pace</span>
          </div>
          <div className="w-full h-3 bg-[#28231D] rounded-full overflow-hidden">
            <div className="h-full bg-[#AC723E] rounded-full" style={{ width: "80%" }} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[13px] pt-2">
          <div>
            <span className="text-[#A89887] block text-[11px]">EXPECTED DISPATCH</span>
            <span className="font-bold text-white">Aug 20, 2026</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">PROJECTED DISPATCH</span>
            <span className="font-bold text-[#F87171]">Aug 27, 2026</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">TELEMETRY SOURCE</span>
            <span className="font-mono text-[11px] text-[#60A5FA]">CNC Machine #12 IoT Feed</span>
          </div>
        </div>
      </Card>

      <EvidenceReceiptBox result={result} />
    </div>
  );
}

// ============================================================================
// 7. Statutory Deadline Tracker UI
// ============================================================================
export function StatutoryDeadlineView({ result }: { result: EvidenceResult }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#28231D] pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#AC723E]">FEATURE MODULE 08</span>
          <h2 className="text-[22px] font-bold text-white">Statutory Deadline Tracker</h2>
          <p className="text-[13.5px] text-[#A89887]">Tracks statutory preliminary lien notices, stop-work filing deadlines, and state prompt payment windows.</p>
        </div>
        <Badge className="bg-[#3B6A8A]/30 text-[#60A5FA] border border-[#3B6A8A]/60 text-[12px] px-3 py-1 font-bold">
          36 Days Remaining
        </Badge>
      </div>

      <Card className="p-5 border border-[#332C24] bg-[#1C1917] text-white space-y-4">
        <div className="flex items-center justify-between border-b border-[#28231D] pb-3">
          <div>
            <div className="font-bold text-white">California Preliminary 20-Day Notice (Civ Code § 8400)</div>
            <div className="text-[12px] text-[#A89887]">Claimant: Voltline Electrical Contractors</div>
          </div>
          <Badge className="bg-[#A6432F] text-white">HIGH PRIORITY</Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
          <div>
            <span className="text-[#A89887] block text-[11px]">FILING DATE</span>
            <span className="font-bold text-white">Aug 1, 2026</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">PERFECTION DEADLINE</span>
            <span className="font-bold text-[#F87171]">Sep 15, 2026</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">DAYS REMAINING</span>
            <span className="font-mono font-bold text-[18px] text-[#F87171]">36 Days</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">STATUTE REF</span>
            <span className="font-mono text-[11px] text-white">CA Civ Code § 8400</span>
          </div>
        </div>
      </Card>

      <EvidenceReceiptBox result={result} />
    </div>
  );
}

// ============================================================================
// 8. Pay Application & Installation Proof UI
// ============================================================================
export function PayAppProofView({ result }: { result: EvidenceResult }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#28231D] pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#AC723E]">FEATURE MODULE 09</span>
          <h2 className="text-[22px] font-bold text-white">Pay Application & Installation Proof</h2>
          <p className="text-[13.5px] text-[#A89887]">Audits contractor progress payment applications against visual site walk photo evidence using vision AI.</p>
        </div>
        <Badge className="bg-[#A6432F]/30 text-[#F87171] border border-[#A6432F]/60 text-[12px] px-3 py-1 font-bold">
          22% Overbilling Flagged
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 border border-[#332C24] bg-[#1C1917] text-white">
          <div className="text-[11px] font-bold uppercase text-[#A89887] mb-2">PAY APP #7 CLAIMED</div>
          <div className="text-[28px] font-bold text-[#F87171] font-mono">90% Complete</div>
          <div className="text-[14px] font-semibold text-white mt-1">$184,500 Claimed Amount</div>
          <p className="text-[12px] text-[#A89887] mt-2">Electrical installation, Floors 3-5 (Voltline Electrical)</p>
        </Card>

        <Card className="p-5 border border-[#3A6A4E]/40 bg-[#3A6A4E]/10 text-white">
          <div className="text-[11px] font-bold uppercase text-[#4ADE80] mb-2">VISION AI VERIFIED</div>
          <div className="text-[28px] font-bold text-[#4ADE80] font-mono">68% Complete</div>
          <div className="text-[14px] font-semibold text-white mt-1">$139,400 Verified Payment Cap</div>
          <p className="text-[12px] text-[#4ADE80] font-medium mt-2">Conduit roughed in; device plates missing & un-energized.</p>
        </Card>
      </div>

      <EvidenceReceiptBox result={result} />
    </div>
  );
}

// ============================================================================
// 9. Payment & Wage Integrity Check UI
// ============================================================================
export function PaymentWageView({ result }: { result: EvidenceResult }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#28231D] pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#AC723E]">FEATURE MODULE 10</span>
          <h2 className="text-[22px] font-bold text-white">Payment & Wage Integrity Check</h2>
          <p className="text-[13.5px] text-[#A89887]">Audits certified payroll reports against prevailing wage rate sheets to catch underpayment exposure.</p>
        </div>
        <Badge className="bg-[#A6432F]/30 text-[#F87171] border border-[#A6432F]/60 text-[12px] px-3 py-1 font-bold">
          Wage Shortfall Flagged
        </Badge>
      </div>

      <Card className="p-5 border border-[#A6432F]/40 bg-[#A6432F]/10 text-white space-y-3">
        <div className="flex items-center justify-between border-b border-[#A6432F]/20 pb-2.5">
          <div className="font-bold text-white">Certified Payroll #W-14 — Apex Rebar</div>
          <div className="font-mono text-[14px] font-bold text-[#F87171]">$14,400 Total Exposure</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
          <div>
            <span className="text-[#A89887] block text-[11px]">WORKER CLASSIFICATION</span>
            <span className="font-bold text-white">Journeyman Ironworker</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">PAID RATE</span>
            <span className="font-bold text-[#F87171]">$42.50 / hr</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">PREVAILING RATE</span>
            <span className="font-bold text-[#4ADE80]">$47.00 / hr</span>
          </div>
          <div>
            <span className="text-[#A89887] block text-[11px]">HOURLY SHORTFALL</span>
            <span className="font-mono font-bold text-[#F87171]">-$4.50 / hr</span>
          </div>
        </div>
      </Card>

      <EvidenceReceiptBox result={result} />
    </div>
  );
}

// ============================================================================
// Master Renderer Map
// ============================================================================
export function renderFeatureView(result: EvidenceResult) {
  switch (result.feature_id) {
    case "duplicate_conflicting_order":
      return <DuplicateOrderView result={result} />;
    case "delay_excuse_verification":
      return <DelayExcuseView result={result} />;
    case "missing_purchase_detector":
      return <MissingPurchaseView result={result} />;
    case "bid_integrity_collusion":
      return <BidIntegrityView result={result} />;
    case "material_authentication":
      return <MaterialAuthView result={result} />;
    case "factory_cloud":
      return <FactoryCloudView result={result} />;
    case "statutory_deadline_tracker":
      return <StatutoryDeadlineView result={result} />;
    case "pay_application_installation_proof":
      return <PayAppProofView result={result} />;
    case "payment_wage_integrity":
      return <PaymentWageView result={result} />;
    default:
      return <DuplicateOrderView result={result} />;
  }
}
