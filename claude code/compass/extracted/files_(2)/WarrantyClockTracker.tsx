import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Design tokens — reused exactly as established across Sentinel / Trustline /
// Compass. Not redefined here beyond the local constant map for readability.
// ---------------------------------------------------------------------------
const tokens = {
  background: "#F3EDE7",
  foreground: "#0C0904",
  muted: "#DBC3B3",
  mutedForeground: "#AA8D74",
  accent: "#AC723E",
  surfaceCard: "#FAF7F3",
  surfaceFloating: "#FFFFFF",
  success: "#4A7A5C",
  warning: "#B8873A",
  danger: "#A6432F",
  info: "#4A6A8A",
  ai: "#6B5A7A",
} as const;

// Same dual-shadow embossed card treatment used throughout Trustline.
const shadowEmboss = "-4px -4px 10px rgba(255,255,255,0.65), 6px 8px 18px rgba(12,9,4,0.08)";

// ---------------------------------------------------------------------------
// Types (mirrors route.py's WarrantyRecord / WarrantyTrackerResponse)
// ---------------------------------------------------------------------------
type PriorityLevel = "critical" | "high" | "medium" | "low";
type Outcome = "pending" | "confirmed_good" | "confirmed_bad" | null;

interface EvidenceItem {
  source: string;
  reliabilityTier: "self_reported" | "third_party_observed" | "verified_transaction";
  timestamp: string;
  rawRef: string;
}

interface WarrantyRecord {
  decisionId: string;
  equipmentName: string;
  entityId: string;
  installDate: string;
  warrantyPeriodMonths: number;
  warrantyEndDate: string;
  nextServiceDue: string | null;
  daysRemaining: number;
  priorityLevel: PriorityLevel;
  serviceDueSoon: boolean;
  manufacturerRef: string;
  decisionMade: string;
  outcome: Outcome;
  reasoning: string;
  evidence: EvidenceItem[];
}

const VENDOR_NAMES: Record<string, string> = {
  vendor_meridian_steel: "Meridian Steel Fabrication",
  vendor_titan_fab: "Titan Fabricators",
  vendor_coastal_bolt: "Coastal Bolt & Fastener",
};

// ---------------------------------------------------------------------------
// Mock data — mirrors what /precedent/warranty-tracker would return for
// project_austin_fab, already sorted by urgency
// ---------------------------------------------------------------------------
const WARRANTIES: WarrantyRecord[] = [
  {
    decisionId: "war_004",
    equipmentName: "UPS System — UPS-Main-1",
    entityId: "vendor_titan_fab",
    installDate: "2025-08-28",
    warrantyPeriodMonths: 12,
    warrantyEndDate: "2026-08-23",
    nextServiceDue: "2026-08-20",
    daysRemaining: 12,
    priorityLevel: "critical",
    serviceDueSoon: true,
    manufacturerRef: "Eaton MFG-UPS1-WTY-77410",
    decisionMade: "Installed UPS-Main-1 under standard 12-month warranty.",
    outcome: "confirmed_good",
    reasoning:
      "UPS System — UPS-Main-1 warranty (installed 2025-08-28, 12-month term) has 12 days remaining, placing it in the 'critical' priority tier. A required service is also due by 2026-08-20.",
    evidence: [
      { source: "manufacturer_warranty_record", reliabilityTier: "verified_transaction", timestamp: "2025-08-28T00:00:00Z", rawRef: "Eaton MFG-UPS1-WTY-77410 — install 2025-08-28, 12mo term" },
    ],
  },
  {
    decisionId: "war_005",
    equipmentName: "Chiller Plant — CH-1",
    entityId: "vendor_meridian_steel",
    installDate: "2022-03-21",
    warrantyPeriodMonths: 24,
    warrantyEndDate: "2024-03-10",
    nextServiceDue: null,
    daysRemaining: -884,
    priorityLevel: "critical",
    serviceDueSoon: false,
    manufacturerRef: "York MFG-CH1-WTY-30187",
    decisionMade: "Installed CH-1 under standard 24-month warranty (expired).",
    outcome: "confirmed_good",
    reasoning:
      "Chiller Plant — CH-1 warranty (installed 2022-03-21, 24-month term) has -884 days remaining, placing it in the 'critical' priority tier.",
    evidence: [
      { source: "manufacturer_warranty_record", reliabilityTier: "verified_transaction", timestamp: "2022-03-21T00:00:00Z", rawRef: "York MFG-CH1-WTY-30187 — install 2022-03-21, 24mo term" },
    ],
  },
  {
    decisionId: "war_001",
    equipmentName: "Cleanroom Air Handling Unit — AHU-3",
    entityId: "vendor_titan_fab",
    installDate: "2024-10-05",
    warrantyPeriodMonths: 24,
    warrantyEndDate: "2026-09-25",
    nextServiceDue: "2026-09-02",
    daysRemaining: 45,
    priorityLevel: "high",
    serviceDueSoon: false,
    manufacturerRef: "Trane MFG-AHU-3-WTY-88213",
    decisionMade: "Installed AHU-3 under Titan Fabricators' standard 24-month warranty package.",
    outcome: "confirmed_good",
    reasoning:
      "Cleanroom Air Handling Unit — AHU-3 warranty (installed 2024-10-05, 24-month term) has 45 days remaining, placing it in the 'high' priority tier.",
    evidence: [
      { source: "manufacturer_warranty_record", reliabilityTier: "verified_transaction", timestamp: "2024-10-05T00:00:00Z", rawRef: "Trane MFG-AHU-3-WTY-88213 — install 2024-10-05, 24mo term" },
    ],
  },
  {
    decisionId: "war_003",
    equipmentName: "Process Cooling Water Pumps — PCW-2A/2B",
    entityId: "vendor_coastal_bolt",
    installDate: "2023-11-10",
    warrantyPeriodMonths: 36,
    warrantyEndDate: "2026-10-25",
    nextServiceDue: "2026-12-29",
    daysRemaining: 75,
    priorityLevel: "high",
    serviceDueSoon: false,
    manufacturerRef: "Grundfos MFG-PCW2-WTY-11029",
    decisionMade: "Installed PCW-2A/2B under a 36-month extended warranty add-on.",
    outcome: "pending",
    reasoning:
      "Process Cooling Water Pumps — PCW-2A/2B warranty (installed 2023-11-10, 36-month term) has 75 days remaining, placing it in the 'high' priority tier.",
    evidence: [
      { source: "manufacturer_warranty_record", reliabilityTier: "verified_transaction", timestamp: "2023-11-10T00:00:00Z", rawRef: "Grundfos MFG-PCW2-WTY-11029 — install 2023-11-10, 36mo term" },
    ],
  },
  {
    decisionId: "war_002",
    equipmentName: "Backup Diesel Generator — GEN-1",
    entityId: "vendor_meridian_steel",
    installDate: "2025-07-07",
    warrantyPeriodMonths: 18,
    warrantyEndDate: "2026-12-29",
    nextServiceDue: "2027-04-18",
    daysRemaining: 140,
    priorityLevel: "medium",
    serviceDueSoon: false,
    manufacturerRef: "Cummins MFG-GEN1-WTY-40567",
    decisionMade: "Installed GEN-1 under standard 18-month manufacturer warranty.",
    outcome: "confirmed_good",
    reasoning:
      "Backup Diesel Generator — GEN-1 warranty (installed 2025-07-07, 18-month term) has 140 days remaining, placing it in the 'medium' priority tier.",
    evidence: [
      { source: "manufacturer_warranty_record", reliabilityTier: "verified_transaction", timestamp: "2025-07-07T00:00:00Z", rawRef: "Cummins MFG-GEN1-WTY-40567 — install 2025-07-07, 18mo term" },
    ],
  },
  {
    decisionId: "war_006",
    equipmentName: "Gas Detection System — GDS-Fab2",
    entityId: "vendor_coastal_bolt",
    installDate: "2025-05-10",
    warrantyPeriodMonths: 24,
    warrantyEndDate: "2027-04-30",
    nextServiceDue: "2027-06-17",
    daysRemaining: 262,
    priorityLevel: "low",
    serviceDueSoon: false,
    manufacturerRef: "Honeywell MFG-GDS2-WTY-55932",
    decisionMade: "Installed GDS-Fab2 under standard 24-month warranty.",
    outcome: "pending",
    reasoning:
      "Gas Detection System — GDS-Fab2 warranty (installed 2025-05-10, 24-month term) has 262 days remaining, placing it in the 'low' priority tier.",
    evidence: [
      { source: "manufacturer_warranty_record", reliabilityTier: "verified_transaction", timestamp: "2025-05-10T00:00:00Z", rawRef: "Honeywell MFG-GDS2-WTY-55932 — install 2025-05-10, 24mo term" },
    ],
  },
];

const PRIORITY_COLOR: Record<PriorityLevel, string> = {
  critical: tokens.danger,
  high: tokens.warning,
  medium: tokens.info,
  low: tokens.success,
};

const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

// ---------------------------------------------------------------------------
// Motion helper — count-up, matching the pattern used across Sentinel/Trustline
// ---------------------------------------------------------------------------
function useCountUp(target: number, active: boolean) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 18 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (active) motionVal.set(target);
  }, [active, target, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  return display;
}

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: i * 0.05, ease: "easeOut" },
  }),
};

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------
export default function WarrantyClockTracker() {
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const criticalCount = WARRANTIES.filter((w) => w.priorityLevel === "critical").length;

  return (
    <div
      className="min-h-full w-full p-6"
      style={{ background: tokens.background, color: tokens.foreground, fontFamily: "Inter, sans-serif" }}
    >
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-end justify-between mb-5"
        >
          <div>
            <span className="text-xs tracking-wide uppercase" style={{ color: tokens.mutedForeground }}>
              Precedent · Warranty Clock
            </span>
            <h1 className="text-2xl font-semibold mt-1" style={{ color: tokens.foreground }}>
              Austin Semiconductor Fab
            </h1>
          </div>
          <SummaryPill count={criticalCount} mounted={mounted} />
        </motion.div>

        <div
          className="p-2"
          style={{ background: tokens.surfaceCard, borderRadius: 12, boxShadow: shadowEmboss }}
        >
          <div className="grid grid-cols-[1.6fr_0.9fr_0.9fr_0.7fr_auto] gap-2 px-3 py-2 text-[11px] uppercase tracking-wide" style={{ color: tokens.mutedForeground }}>
            <span>Equipment</span>
            <span>Install Date</span>
            <span>Warranty Ends</span>
            <span>Days Left</span>
            <span></span>
          </div>

          <div className="space-y-1.5">
            {WARRANTIES.map((w, i) => (
              <WarrantyRow
                key={w.decisionId}
                index={i}
                warranty={w}
                expanded={expandedId === w.decisionId}
                onToggle={() => setExpandedId((cur) => (cur === w.decisionId ? null : w.decisionId))}
                mounted={mounted}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryPill({ count, mounted }: { count: number; mounted: boolean }) {
  const display = useCountUp(count, mounted);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{ background: count > 0 ? tokens.danger : tokens.success, color: tokens.surfaceFloating }}
    >
      <span className="text-sm font-semibold tabular-nums">{display}</span>
      <span className="text-xs">critical</span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Warranty row — click to expand for manufacturer paperwork reference
// ---------------------------------------------------------------------------
function WarrantyRow({
  warranty,
  index,
  expanded,
  onToggle,
  mounted,
}: {
  warranty: WarrantyRecord;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  mounted: boolean;
}) {
  const daysDisplay = useCountUp(warranty.daysRemaining, mounted);
  const color = PRIORITY_COLOR[warranty.priorityLevel];
  const overdue = warranty.daysRemaining < 0;

  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={rowVariants}
      layout
      className="rounded-lg overflow-hidden"
      style={{ background: tokens.surfaceFloating, border: `1px solid ${tokens.muted}` }}
    >
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[1.6fr_0.9fr_0.9fr_0.7fr_auto] gap-2 items-center px-3 py-3 text-left transition-colors hover:bg-black/5"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: tokens.foreground }}>
              {warranty.equipmentName}
            </p>
            <p className="text-[11px] truncate" style={{ color: tokens.mutedForeground }}>
              {VENDOR_NAMES[warranty.entityId] ?? warranty.entityId}
            </p>
          </div>
        </div>
        <span className="text-xs" style={{ color: tokens.mutedForeground }}>
          {formatDate(warranty.installDate)}
        </span>
        <span className="text-xs" style={{ color: tokens.mutedForeground }}>
          {formatDate(warranty.warrantyEndDate)}
        </span>
        <span className="text-sm font-semibold tabular-nums" style={{ color }}>
          {overdue ? `${Math.abs(daysDisplay)}d over` : `${daysDisplay}d`}
        </span>
        <div className="flex items-center gap-2 justify-end">
          {warranty.serviceDueSoon && (
            <Badge
              style={{
                background: tokens.warning,
                color: tokens.surfaceFloating,
                borderRadius: 6,
                fontSize: 10,
                padding: "2px 6px",
              }}
            >
              service due
            </Badge>
          )}
          <Badge
            style={{
              background: color,
              color: tokens.surfaceFloating,
              borderRadius: 6,
              fontSize: 10,
              padding: "2px 6px",
            }}
          >
            {PRIORITY_LABEL[warranty.priorityLevel]}
          </Badge>
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-xs"
            style={{ color: tokens.mutedForeground }}
          >
            ›
          </motion.span>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-3" style={{ borderTop: `1px solid ${tokens.muted}` }}>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <DetailField label="Manufacturer Reference" value={warranty.manufacturerRef} />
                <DetailField label="Warranty Term" value={`${warranty.warrantyPeriodMonths} months`} />
                <DetailField
                  label="Next Service Due"
                  value={warranty.nextServiceDue ? formatDate(warranty.nextServiceDue) : "None scheduled"}
                />
                <DetailField label="Outcome" value={outcomeLabel(warranty.outcome)} />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wide" style={{ color: tokens.mutedForeground }}>
                  Decision on Record
                </span>
                <p className="text-xs mt-1" style={{ color: tokens.foreground }}>
                  {warranty.decisionMade}
                </p>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wide" style={{ color: tokens.mutedForeground }}>
                  Reasoning
                </span>
                <p className="text-xs mt-1" style={{ color: tokens.foreground }}>
                  {warranty.reasoning}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] uppercase tracking-wide" style={{ color: tokens.mutedForeground }}>
        {label}
      </span>
      <p className="text-xs font-medium mt-0.5" style={{ color: tokens.foreground }}>
        {value}
      </p>
    </div>
  );
}

function outcomeLabel(outcome: Outcome): string {
  if (outcome === "confirmed_good") return "Confirmed good";
  if (outcome === "confirmed_bad") return "Confirmed bad";
  if (outcome === "pending") return "Pending";
  return "—";
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}
