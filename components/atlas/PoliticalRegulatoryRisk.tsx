"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ShieldAlert, Scale, ChevronRight } from "lucide-react";

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

interface Event {
  id: string;
  headline: string;
  category: "Tariff" | "Geopolitical" | "Regulatory";
  date: string;
  affected: string;
  severity: "danger" | "warning" | "info";
  detail: string;
}

const EVENTS: Event[] = [
  {
    id: "e1",
    headline: "25% South Korean Steel & Electrical Import Tariff finalization",
    category: "Tariff",
    date: "Aug 10",
    affected: "Switchgear Shipment #4471 · Meridian Steel",
    severity: "danger",
    detail: "New executive trade order increases the landing cost on steel products originating from South Korea by 25% starting September 1st.",
  },
  {
    id: "e2",
    headline: "Gulf Coast marine security advisory issued",
    category: "Geopolitical",
    date: "Aug 08",
    affected: "All inbound Gulf of Mexico shipments",
    severity: "warning",
    detail: "High-density vessel routes are subject to additional safety inspection checklists, possibly creating 2-3 day customs bottlenecks.",
  },
  {
    id: "e3",
    headline: "Domestic green steel sourcing mandate review",
    category: "Regulatory",
    date: "Aug 02",
    affected: "Austin Semiconductor Fab phase 3",
    severity: "info",
    detail: "New Congressional proposal to subsidize domestic green-certified iron/steel sourcing on federally-backed semiconductor projects.",
  },
];

export default function PoliticalRegulatoryRisk() {
  const [selectedEvent, setSelectedEvent] = useState<Event>(EVENTS[0]);

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
            Atlas · Political &amp; Regulatory Risk
          </span>
          <h1 className="text-2xl font-semibold mt-1">Political &amp; Regulatory Risk Monitoring</h1>
          <p className="text-xs mt-1" style={{ color: tokens.mutedForeground }}>
            Tracking global trade orders, regulatory changes, and local risk signals
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3" style={{ gridAutoRows: "minmax(220px, auto)" }}>
          {/* Feed style list of events */}
          <Card
            className="md:col-span-2 p-5 flex flex-col gap-4"
            style={{ background: tokens.surfaceCard, borderColor: tokens.muted, boxShadow: shadowEmboss }}
          >
            <div>
              <span className="text-xs uppercase tracking-wider" style={{ color: tokens.mutedForeground }}>
                Recent Risk Events Feed
              </span>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto pr-1">
              {EVENTS.map((e) => {
                const isSelected = selectedEvent.id === e.id;
                const badgeColor = e.severity === "danger" ? tokens.danger : e.severity === "warning" ? tokens.warning : tokens.info;

                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    className="p-3 rounded-lg border text-left flex items-start justify-between gap-4 transition-all hover:bg-white/5"
                    style={{
                      background: isSelected ? "rgba(125,57,235,0.12)" : "transparent",
                      borderColor: isSelected ? tokens.accent : tokens.muted,
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="text-[9px] px-1.5 py-0 border-0" style={{ background: `color-mix(in srgb, ${badgeColor} 15%, transparent)`, color: badgeColor }}>
                          {e.category}
                        </Badge>
                        <span className="text-[10px]" style={{ color: tokens.mutedForeground }}>{e.date}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-white line-clamp-1">{e.headline}</h4>
                      <p className="text-[10px]" style={{ color: tokens.mutedForeground }}>Affects: {e.affected}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0 mt-2 opacity-40" />
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Details Panel */}
          <Card
            className="p-5 flex flex-col justify-between"
            style={{ background: tokens.surfaceCard, borderColor: tokens.muted, boxShadow: shadowEmboss }}
          >
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-wider" style={{ color: tokens.mutedForeground }}>
                Event Impact Detail
              </span>
              <h3 className="text-sm font-bold text-white">{selectedEvent.headline}</h3>
              <p className="text-xs leading-relaxed" style={{ color: tokens.mutedForeground }}>
                {selectedEvent.detail}
              </p>
            </div>

            <div className="border-t pt-3" style={{ borderColor: tokens.muted }}>
              <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: tokens.mutedForeground }}>
                Monitored Scope &amp; Regions
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Badge className="text-[9px] bg-white/5 border border-white/10 text-white rounded">US-KR Trade</Badge>
                <Badge className="text-[9px] bg-white/5 border border-white/10 text-white rounded">Metal Tariffs</Badge>
                <Badge className="text-[9px] bg-white/5 border border-white/10 text-white rounded">Houston Ports</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
