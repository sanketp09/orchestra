"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sun, CloudRain, CloudLightning, Wind } from "lucide-react";

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

interface ForecastDay {
  day: string;
  icon: any;
  temp: string;
  precip: number;
  wind: string;
  risk: boolean;
  reason?: string;
}

const FORECAST: ForecastDay[] = [
  { day: "Mon", icon: Sun, temp: "92°F", precip: 10, wind: "8mph", risk: false },
  { day: "Tue", icon: Sun, temp: "94°F", precip: 15, wind: "10mph", risk: false },
  { day: "Wed", icon: CloudLightning, temp: "84°F", precip: 90, wind: "24mph", risk: true, reason: "Heavy thunderstorms near Houston port" },
  { day: "Thu", icon: CloudRain, temp: "86°F", precip: 60, wind: "14mph", risk: false },
  { day: "Fri", icon: Sun, temp: "90°F", precip: 20, wind: "9mph", risk: false },
  { day: "Sat", icon: Sun, temp: "91°F", precip: 10, wind: "7mph", risk: false },
];

export default function WeatherIntelligence() {
  const [selectedDay, setSelectedDay] = useState<ForecastDay | null>(FORECAST[2]);

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
            Atlas · Weather Intelligence
          </span>
          <h1 className="text-2xl font-semibold mt-1">Global Weather &amp; Port Marine Forecast</h1>
          <p className="text-xs mt-1" style={{ color: tokens.mutedForeground }}>
            Forward-looking routing and arrival window weather risk for Shipment #4471
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3" style={{ gridAutoRows: "minmax(200px, auto)" }}>
          {/* Weather strip */}
          <Card
            className="md:col-span-2 p-5 flex flex-col justify-between"
            style={{ background: tokens.surfaceCard, borderColor: tokens.muted, boxShadow: shadowEmboss }}
          >
            <div>
              <span className="text-xs uppercase tracking-wider" style={{ color: tokens.mutedForeground }}>
                Route Forecast (Houston arrival window)
              </span>
              <div className="grid grid-cols-6 gap-2 mt-4">
                {FORECAST.map((f, i) => {
                  const Icon = f.icon;
                  const isSelected = selectedDay?.day === f.day;
                  return (
                    <button
                      key={f.day}
                      onClick={() => setSelectedDay(f)}
                      className="p-3 rounded-lg border flex flex-col items-center gap-2 transition-all hover:bg-white/5"
                      style={{
                        background: isSelected ? "rgba(125,57,235,0.15)" : "transparent",
                        borderColor: f.risk ? tokens.warning : isSelected ? tokens.accent : tokens.muted,
                      }}
                    >
                      <span className="text-xs font-semibold">{f.day}</span>
                      <Icon className="w-5 h-5" style={{ color: f.risk ? tokens.warning : tokens.mutedForeground }} />
                      <span className="text-xs font-semibold tabular-nums">{f.temp}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-[11px]" style={{ color: tokens.mutedForeground }}>
              * Click on any weather tile to view risk assessment. Wednesday shows elevated warning risk due to lightning and wind.
            </p>
          </Card>

          {/* Composite risk overview */}
          <Card
            className="p-5 flex flex-col justify-between"
            style={{ background: tokens.surfaceCard, borderColor: tokens.muted, boxShadow: shadowEmboss }}
          >
            <div>
              <span className="text-xs uppercase tracking-wider" style={{ color: tokens.mutedForeground }}>
                Composite Risk Assessment
              </span>
              <div className="mt-3 flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full" style={{ background: tokens.warning }} />
                <h3 className="text-base font-semibold">Elevated (Wednesday)</h3>
              </div>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: tokens.mutedForeground }}>
                {selectedDay?.reason || "No weather threats identified along remaining ocean path for selected day."}
              </p>
            </div>

            <div className="border-t pt-3" style={{ borderColor: tokens.muted }}>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.mutedForeground }}>
                Selected Day Stats ({selectedDay?.day})
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                <div>Precip: <span className="font-semibold text-white">{selectedDay?.precip}%</span></div>
                <div>Wind: <span className="font-semibold text-white">{selectedDay?.wind}</span></div>
              </div>
            </div>
          </Card>

          {/* Historical Sentinel Link card */}
          <Card
            className="md:col-span-3 p-4 flex items-center justify-between gap-4"
            style={{ background: "rgba(125,57,235,0.06)", borderColor: "rgba(125,57,235,0.2)", boxShadow: shadowEmboss }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold font-mono text-xs">S</div>
              <div>
                <p className="text-xs font-semibold text-white">Linked with Sentinel Audit Systems</p>
                <p className="text-[11px]" style={{ color: tokens.mutedForeground }}>
                  This weather intelligence feed serves as the underlying verification signal for delay excuse claims.
                </p>
              </div>
            </div>
            <Badge className="border-none bg-purple-500/20 text-purple-300 font-semibold text-[10px]">INTEGRATED</Badge>
          </Card>
        </div>
      </div>
    </div>
  );
}
