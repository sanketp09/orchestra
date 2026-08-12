"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Centralized demo data — same vendors/trust scores used across Trustline
// ---------------------------------------------------------------------------

type CapabilityId =
  | "cnc"
  | "clean_room"
  | "night_shift"
  | "welding_certified"
  | "aws_d1_1"
  | "iso_9001"
  | "nde_testing"
  | "on_site_qc"
  | "expedited_shipping";

const CAPABILITIES: { id: CapabilityId; label: string }[] = [
  { id: "cnc", label: "CNC Machining" },
  { id: "clean_room", label: "Clean-Room Certified" },
  { id: "night_shift", label: "Night-Shift Capacity" },
  { id: "welding_certified", label: "Certified Welders" },
  { id: "aws_d1_1", label: "AWS D1.1" },
  { id: "iso_9001", label: "ISO 9001" },
  { id: "nde_testing", label: "NDE Testing" },
  { id: "on_site_qc", label: "On-Site QC" },
  { id: "expedited_shipping", label: "Expedited Shipping" },
];

const CAPABILITY_LABEL: Record<CapabilityId, string> = Object.fromEntries(
  CAPABILITIES.map((c) => [c.id, c.label])
) as Record<CapabilityId, string>;

type Vendor = {
  vendor_id: string;
  name: string;
  trade: string;
  location: string;
  trust_score: number;
  capabilities: CapabilityId[];
};

const VENDORS: Vendor[] = [
  {
    vendor_id: "vendor_meridian_steel",
    name: "Meridian Steel Fabrication",
    trade: "Structural Steel",
    location: "Houston, TX",
    trust_score: 76,
    capabilities: ["cnc", "welding_certified", "aws_d1_1", "iso_9001", "nde_testing"],
  },
  {
    vendor_id: "vendor_titan_fab",
    name: "Titan Fabricators",
    trade: "Structural Steel",
    location: "Baytown, TX",
    trust_score: 88,
    capabilities: ["cnc", "clean_room", "night_shift", "welding_certified", "aws_d1_1", "iso_9001", "on_site_qc"],
  },
  {
    vendor_id: "vendor_coastal_bolt",
    name: "Coastal Bolt & Fastener",
    trade: "Fasteners",
    location: "Corpus Christi, TX",
    trust_score: 54,
    capabilities: ["night_shift", "expedited_shipping"],
  },
  {
    vendor_id: "vendor_ironclad_weld",
    name: "Ironclad Weld Works",
    trade: "Welding & Fabrication",
    location: "Pasadena, TX",
    trust_score: 71,
    capabilities: ["welding_certified", "aws_d1_1", "night_shift", "nde_testing"],
  },
  {
    vendor_id: "vendor_precision_cnc",
    name: "Precision CNC Solutions",
    trade: "Precision Machining",
    location: "Sugar Land, TX",
    trust_score: 91,
    capabilities: ["cnc", "clean_room", "iso_9001", "on_site_qc", "expedited_shipping"],
  },
  {
    vendor_id: "vendor_gulf_coast_machining",
    name: "Gulf Coast Machining",
    trade: "Precision Machining",
    location: "Texas City, TX",
    trust_score: 65,
    capabilities: ["cnc", "night_shift", "nde_testing"],
  },
];

// ---------------------------------------------------------------------------
// Shared shell — dual-shadow embossed card
// ---------------------------------------------------------------------------

function EmbossedCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn("rounded-[12px] border-0 bg-[var(--surface-card)] p-4", className)}
      style={{
        boxShadow: "-6px -6px 14px rgba(255,255,255,0.65), 8px 8px 18px rgba(12,9,4,0.10)",
      }}
    >
      {children}
    </Card>
  );
}

function trustTone(score: number): "success" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 65) return "warning";
  return "danger";
}

// ---------------------------------------------------------------------------
// Capability chip
// ---------------------------------------------------------------------------

function CapabilityChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "rounded-[12px] border px-3 py-2.5 text-left text-sm font-medium transition-colors",
        selected
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--surface-card)]"
          : "border-[var(--muted)] bg-[var(--surface-card)] text-[var(--foreground)] hover:bg-[var(--muted)]/30"
      )}
    >
      {label}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Vendor result card
// ---------------------------------------------------------------------------

function VendorCard({ vendor, selected }: { vendor: Vendor; selected: Set<CapabilityId> }) {
  const tone = trustTone(vendor.trust_score);
  return (
    <motion.div
      layout
      layoutId={vendor.vendor_id}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <EmbossedCard className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground)]">{vendor.name}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {vendor.trade} · {vendor.location}
            </p>
          </div>
          <Badge
            className={cn(
              "shrink-0 border-none text-xs",
              tone === "success" && "bg-[var(--success)]/10 text-[var(--success)]",
              tone === "warning" && "bg-[var(--warning)]/10 text-[var(--warning)]",
              tone === "danger" && "bg-[var(--danger)]/10 text-[var(--danger)]"
            )}
          >
            Trust {vendor.trust_score}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {vendor.capabilities.map((cap) => (
            <span
              key={cap}
              className={cn(
                "rounded-[8px] px-2 py-1 text-[11px] font-medium",
                selected.has(cap)
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "bg-[var(--muted)]/40 text-[var(--muted-foreground)]"
              )}
            >
              {CAPABILITY_LABEL[cap]}
            </span>
          ))}
        </div>
      </EmbossedCard>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function SupplierCapabilityGraph() {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<CapabilityId>>(new Set());

  const toggleCapability = (id: CapabilityId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleChips = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CAPABILITIES;
    return CAPABILITIES.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  const matchingVendors = React.useMemo(() => {
    if (selected.size === 0) return VENDORS;
    return VENDORS.filter((v) => {
      const caps = new Set(v.capabilities);
      return Array.from(selected).every((c) => caps.has(c));
    });
  }, [selected]);

  const sortedVendors = React.useMemo(
    () => [...matchingVendors].sort((a, b) => b.trust_score - a.trust_score),
    [matchingVendors]
  );

  return (
    <div className="min-h-screen w-full bg-[var(--background)] p-6 font-[Inter,sans-serif] md:p-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
            TRUSTLINE
          </span>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Supplier Capability Graph</h1>
        </div>

        <EmbossedCard>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by capability — clean-room certified, night-shift, CNC machining…"
              className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
            />
          </div>
        </EmbossedCard>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {visibleChips.map((c) => (
            <CapabilityChip
              key={c.id}
              label={c.label}
              selected={selected.has(c.id)}
              onClick={() => toggleCapability(c.id)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            {sortedVendors.length} matching {sortedVendors.length === 1 ? "supplier" : "suppliers"}
          </span>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-[var(--muted-foreground)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--foreground)]"
            >
              Clear filters
            </button>
          )}
        </div>

        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {sortedVendors.map((v) => (
              <VendorCard key={v.vendor_id} vendor={v} selected={selected} />
            ))}
          </AnimatePresence>
        </motion.div>

        {sortedVendors.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-10 text-center text-sm text-[var(--muted-foreground)]"
          >
            No suppliers match every selected capability. Try clearing a filter.
          </motion.p>
        )}
      </div>
    </div>
  );
}
