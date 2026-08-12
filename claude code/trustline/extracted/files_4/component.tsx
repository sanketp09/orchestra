"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Design tokens — ORCHESTRA system (Dark Glassmorphic Neo-Industrial Theme)
// ---------------------------------------------------------------------------
const tokens = {
  background: "#08070C",
  foreground: "#FFFFFF",
  muted: "rgba(255, 255, 255, 0.08)",
  mutedForeground: "rgba(255, 255, 255, 0.45)",
  accent: "#7D39EB",
  surfaceCard: "rgba(255, 255, 255, 0.02)",
  surfaceFloating: "rgba(255, 255, 255, 0.04)",
  success: "#C6FF33",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#38BDF8",
  ai: "#7D39EB",
};

interface BackupVendor {
  id: string;
  name: string;
  trade: string;
  location: string;
  trustScore: number;
  capacityScore: number;
  reasoning: string;
}

const BACKUP_VENDORS: BackupVendor[] = [
  {
    id: "vendor_titan_fab",
    name: "Titan Fabricators",
    trade: "Structural Steel",
    location: "Houston, TX",
    trustScore: 88,
    capacityScore: 92,
    reasoning: "Ranked #1 — highest trust score in Structural Steel, stable financials, no active flags."
  },
  {
    id: "vendor_lonestar_steel",
    name: "Lonestar Steelworks",
    trade: "Structural Steel",
    location: "Dallas, TX",
    trustScore: 79,
    capacityScore: 85,
    reasoning: "Ranked #2 — strong delivery log, slight delay flags last quarter."
  },
  {
    id: "vendor_apex_metal",
    name: "Apex Metalworks",
    trade: "Structural Steel",
    location: "San Antonio, TX",
    trustScore: 72,
    capacityScore: 80,
    reasoning: "Ranked #3 — acceptable quality scores, limited bonding capacity."
  },
  {
    id: "vendor_coastal_bolt",
    name: "Coastal Bolt & Fastener",
    trade: "Fasteners & Hardware",
    location: "Galveston, TX",
    trustScore: 54,
    capacityScore: 40,
    reasoning: "Ranked #4 — flagged for financial distress (UCC lien). Not recommended."
  }
];

function RadialScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const strokeW = 5;
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? tokens.success : score >= 60 ? tokens.warning : tokens.danger;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - fill }}
        transition={{ duration: 1.0, ease: "easeOut" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        className="text-[12px] font-bold fill-current"
        style={{ color: tokens.foreground }}
      >
        {score}
      </text>
    </svg>
  );
}

export default function BackupSupplierDiscovery() {
  const [selectedTrade, setSelectedTrade] = useState<string>("All");
  const [selectedLocation, setSelectedLocation] = useState<string>("All");
  const [reservedIds, setReservedIds] = useState<Record<string, boolean>>({});

  const filteredVendors = BACKUP_VENDORS.filter((vendor) => {
    const tradeMatch = selectedTrade === "All" || vendor.trade === selectedTrade;
    const locationMatch = selectedLocation === "All" || vendor.location.includes(selectedLocation);
    return tradeMatch && locationMatch;
  }).sort((a, b) => b.trustScore - a.trustScore);

  const toggleReserve = (id: string) => {
    setReservedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const CARD_EMBOSSED =
    "border border-white/5 rounded-[12px] bg-white/[0.02] backdrop-blur-md shadow-lg";

  const HERO_GLASS =
    "border border-white/10 rounded-[12px] bg-white/[0.04] backdrop-blur-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.2)]";

  return (
    <div className="w-full px-6 py-8 text-foreground" style={{
      "--background": tokens.background,
      "--foreground": tokens.foreground,
      "--muted": tokens.muted,
      "--muted-foreground": tokens.mutedForeground,
      "--accent": tokens.accent,
    } as any}>
      <div className="mx-auto max-w-[1000px] flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <Badge className="self-start rounded-[4px] border border-white/10 px-2 py-0.5 text-[11.5px] font-medium bg-white/5 text-[var(--accent)]">
            Alternative Sourcing & Redundancy
          </Badge>
          <h1 className="text-[28px] font-bold leading-tight">Backup Supplier Discovery</h1>
          <p className="text-[14px] text-muted-foreground">
            Ranked backup candidates matching Meridian Steel Fabrication's scope (Structural Steel) ordered by trust score.
          </p>
        </div>

        {/* Filters */}
        <div className={cn(CARD_EMBOSSED, "p-4 flex flex-wrap gap-4 items-center justify-between")}>
          <div className="flex gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Trade Filter</span>
              <div className="flex gap-2">
                {["All", "Structural Steel", "Fasteners & Hardware"].map((trade) => (
                  <button
                    key={trade}
                    onClick={() => setSelectedTrade(trade)}
                    className={cn(
                      "px-3 py-1 text-[12px] font-medium rounded-full transition-colors border",
                      selectedTrade === trade
                        ? "bg-[#C6FF33] text-black border-[#C6FF33]"
                        : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                    )}
                  >
                    {trade}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Location Filter</span>
              <div className="flex gap-2">
                {["All", "Houston", "Dallas", "San Antonio", "Galveston"].map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setSelectedLocation(loc)}
                    className={cn(
                      "px-3 py-1 text-[12px] font-medium rounded-full transition-colors border",
                      selectedLocation === loc
                        ? "bg-[#C6FF33] text-black border-[#C6FF33]"
                        : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                    )}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-[12px] text-muted-foreground font-medium">
            Found {filteredVendors.length} matching candidate{filteredVendors.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Bento Grid */}
        <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-6" layout>
          <AnimatePresence mode="popLayout">
            {filteredVendors.map((vendor, index) => {
              const isTopPick = index === 0 && vendor.trustScore > 80;
              const isReserved = !!reservedIds[vendor.id];

              return (
                <motion.div
                  key={vendor.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className={cn(
                    isTopPick ? "md:col-span-2" : "col-span-1",
                    isTopPick ? HERO_GLASS : CARD_EMBOSSED,
                    "p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300"
                  )}
                >
                  {isTopPick && (
                    <div className="absolute top-0 right-0 bg-[#C6FF33] text-black px-3 py-1 text-[10px] uppercase font-bold rounded-bl-lg tracking-wider">
                      Top Backup Recommendation
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[18px] font-bold tracking-tight">{vendor.name}</h3>
                        <Badge className="bg-transparent border border-white/10 text-[#C6FF33] text-[11px] font-normal px-2 py-0">
                          {vendor.trade}
                        </Badge>
                      </div>
                      <span className="text-[12px] text-muted-foreground font-medium">{vendor.location}</span>
                    </div>

                    <RadialScoreRing score={vendor.trustScore} />
                  </div>

                  <p className="mt-4 text-[13px] text-muted-foreground leading-relaxed italic bg-white/5 p-3 rounded-lg border border-white/5">
                    {vendor.reasoning}
                  </p>

                  <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/5 pt-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold">Reserve Capacity</span>
                      <span className="text-[13px] font-bold text-[#C6FF33]">Available immediately</span>
                    </div>

                    <Button
                      onClick={() => toggleReserve(vendor.id)}
                      className={cn(
                        "rounded-[6px] px-4 py-2 text-[12px] font-bold transition-all flex items-center gap-2 shadow-sm border-0",
                        isReserved
                          ? "bg-[#C6FF33] hover:bg-[#b0f020] text-black"
                          : "bg-[#7D39EB] hover:bg-[#682ad4] text-white"
                      )}
                    >
                      {isReserved ? (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          Capacity Reserved
                        </>
                      ) : (
                        "Reserve Capacity"
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {filteredVendors.length === 0 && (
          <div className={cn(CARD_EMBOSSED, "py-16 text-center text-muted-foreground flex flex-col items-center gap-2")}>
            <svg className="h-10 w-10 text-muted-foreground opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-bold text-[14px]">No matching backup suppliers found</p>
            <p className="text-[12px]">Adjust your trade or location filters to see more candidates.</p>
          </div>
        )}
      </div>
    </div>
  );
}
