"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

export default function CustomsDutyMonitoring() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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
            Atlas · Customs &amp; Duty Monitoring
          </span>
          <h1 className="text-2xl font-semibold mt-1">Customs Clearance &amp; Duty Tracker</h1>
          <p className="text-xs mt-1" style={{ color: tokens.mutedForeground }}>
            Real-time compliance monitoring for Switchgear Shipment #4471
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3" style={{ gridAutoRows: "minmax(200px, auto)" }}>
          {/* Hero map-style route visualization */}
          <Card
            className="md:col-span-2 p-5 flex flex-col justify-between"
            style={{ background: tokens.surfaceCard, borderColor: tokens.muted, boxShadow: shadowEmboss }}
          >
            <div>
              <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]" style={{ color: tokens.mutedForeground }}>
                Active Customs Clearance Route
              </span>
              <p className="text-sm font-semibold mt-1">Ulsan Port (KR) → Port of Houston (US)</p>
            </div>

            <div className="my-6 relative h-20 flex items-center justify-between px-6">
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <path
                  d="M 50,40 C 150,10 250,70 350,40"
                  fill="none"
                  stroke={tokens.accent}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              </svg>
              <div className="z-10 flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-emerald-400" />
                <span className="text-[10px] mt-1 font-semibold text-emerald-400">ULSAN</span>
                <span className="text-[9px]" style={{ color: tokens.mutedForeground }}>Cleared Jul 20</span>
              </div>
              <div className="z-10 flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] mt-1 font-semibold text-amber-400">HOUSTON</span>
                <span className="text-[9px]" style={{ color: tokens.mutedForeground }}>Customs pending</span>
              </div>
            </div>

            <p className="text-xs" style={{ color: tokens.mutedForeground }}>
              Regulatory Rule Applied: <span className="text-amber-400 font-semibold">25% import tariff on electrical components (South Korea origin)</span> effective Sep 1.
            </p>
          </Card>

          {/* Duty Impact calculation */}
          <Card
            className="p-5 flex flex-col justify-between"
            style={{ background: tokens.surfaceCard, borderColor: tokens.muted, boxShadow: shadowEmboss }}
          >
            <div>
              <span className="text-xs uppercase tracking-wider" style={{ color: tokens.mutedForeground }}>
                Financial landed cost delta
              </span>
              <h3 className="text-xl font-bold mt-2 text-rose-400">+$153,000 USD</h3>
              <p className="text-xs mt-1" style={{ color: tokens.mutedForeground }}>
                Calculated if Houston customs entry slips past Sep 1 deadline
              </p>
            </div>

            <div className="border-t pt-3" style={{ borderColor: tokens.muted }}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: tokens.mutedForeground }}>Original Estimated Duty</span>
                <span className="font-semibold">$36,800</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: tokens.mutedForeground }}>With Tariff (Sep 1+)</span>
                <span className="font-semibold text-rose-400">$189,800</span>
              </div>
            </div>
          </Card>

          {/* Historical Alert log */}
          <Card
            className="md:col-span-3 p-5"
            style={{ background: tokens.surfaceCard, borderColor: tokens.muted, boxShadow: shadowEmboss }}
          >
            <h4 className="text-sm font-semibold mb-3">Customs Alert History</h4>
            <div className="space-y-3">
              <AlertRow
                date="Aug 10"
                title="Port of Houston delay alert"
                desc="Customs backlog increased average processing times to 4.5 days."
                severity="warning"
              />
              <AlertRow
                date="Jul 25"
                title="Tariff rule updated"
                desc="Federal tariff proposal finalised at 25% for South Korean electronics."
                severity="info"
              />
              <AlertRow
                date="Jul 20"
                title="Export approval success"
                desc="Cleared Korean customs customs gate 3 at Ulsan Port."
                severity="success"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ date, title, desc, severity }: { date: string; title: string; desc: string; severity: "success" | "warning" | "info" }) {
  const color = severity === "warning" ? tokens.warning : severity === "success" ? tokens.success : tokens.info;
  return (
    <div className="flex items-start gap-3 text-xs border-b pb-2 last:border-b-0 last:pb-0" style={{ borderColor: tokens.muted }}>
      <span className="font-mono text-white/40 shrink-0 mt-0.5">{date}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <Badge className="text-[9px] px-1.5 py-0 border-0" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
            {severity}
          </Badge>
        </div>
        <p className="mt-0.5" style={{ color: tokens.mutedForeground }}>{desc}</p>
      </div>
    </div>
  );
}
