"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CopyCheck,
  CloudRain,
  PackageSearch,
  ShieldAlert,
  BadgeCheck,
  Factory,
  Landmark,
  Banknote,
  Upload,
  Sparkles,
  ArrowLeft,
  Scan,
  CheckCircle2,
  Zap,
  Play,
  FileText
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EvidenceResult, TypewriterText } from "./sentinel-features/FeatureViews";

// Direct imports of the actual 9 feature components
import DuplicateOrderCheckScreen from "@/claude code/Duplicate & Conflicting Order Catcher/component";
import FactoryStatusScreenDelay from "@/claude code/s Delay Excuse Verification feature/component";
import PayApplicationVerifierMissing from "@/claude code/missing purchase detector/component";
import BidIntegrityAudit from "@/claude code/Bid Integrity & Collusion Check/component";
import MaterialAuthenticationScreen from "@/claude code/material-authentication/component";
import FactoryStatusScreenCloud from "@/claude code/Factory Cloud/component";
import StatutoryDeadlineTracker from "@/claude code/Statutory Deadline Tracker/component";
import PayApplicationVerifierProof from "@/claude code/Pay Application & Installation Proof/component";
import SentinelPaymentWageIntegrity from "@/claude code/Payment & Wage Integrity Check/component";

/* ── COLOUR TOKENS (Glassmorphic Neo-Industrial) ────────── */
const CANVAS   = "#08070C"; // Underlay base dark charcoal
const BORDER   = "rgba(255, 255, 255, 0.08)"; // Subtle glass border
const SUCCESS  = "#C6FF33"; // Electric Lime highlight
const WARNING  = "#FBBF24"; // Amber
const DANGER   = "#F87171"; // Red
const AI       = "#7D39EB"; // Violet Accent

function renderActualFeature(featureId: string) {
  switch (featureId) {
    case "duplicate_conflicting_order":
      return <DuplicateOrderCheckScreen />;
    case "delay_excuse_verification":
      return <FactoryStatusScreenDelay />;
    case "missing_purchase_detector":
      return <PayApplicationVerifierMissing />;
    case "bid_integrity_collusion":
      return <BidIntegrityAudit />;
    case "material_authentication":
      return <MaterialAuthenticationScreen />;
    case "factory_cloud":
      return <FactoryStatusScreenCloud />;
    case "statutory_deadline_tracker":
      return <StatutoryDeadlineTracker />;
    case "pay_application_installation_proof":
      return <PayApplicationVerifierProof />;
    case "payment_wage_integrity":
      return <SentinelPaymentWageIntegrity />;
    default:
      return null;
  }
}

export interface FeatureCardMeta {
  id: string;
  number: string;
  name: string;
  icon: any;
  category: string;
  description: string;
  presetPrompt: string;
  presetFile?: string;
}

export const STRICT_9_FEATURES: FeatureCardMeta[] = [
  {
    id: "duplicate_conflicting_order",
    number: "02",
    name: "Duplicate & Conflicting Order Catcher",
    icon: CopyCheck,
    category: "Order Integrity",
    description: "Scans purchase orders against active project ledgers to flag duplicate line items and quantity conflicts.",
    presetPrompt: "Checking PO-1042 for 18 tons Grade 60 Rebar ($156,000) from Meridian Steelworks against open orders.",
    presetFile: "PO_1042_Meridian.pdf"
  },
  {
    id: "delay_excuse_verification",
    number: "03",
    name: "Delay Excuse Verification",
    icon: CloudRain,
    category: "Schedule Audit",
    description: "Audits contractor weather & delay extension requests against independent meteorological station archives.",
    presetPrompt: "Subcontractor claims 14-day schedule extension due to monsoon rain on site between July 10-24.",
    presetFile: "Delay_Claim_DC402.pdf"
  },
  {
    id: "missing_purchase_detector",
    number: "04",
    name: "Missing Purchase Detector",
    icon: PackageSearch,
    category: "Asset Inventory",
    description: "Matches smart camera scans of on-site materials against approved purchase orders to flag unbooked materials.",
    presetPrompt: "Analyze drone photograph from South Laydown Area. Detect and cross-reference rebar bundles.",
    presetFile: "Drone_Laydown_Scan_8.png"
  },
  {
    id: "bid_integrity_collusion",
    number: "05",
    name: "Bid Integrity & Collusion Check",
    icon: ShieldAlert,
    category: "Tendering security",
    description: "Reviews incoming subcontractor CSV bid sheets to flag price matching, identical line items, and shared metadata.",
    presetPrompt: "Run collision check across Bid Sheets for Riverside MEP packages. Flag identical line cost items.",
    presetFile: "Riverside_MEP_Bids.csv"
  },
  {
    id: "material_authentication",
    number: "06",
    name: "Material Authentication",
    icon: Factory,
    category: "Quality Assurance",
    description: "Verifies Mill Test Reports and metallurgical grade certificates against ASTM/AISC structural compliance norms.",
    presetPrompt: "Authenticate Mill Certification heat stamp 880213. Check tensile capacity against grade standards.",
    presetFile: "Mill_Cert_Heat_880213.pdf"
  },
  {
    id: "factory_cloud",
    number: "07",
    name: "Factory Cloud Logs",
    icon: BadgeCheck,
    category: "Logistics Verification",
    description: "Connects to remote fabrication plant sensor logs to verify structure dispatch timestamps against logistics claims.",
    presetPrompt: "Check Meridian Steelworks factory logs. Verify steel frame assembly completed on August 8, 2026.",
    presetFile: "Factory_Production_Logs.json"
  },
  {
    id: "statutory_deadline_tracker",
    number: "08",
    name: "Statutory Deadline Tracker",
    icon: Landmark,
    category: "Contract Compliance",
    description: "Calculates Notice to Owner and Mechanics Lien deadlines to prevent project liability exposure.",
    presetPrompt: "Track statutory lien filing deadline for subcontractor. Project start date was May 15, 2026.",
    presetFile: "Lien_Notice_Form_ABC.pdf"
  },
  {
    id: "pay_application_installation_proof",
    number: "09",
    name: "Pay App & Installation Proof",
    icon: Banknote,
    category: "Billing Audit",
    description: "Correlates claimed work completion percent in contractor draw requests with actual installation footage.",
    presetPrompt: "Cross-examine Draw 5 concrete slab claim (85% complete) with laser scan progress files.",
    presetFile: "Draw5_Progress_Scan.zip"
  },
  {
    id: "payment_wage_integrity",
    number: "10",
    name: "Payment & Wage Integrity",
    icon: CheckCircle2,
    category: "Labour Compliance",
    description: "Validates prevailing wage certs, union benefit reports, and certified payroll logs to protect the project.",
    presetPrompt: "Verify certified payroll logs for Week 22. Check welder rates against local prevailing wage indexes.",
    presetFile: "Certified_Payroll_Week22.pdf"
  }
];

export function SentinelCoreOrchestrator() {
  const [flowState, setFlowState] = useState<"idle" | "classifying" | "selected" | "expanded">("idle");
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [activeScanningIndex, setActiveScanningIndex] = useState<number>(-1);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>("");
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const handleOrchestrate = async (customPrompt?: string, customFile?: string) => {
    setFlowState("classifying");
    setActiveScanningIndex(-1);

    const payload = customPrompt
      ? { text: customPrompt }
      : { text: inputText || uploadedFileName || "General search" };

    // Simulate classification animation
    let scanInterval = setInterval(() => {
      setActiveScanningIndex((prev) => (prev + 1) % STRICT_9_FEATURES.length);
    }, 120);

    try {
      const res = await fetch("/api/sentinel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      clearInterval(scanInterval);

      const matchedId = data.feature_id || "duplicate_conflicting_order";
      const matchedIndex = STRICT_9_FEATURES.findIndex((f) => f.id === matchedId);
      setActiveScanningIndex(matchedIndex >= 0 ? matchedIndex : 0);
      setSelectedFeatureId(matchedId);
      setVerificationResult(data.result);

      // Highlight target card
      setFlowState("selected");

      // Expand into full UI view with AI generation transition
      setTimeout(() => {
        setFlowState("expanded");
      }, 700);

    } catch (err) {
      console.error("Orchestration error:", err);
      clearInterval(scanInterval);
      const fallbackId = "duplicate_conflicting_order";
      setSelectedFeatureId(fallbackId);
      setFlowState("selected");
      setTimeout(() => {
        setFlowState("expanded");
      }, 700);
    }
  };

  const handleReset = () => {
    setFlowState("idle");
    setSelectedFeatureId(null);
    setVerificationResult(null);
    setInputText("");
    setUploadedFileName(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 md:p-10 space-y-8 glass-panel text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: BORDER }}>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-[4px] bg-white/5 text-purple-400 border border-purple-500/20 shadow-sm">
              <Zap className="w-3.5 h-3.5" /> SENTINEL CORE ENGINE
            </span>
            <span className="flex items-center gap-1.5 text-[12px] font-mono text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              9 Feature Modules Active
            </span>
          </div>
          <h1 className="text-[32px] font-bold text-white tracking-tight">
            Intelligent Procurement Sentinel
          </h1>
          <p className="text-[14.5px] mt-1 text-white/70">
            Drop any file or prompt — Sentinel Core dynamically classifies procurement intent, triggers Python verification, and streams structured evidence.
          </p>
        </div>

        {flowState === "expanded" && (
          <Button
            onClick={handleReset}
            className="bg-[#C6FF33] hover:bg-[#b0f020] text-black font-bold gap-2 shrink-0 rounded-[8px] border-none px-5 shadow-lg transition-transform hover:-translate-y-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Orchestrate Another Event
          </Button>
        )}
      </div>

      {/* Input Ingestion Bar (Visible in Idle or Classifying state) */}
      {flowState !== "expanded" && (
        <div className="p-6 border bg-white/5 shadow-inner rounded-[16px] space-y-5" style={{ borderColor: BORDER }}>
          <div className="flex flex-col md:flex-row gap-5 items-stretch">
            {/* File Dropzone */}
            <label className="flex-1 flex flex-col items-center justify-center p-5 border-2 border-dashed bg-black/40 hover:bg-black/60 text-white rounded-[12px] cursor-pointer transition-all duration-300 group shadow-lg"
              style={{ borderColor: BORDER }}>
              <Upload className="w-7 h-7 mb-2 transition-transform group-hover:scale-110" style={{ color: SUCCESS }} />
              <span className="text-[13.5px] font-bold text-white text-center">
                {uploadedFileName ? `Attached: ${uploadedFileName}` : "Drop Subcontract File / Invoice / Photo"}
              </span>
              <span className="text-[11px] text-white/50 mt-1 font-mono">PDF, MP4, PNG, JPG, CSV (Auto-Classified)</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                     setUploadedFileName(e.target.files[0].name);
                     setInputText(e.target.files[0].name);
                  }
                }}
              />
            </label>

            {/* Custom Text Ingestion */}
            <div className="flex-[2] flex flex-col gap-2.5">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Or paste procurement text (e.g. 'Check PO-1042 rebar grade 60 against open orders' or 'Contractor claims 14 day delay due to rain')..."
                className="w-full h-28 p-3.5 text-[13.5px] border rounded-[12px] bg-white/5 text-white placeholder-white/30 focus:outline-none focus:border-[#C6FF33] resize-none shadow-inner"
                style={{ borderColor: BORDER }}
              />
              <Button
                onClick={() => handleOrchestrate()}
                disabled={flowState === "classifying"}
                className="bg-[#C6FF33] hover:bg-[#b0f020] text-black font-bold h-11 gap-2 rounded-[10px] self-end px-7 shadow-xl border-none transition-transform hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" />
                {flowState === "classifying" ? "Classifying Intent..." : "Orchestrate Verification"}
              </Button>
            </div>
          </div>

          {/* Quick Preset Buttons for all 9 features */}
          <div className="pt-4 border-t" style={{ borderColor: BORDER }}>
            <span className="text-[11px] font-bold uppercase tracking-wider block mb-2.5" style={{ color: SUCCESS }}>
              ⚡ CLICK ANY PRESET TO DEMO SPECIFIC FEATURE:
            </span>
            <div className="flex flex-wrap gap-2">
              {STRICT_9_FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <button
                    key={feat.id}
                    onClick={() => {
                      setInputText(feat.presetPrompt);
                      setUploadedFileName(feat.presetFile || null);
                      handleOrchestrate(feat.presetPrompt, feat.presetFile);
                    }}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border hover:border-[#C6FF33] rounded-[8px] text-[12px] font-semibold text-white transition-all shadow-sm"
                    style={{ borderColor: BORDER }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: SUCCESS }} />
                    <span>{feat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic AI Status Banner */}
      {flowState === "classifying" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-3 p-4 bg-black/60 text-white rounded-[12px] shadow-2xl border-2"
          style={{ borderColor: SUCCESS }}
        >
          <Scan className="w-5 h-5 animate-spin" style={{ color: SUCCESS }} />
          <span className="text-[15px] font-bold tracking-wide font-mono text-white">
            <TypewriterText text="Understanding Procurement Event... Scanning 9 Sentinel Feature Modules" speed={15} />
          </span>
        </motion.div>
      )}

      {/* 9 Feature Cards Matrix */}
      {flowState !== "expanded" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
          {/* Laser Scan Line */}
          {flowState === "classifying" && (
            <motion.div
              className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-[#C6FF33] to-transparent z-30 pointer-events-none"
              animate={{ y: [0, 160, 320, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            />
          )}

          {STRICT_9_FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            const isScanning = flowState === "classifying" && activeScanningIndex === idx;
            const isSelected = selectedFeatureId === feat.id;
            const isOtherFaded = (flowState === "selected" || flowState === "classifying") && !isSelected && !isScanning;

            return (
              <motion.div
                key={feat.id}
                layoutId={`card-${feat.id}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{
                  scale: isSelected ? 1.05 : 1,
                  opacity: isOtherFaded ? 0.35 : 1,
                  y: 0,
                  filter: isOtherFaded ? "blur(1.5px)" : "blur(0px)"
                }}
                transition={{
                  y: { type: "spring", stiffness: 100, damping: 15, delay: idx * 0.06 },
                  opacity: { duration: 0.25, delay: idx * 0.04 },
                  scale: { duration: 0.3 },
                  filter: { duration: 0.3 }
                }}
                className="h-full"
              >
                <div
                  onClick={() => {
                    setInputText(feat.presetPrompt);
                    handleOrchestrate(feat.presetPrompt, feat.presetFile);
                  }}
                  className={`p-6 rounded-[16px] h-full flex flex-col justify-between cursor-pointer transition-all duration-300 relative overflow-hidden text-white border ${
                    isSelected
                      ? "border-2 bg-[#120E1C] shadow-2xl ring-4 ring-purple-500/25"
                      : isScanning
                      ? "bg-white/10 shadow-xl animate-pulse"
                      : "bg-white/5 hover:bg-white/10 shadow-lg"
                  }`}
                  style={{
                    borderColor: isSelected ? SUCCESS : isScanning ? SUCCESS : BORDER
                  }}
                >
                  {/* Subtle Card Header Pattern */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-bl-full pointer-events-none" />

                  {/* Card Content */}
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <span className="text-[11px] font-mono font-bold tracking-widest" style={{ color: SUCCESS }}>
                        MODULE {feat.number}
                      </span>
                      <Badge className="text-[10px] uppercase font-bold bg-black/40 text-white/80 border border-white/10">
                        {feat.category}
                      </Badge>
                    </div>

                    <div className="flex items-start gap-3.5 mb-3">
                      <div className={`p-3 rounded-[10px] shrink-0 ${isSelected ? "bg-white/10 text-white border" : "bg-white/5 text-white/70 border"}`}
                        style={{ borderColor: BORDER }}>
                        <Icon className="w-5 h-5" style={{ color: SUCCESS }} />
                      </div>
                      <h3 className="text-[17px] font-bold text-white leading-snug">
                        {feat.name}
                      </h3>
                    </div>

                    <p className="text-[13px] text-white/60 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>

                  {/* Card Footer Status */}
                  <div className="mt-6 pt-3.5 border-t flex items-center justify-between text-[11.5px]" style={{ borderColor: BORDER }}>
                    <span className="font-semibold text-white flex items-center gap-2">
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#C6FF33]" />
                          <span className="text-[#C6FF33] font-bold">Intent Matched</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" style={{ color: SUCCESS }} />
                          <span className="text-white/80">Ready for Ingestion</span>
                        </>
                      )}
                    </span>
                    <span className="text-white/40 font-mono text-[10.5px]">Python Verified</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Expanded Full Feature UI View with AI Generation */}
      {flowState === "expanded" && selectedFeatureId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="border rounded-[24px] shadow-2xl overflow-hidden p-1 glass-panel"
          style={{ borderColor: BORDER }}
        >
          {renderActualFeature(selectedFeatureId)}
        </motion.div>
      )}
    </div>
  );
}
