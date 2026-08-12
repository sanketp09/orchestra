"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Shield, Plane, ArrowRight } from "lucide-react";

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

interface AlternateSupplier {
  id: string;
  name: string;
  country: string;
  leadTimeDays: number;
  capacityScore: string;
  pricingBenchmark: string;
  description: string;
}

const ALTERNATES: AlternateSupplier[] = [
  {
    id: "alt1",
    name: "Nippon Steel Heavy Industries",
    country: "Japan",
    leadTimeDays: 14,
    capacityScore: "High (Available)",
    pricingBenchmark: "+4.2% vs. current contract",
    description: "Primary heavy structural forge with direct ocean shipping routes to Houston. Excellent QA rating.",
  },
  {
    id: "alt2",
    name: "Tata Steel European Division",
    country: "Germany",
    leadTimeDays: 21,
    capacityScore: "Medium (Available)",
    pricingBenchmark: "-1.5% vs. current contract",
    description: "Highly automated German steel plating and beam forge. Duty rate is stable under EU-US agreements.",
  },
  {
    id: "alt3",
    name: "Vorex Fabrication & Structural",
    country: "Mexico",
    leadTimeDays: 5,
    capacityScore: "High (Available)",
    pricingBenchmark: "+8.0% vs. current contract",
    description: "Overland trucking shipping allows rapid site delivery, bypasses Houston port entirely. Higher base material cost.",
  },
];

export default function AlternateGlobalSourcing() {
  const [invitedSupplier, setInvitedSupplier] = useState<string | null>(null);

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
            Atlas · Alternate Global Sourcing
          </span>
          <h1 className="text-2xl font-semibold mt-1">Backup Sourcing &amp; Alternative Suppliers</h1>
          <p className="text-xs mt-1" style={{ color: tokens.mutedForeground }}>
            Sourced from global trade market indexes — not yet in your approved vendor network
          </p>
        </motion.div>

        {/* Cause / Context trigger banner */}
        <div className="mb-6 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: "rgba(248,113,113,0.05)", borderColor: "rgba(248,113,113,0.15)" }}>
          <div>
            <Badge className="bg-rose-500/10 text-rose-400 border-0 rounded text-[9px] uppercase tracking-wider font-semibold mb-1">
              Trigger Event
            </Badge>
            <p className="text-xs text-white font-semibold">South Korea import tariff &amp; Port of Houston delays affecting Shipment #4471</p>
            <p className="text-[10px]" style={{ color: tokens.mutedForeground }}>
              Atlas has scanned global structural steel supply channels outside South Korea to identify immediate risk offsets.
            </p>
          </div>
        </div>

        {/* Alternatives Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {ALTERNATES.map((supplier) => (
            <Card
              key={supplier.id}
              className="p-5 flex flex-col justify-between"
              style={{ background: tokens.surfaceCard, borderColor: tokens.muted, boxShadow: shadowEmboss }}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <Badge className="bg-purple-500/10 text-purple-400 border-0 text-[9px] rounded font-mono uppercase tracking-wider font-bold">
                    Market Option
                  </Badge>
                  <span className="text-[10px] font-semibold text-white/50">{supplier.country}</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{supplier.name}</h3>
                <p className="text-[11px] leading-relaxed mb-4" style={{ color: tokens.mutedForeground }}>
                  {supplier.description}
                </p>
              </div>

              <div className="space-y-3">
                <div className="border-t pt-3 space-y-1.5 text-xs" style={{ borderColor: tokens.muted }}>
                  <div className="flex justify-between">
                    <span style={{ color: tokens.mutedForeground }}>Est. Lead Time:</span>
                    <span className="font-semibold text-white">{supplier.leadTimeDays} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: tokens.mutedForeground }}>Benchmark:</span>
                    <span className="font-semibold text-white">{supplier.pricingBenchmark}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: tokens.mutedForeground }}>Capacity status:</span>
                    <span className="font-semibold text-emerald-400">{supplier.capacityScore}</span>
                  </div>
                </div>

                <Button
                  onClick={() => setInvitedSupplier(supplier.name)}
                  className="w-full text-xs font-semibold py-1.5 h-8 bg-purple-600 hover:bg-purple-700 text-white rounded-[8px] transition-colors"
                  style={{ background: tokens.accent }}
                >
                  Start Prequalification
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <AnimatePresence>
          {invitedSupplier && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 p-4 rounded-xl border text-center text-xs"
              style={{ background: "rgba(198,255,51,0.06)", borderColor: "rgba(198,255,51,0.2)" }}
            >
              <p className="font-semibold" style={{ color: tokens.success }}>
                Prequalification flow initialized for {invitedSupplier}!
              </p>
              <p className="text-[11px] mt-1" style={{ color: tokens.mutedForeground }}>
                Routing supplier questionnaire through Trustline's Supplier Workspace onboarding panel.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
