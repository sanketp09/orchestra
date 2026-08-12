"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  FileText,
  Anchor,
  CloudRain,
  AlertTriangle,
  Globe,
  Users,
  Banknote,
  RefreshCw,
  Layers,
  Sparkles,
  ArrowLeft,
  Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Import Atlas components
import CommodityIntelligence from "@/components/atlas/CommodityIntelligence";
import CustomsDutyMonitoring from "@/components/atlas/CustomsDutyMonitoring";
import PortShippingIntelligence from "@/components/atlas/PortShippingIntelligence";
import WeatherIntelligence from "@/components/atlas/WeatherIntelligence";
import PoliticalRegulatoryRisk from "@/components/atlas/PoliticalRegulatoryRisk";
import AlternateGlobalSourcing from "@/components/atlas/AlternateGlobalSourcing";
import LaborMarketIntelligence from "@/components/atlas/LaborMarketIntelligence";
import CurrencyExposure from "@/components/atlas/CurrencyExposure";
import PriceRecheckCard from "@/components/atlas/PriceRecheckCard";
import MarketSignalAggregation from "@/components/atlas/MarketSignalAggregation";
import AtlasDailyBriefing from "@/components/atlas/AtlasDailyBriefing";

/* ── COLOR TOKENS ── */
const CANVAS = "#08070C";
const BORDER = "rgba(255, 255, 255, 0.08)";
const SUCCESS = "#C6FF33"; // Electric Lime
const ACCENT = "#7D39EB"; // Brand Violet

export interface AtlasModuleMeta {
  id: string;
  number: string;
  name: string;
  icon: any;
  category: string;
  description: string;
}

export const ATLAS_MODULES: AtlasModuleMeta[] = [
  {
    id: "commodity_intelligence",
    number: "01",
    name: "Commodity Intelligence",
    icon: TrendingUp,
    category: "Market Pricing",
    description: "Tracks spot material prices, project budget thresholds, and predicts future procurement cost drifts.",
  },
  {
    id: "customs_duty",
    number: "02",
    name: "Customs & Duty Monitoring",
    icon: FileText,
    category: "Compliance",
    description: "Monitors import tariff updates, duty structures, and tax exposure for international shipment lanes.",
  },
  {
    id: "port_shipping",
    number: "03",
    name: "Port & Shipping Intelligence",
    icon: Anchor,
    category: "Logistics",
    description: "Traces real-time cargo vessels, detects transit congestion, and forecasts alternative port rerouting.",
  },
  {
    id: "weather_intelligence",
    number: "04",
    name: "Weather Intelligence",
    icon: CloudRain,
    category: "Risk Control",
    description: "Evaluates severe marine forecasts, lightning vectors, and local site disruption warnings.",
  },
  {
    id: "political_regulatory",
    number: "05",
    name: "Political & Regulatory Risk",
    icon: AlertTriangle,
    category: "Trade Policy",
    description: "Aggregates foreign trade sanctions, executive import decrees, and supply network barriers.",
  },
  {
    id: "alternate_sourcing",
    number: "06",
    name: "Alternate Global Sourcing",
    icon: Globe,
    category: "Supply Chain",
    description: "Identifies backup supplier profiles, lead-time indexes, and starts prequalification request flows.",
  },
  {
    id: "labor_market",
    number: "07",
    name: "Labor Market Intelligence",
    icon: Users,
    category: "Labor Economics",
    description: "Monitors regional wage rates, trade union actions, and local contractor staffing risk indices.",
  },
  {
    id: "currency_exposure",
    number: "08",
    name: "Currency Exposure",
    icon: Banknote,
    category: "FX Risk",
    description: "Tracks exchange rates, PO currency fluctuation exposure, and suggests hedge-locking triggers.",
  },
  {
    id: "price_recheck",
    number: "09",
    name: "Price Re-Check",
    icon: RefreshCw,
    category: "Cost Control",
    description: "Re-evaluates vendor price agreements against spot benchmarks right before placing orders.",
  },
  {
    id: "market_signal_aggregation",
    number: "10",
    name: "Market Signal Aggregation",
    icon: Layers,
    category: "Intelligence",
    description: "Consolidates trade press sentiment, federal registers, and exchange indices into cohesive alerts.",
  },
];

export function AtlasCoreOrchestrator() {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [showDailyBriefing, setShowDailyBriefing] = useState<boolean>(true);

  const activeModule = ATLAS_MODULES.find((m) => m.id === selectedModuleId);

  const handleSelectBriefingTile = (slug: string) => {
    // Map the briefing tile slug to module ID
    const mapping: Record<string, string> = {
      political_regulatory_risk: "political_regulatory",
      shipment_delay_risk: "port_shipping",
      customs_delay: "customs_duty",
      weather_disruption: "weather_intelligence",
      alternate_sourcing: "alternate_sourcing",
      port_congestion: "port_shipping",
      labor_disruption: "labor_market",
      commodity_price_watch: "commodity_intelligence",
      fx_exposure: "currency_exposure",
    };
    const target = mapping[slug];
    if (target) {
      setSelectedModuleId(target);
      setShowDailyBriefing(false);
    }
  };

  const renderModuleComponent = () => {
    switch (selectedModuleId) {
      case "commodity_intelligence":
        return <CommodityIntelligence />;
      case "customs_duty":
        return <CustomsDutyMonitoring />;
      case "port_shipping":
        return <PortShippingIntelligence />;
      case "weather_intelligence":
        return <WeatherIntelligence />;
      case "political_regulatory":
        return <PoliticalRegulatoryRisk />;
      case "alternate_sourcing":
        return <AlternateGlobalSourcing />;
      case "labor_market":
        return <LaborMarketIntelligence />;
      case "currency_exposure":
        return <CurrencyExposure />;
      case "price_recheck":
        return <PriceRecheckCard />;
      case "market_signal_aggregation":
        return <MarketSignalAggregation />;
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
            <div className="border-b pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4" style={{ borderColor: BORDER }}>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-[4px] bg-white/5 text-purple-400 border border-purple-500/20 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" /> ATLAS GLOBAL INTEL
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#C6FF33] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C6FF33] animate-pulse" />
                    10 Active Intelligence Streams
                  </span>
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white">
                  Atlas Procurement Intelligence Hub
                </h1>
                <p className="text-[14px] text-white/60 mt-1">
                  Predict global shipment delays, track spot metals prices, monitor FX drifts, and evaluate regional political risks.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setShowDailyBriefing(true)}
                  className={`rounded-[8px] px-4 py-2 font-semibold text-xs transition-all ${
                    showDailyBriefing
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                  style={{
                    background: showDailyBriefing ? ACCENT : "rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <Activity className="w-3.5 h-3.5 mr-1.5" /> Daily Briefing
                </Button>
                <Button
                  onClick={() => setShowDailyBriefing(false)}
                  className={`rounded-[8px] px-4 py-2 font-semibold text-xs transition-all ${
                    !showDailyBriefing
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                  style={{
                    background: !showDailyBriefing ? ACCENT : "rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <Layers className="w-3.5 h-3.5 mr-1.5" /> Grid Directory
                </Button>
              </div>
            </div>

            {/* Daily Briefing View vs Bento Grid */}
            <AnimatePresence mode="wait">
              {showDailyBriefing ? (
                <motion.div
                  key="daily-briefing-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  <AtlasDailyBriefing onSelectTile={handleSelectBriefingTile} />
                </motion.div>
              ) : (
                <motion.div
                  key="grid-directory-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4"
                >
                  {ATLAS_MODULES.map((mod, idx) => {
                    const Icon = mod.icon;
                    return (
                      <motion.button
                        key={mod.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04, duration: 0.3 }}
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
                          <h3 className="text-[14px] font-bold text-white leading-tight">
                            {mod.name}
                          </h3>
                          <p className="text-[11.5px] text-white/50 group-hover:text-white/70 transition-colors leading-relaxed line-clamp-3">
                            {mod.description}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
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
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Atlas Directory
                </button>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    {activeModule?.category}
                  </span>
                  <span className="text-[11px] font-mono text-white/40">
                    Atlas Stream {activeModule?.number}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white">{activeModule?.name}</h2>
              </div>

              <Button
                onClick={() => setSelectedModuleId(null)}
                className="bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 font-semibold gap-2 shrink-0 rounded-[8px] px-4 py-2"
              >
                Close Stream
              </Button>
            </div>

            {/* Themed Container */}
            <div
              className="w-full rounded-[16px] overflow-hidden border border-purple-500/10 shadow-xl bg-[#08070C] p-1"
              style={{
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
