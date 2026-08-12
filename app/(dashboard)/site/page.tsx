"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic,
  Video,
  RotateCcw,
  Square,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceiptCard } from "@/components/receipt-card";
import { cn } from "@/lib/utils";

type CaptureMode = "voice" | "video";
type CaptureState = "idle" | "recording" | "processing" | "completed";

const revealVariants = {
  initial: {
    opacity: 0,
    rotateX: 6,
    z: -80,
    y: 30,
  },
  whileInView: {
    opacity: 1,
    rotateX: 0,
    z: 0,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as any,
    },
  },
};

/* ── PALETTE ──────────────────────────────────────────────
   Black, Violet, Lime, White
──────────────────────────────────────────────────────────── */
const INK      = "#FFFFFF";
const BROWN_MD = "rgba(255, 255, 255, 0.7)";
const BROWN_LT = "rgba(255, 255, 255, 0.45)";
const SAND     = "rgba(255, 255, 255, 0.25)";
const CREAM    = "rgba(255, 255, 255, 0.08)";
const CANVAS   = "#08070C";
const SURFACE  = "rgba(255, 255, 255, 0.03)";
const BORDER   = "rgba(255, 255, 255, 0.08)";

const SUCCESS  = "#C6FF33";  /* Lime */
const WARNING  = "#FBBF24";  /* Amber */
const DANGER   = "#F87171";  /* Red */
const AI       = "#7D39EB";  /* Violet */

export default function MobileSiteCapturePage() {
  const [state, setState] = useState<CaptureState>("idle");
  const [mode, setMode] = useState<CaptureMode>("voice");
  const [transcript, setTranscript] = useState("");
  const [progress, setProgress] = useState(0);

  simulateCapture: {
    // Simulated function inside component
  }

  const simulateCapture = () => {
    setState("recording");
    setProgress(0);
    setTimeout(() => {
      setState("processing");
      setTimeout(() => {
        setTranscript(
          mode === "voice"
            ? "Inspect column 14 for concrete spalling. Concrete coverage index is below threshold. Flagged safety level: High."
            : "Reviewing delivery batch 882 for reinforcement rebar steel spacing errors."
        );
        setState("completed");
      }, 1500);
    }, 2000);
  };

  const handleReset = () => {
    setState("idle");
    setTranscript("");
  };

  return (
    <div className="space-y-8 p-6 md:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        variants={revealVariants} initial="initial" whileInView="whileInView" viewport={{ once: true }}
        className="flex flex-col justify-between gap-4 md:flex-row md:items-center border-b pb-5"
        style={{ borderColor: BORDER }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(125, 57, 235, 0.1)", borderColor: "rgba(125, 57, 235, 0.25)", color: "#A855F7" }}>
              On-Site Audio/Video Capture
            </span>
            <span className="text-[12px] font-mono" style={{ color: BROWN_LT }}>Mobile Ground Link</span>
          </div>
          <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-white">
            Mobile Site Capture
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: BROWN_MD }}>
            Stream raw audio dictation or video walkthroughs directly into Orchestra's evidence register.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw size={14} className="mr-1.5" /> Reset State
          </Button>
        </div>
      </motion.div>

      {/* Capture section */}
      <motion.div variants={revealVariants} initial="initial" whileInView="whileInView" viewport={{ once: true }}>
        <Card className="p-6 border rounded-xl space-y-6 shadow-sm glass-panel"
          style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: BORDER }}>
            <h3 className="text-[15.5px] font-bold flex items-center gap-2 text-white">
              <Mic size={16} style={{ color: SUCCESS }} /> 1. Raw Ground Input Stream
            </h3>
            <div className="flex gap-2">
              {(["voice", "video"] as CaptureMode[]).map(m => (
                <button key={m} disabled={state !== "idle"} onClick={() => setMode(m)}
                  className="px-3 py-1 rounded-lg text-[12px] font-semibold border transition-colors"
                  style={{
                    background: mode === m ? SUCCESS : "transparent",
                    color: mode === m ? CANVAS : BROWN_MD,
                    borderColor: mode === m ? SUCCESS : BORDER,
                  }}>
                  {m === "voice" ? "Voice Memo" : "Video Walkthrough"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            {state === "idle" && (
              <button onClick={simulateCapture}
                className="h-20 w-20 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{ background: SUCCESS, color: CANVAS }}>
                {mode === "voice" ? <Mic size={30} /> : <Video size={30} />}
              </button>
            )}
            {state === "recording" && (
              <div className="flex flex-col items-center space-y-3">
                <div className="h-16 w-16 rounded-full animate-pulse flex items-center justify-center text-white" style={{ background: DANGER }}>
                  <Square size={20} />
                </div>
                <p className="text-[13px] font-mono animate-pulse" style={{ color: DANGER }}>RECORDING LIVE STREAM...</p>
              </div>
            )}
            {state === "processing" && (
              <div className="flex flex-col items-center space-y-3">
                <div className="h-8 w-8 rounded-full border-4 border-t-white animate-spin" style={{ borderColor: BORDER }} />
                <p className="text-[13px] font-mono" style={{ color: BROWN_LT }}>EXTRACTING METRICS &amp; ENTITIES...</p>
              </div>
            )}
            {state === "completed" && (
              <div className="p-4 rounded-xl border w-full text-[13.5px] leading-relaxed" style={{ background: "rgba(255,255,255,0.02)", borderColor: BORDER, color: INK }}>
                <span className="font-mono text-[11px] block uppercase mb-1" style={{ color: BROWN_LT }}>Extracted Transcript</span>
                "{transcript}"
              </div>
            )}
            {state === "idle" && (
              <p className="text-[12.5px]" style={{ color: BROWN_MD }}>Click button to begin real-time site audit recording</p>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Structured output */}
      {state === "completed" && (
        <motion.div variants={revealVariants} initial="initial" whileInView="whileInView" viewport={{ once: true }} className="space-y-4">
          <h3 className="text-[16px] font-bold text-white">2. Structured Compliance Output</h3>
          <div className="space-y-4">
            <Card className="p-5 border rounded-xl space-y-3 shadow-sm glass-panel" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: BORDER }}>
                <span className="text-[14px] font-bold text-white">Structured Event Parameters</span>
                <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
                  style={{ background: "rgba(198, 255, 51, 0.08)", color: SUCCESS, borderColor: "rgba(198, 255, 51, 0.25)" }}>
                  98.2% Confidence
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                {[
                  { label: "Event Category", value: "Quality Assurance Audit", color: INK },
                  { label: "Identified Site Element", value: "Column 14 Concrete Spall", color: INK },
                  { label: "Assigned Severity", value: "HIGH RISK", color: DANGER },
                  { label: "Subcontract Reference", value: "PO-88213 §9.4", color: INK, mono: true },
                ].map(item => (
                  <div key={item.label}>
                    <span className="block mb-0.5" style={{ color: BROWN_LT }}>{item.label}:</span>
                    <span className={`font-semibold ${item.mono ? "font-mono" : ""}`} style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
            <ReceiptCard
              title="Column 14 Concrete Spall Exception"
              subtitle="Weather correlation & inspection log checklist"
              badgeText="Safety Exception"
              badgeVariant="danger"
              defaultOpen={true}
            />
          </div>
        </motion.div>
      )}

      {state === "idle" && (
        <div className="py-12 text-center" style={{ color: BROWN_LT }}>
          <FolderOpen className="mx-auto mb-2 opacity-50" size={32} />
          <p className="text-[14px]">No active captures processed yet. Click the recorder above to simulate.</p>
        </div>
      )}
    </div>
  );
}
