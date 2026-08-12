"use client";

import * as React from "react";
import { motion, AnimatePresence, useSpring } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const shadowEmboss = "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)";

type PriceOption = {
  vendor_id: string;
  vendor_name: string;
  current_price: number;
  lead_time_days: number;
  is_habitual: boolean;
  is_best: boolean;
};

type ItemSlug = "copper_wiring_4_0_1000ft" | "structural_steel_plate_a36_per_ton";

type Scenario = {
  item: ItemSlug;
  itemLabel: string;
  habitualVendorId: string;
  habitualPrice: number;
  options: PriceOption[];
};

const SCENARIOS: Record<ItemSlug, Scenario> = {
  copper_wiring_4_0_1000ft: {
    item: "copper_wiring_4_0_1000ft",
    itemLabel: "Copper Wiring — 4/0 AWG (1000 ft spool)",
    habitualVendorId: "vendor_coastal_bolt",
    habitualPrice: 4850,
    options: [
      { vendor_id: "vendor_coastal_bolt", vendor_name: "Coastal Bolt & Fastener", current_price: 4850, lead_time_days: 5, is_habitual: true, is_best: false },
      { vendor_id: "vendor_titan_fab", vendor_name: "Titan Fabricators", current_price: 4600, lead_time_days: 7, is_habitual: false, is_best: false },
      { vendor_id: "vendor_lonestar_wire", vendor_name: "Lonestar Wire & Cable", current_price: 4550, lead_time_days: 4, is_habitual: false, is_best: true },
    ],
  },
  structural_steel_plate_a36_per_ton: {
    item: "structural_steel_plate_a36_per_ton",
    itemLabel: "Structural Steel Plate — A36 (per ton)",
    habitualVendorId: "vendor_meridian_steel",
    habitualPrice: 1140,
    options: [
      { vendor_id: "vendor_meridian_steel", vendor_name: "Meridian Steel Fabrication", current_price: 1140, lead_time_days: 10, is_habitual: true, is_best: true },
      { vendor_id: "vendor_titan_fab", vendor_name: "Titan Fabricators", current_price: 1150, lead_time_days: 9, is_habitual: false, is_best: false },
      { vendor_id: "vendor_gulf_coast_machining", vendor_name: "Gulf Coast Machining", current_price: 1205, lead_time_days: 8, is_habitual: false, is_best: false },
    ],
  },
};

function computeComparison(scenario: Scenario) {
  const ranked = [...scenario.options].sort((a, b) => a.current_price - b.current_price);
  const best = ranked[0];
  const betterOptionExists = best.current_price < scenario.habitualPrice;
  const savings = Math.max(0, scenario.habitualPrice - best.current_price);
  const savingsPct = scenario.habitualPrice > 0 ? (savings / scenario.habitualPrice) * 100 : 0;
  return { ranked, best, betterOptionExists, savings, savingsPct };
}

function EmbossedCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Card
      className={cn("rounded-[12px] border bg-[var(--surface-card)] p-5", className)}
      style={{ boxShadow: shadowEmboss, borderColor: tokens.muted }}
    >
      {children}
    </Card>
  );
}

function AnimatedDollar({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(0, { stiffness: 70, damping: 18, mass: 0.8 });
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  React.useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  return <span className={className}>${display.toLocaleString()}</span>;
}

export default function PriceRecheckCard() {
  const [itemSlug, setItemSlug] = React.useState<ItemSlug>("copper_wiring_4_0_1000ft");
  const [selectedVendorId, setSelectedVendorId] = React.useState<string>(SCENARIOS.copper_wiring_4_0_1000ft.habitualVendorId);
  const [confirmed, setConfirmed] = React.useState<string | null>(null);

  const scenario = SCENARIOS[itemSlug];
  const { ranked, best, betterOptionExists, savings, savingsPct } = React.useMemo(
    () => computeComparison(scenario),
    [scenario]
  );

  const habitualOption = scenario.options.find((o) => o.vendor_id === scenario.habitualVendorId)!;
  const selectedOption = ranked.find((o) => o.vendor_id === selectedVendorId) ?? habitualOption;

  const handleSwitch = () => {
    setSelectedVendorId(best.vendor_id);
    setConfirmed(`Switched to ${best.vendor_name} — reorder will use $${best.current_price.toLocaleString()}.`);
  };

  const handleProceed = () => {
    setConfirmed(`Proceeding with ${selectedOption.vendor_name} at $${selectedOption.current_price.toLocaleString()}.`);
  };

  const changeItem = (slug: ItemSlug) => {
    setItemSlug(slug);
    setSelectedVendorId(SCENARIOS[slug].habitualVendorId);
    setConfirmed(null);
  };

  return (
    <div className="flex w-full items-center justify-center bg-[var(--background)] p-6 font-[Inter,sans-serif]" style={{ background: tokens.background }}>
      <div className="w-full max-w-md">
        {/* demo-only scenario switcher, not part of the production card */}
        <div className="mb-3 flex gap-2">
          {(Object.keys(SCENARIOS) as ItemSlug[]).map((slug) => (
            <button
              key={slug}
              onClick={() => changeItem(slug)}
              className={cn(
                "rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-colors",
                itemSlug === slug
                  ? "bg-purple-600 text-white"
                  : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10"
              )}
              style={{
                background: itemSlug === slug ? tokens.accent : "rgba(255,255,255,0.05)",
                color: tokens.foreground,
              }}
            >
              {SCENARIOS[slug].itemLabel.split("—")[0].trim()}
            </button>
          ))}
        </div>

        <motion.div
          key={itemSlug}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <EmbossedCard className="flex flex-col gap-4">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Price re-check before reordering
              </span>
              <h3 className="mt-1 text-base font-medium text-[var(--foreground)]">{scenario.itemLabel}</h3>
            </div>

            <div className="flex items-center justify-between rounded-[10px] bg-white/5 px-3 py-2.5">
              <div>
                <span className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                  About to pay ({habitualOption.vendor_name})
                </span>
                <div className="text-lg font-bold text-[var(--foreground)]">
                  ${scenario.habitualPrice.toLocaleString()}
                </div>
              </div>
              {betterOptionExists ? (
                <Badge className="border-none bg-amber-500/10 text-amber-400">Habitual price</Badge>
              ) : (
                <Badge className="border-none bg-emerald-500/10 text-emerald-400">Already best</Badge>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Current approved pricing
              </span>
              {ranked.map((o, i) => (
                <motion.div
                  key={o.vendor_id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ x: 2 }}
                  className={cn(
                    "flex items-center justify-between rounded-[10px] border px-3 py-2 transition-colors",
                    o.is_best && betterOptionExists
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-white/5 bg-[var(--surface-card)]"
                  )}
                  style={{ borderColor: o.is_best && betterOptionExists ? "rgba(16,185,129,0.4)" : tokens.muted }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">{o.vendor_name}</span>
                    {o.is_habitual && (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">habitual</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--muted-foreground)]">{o.lead_time_days}d lead</span>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        o.is_best && betterOptionExists ? "text-emerald-400" : "text-[var(--foreground)]"
                      )}
                    >
                      ${o.current_price.toLocaleString()}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {betterOptionExists ? (
                <motion.div
                  key="better"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-[10px] bg-emerald-500/10 p-3"
                >
                  <div className="flex items-baseline gap-1">
                    <AnimatedDollar value={savings} className="text-xl font-bold text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-semibold">saved ({savingsPct.toFixed(1)}%)</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--foreground)]">
                    {best.vendor_name} now beats your habitual price.
                  </p>
                  <Button
                    onClick={handleSwitch}
                    className="mt-2 w-full bg-emerald-500 text-black font-semibold transition-colors hover:bg-emerald-600"
                  >
                    Use this price instead
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="calm"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-[10px] bg-white/5 p-3 text-center"
                >
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {habitualOption.vendor_name} is still the best price.
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">No action needed — proceed as usual.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between border-t border-white/5 pt-3" style={{ borderColor: tokens.muted }}>
              <span className="text-xs text-[var(--muted-foreground)]">
                Reordering at{" "}
                <span className="font-medium text-[var(--foreground)]">${selectedOption.current_price.toLocaleString()}</span>{" "}
                from {selectedOption.vendor_name}
              </span>
              <Button
                onClick={handleProceed}
                variant="outline"
                className="border-white/20 text-[var(--foreground)] transition-colors hover:bg-white/10"
              >
                Proceed
              </Button>
            </div>

            <AnimatePresence>
              {confirmed && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-[var(--muted-foreground)]"
                >
                  {confirmed}
                </motion.p>
              )}
            </AnimatePresence>
          </EmbossedCard>
        </motion.div>
      </div>
    </div>
  );
}
