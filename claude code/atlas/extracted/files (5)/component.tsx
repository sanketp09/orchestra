"use client";

/**
 * Atlas — Port & Shipping Intelligence
 *
 * Route progress for Switchgear Shipment #4471 (Meridian Steel Fabrication
 * -> Austin Semiconductor Fab), with a live congestion check at the Port of
 * Houston waypoint and a concrete reroute recommendation when relevant.
 *
 * Visually matches Trustline's established bento-grid + soft-depth
 * treatment (data-rich, not flow-based like Sentinel) — reuses the same
 * color tokens, shadow treatment, and easing already established in the
 * repo rather than redefining them here.
 *
 * NOTE: assumes `@/lib/animations` exports `EASE_OUT_EXPO` and a
 * `useCountUp` hook matching Trustline's convention (see e.g.
 * EMR & Safety Trend Watch). If the repo's actual export names differ,
 * swap the import below accordingly — nothing else in this file depends on
 * the exact names.
 *
 * Mirrors the response shape of GET /atlas/shipment-status/{shipment_id}
 * (route.py). Falls back to the same seeded demo data if that endpoint
 * isn't reachable, so this demos standalone too.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE_OUT_EXPO, useCountUp } from "@/lib/animations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror route.py's response schema
// ---------------------------------------------------------------------------

type WaypointStatus = "completed" | "current" | "upcoming";
type WaypointType = "factory" | "departure_port" | "transit" | "arrival_port" | "site";

type Waypoint = {
  id: string;
  label: string;
  type: WaypointType;
  status: WaypointStatus;
  date: string | null;
  progress_pct: number | null;
  has_congestion: boolean;
};

type WorldSignal = {
  signal_type: string;
  affected_entity_ids: string[];
  severity: "info" | "watch" | "action_needed";
  summary: string;
  detail: Record<string, unknown>;
  recommended_action: string | null;
  detected_at: string;
};

type RerouteOption = {
  alternate_port: string;
  alternate_total_transit_days: number;
  time_savings_days: number;
  recommended: boolean;
};

type ShipmentStatusResponse = {
  shipment_id: string;
  shipment_label: string;
  vendor_id: string;
  vendor_name: string;
  project_id: string;
  project_name: string;
  waypoints: Waypoint[];
  route_progress_pct: number;
  original_eta: string;
  current_eta: string;
  delay_days: number;
  congestion_signal: WorldSignal | null;
  reroute_option: RerouteOption | null;
  needs_human: boolean;
  reasoning: string;
};

// ---------------------------------------------------------------------------
// Local fallback — mirrors exactly what GET /atlas/shipment-status/shipment_4471
// returns (both the seeded congested state and the simulate_congestion=false
// on-track state), kept in sync by hand with route.py.
// ---------------------------------------------------------------------------

const FALLBACK_CONGESTED: ShipmentStatusResponse = {
  shipment_id: "shipment_4471",
  shipment_label: "Switchgear Shipment #4471",
  vendor_id: "vendor_meridian_steel",
  vendor_name: "Meridian Steel Fabrication",
  project_id: "project_austin_fab",
  project_name: "Austin Semiconductor Fab",
  waypoints: [
    { id: "factory", label: "Ulsan Fabrication Facility", type: "factory", status: "completed", date: "2026-07-18", progress_pct: null, has_congestion: false },
    { id: "departure_port", label: "Port of Ulsan", type: "departure_port", status: "completed", date: "2026-07-20", progress_pct: null, has_congestion: false },
    { id: "transit", label: "Pacific Ocean Transit", type: "transit", status: "current", date: null, progress_pct: 95.8, has_congestion: false },
    { id: "arrival_port", label: "Port of Houston", type: "arrival_port", status: "upcoming", date: "2026-08-18", progress_pct: null, has_congestion: true },
    { id: "site", label: "Austin Semiconductor Fab Site", type: "site", status: "upcoming", date: "2026-08-21", progress_pct: null, has_congestion: false },
  ],
  route_progress_pct: 86.2,
  original_eta: "2026-08-16",
  current_eta: "2026-08-21",
  delay_days: 5,
  congestion_signal: {
    signal_type: "port_congestion",
    affected_entity_ids: ["shipment_4471", "vendor_meridian_steel", "project_austin_fab"],
    severity: "action_needed",
    summary: "Port of Houston is experiencing moderate congestion, affecting Switchgear Shipment #4471.",
    detail: { congestion_level: "moderate", port: "Port of Houston", delay_days: 5, vessels_queued: 14, avg_berth_wait_days: 4.5 },
    recommended_action: "Reroute via Port of Beaumont — saves 4 days",
    detected_at: "2026-08-10T09:00:00Z",
  },
  reroute_option: { alternate_port: "Port of Beaumont", alternate_total_transit_days: 28, time_savings_days: 4, recommended: true },
  needs_human: true,
  reasoning:
    "Moderate congestion at Port of Houston adds 5 days to Switchgear Shipment #4471's ETA (now 2026-08-21, vs. original 2026-08-16). Rerouting via Port of Beaumont would save 4 days — flagged for human review since redirecting an in-transit shipment is a real decision, not something to auto-execute.",
};

const FALLBACK_ON_TRACK: ShipmentStatusResponse = {
  ...FALLBACK_CONGESTED,
  waypoints: FALLBACK_CONGESTED.waypoints.map((w) =>
    w.id === "arrival_port"
      ? { ...w, has_congestion: false, date: "2026-08-16" }
      : w.id === "site"
        ? { ...w, date: "2026-08-16" }
        : w
  ),
  current_eta: "2026-08-16",
  delay_days: 0,
  congestion_signal: null,
  reroute_option: null,
  needs_human: false,
  reasoning:
    "Switchgear Shipment #4471 is on track — no congestion detected at Port of Houston. Current ETA matches original ETA of 2026-08-16.",
};

async function fetchShipmentStatus(simulateCongestion: boolean | null): Promise<ShipmentStatusResponse> {
  try {
    const query = simulateCongestion === null ? "" : `?simulate_congestion=${simulateCongestion}`;
    const res = await fetch(`/atlas/shipment-status/shipment_4471${query}`);
    if (!res.ok) throw new Error(`Shipment status failed: ${res.status}`);
    return (await res.json()) as ShipmentStatusResponse;
  } catch {
    return simulateCongestion === false ? FALLBACK_ON_TRACK : FALLBACK_CONGESTED;
  }
}

// ---------------------------------------------------------------------------
// Visual constants — matching Trustline's established treatment
// ---------------------------------------------------------------------------

const SOFT_SHADOW = "-4px -4px 10px rgba(255,255,255,0.6), 6px 6px 16px rgba(12,9,4,0.08)";

const WAYPOINT_LABEL_SHORT: Record<WaypointType, string> = {
  factory: "Factory",
  departure_port: "Departure",
  transit: "Transit",
  arrival_port: "Arrival Port",
  site: "Site",
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function PortShippingIntelligence() {
  const [simulateCongestion, setSimulateCongestion] = useState<boolean | null>(null);
  const [data, setData] = useState<ShipmentStatusResponse>(FALLBACK_CONGESTED);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchShipmentStatus(simulateCongestion).then((response) => {
      setData(response);
      setLoading(false);
    });
  }, [simulateCongestion]);

  const hasCongestion = data.congestion_signal !== null;
  const etaDelta = data.delay_days;

  return (
    <div className="w-full rounded-xl p-6" style={{ background: "var(--background)" }}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge
            className="mb-2 rounded-[8px] border-0 text-[11px] uppercase tracking-wide"
            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            Atlas · Port &amp; Shipping Intelligence
          </Badge>
          <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            {data.shipment_label}
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            {data.vendor_name} → {data.project_name}
          </p>
        </div>

        {/* Demo-only toggle backed by the real simulate_congestion query param
            — lets both UI states (alert vs. on-track) be exercised. */}
        <div className="flex gap-1.5 rounded-[10px] p-1" style={{ background: "var(--muted)" }}>
          {[
            { key: null as boolean | null, label: "Live" },
            { key: false, label: "On track" },
            { key: true, label: "Congestion" },
          ].map((option) => (
            <button
              key={String(option.key)}
              onClick={() => setSimulateCongestion(option.key)}
              className={cn(
                "rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors",
                simulateCongestion === option.key ? "shadow-sm" : "opacity-70 hover:opacity-100"
              )}
              style={{
                background: simulateCongestion === option.key ? "var(--surface-floating)" : "transparent",
                color: "var(--foreground)",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-2">
        <RouteProgressCard waypoints={data.waypoints} progressPct={data.route_progress_pct} loading={loading} />
        <EtaCard originalEta={data.original_eta} currentEta={data.current_eta} delayDays={etaDelta} />
        <RecommendedActionCard
          hasCongestion={hasCongestion}
          signal={data.congestion_signal}
          reroute={data.reroute_option}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero — Route progress visualization (the one glass element on this screen)
// ---------------------------------------------------------------------------

function RouteProgressCard({
  waypoints,
  progressPct,
  loading,
}: {
  waypoints: Waypoint[];
  progressPct: number;
  loading: boolean;
}) {
  return (
    <Card
      className="relative col-span-1 row-span-2 overflow-hidden rounded-xl border p-5 md:col-span-2"
      style={{
        background: "rgba(255,255,255,0.55)",
        borderColor: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 8px 30px rgba(12,9,4,0.10)",
      }}
    >
      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
        Route progress
      </p>
      <p className="mt-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>
        Ulsan, South Korea → Port of Houston → Austin site
      </p>

      <div className="relative mt-16 px-4">
        {/* Base track */}
        <div className="relative h-1.5 w-full rounded-full" style={{ background: "var(--muted)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--accent)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.2 }}
          />
        </div>

        {/* Waypoints */}
        <div className="relative mt-0 flex justify-between">
          {waypoints.map((wp, i) => {
            const leftPct = (i / (waypoints.length - 1)) * 100;
            return (
              <div
                key={wp.id}
                className="absolute flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${leftPct}%`, top: "-6px" }}
              >
                <div className="relative">
                  {wp.has_congestion && (
                    <motion.span
                      className="absolute inset-[-6px] rounded-full"
                      style={{ border: "2px solid var(--warning)" }}
                      initial={{ opacity: 0.6, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.6 }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  <motion.div
                    className="h-3.5 w-3.5 rounded-full border-2"
                    style={{
                      background: wp.status === "upcoming" ? "var(--surface-floating)" : "var(--accent)",
                      borderColor: wp.has_congestion ? "var(--warning)" : "var(--accent)",
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.35, ease: EASE_OUT_EXPO, delay: 0.1 * i }}
                  />
                  {wp.status === "current" && (
                    <motion.span
                      className="absolute inset-[-5px] rounded-full"
                      style={{ border: "2px solid var(--accent)" }}
                      animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.5, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </div>
                <span
                  className="mt-3 whitespace-nowrap text-[10px] font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  {WAYPOINT_LABEL_SHORT[wp.type]}
                </span>
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  {wp.date ? formatDate(wp.date) : wp.progress_pct != null ? `${wp.progress_pct}%` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-16 flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: loading ? "var(--muted-foreground)" : "var(--accent)" }}
        />
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {loading ? "Refreshing route…" : `${progressPct}% of route complete`}
        </span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ETA card
// ---------------------------------------------------------------------------

function EtaCard({
  originalEta,
  currentEta,
  delayDays,
}: {
  originalEta: string;
  currentEta: string;
  delayDays: number;
}) {
  // Assumes lib/animations' useCountUp(target, options) returns a number
  // that eases toward `target` — see the top-of-file note if the real
  // signature differs.
  const delayDisplay = useCountUp(delayDays, { duration: 0.6 });

  return (
    <Card
      className="col-span-1 row-span-1 flex flex-col justify-between rounded-xl border-0 p-5"
      style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
    >
      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
        ETA
      </p>

      <div className="mt-2">
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Original: {formatDate(originalEta)}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: delayDays > 0 ? "var(--warning)" : "var(--success)" }}>
          {formatDate(currentEta)}
        </p>
      </div>

      <AnimatePresence>
        {delayDays > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 w-fit rounded-[6px] px-2 py-1 text-xs font-medium"
            style={{ background: "var(--warning)", color: "var(--surface-floating)" }}
          >
            +{Math.round(delayDisplay)}d vs. original
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Recommended Action card — both the alert state and the calm state
// ---------------------------------------------------------------------------

function RecommendedActionCard({
  hasCongestion,
  signal,
  reroute,
}: {
  hasCongestion: boolean;
  signal: WorldSignal | null;
  reroute: RerouteOption | null;
}) {
  return (
    <Card
      className="col-span-1 row-span-1 flex flex-col justify-between rounded-xl border-0 p-5"
      style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
    >
      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
        Recommended action
      </p>

      <AnimatePresence mode="wait">
        {hasCongestion && signal && reroute ? (
          <motion.div
            key="alert"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            className="mt-2"
          >
            <Badge
              className="rounded-[6px] border-0 text-[10px] uppercase tracking-wide"
              style={{ background: "var(--warning)", color: "var(--surface-floating)" }}
            >
              {signal.detail.congestion_level as string} congestion
            </Badge>
            <p className="mt-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Reroute via {reroute.alternate_port}
            </p>
            <p className="text-xs" style={{ color: "var(--success)" }}>
              Saves {reroute.time_savings_days} days
            </p>
            <Button
              className="mt-3 w-full rounded-[8px] text-xs"
              style={{ background: "var(--accent)", color: "var(--surface-floating)" }}
            >
              Review reroute
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="calm"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            className="mt-2 flex flex-1 flex-col justify-center"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--success)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                On track
              </p>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              No port congestion detected. No action needed.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
