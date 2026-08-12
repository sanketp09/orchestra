import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Design tokens — consuming ORCHESTRA global CSS variables
// ---------------------------------------------------------------------------
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

type Severity = "action_needed" | "watch" | "info";

interface Tile {
  slug: string;
  label: string;
  icon: string;
  headline: string;
  severity: Severity;
  colSpan: 1 | 2;
  viewDetailsPath: string;
  affectedCount: number;
}

const TILES: Tile[] = [
  { slug: "political_regulatory_risk", label: "Political & Regulatory Risk", icon: "alert-triangle", severity: "action_needed", colSpan: 2, viewDetailsPath: "/atlas/political-regulatory-risk", affectedCount: 3,
    headline: "New 25% tariff on South Korean steel and electrical imports affects Shipment #4471 (Meridian Steel) and Austin Semiconductor Fab's structural steel budget." },
  { slug: "shipment_delay_risk", label: "Shipment Delay Cascade", icon: "clock", severity: "action_needed", colSpan: 2, viewDetailsPath: "/atlas/shipment-delay-risk", affectedCount: 2,
    headline: "If Shipment #4471 slips past the Sep 1 tariff effective date, landed cost rises by an estimated $153K." },
  { slug: "customs_delay", label: "Customs & Border Delay", icon: "stamp", severity: "watch", colSpan: 1, viewDetailsPath: "/atlas/customs-delay", affectedCount: 2,
    headline: "Port of Houston customs processing running 3-5 days behind average, a risk to Shipment #4471's transit." },
  { slug: "weather_disruption", label: "Weather & Natural Disaster Watch", icon: "cloud-rain", severity: "watch", colSpan: 1, viewDetailsPath: "/atlas/weather-disruption", affectedCount: 2,
    headline: "A tropical system tracking toward the Gulf Coast may affect Port of Houston operations during Shipment #4471's arrival." },
  { slug: "alternate_sourcing", label: "Alternate Global Sourcing", icon: "search", severity: "watch", colSpan: 1, viewDetailsPath: "/atlas/alternate-sourcing", affectedCount: 2,
    headline: "3 alternate suppliers identified outside South Korea for switchgear and structural steel sourcing." },
  { slug: "port_congestion", label: "Port Congestion Monitor", icon: "anchor", severity: "watch", colSpan: 1, viewDetailsPath: "/atlas/port-congestion", affectedCount: 1,
    headline: "Port of Houston congestion index at 72% ahead of Shipment #4471's arrival window." },
  { slug: "labor_disruption", label: "Labor Action Risk", icon: "users", severity: "info", colSpan: 1, viewDetailsPath: "/atlas/labor-disruption", affectedCount: 2,
    headline: "No active labor actions reported at Port of Houston or Ulsan facilities affecting current shipments." },
  { slug: "commodity_price_watch", label: "Commodity Price Watch", icon: "trending-up", severity: "info", colSpan: 1, viewDetailsPath: "/atlas/commodity-price-watch", affectedCount: 1,
    headline: "Structural steel spot prices up 4% month-over-month; Austin Semiconductor Fab's $2.1M budget line remains within tolerance." },
  { slug: "fx_exposure", label: "Currency & FX Exposure", icon: "banknote", severity: "info", colSpan: 1, viewDetailsPath: "/atlas/fx-exposure", affectedCount: 1,
    headline: "KRW/USD stable within a 1.5% band this month; limited currency risk on Meridian Steel's Ulsan-sourced shipments." },
];

const SEVERITY_LABEL: Record<Severity, string> = {
  action_needed: "Action Needed",
  watch: "Watch",
  info: "Info",
};
const SEVERITY_COLOR: Record<Severity, string> = {
  action_needed: "var(--danger)",
  watch: "var(--warning)",
  info: "var(--info)",
};

function Icon({ name, color }: { name: string; color: string }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "alert-triangle":
      return <svg {...common}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case "stamp":
      return <svg {...common}><path d="M5 22h14" /><path d="M6 18h12l-1-4H7l-1 4Z" /><path d="M9 14V9a3 3 0 0 1 6 0v5" /></svg>;
    case "anchor":
      return <svg {...common}><circle cx="12" cy="5" r="2" /><path d="M12 7v14" /><path d="M5 12H2a10 10 0 0 0 20 0h-3" /><path d="M7 15l5 4 5-4" /></svg>;
    case "cloud-rain":
      return <svg {...common}><path d="M16 13a4 4 0 0 0-1-7.87A5.5 5.5 0 0 0 5 8.5 4 4 0 0 0 6 16h10a3 3 0 0 0 0-6Z" /><line x1="9" y1="18" x2="9" y2="21" /><line x1="13" y1="18" x2="13" y2="21" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>;
    case "trending-up":
      return <svg {...common}><polyline points="3 17 9 11 13 15 21 6" /><polyline points="15 6 21 6 21 12" /></svg>;
    case "banknote":
      return <svg {...common}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></svg>;
    case "users":
      return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

function NeumorphicCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("rounded-[12px] p-5 relative overflow-hidden border", className)}
      style={{
        background: "var(--surface-card)",
        borderColor: tokens.muted,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)",
      }}
    >
      {children}
    </div>
  );
}

function AnimatedCount({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 100, damping: 20 });
  const [display, setDisplay] = useState(0);
  useEffect(() => { motionVal.set(value); }, [value, motionVal]);
  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);
  return <span>{display}</span>;
}

function BriefingTile({ tile, index, onSelectTile }: { tile: Tile; index: number; onSelectTile?: (slug: string) => void }) {
  const color = SEVERITY_COLOR[tile.severity];
  return (
    <motion.div
      className={tile.colSpan === 2 ? "col-span-2" : "col-span-1"}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      onClick={() => onSelectTile?.(tile.slug)}
    >
      <NeumorphicCard
        className={cn(
          "h-full flex flex-col cursor-pointer transition-all duration-200",
          "hover:-translate-y-0.5 hover:border-purple-500/40"
        )}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: color, opacity: 0.7 }}
        />
        <div className="flex items-start justify-between mb-2 pl-1.5">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0"
              style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
            >
              <Icon name={tile.icon} color={color} />
            </div>
            <span className="text-[11.5px] font-semibold text-[var(--foreground)]">{tile.label}</span>
          </div>
          <Badge
            className="text-[9px] font-semibold shrink-0"
            style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
          >
            {SEVERITY_LABEL[tile.severity]}
          </Badge>
        </div>

        <p className={cn(
          "text-[var(--foreground)] leading-snug pl-1.5 flex-1",
          tile.colSpan === 2 ? "text-[14px]" : "text-[12.5px]"
        )}>
          {tile.headline}
        </p>

        <div className="flex items-center justify-between mt-3 pl-1.5">
          <span className="text-[10.5px] text-[var(--muted-foreground)]">
            Touches {tile.affectedCount} tracked {tile.affectedCount === 1 ? "entity" : "entities"}
          </span>
          <span className="text-[11px] font-medium text-[var(--accent)] hover:brightness-90 transition-[filter] duration-150">
            View details &rarr;
          </span>
        </div>
      </NeumorphicCard>
    </motion.div>
  );
}

export default function AtlasDailyBriefing({ onSelectTile }: { onSelectTile?: (slug: string) => void }) {
  const counts = TILES.reduce(
    (acc, t) => { acc[t.severity]++; return acc; },
    { action_needed: 0, watch: 0, info: 0 } as Record<Severity, number>
  );

  return (
    <div
      className="min-h-full w-full"
      style={{
        backgroundColor: tokens.background,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Daily Briefing</h1>
            <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
              Atlas · Everything touching your active vendors, shipments, and budget lines today
            </p>
          </div>
          <div className="flex items-center gap-4">
            {(["action_needed", "watch", "info"] as Severity[]).map((sev) => (
              <div key={sev} className="text-center">
                <div className="text-2xl font-bold tabular-nums" style={{ color: SEVERITY_COLOR[sev] }}>
                  <AnimatedCount value={counts[sev]} />
                </div>
                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide font-medium">
                  {SEVERITY_LABEL[sev]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TILES.map((tile, i) => (
            <BriefingTile key={tile.slug} tile={tile} index={i} onSelectTile={onSelectTile} />
          ))}
        </div>
      </div>
    </div>
  );
}
