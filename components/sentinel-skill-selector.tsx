"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import {
  Fingerprint, Video, Banknote, Landmark, UploadCloud, ArrowRight,
  FileText, CopyCheck, CloudRain, PackageSearch, ShieldAlert, Factory,
  Sparkles, CheckCircle2, Play, ArrowLeft, type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SentinelFeatureRenderer } from "@/components/sentinel-features/SentinelFeatureRenderer";

/* ─────────────────────────────────────────────────────────
   SITE COLOUR TOKENS (Glassmorphic Neo-Industrial)
───────────────────────────────────────────────────────── */
const INK        = "#FFFFFF"; // Crisp White
const INK2       = "rgba(255, 255, 255, 0.7)"; // Secondary label
const MUTED      = "rgba(255, 255, 255, 0.45)"; // Muted text
const BORDER     = "rgba(255, 255, 255, 0.08)"; // Subtle glass border
const ACCENT     = "#7D39EB"; // Violet Accent
const CREAM      = "rgba(255, 255, 255, 0.02)"; // Glass card surface
const CANVAS     = "#08070C"; // Underlay base dark charcoal
const SUCCESS    = "#C6FF33"; // Electric Lime highlight
const WARNING    = "#FBBF24"; // Amber
const DANGER     = "#F87171"; // Red

/* ─────────────────────────────────────────────────────────
   CARD DIMENSIONS
───────────────────────────────────────────────────────── */
const CARD_W      = 220;
const CARD_H      = 300;
const CARD_GAP    = 24;
const CARD_STRIDE = CARD_W + CARD_GAP;

/* ─────────────────────────────────────────────────────────
   SKILL REGISTRY (All 9 Strict Sentinel Modules)
───────────────────────────────────────────────────────── */
interface Skill {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  topColor: string;
  titleColor: string;
  presetPrompt: string;
  presetFile?: string;
}

const SKILLS: Skill[] = [
  {
    id: "duplicate_conflicting_order",
    title: "Duplicate & Conflicting Order",
    description: "Flags duplicate PO line items and quantity conflicts against active ledger logs.",
    icon: CopyCheck,
    topColor: "#7D39EB",
    titleColor: "#7D39EB",
    presetPrompt: "Check PO-1042 rebar grade 60 against open orders",
    presetFile: "PO_1042_Rebar_Duplicate_Check.pdf"
  },
  {
    id: "delay_excuse_verification",
    title: "Delay Excuse Verification",
    description: "Audits weather, GPS, and schedule records to verify extension excuses.",
    icon: CloudRain,
    topColor: "#60A5FA",
    titleColor: "#60A5FA",
    presetPrompt: "Contractor claims 14 day delay due to rain and high winds",
    presetFile: "Delay_Claim_Form_RevB.pdf"
  },
  {
    id: "missing_purchase_detector",
    title: "Missing Purchase Detector",
    description: "Scans physical material installations to detect unbooked inventory.",
    icon: PackageSearch,
    topColor: "#F87171",
    titleColor: "#F87171",
    presetPrompt: "Cross-reference site walk materials against approved purchase order catalog",
    presetFile: "Site_Walk_Inspection_Photos.zip"
  },
  {
    id: "bid_integrity_collusion",
    title: "Bid Integrity & Collusion",
    description: "Identifies pricing anomalies and complementary bids across vendor entries.",
    icon: ShieldAlert,
    topColor: "#7D39EB",
    titleColor: "#7D39EB",
    presetPrompt: "Analyze submitted bid packages for complementary bidding and shared metadata",
    presetFile: "Concrete_Bid_Submissions_2026.csv"
  },
  {
    id: "material_authentication",
    title: "Material Authentication",
    description: "Verifies mill test reports, heat stamps, and physical material specifications.",
    icon: Fingerprint,
    topColor: "#60A5FA",
    titleColor: "#60A5FA",
    presetPrompt: "Verify mill test reports and heat stamps for high-tensile reinforcement steel",
    presetFile: "Mill_Certification_Report_10294.pdf"
  },
  {
    id: "factory_cloud",
    title: "Factory Cloud Logs",
    description: "Streams remote mill sensors and fabrication status to match dispatch manifests.",
    icon: Factory,
    topColor: "#7D39EB",
    titleColor: "#7D39EB",
    presetPrompt: "Verify factory logs and mill timestamps for steel beam production line",
    presetFile: "Factory_Production_Logs.json"
  },
  {
    id: "statutory_deadline_tracker",
    title: "Statutory Deadline Tracker",
    description: "Monitors notice to owner, mechanics lien, and prompt payment compliance dates.",
    icon: Landmark,
    topColor: "#C6FF33",
    titleColor: "#C6FF33",
    presetPrompt: "Check mechanic lien and NTO filing deadlines for contract PO-88213",
    presetFile: "NTO_Notice_To_Owner_Filing.pdf"
  },
  {
    id: "pay_application_installation_proof",
    title: "Pay Application Proof",
    description: "Correlates on-site installation percentage with monthly invoice draw requests.",
    icon: Banknote,
    topColor: "#C6FF33",
    titleColor: "#C6FF33",
    presetPrompt: "Review Pay App Draw 5 installation proof photos for structural concrete",
    presetFile: "Pay_App_5_Installation_Photos.zip"
  },
  {
    id: "payment_wage_integrity",
    title: "Payment & Wage Integrity",
    description: "Cross-checks union pay rates, prevailing wage certs, and lien releases.",
    icon: CheckCircle2,
    topColor: "#60A5FA",
    titleColor: "#60A5FA",
    presetPrompt: "Verify prevailing wage payroll records and certified payroll logs",
    presetFile: "Certified_Payroll_Report_Week22.pdf"
  }
];

/* ─────────────────────────────────────────────────────────
   SPLIT CARD — colored top + dark bottom + circle icon badge
───────────────────────────────────────────────────────── */
function SkillCard({
  skill,
  isCentered,
  isOut,
  isFinalWinner,
}: {
  skill: Skill;
  isCentered: boolean;
  isOut: boolean;
  isWinner: boolean;
  isFinalWinner: boolean;
}) {
  const Icon = skill.icon;
  const TOP_H = 115;

  return (
    <motion.div
      animate={{
        y:       isCentered && !isOut ? -20 : 0,
        scale:   isFinalWinner ? 1.08 : isCentered && !isOut ? 1.03 : isOut ? 0.92 : 1,
        opacity: isOut ? 0.35 : 1,
        filter:  isOut ? "brightness(0.65) blur(1.5px)" : "brightness(1) blur(0px)",
        zIndex:  isFinalWinner ? 30 : isCentered ? 10 : 1,
      }}
      transition={
        isFinalWinner
          ? { type: "spring", stiffness: 220, damping: 20 }
          : { duration: 0.28, ease: "easeOut" }
      }
      style={{
        width: CARD_W,
        height: CARD_H,
        flexShrink: 0,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: isFinalWinner
          ? `0 28px 64px rgba(0,0,0,0.6), 0 0 0 2px ${SUCCESS}`
          : isCentered && !isOut
          ? `0 18px 45px rgba(0,0,0,0.4)`
          : `0 6px 20px rgba(0,0,0,0.3)`,
        position: "relative",
      }}
    >
      {/* ── TOP COLORED SECTION */}
      <div
        style={{
          height: TOP_H,
          background: skill.topColor,
          position: "relative",
        }}
      >
        <div style={{
          position: "absolute", top: 12, right: 14,
          width: 10, height: 10, borderRadius: "50%",
          background: "rgba(255,255,255,0.25)",
        }} />
        <div style={{
          position: "absolute", top: 28, right: 30,
          width: 5, height: 5, borderRadius: "50%",
          background: "rgba(255,255,255,0.20)",
        }} />
        <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`dot-${skill.id}`} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#dot-${skill.id})`} />
        </svg>
      </div>

      {/* ── DARK bottom section */}
      <div
        style={{
          flex: 1,
          background: "#120E1C",
          padding: "48px 18px 18px",
          position: "relative",
          height: CARD_H - TOP_H,
          border: `1px solid ${BORDER}`,
          borderTop: "none",
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18
        }}
      >
        <span style={{ position: "absolute", top: 52, right: 14, color: "rgba(255,255,255,0.20)", fontSize: 16, fontWeight: 300 }}>+</span>

        <p className="text-[13.5px] font-black uppercase tracking-[0.08em] mb-0.5 text-white leading-tight">
          {skill.title}
        </p>
        <p className="text-[9.5px] uppercase tracking-[0.12em] mb-2 font-mono font-bold"
          style={{ color: SUCCESS }}>
          SENTINEL CORE MODULE
        </p>
        <p className="text-[11px] leading-relaxed text-white/60">
          {skill.description}
        </p>
      </div>

      {/* ── CIRCLE ICON BADGE */}
      <div
        style={{
          position: "absolute",
          top: TOP_H - 30,
          left: "50%",
          transform: "translateX(-50%)",
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "#120E1C",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 4px 18px rgba(0,0,0,0.5), 0 0 0 3px ${skill.topColor}`,
          zIndex: 10,
        }}
      >
        <Icon size={24} strokeWidth={1.75} style={{ color: skill.topColor }} />
      </div>

      {/* Selected badge for winner */}
      {isFinalWinner && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{
            position: "absolute", top: 10, right: 10,
            background: SUCCESS, color: CANVAS,
            borderRadius: 20, padding: "3px 10px",
            fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
            zIndex: 20,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
          }}
        >
          Active Match
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   CAROUSEL
───────────────────────────────────────────────────────── */
function SkillCarousel({
  eliminated,
  phase,
  targetIdx,
}: {
  eliminated: Set<number>;
  phase: Phase;
  passCursor: number;
  targetIdx: number | null;
}) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const trackRef      = useRef<HTMLDivElement>(null);
  const offsetRef     = useRef(0);
  const pausedRef     = useRef(false);
  const snapTargetRef = useRef<number | null>(null);
  const [centeredIdx, setCenteredIdx] = useState(0);

  useEffect(() => {
    if (phase === "centering" && targetIdx !== null) {
      pausedRef.current = true;
      const container = containerRef.current;
      if (!container) return;
      const viewW = container.offsetWidth;
      const targetOffset = SKILLS.length * CARD_STRIDE + targetIdx * CARD_STRIDE - viewW / 2 + CARD_W / 2;
      snapTargetRef.current = targetOffset;
    }
    if (phase === "idle") {
      pausedRef.current = false;
      snapTargetRef.current = null;
    }
  }, [phase, targetIdx]);

  const items  = [...SKILLS, ...SKILLS, ...SKILLS];
  const TOTAL_W = SKILLS.length * CARD_STRIDE;

  const isFinalWinner = (realIdx: number) =>
    (phase === "revealed") && targetIdx === realIdx;

  useAnimationFrame(() => {
    const track     = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;

    const viewW = container.offsetWidth;

    if (snapTargetRef.current !== null) {
      const diff = snapTargetRef.current - offsetRef.current;
      if (Math.abs(diff) < 0.5) {
        offsetRef.current = snapTargetRef.current;
      } else {
        offsetRef.current += diff * 0.08;
      }
    } else if (!pausedRef.current) {
      offsetRef.current += SCROLL_SPEED;
      if (offsetRef.current >= TOTAL_W) offsetRef.current -= TOTAL_W;
    }

    track.style.transform = `translateX(-${offsetRef.current}px)`;

    const viewCenter = offsetRef.current + viewW / 2;
    const rawIdx = Math.round(viewCenter / CARD_STRIDE);
    const idx = ((rawIdx % SKILLS.length) + SKILLS.length) % SKILLS.length;
    setCenteredIdx(idx);
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden border rounded-[16px] shadow-inner"
      style={{ paddingTop: 32, paddingBottom: 32, background: "rgba(0, 0, 0, 0.25)", borderColor: BORDER }}
      onMouseEnter={() => { if (phase === "idle") pausedRef.current = true; }}
      onMouseLeave={() => { if (phase === "idle") pausedRef.current = false; }}
    >
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-32 z-20"
        style={{ background: `linear-gradient(to right, rgba(8, 7, 12, 0.95), transparent)` }} />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-32 z-20"
        style={{ background: `linear-gradient(to left, rgba(8, 7, 12, 0.95), transparent)` }} />

      <div
        ref={trackRef}
        className="flex will-change-transform"
        style={{ gap: CARD_GAP, width: `${items.length * CARD_STRIDE}px`, alignItems: "flex-end" }}
      >
        {items.map((skill, i) => {
          const realIdx = i % SKILLS.length;
          const isOut   = eliminated.has(realIdx);
          const isWin   = targetIdx === realIdx;
          return (
            <SkillCard
              key={`${skill.id}-${i}`}
              skill={skill}
              isCentered={centeredIdx === realIdx}
              isOut={isOut}
              isWinner={isWin}
              isFinalWinner={isFinalWinner(realIdx)}
            />
          );
        })}
      </div>
    </div>
  );
}

const PASS_DURATION_MS         = 480;
const INITIAL_DELAY_MS         = 400;
const SETTLE_DELAY_MS          = 600;
const CONTINUE_REVEAL_DELAY_MS = 700;
const SCROLL_SPEED             = 0.5;

type Phase = "idle" | "uploading" | "analyzing" | "centering" | "revealed";

function generatePassPlan(targetIdx: number) {
  const allIndices = Array.from({ length: SKILLS.length }, (_, i) => i);
  const others = allIndices.filter(i => i !== targetIdx);

  const shuffledOthers = [...others].sort(() => Math.random() - 0.5);

  const pass1 = shuffledOthers.slice(0, 2);
  const pass2 = shuffledOthers.slice(2, 4);
  const pass3 = shuffledOthers.slice(4, 6);
  const pass4 = shuffledOthers.slice(6);

  return [
    { eliminate: pass1, status: "Checking regulatory and deadline databases..." },
    { eliminate: [...pass1, ...pass2], status: "Analyzing bid pricing structures and unit costs..." },
    { eliminate: [...pass1, ...pass2, ...pass3], status: "Validating transaction ledger history..." },
    { eliminate: [...pass1, ...pass2, ...pass3, ...pass4], status: `Sentinel match confirmed ✓ Routing to ${SKILLS[targetIdx].title}` }
  ];
}

/* ─────────────────────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────────────────────── */
export function SentinelSkillSelector() {
  const [phase, setPhase]           = useState<Phase>("idle");
  const [eliminated, setEliminated] = useState<Set<number>>(new Set());
  const [passCursor, setPassCursor] = useState(-1);
  const [statusText, setStatusText] = useState("");
  const [statusType, setStatusType] = useState<"neutral" | "analyzing" | "found">("neutral");
  const [targetIdx, setTargetIdx]   = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timers       = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(t => clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const runSequence = useCallback(async (customText?: string, customFile?: string) => {
    clearTimers();
    setEliminated(new Set());
    setPassCursor(-1);
    setTargetIdx(null);
    setPhase("uploading");
    setStatusText("Document received. Analyzing procurement intent...");
    setStatusType("neutral");

    const payload = customText 
      ? { text: customText }
      : { filename: customFile || "unknown_document.pdf" };

    try {
      const response = await fetch("/api/sentinel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      const matchedId = data.feature_id || "duplicate_conflicting_order";
      const matchedIndex = SKILLS.findIndex((s) => s.id === matchedId);
      const targetIdx = matchedIndex >= 0 ? matchedIndex : 0;

      const plan = generatePassPlan(targetIdx);

      timers.current.push(setTimeout(() => {
        setPhase("analyzing");
        setStatusText("Synthesizing parameters from PDF metadata...");
        setStatusType("analyzing");
      }, INITIAL_DELAY_MS));

      plan.forEach((step, pIdx) => {
        timers.current.push(setTimeout(() => {
          setPassCursor(pIdx);
          setEliminated(new Set(step.eliminate));
          setStatusText(step.status);
          if (pIdx === plan.length - 1) {
            setStatusType("found");
          }
        }, INITIAL_DELAY_MS + (pIdx + 1) * PASS_DURATION_MS));
      });

      const centerAt = INITIAL_DELAY_MS + (plan.length + 1) * PASS_DURATION_MS;
      timers.current.push(setTimeout(() => {
        setPhase("centering");
        setTargetIdx(targetIdx);
      }, centerAt));

      timers.current.push(setTimeout(() => {
        setPhase("revealed");
      }, centerAt + CONTINUE_REVEAL_DELAY_MS));

    } catch (err) {
      console.error("Orchestration error:", err);
      setTargetIdx(0);
      setPhase("revealed");
    }
  }, [clearTimers]);

  const handleReset = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setEliminated(new Set());
    setPassCursor(-1);
    setStatusText("");
    setStatusType("neutral");
    setTargetIdx(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [clearTimers]);

  const isBusy = phase !== "idle";

  return (
    <div className="w-full max-w-7xl mx-auto p-6 md:p-10 space-y-8 glass-panel text-white">
      {/* ── HEADER ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 animate-fade-up" style={{ borderColor: BORDER }}>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-[4px] bg-white/5 text-purple-400 border border-purple-500/20 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" /> SENTINEL ENGINE
            </span>
            <span className="flex items-center gap-1.5 text-[12px] font-mono text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              9 Moving Modules Active
            </span>
          </div>
          <h1 className="text-[32px] font-bold text-white tracking-tight">
            Intelligent Procurement Sentinel
          </h1>
          <p className="text-[14.5px] mt-1" style={{ color: INK2 }}>
            Upload any document or click a preset to see the moving cards filter, zoom, and open the active module.
          </p>
        </div>

        {phase === "revealed" && (
          <Button
            onClick={handleReset}
            className="bg-[#C6FF33] hover:bg-[#b0f020] text-black font-bold gap-2 shrink-0 rounded-[8px] border-none px-5 shadow-lg transition-transform hover:-translate-y-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Scan Another File
          </Button>
        )}
      </div>

      {/* ── UPLOAD ZONE ────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!isBusy && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-5 animate-fade-up"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-[16px] border-2 border-dashed flex flex-col items-center gap-3 py-12 transition-all duration-300 cursor-pointer group"
              style={{ borderColor: BORDER, background: "rgba(255, 255, 255, 0.01)" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = SUCCESS)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <UploadCloud size={36} strokeWidth={1.5} style={{ color: SUCCESS }} />
              </motion.div>
              <div className="text-center px-4">
                <p className="text-[17px] font-bold text-white">
                  Drop procurement document / file here
                </p>
                <p className="text-[13.5px] mt-1" style={{ color: INK2 }}>
                  Purchase Order, Weather Invoice, Bid packages, Mill Certifications — Sentinel automates the routing
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {["Purchase Order", "Delay Claim", "Bid Log", "Mill test"].map(label => (
                  <span key={label} className="text-[11px] font-semibold px-2.5 py-1 rounded-[4px]"
                    style={{ background: "rgba(255, 255, 255, 0.03)", color: INK2, border: `1px solid ${BORDER}` }}>
                    {label}
                  </span>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    runSequence(undefined, e.target.files[0].name);
                  }
                }}
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QUICK PRESETS ─────────────────────────────── */}
      {!isBusy && (
        <div className="pt-4 border-t animate-fade-up" style={{ borderColor: BORDER }}>
          <span className="text-[11px] font-bold uppercase tracking-wider block mb-2.5" style={{ color: SUCCESS }}>
            ⚡ CLICK ANY PRESET TO DEMO MOVING CARDS ROUTING SEQUENCE:
          </span>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((skill) => {
              const Icon = skill.icon;
              return (
                <button
                  key={skill.id}
                  onClick={() => runSequence(skill.presetPrompt, skill.presetFile)}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#C6FF33] rounded-[8px] text-[12px] font-semibold text-white transition-all shadow-sm"
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: SUCCESS }} />
                  <span>{skill.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STATUS LINE ────────────────────────────────── */}
      <div className="flex items-center justify-center min-h-[36px] my-3">
        <AnimatePresence mode="wait">
          {statusText && (
            <motion.div key={statusText}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}
              className="flex items-center gap-2.5 bg-black/60 px-4 py-2 rounded-full border shadow-lg text-white"
              style={{ borderColor: BORDER }}
            >
              {phase === "analyzing" && (
                <span className="flex h-2.5 w-2.5 rounded-full animate-pulse bg-purple-500" />
              )}
              {statusType === "found" && (
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              )}
              <p className="text-[13.5px] font-bold font-mono text-center">
                {statusText}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── CAROUSEL ───────────────────────────────────── */}
      <AnimatePresence>
        {isBusy && phase !== "revealed" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <SkillCarousel
              eliminated={eliminated}
              phase={phase}
              passCursor={passCursor}
              targetIdx={targetIdx}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "revealed" && targetIdx !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="mt-6"
          >
            <div className="animate-ai-generate flex flex-col gap-4">
              <div
                className="border px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[16px] bg-[#120E1C]"
                style={{
                  borderColor: SUCCESS,
                  borderTopWidth: "3px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      Routed Sentinel Module
                    </span>
                    <span className="text-[12px] font-mono text-white/50">
                      ID: {SKILLS[targetIdx].id}
                    </span>
                  </div>
                  <p className="text-[19px] font-bold text-white">
                    {SKILLS[targetIdx].title}
                  </p>
                  <p className="text-[13px] text-white/60 mt-0.5">
                    {SKILLS[targetIdx].description}
                  </p>
                </div>
              </div>

              {/* Render the full feature component UI */}
              <SentinelFeatureRenderer skillId={SKILLS[targetIdx].id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DIRECT SKILL SWITCHER BAR ────────────────── */}
      <div className="mt-8 pt-6 border-t" style={{ borderColor: BORDER }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-3 text-white/40">
          Or Mount Feature Module Directly (Manual Override)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {SKILLS.map((skill, idx) => {
            const Icon = skill.icon;
            const isSelected = phase === "revealed" && targetIdx === idx;
            return (
              <button
                key={skill.id}
                onClick={() => {
                  clearTimers();
                  setPhase("revealed");
                  setTargetIdx(idx);
                  setStatusText(`Manual selection — activated ${skill.title}`);
                  setStatusType("found");
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-[8px] text-left transition-all duration-200 border"
                style={{
                  background: isSelected ? SUCCESS : "rgba(255, 255, 255, 0.02)",
                  color: isSelected ? CANVAS : INK,
                  borderColor: isSelected ? SUCCESS : BORDER,
                }}
              >
                <div
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0"
                  style={{
                    background: isSelected ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.05)",
                    color: isSelected ? CANVAS : SUCCESS,
                  }}
                >
                  <Icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold truncate leading-tight">{skill.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RESET ──────────────────────────────────────── */}
      {isBusy && (
        <div className="flex justify-center mt-6">
          <button onClick={handleReset}
            className="text-[12px] font-bold underline underline-offset-4 text-white/50 hover:text-white transition-colors">
            Reset Scanner
          </button>
        </div>
      )}

    </div>
  );
}
