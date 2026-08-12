"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertCircle, Building2,
  ArrowUpCircle, ChevronRight, ChevronLeft, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── COLOUR TOKENS ─────────────────────────────────────── */
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

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { num: 1 as Step, label: "Documents"  },
  { num: 2 as Step, label: "RFQ Review" },
  { num: 3 as Step, label: "Compliance" },
  { num: 4 as Step, label: "Status"     },
];

const revealVariants = {
  initial:     { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16,1,0.3,1] as any } },
};

export default function SupplierWorkspacePage() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [rfqFilled, setRfqFilled] = useState(false);

  const progressPercent = Math.round(((currentStep - 1) / 3) * 100);

  const simulateUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setUploadedFiles(["coi_liberty_2026.pdf", "w9_corporate_signed.pdf"]);
      setIsUploading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full antialiased" style={{ background: CANVAS }}>

      {/* ── Supplier-specific top nav (standalone) */}
      <nav
        className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b px-6 backdrop-blur-md"
        style={{ background: "rgba(8, 7, 12, 0.8)", borderColor: BORDER }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: SUCCESS }}>
            <Building2 size={14} style={{ color: CANVAS }} />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-white">ORCHESTRA</span>
          <span className="text-[12px]" style={{ color: BROWN_LT }}> / Vendor Portal</span>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[12px] font-semibold" style={{ color: BROWN_LT }}>
            Onboarding Progress:
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-28 rounded-full overflow-hidden" style={{ background: CREAM }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: SUCCESS }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className="text-[12px] font-bold font-mono text-white">{progressPercent}%</span>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto py-10 px-6 space-y-8">

        {/* Hero */}
        <div className="text-center max-w-lg mx-auto">
          <span
            className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider mb-3"
            style={{ background: "rgba(125, 57, 235, 0.12)", borderColor: BORDER, color: "#A855F7" }}
          >
            External Onboarding Workspace
          </span>
          <h1 className="text-[28px] font-bold tracking-tight text-white animate-float-gentle">
            Supplier Verification Portal
          </h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: BROWN_MD }}>
            Complete the 4-step compliance verification flow to clear payment releases.
          </p>
        </div>

        {/* Step tabs */}
        <div
          className="flex items-center rounded-xl border p-1.5 gap-1 glass-panel"
          style={{ borderColor: BORDER }}
        >
          {STEPS.map((step) => (
            <button
              key={step.num}
              onClick={() => setCurrentStep(step.num)}
              className="relative flex-1 rounded-lg py-2 text-[12.5px] font-semibold transition-all duration-150"
              style={{
                background: currentStep === step.num ? SUCCESS : "transparent",
                color: currentStep === step.num ? CANVAS : BROWN_LT,
              }}
            >
              <span className="opacity-60 mr-1">{step.num}.</span>
              {step.label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">

          {/* STEP 1 */}
          {currentStep === 1 && (
            <motion.div key="step-1" variants={revealVariants} initial="initial" animate="whileInView" exit="initial" className="space-y-4">
              <h2 className="text-[16px] font-bold text-white">Step 1: Upload Compliance Documents</h2>
              <div className="rounded-xl border p-8 text-center space-y-4 glass-panel animate-ai-generate" style={{ borderColor: BORDER }}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: "rgba(198, 255, 51, 0.08)", color: SUCCESS }}>
                  <ArrowUpCircle size={24} className="animate-bounce" />
                </div>
                <h3 className="text-[16px] font-bold text-white">Drag &amp; drop verification files</h3>
                <p className="text-[13px] max-w-sm mx-auto" style={{ color: BROWN_MD }}>
                  Upload COI liability policies, signed MSA packages, and corporate W-9 forms.
                </p>
                <button
                  onClick={simulateUpload}
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[14px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ background: SUCCESS, color: CANVAS }}
                >
                  {isUploading ? "Verifying..." : "Simulate File Selection"}
                </button>
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 p-3.5 rounded-lg border text-left text-[13px]"
                    style={{ background: "rgba(0,0,0,0.2)", borderColor: BORDER }}>
                    <span className="font-bold block mb-1" style={{ color: SUCCESS }}>✓ 2 Files Uploaded Successfully</span>
                    {uploadedFiles.map(f => (
                      <p key={f} className="font-mono text-white/80" style={{ color: INK }}>{f}</p>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <motion.div key="step-2" variants={revealVariants} initial="initial" animate="whileInView" exit="initial" className="space-y-4">
              <h2 className="text-[16px] font-bold text-white">Step 2: Auto-filled RFQ Response</h2>
              <div className="rounded-xl border p-6 space-y-4 glass-panel animate-ai-generate" style={{ borderColor: BORDER }}>
                <p className="text-[13.5px]" style={{ color: BROWN_MD }}>
                  Orchestra has pre-filled the line items based on your uploaded document metadata. Please verify:
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Vendor Name", value: "Meridian Steelworks", mono: false },
                    { label: "Total Quoted Price", value: "$282,000", mono: true },
                    { label: "Scope Reference", value: "PO-88213 · Tower B", mono: true },
                    { label: "Net Payment Terms", value: "Net-30", mono: false },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center border-b pb-2 text-[13px]" style={{ borderColor: BORDER }}>
                      <span style={{ color: BROWN_LT }}>{row.label}:</span>
                      <span className={`font-semibold ${row.mono ? "font-mono" : ""}`} style={{ color: INK }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setRfqFilled(true)}
                  className="rounded-lg border px-4 py-2 text-[13.5px] font-semibold transition-all hover:-translate-y-0.5"
                  style={{
                    background: rfqFilled ? "rgba(198, 255, 51, 0.08)" : "transparent",
                    borderColor: rfqFilled ? SUCCESS : BORDER,
                    color: rfqFilled ? SUCCESS : INK,
                  }}
                >
                  {rfqFilled ? "✓ Response Confirmed" : "Confirm Autofill Entries"}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <motion.div key="step-3" variants={revealVariants} initial="initial" animate="whileInView" exit="initial" className="space-y-4">
              <h2 className="text-[16px] font-bold text-white">Step 3: SAM.gov Registry Compliance</h2>
              <div className="rounded-xl border divide-y divide-white/10 overflow-hidden glass-panel" style={{ borderColor: BORDER }}>
                {[
                  {
                    icon: CheckCircle2, color: SUCCESS,
                    title: "SAM.gov Registry Status Check",
                    detail: "Active status checked today. General registry matches registration code.",
                    status: "Passed",
                  },
                  {
                    icon: AlertCircle, color: WARNING,
                    title: "OSHA Safety Benchmark Check",
                    detail: "EMR safety rating requires manual approval. Flag raised in buyer dashboard.",
                    status: "Pending",
                  },
                  {
                    icon: CheckCircle2, color: SUCCESS,
                    title: "Lien Waiver Verification",
                    detail: "Waiver matching prime subcontract filed under PO-88213.",
                    status: "Passed",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-5">
                    <item.icon size={18} className="mt-0.5 shrink-0" style={{ color: item.color }} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-bold text-white">{item.title}</h4>
                      <p className="text-[12.5px] mt-0.5" style={{ color: BROWN_MD }}>{item.detail}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg border"
                      style={{ background: `${item.color}12`, color: item.color, borderColor: `${item.color}28` }}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <motion.div key="step-4" variants={revealVariants} initial="initial" animate="whileInView" exit="initial" className="space-y-4">
              <h2 className="text-[16px] font-bold text-white">Step 4: Onboarding Status Overview</h2>
              <div className="rounded-xl border p-6 space-y-4 glass-panel" style={{ borderColor: BORDER }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(251, 191, 36, 0.08)", border: `1px solid rgba(251, 191, 36, 0.25)` }}>
                    <AlertCircle size={18} style={{ color: WARNING }} />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-white">Verification Pending</h3>
                    <p className="text-[12px]" style={{ color: BROWN_LT }}>Awaiting compliance officer review</p>
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: BROWN_MD }}>
                  All documents have been successfully ingested. The buyer compliance officer is reviewing the safety rating variance. No action needed at this time.
                </p>
                <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: BORDER }}>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: CREAM }}>
                    <div className="h-full w-3/4 rounded-full" style={{ background: SUCCESS }} />
                  </div>
                  <span className="text-[12px] font-mono font-bold shrink-0 text-white">75%</span>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t" style={{ borderColor: BORDER }}>
          <button
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((p) => (p - 1) as Step)}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-[13.5px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none"
            style={{ borderColor: BORDER, color: BROWN_MD }}
          >
            <ChevronLeft size={15} /> Back
          </button>
          <button
            disabled={currentStep === 4}
            onClick={() => setCurrentStep((p) => (p + 1) as Step)}
            className="flex items-center gap-2 rounded-lg px-5 py-2 text-[13.5px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none"
            style={{ background: SUCCESS, color: CANVAS }}
          >
            Next Step <ChevronRight size={15} />
          </button>
        </div>

      </main>
    </div>
  );
}
