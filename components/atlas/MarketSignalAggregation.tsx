"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Flame, AlertCircle } from "lucide-react";

const tokens = {
  background: "var(--background, #08070C)",
  foreground: "var(--foreground, #FFFFFF)",
  muted: "var(--muted, rgba(255, 255, 255, 0.08))",
  mutedForeground: "var(--muted-foreground, rgba(245, 243, 239, 0.45))",
  accent: "var(--accent, #7D39EB)",
  surfaceCard: "var(--surface-card, #120E1C)",
  surfaceFloating: "var(--surface-floating, #1C172E)",
  success: "var(--success, #C6FF33)",
  warning: "var(--warning, #FBBF24)",
  danger: "var(--danger, #F87171)",
  info: "var(--info, #60A5FA)",
  ai: "var(--ai, #7D39EB)",
} as const;

const shadowEmboss = "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)";

interface MarketSignal {
  id: string;
  source: string;
  category: "Tariff" | "Logistic" | "Commodity" | "Macro";
  headline: string;
  impactScore: number; // 1-10
  sentiment: "bearish" | "bullish" | "neutral";
  detectedAt: string;
}

const SIGNALS: MarketSignal[] = [
  {
    id: "s1",
    source: "Federal Register",
    category: "Tariff",
    headline: "Import tariff schedule amendments formally published — South Korea steel products face 25% surcharge",
    impactScore: 9,
    sentiment: "bearish",
    detectedAt: "2 hours ago",
  },
  {
    id: "s2",
    source: "LME (London Metal Exchange)",
    category: "Commodity",
    headline: "Copper stock inventories touch 14-month lows on heavy East Asian manufacturing draws",
    impactScore: 7,
    sentiment: "bullish",
    detectedAt: "4 hours ago",
  },
  {
    id: "s3",
    source: "Houston Port Authority",
    category: "Logistic",
    headline: "Average container dwell times rise to 4.8 days as labor shortages delay offload queuing",
    impactScore: 8,
    sentiment: "bearish",
    detectedAt: "6 hours ago",
  },
  {
    id: "s4",
    source: "US Bureau of Labor Statistics",
    category: "Macro",
    headline: "Texas construction wage index registers 4.8% annualized growth rate for Q2 2026",
    impactScore: 6,
    sentiment: "bearish",
    detectedAt: "1 day ago",
  },
];

export default function MarketSignalAggregation() {
  const [selectedSignal, setSelectedSignal] = useState<MarketSignal | null>(null);

  return (
    <div
      className="min-h-full w-full p-6"
      style={{ background: tokens.background, color: tokens.foreground, fontFamily: "Inter, sans-serif" }}
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-5"
        >
          <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
            Atlas · Market Signal Aggregation
          </span>
          <h1 className="text-2xl font-semibold mt-1">Market Signals &amp; Sentiment Aggregation</h1>
          <p className="text-xs mt-1" style={{ color: tokens.mutedForeground }}>
            Aggregating external trade indices, federal registry reports, and spot market benchmarks
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3" style={{ gridAutoRows: "minmax(200px, auto)" }}>
          {/* Signal Feed */}
          <Card
            className="md:col-span-2 p-5 flex flex-col justify-between"
            style={{ background: tokens.surfaceCard, borderColor: tokens.muted, boxShadow: shadowEmboss }}
          >
            <div>
              <span className="text-xs uppercase tracking-wider" style={{ color: tokens.mutedForeground }}>
                Real-Time Monitored Signals
              </span>
              <div className="flex flex-col gap-2.5 mt-3">
                {SIGNALS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSignal(s)}
                    className="p-3 rounded-lg border text-left flex items-start justify-between gap-4 transition-all hover:bg-white/5"
                    style={{
                      background: selectedSignal?.id === s.id ? "rgba(125,57,235,0.12)" : "transparent",
                      borderColor: selectedSignal?.id === s.id ? tokens.accent : tokens.muted,
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-[9px] px-1.5 py-0 border-0" style={{ background: "rgba(255,255,255,0.05)", color: tokens.foreground }}>
                          {s.category}
                        </Badge>
                        <span className="text-[10px]" style={{ color: tokens.mutedForeground }}>{s.source} · {s.detectedAt}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-white line-clamp-1">{s.headline}</h4>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-semibold" style={{ color: s.sentiment === "bearish" ? tokens.danger : s.sentiment === "bullish" ? tokens.success : tokens.mutedForeground }}>
                        {s.sentiment.toUpperCase()}
                      </span>
                      <Badge className="text-[10px] bg-white/5 border border-white/10 text-white font-mono rounded">
                        Score: {s.impactScore}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Sentiment overview */}
          <Card
            className="p-5 flex flex-col justify-between"
            style={{ background: tokens.surfaceCard, borderColor: tokens.muted, boxShadow: shadowEmboss }}
          >
            <div>
              <span className="text-xs uppercase tracking-wider" style={{ color: tokens.mutedForeground }}>
                Aggregate Sentiment Analysis
              </span>
              <div className="mt-4 text-center p-4 rounded-xl" style={{ background: "rgba(248,113,113,0.05)" }}>
                <Flame className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                <h3 className="text-base font-semibold text-rose-400">Moderately Bearish</h3>
                <p className="text-xs mt-1" style={{ color: tokens.mutedForeground }}>
                  Driven by port labor backlogs and East Asian steel tariffs.
                </p>
              </div>
            </div>

            <div className="border-t pt-3" style={{ borderColor: tokens.muted }}>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.mutedForeground }}>
                Active Crawlers
              </span>
              <div className="flex justify-between text-xs mt-1" style={{ color: tokens.mutedForeground }}>
                <span>Federal Registry</span>
                <span className="text-emerald-400 font-semibold">Active</span>
              </div>
              <div className="flex justify-between text-xs" style={{ color: tokens.mutedForeground }}>
                <span>LME Indices</span>
                <span className="text-emerald-400 font-semibold">Active</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
