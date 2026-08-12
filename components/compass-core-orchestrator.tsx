"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  Compass,
  Clock,
  Calculator,
  GitBranch,
  Skull,
  Waves,
  Scan,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Import Compass components
import DecisionDebtLedger from "@/components/compass/DecisionDebtLedger";
import ProcurementOpportunity from "@/components/compass/ProcurementOpportunity";
import WarrantyClockTracker from "@/components/compass/WarrantyClockTracker";
import ClauseValueCalculator from "@/components/compass/ClauseValueCalculator";
import CompanyPatternBreak from "@/components/compass/CompanyPatternBreak";
import PreMortemGenerator from "@/components/compass/PreMortemGenerator";
import RippleCheck from "@/components/compass/RippleCheck";
import ProcurementXRay from "@/components/compass/ProcurementXRay";

/* ── COLOR TOKENS ── */
const CANVAS = "#08070C";
const BORDER = "rgba(255, 255, 255, 0.08)";
const SUCCESS = "#C6FF33"; // Electric Lime
const ACCENT = "#7D39EB"; // Brand Violet

export interface CompassModuleMeta {
  id: string;
  number: string;
  name: string;
  icon: any;
  category: string;
  description: string;
}

export const COMPASS_MODULES: CompassModuleMeta[] = [
  {
    id: "decision_debt_ledger",
    number: "01",
    name: "Decision Debt Ledger",
    icon: Scale,
    category: "Risk Control",
    description: "Tracks calculated risk, accumulated decision debt, exposure index, and scheduling milestones.",
  },
  {
    id: "procurement_opportunity",
    number: "02",
    name: "Procurement Opportunity Radar",
    icon: Compass,
    category: "Cost Savings",
    description: "Identifies volume bundling, cross-project material grouping, and timing optimizations.",
  },
  {
    id: "warranty_clock_tracker",
    number: "03",
    name: "Warranty Clock Tracker",
    icon: Clock,
    category: "Operations",
    description: "Monitors contract warranties, manufacturer timelines, and notification windows dynamically.",
  },
  {
    id: "clause_value_calculator",
    number: "04",
    name: "Clause Value Calculator",
    icon: Calculator,
    category: "Contract Value",
    description: "Translates legal concessions and payment terms into explicit project dollar values.",
  },
  {
    id: "company_pattern_break",
    number: "05",
    name: "Company Pattern Break Audits",
    icon: GitBranch,
    category: "Compliance",
    description: "Flags deviations from historical organization-level weights across cost, risk, and schedule.",
  },
  {
    id: "pre_mortem_generator",
    number: "06",
    name: "Pre-Mortem Risk Simulator",
    icon: Skull,
    category: "Proactive Risk",
    description: "Generates project failure pathways, assigning severity weights and preventative mitigations.",
  },
  {
    id: "ripple_check",
    number: "07",
    name: "Ripple Impact Check",
    icon: Waves,
    category: "Schedule Analysis",
    description: "Visualizes cascading delay factors and secondary consequences of critical-path overrides.",
  },
  {
    id: "procurement_xray",
    number: "08",
    name: "Procurement Deep X-Ray",
    icon: Scan,
    category: "Intelligence",
    description: "Drills into procurement submittals, vendor margins, and structural risk dimensions.",
  },
];

export function CompassCoreOrchestrator() {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  const activeModule = COMPASS_MODULES.find((m) => m.id === selectedModuleId);

  const renderModuleComponent = () => {
    switch (selectedModuleId) {
      case "decision_debt_ledger":
        return <DecisionDebtLedger />;
      case "procurement_opportunity":
        return <ProcurementOpportunity />;
      case "warranty_clock_tracker":
        return <WarrantyClockTracker />;
      case "clause_value_calculator":
        return <ClauseValueCalculator />;
      case "company_pattern_break":
        return <CompanyPatternBreak />;
      case "pre_mortem_generator":
        return <PreMortemGenerator />;
      case "ripple_check":
        return <RippleCheck />;
      case "procurement_xray":
        return <ProcurementXRay />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8 text-white relative">
      <AnimatePresence mode="wait">
        {!selectedModuleId ? (
          <motion.div
            key="dashboard-grid"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="border-b pb-6" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-[4px] bg-white/5 text-purple-400 border border-purple-500/20 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" /> COMPASS INTEL
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  8 Active Modules
                </span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Compass Procurement Intelligence
              </h1>
              <p className="text-[14px] text-white/60 mt-1">
                Evaluate legal terms, trace downstream schedule impacts, and expose transaction anomalies across the project lifecycle.
              </p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
              {COMPASS_MODULES.map((mod, idx) => {
                const Icon = mod.icon;
                return (
                  <motion.button
                    key={mod.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.35 }}
                    onClick={() => setSelectedModuleId(mod.id)}
                    className="group relative flex flex-col text-left rounded-[16px] border border-white/5 bg-[#120E1C]/50 hover:bg-[#120E1C] p-5 transition-all duration-300 hover:-translate-y-1"
                    style={{
                      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                    }}
                  >
                    {/* Hover Glow Accent */}
                    <div
                      className="absolute inset-0 rounded-[16px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{
                        boxShadow: `0 0 24px rgba(125, 57, 235, 0.15), inset 0 0 12px rgba(125, 57, 235, 0.05)`,
                        border: `1px solid rgba(125, 57, 235, 0.3)`,
                      }}
                    />

                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 rounded-[8px] bg-white/5 text-[#C6FF33] group-hover:text-white group-hover:bg-[#7D39EB] transition-colors duration-300">
                        <Icon size={20} />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-white/30 tracking-widest">
                        {mod.number}
                      </span>
                    </div>

                    <div className="mt-auto space-y-1.5">
                      <span className="text-[9.5px] uppercase tracking-[0.12em] font-mono font-bold text-[#7D39EB] group-hover:text-[#C6FF33] transition-colors">
                        {mod.category}
                      </span>
                      <h3 className="text-[15px] font-bold text-white leading-tight">
                        {mod.name}
                      </h3>
                      <p className="text-[12px] text-white/50 group-hover:text-white/70 transition-colors leading-relaxed">
                        {mod.description}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="module-renderer"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* Nav Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: BORDER }}>
              <div>
                <button
                  onClick={() => setSelectedModuleId(null)}
                  className="flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-white transition-colors mb-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Compass Directory
                </button>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    {activeModule?.category}
                  </span>
                  <span className="text-[11px] font-mono text-white/40">
                    Compass Module {activeModule?.number}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white">{activeModule?.name}</h2>
              </div>

              <Button
                onClick={() => setSelectedModuleId(null)}
                className="bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 font-semibold gap-2 shrink-0 rounded-[8px] px-4 py-2"
              >
                Close Module
              </Button>
            </div>

            {/* Mount current module inside a neat theme provider context */}
            <div
              className="w-full rounded-[16px] overflow-hidden border border-purple-500/10 shadow-xl bg-[#08070C] p-1"
              style={{
                // Expose theme color tokens directly as CSS properties so that child components inherit them properly
                "--background": "#08070C",
                "--foreground": "#FFFFFF",
                "--muted": "rgba(255, 255, 255, 0.08)",
                "--muted-foreground": "rgba(245, 243, 239, 0.45)",
                "--accent": "#7D39EB",
                "--border": "rgba(255, 255, 255, 0.08)",
                "--surface-card": "#120E1C",
                "--surface-floating": "#1C172E",
                "--success": "#C6FF33",
                "--warning": "#FBBF24",
                "--danger": "#F87171",
                "--info": "#60A5FA",
                "--ai": "#7D39EB",
              } as any}
            >
              <div className="animate-ai-generate">
                {renderModuleComponent()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
