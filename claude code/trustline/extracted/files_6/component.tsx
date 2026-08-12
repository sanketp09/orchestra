import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Centralized Trustline demo dataset + this endpoint's seeded registration
// matches (mirrors route.py exactly)
// ---------------------------------------------------------------------------

const PRIMARY = {
  id: "vendor_meridian_steel",
  name: "Meridian Steel Fabrication",
  trade: "Structural Steel",
  location: "Houston, TX",
};

const CONNECTED = {
  id: "vendor_msf_holdings",
  name: "MSF Holdings LLC",
};

const UNRELATED = {
  id: "vendor_titan_fab",
  name: "Titan Fabricators",
};

interface FieldMatch {
  field: string;
  label: string;
  a: string;
  b: string;
  matchType: "exact" | "fuzzy";
  ratio: number;
}

const MATCHED_FIELDS: FieldMatch[] = [
  {
    field: "registered_agent",
    label: "Registered agent",
    a: "Sterling Corporate Services LLC",
    b: "Sterling Corporate Services LLC",
    matchType: "exact",
    ratio: 1.0,
  },
  {
    field: "registered_officer",
    label: "Registered officer",
    a: "Daniel R. Voss",
    b: "Daniel Voss",
    matchType: "fuzzy",
    ratio: 0.89,
  },
  {
    field: "registered_address",
    label: "Registered address",
    a: "4820 Market St, Suite 210, Houston, TX 77002",
    b: "4820 Market St, Suite 340, Houston, TX 77002",
    matchType: "fuzzy",
    ratio: 0.83,
  },
];

const CONFIRMED_MATCHES = MATCHED_FIELDS.filter((f) => f.matchType === "exact" || f.ratio >= 0.85);

const scanSteps = [
  "Reading registered agent records…",
  "Comparing registered officers…",
  "Cross-checking registered addresses…",
  "Building entity connection graph…",
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 80, damping: 20 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    motionVal.set(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(v.toFixed(decimals)));
    return () => unsub();
  }, [spring, decimals]);

  return <span>{display}</span>;
}

// ---------------------------------------------------------------------------
// Hand-built node-link network diagram
// ---------------------------------------------------------------------------

function OwnershipNetwork() {
  // Layout: Meridian (left), MSF Holdings (right, connected), Titan (bottom, unconnected)
  const nodes = [
    { id: "meridian", label: PRIMARY.name, sub: PRIMARY.location, x: 130, y: 90, connected: true },
    { id: "msf", label: CONNECTED.name, sub: "Shell entity, same agent", x: 470, y: 90, connected: true },
    { id: "titan", label: UNRELATED.name, sub: "No shared fields", x: 300, y: 230, connected: false },
  ];

  return (
    <svg viewBox="0 0 600 280" className="w-full h-auto" role="img" aria-label="Ownership connection network">
      {/* edge: meridian -> msf (the finding) */}
      <motion.line
        x1={nodes[0].x + 60}
        y1={nodes[0].y}
        x2={nodes[1].x - 60}
        y2={nodes[1].y}
        stroke="var(--ai)"
        strokeWidth={2.5}
        strokeDasharray={340}
        initial={{ strokeDashoffset: 340 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
      />
      <motion.text
        x={(nodes[0].x + nodes[1].x) / 2}
        y={nodes[0].y - 14}
        textAnchor="middle"
        className="fill-[var(--ai)]"
        style={{ fontSize: 12, fontWeight: 500 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.3 }}
      >
        Same registered agent
      </motion.text>

      {/* faint dashed non-edges to titan, showing it was checked and cleared */}
      <motion.line
        x1={nodes[0].x + 40}
        y1={nodes[0].y + 35}
        x2={nodes[2].x - 50}
        y2={nodes[2].y - 30}
        stroke="var(--muted-foreground)"
        strokeWidth={1}
        strokeDasharray="3 5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.3, duration: 0.4 }}
      />
      <motion.line
        x1={nodes[1].x - 40}
        y1={nodes[1].y + 35}
        x2={nodes[2].x + 50}
        y2={nodes[2].y - 30}
        stroke="var(--muted-foreground)"
        strokeWidth={1}
        strokeDasharray="3 5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.3, duration: 0.4 }}
      />

      {nodes.map((n, i) => (
        <motion.g
          key={n.id}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.15, duration: 0.4, ease: "easeOut" }}
        >
          <circle
            cx={n.x}
            cy={n.y}
            r={n.connected ? 52 : 44}
            fill={n.connected ? "rgba(125, 57, 235, 0.15)" : "var(--surface-card)"}
            stroke={n.connected ? "var(--ai)" : "rgba(255, 255, 255, 0.1)"}
            strokeWidth={n.connected ? 2 : 1.5}
          />
          <text x={n.x} y={n.y - 4} textAnchor="middle" className="fill-[var(--foreground)]" style={{ fontSize: 12, fontWeight: 700 }}>
            {n.label.length > 20 ? n.label.slice(0, 18) + "…" : n.label}
          </text>
          <text x={n.x} y={n.y + 13} textAnchor="middle" className="fill-[var(--muted-foreground)]" style={{ fontSize: 10 }}>
            {n.sub}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type ScreenState = "scanning" | "results" | "error";

export default function HiddenOwnershipDetector() {
  const [screen, setScreen] = useState<ScreenState>("scanning");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (screen !== "scanning") return;
    if (stepIndex >= scanSteps.length) {
      const t = setTimeout(() => setScreen("results"), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIndex((i) => i + 1), 520);
    return () => clearTimeout(t);
  }, [screen, stepIndex]);

  function retry() {
    setScreen("scanning");
    setStepIndex(0);
  }
  function forceError() {
    setScreen("error");
  }

  const needsHuman = CONFIRMED_MATCHES.length > 0;
  const confidence = Math.round((CONFIRMED_MATCHES.reduce((a, c) => a + c.ratio, 0) / CONFIRMED_MATCHES.length) * 100);

  return (
    <div
      className="w-full min-h-[700px] rounded-[12px] p-6 sm:p-8"
      style={{
        // @ts-ignore css custom properties
        "--background": "#08070C",
        "--foreground": "#FFFFFF",
        "--muted": "rgba(255, 255, 255, 0.08)",
        "--muted-foreground": "rgba(255, 255, 255, 0.45)",
        "--accent": "#7D39EB",
        "--surface-card": "rgba(255, 255, 255, 0.02)",
        "--surface-floating": "rgba(255, 255, 255, 0.04)",
        "--success": "#C6FF33",
        "--warning": "#FBBF24",
        "--danger": "#F87171",
        "--info": "#38BDF8",
        "--ai": "#7D39EB",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <AnimatePresence mode="wait">
        {screen === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[600px] gap-6"
          >
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-[var(--muted)]" />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--ai)]"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-medium text-[var(--foreground)]">Trustline is checking for hidden ownership</p>
              <div className="h-5 mt-2 relative">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={stepIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="text-[13px] text-[var(--muted-foreground)]"
                  >
                    {scanSteps[Math.min(stepIndex, scanSteps.length - 1)]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
            <button onClick={forceError} className="text-[11px] text-[var(--muted-foreground)] underline underline-offset-2 hover:text-[var(--foreground)] transition-colors mt-4">
              Simulate a registrations lookup failure (demo)
            </button>
          </motion.div>
        )}

        {screen === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-[600px] gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] flex items-center justify-center">
              <span className="text-[var(--danger)] text-[20px] leading-none">!</span>
            </div>
            <div>
              <p className="text-[15px] font-medium text-[var(--foreground)]">Couldn't reach state registration records</p>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1 max-w-[380px]">
                The vendor profile loaded, but the secretary-of-state registrations lookup timed out before a comparison could run.
              </p>
            </div>
            <button
              className="text-[13px] text-white bg-[var(--accent)] hover:brightness-110 transition-all rounded-[8px] px-4 py-2"
              onClick={retry}
            >
              Retry lookup
            </button>
          </motion.div>
        )}

        {screen === "results" && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 * 0.1 }}>
              <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Trustline · Hidden Ownership Detector</p>
              <h1 className="text-[22px] font-bold text-[var(--foreground)] leading-tight">{PRIMARY.name}</h1>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
                {PRIMARY.trade} · {PRIMARY.location}
              </p>
            </motion.div>

            {/* Hero: network diagram, full width, glass treatment */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 * 0.1, duration: 0.4 }}
              className="rounded-[12px] p-5 sm:p-6"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">Connection graph</p>
                {needsHuman && (
                  <Badge className="text-[11px] px-2 py-0.5 rounded-[6px] font-medium bg-[color-mix(in_srgb,var(--ai)_18%,transparent)] text-[var(--ai)]">
                    {CONFIRMED_MATCHES.length} shared field{CONFIRMED_MATCHES.length > 1 ? "s" : ""} found
                  </Badge>
                )}
              </div>
              <OwnershipNetwork />
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1 text-center">
                {PRIMARY.name} and {CONNECTED.name} share a registered agent and a near-identical registered officer —
                {UNRELATED.name} was checked and cleared, no shared fields.
              </p>
            </motion.div>

            {/* Supporting evidence table */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2 * 0.1, duration: 0.35 }}>
              <h2 className="text-[13px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Supporting evidence</h2>
              <Card
                className="rounded-[12px] p-0 overflow-hidden bg-[var(--surface-card)] border border-white/5"
                style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
              >
                <div className="grid grid-cols-[1fr_1.4fr_1.4fr_0.9fr] gap-2 px-4 py-2.5 border-b border-[var(--muted)]/60 text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                  <span>Field</span>
                  <span>{PRIMARY.name}</span>
                  <span>{CONNECTED.name}</span>
                  <span>Match</span>
                </div>
                {MATCHED_FIELDS.map((f, i) => {
                  const isMatch = f.matchType === "exact" || f.ratio >= 0.85;
                  return (
                    <motion.div
                      key={f.field}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 3 * 0.1 + i * 0.08, duration: 0.25 }}
                      className={cn(
                        "grid grid-cols-[1fr_1.4fr_1.4fr_0.9fr] gap-2 px-4 py-3 items-center border-b border-[var(--muted)]/40 last:border-b-0",
                        isMatch && "border-l-[3px] border-l-[var(--ai)]"
                      )}
                    >
                      <span className="text-[13px] font-medium text-[var(--foreground)]">{f.label}</span>
                      <span className="text-[12px] text-[var(--foreground)]">{f.a}</span>
                      <span className="text-[12px] text-[var(--foreground)]">{f.b}</span>
                      <span>
                        <Badge
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-[6px] font-medium tabular-nums",
                            isMatch
                              ? "bg-[color-mix(in_srgb,var(--ai)_18%,transparent)] text-[var(--ai)]"
                              : "bg-[var(--muted)]/40 text-[var(--muted-foreground)]"
                          )}
                        >
                          {f.matchType === "exact" ? "Exact" : `${Math.round(f.ratio * 100)}%`}
                        </Badge>
                      </span>
                    </motion.div>
                  );
                })}
              </Card>
            </motion.div>

            {/* Evidence receipt */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4 * 0.1, duration: 0.35 }}>
              <Card className="bg-[var(--surface-floating)] border border-white/5 shadow-md rounded-[10px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-medium text-[var(--foreground)]">Evidence receipt</h3>
                  <Badge
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-[6px] font-medium",
                      needsHuman
                        ? "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning)]"
                        : "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)]"
                    )}
                  >
                    {needsHuman ? "Needs human review" : "No review required"}
                  </Badge>
                </div>
                <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed mb-4">
                  Compared registered agent, officer, and address across the state registrations table by exact and
                  fuzzy string matching. {CONFIRMED_MATCHES.length} field(s) matched {CONNECTED.name} at or above the
                  85% similarity threshold, so this was flagged for human review.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Confidence</p>
                    <p className="text-[15px] font-bold text-[var(--foreground)] tabular-nums">
                      0.<AnimatedNumber value={confidence} />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Evidence items</p>
                    <p className="text-[15px] font-bold text-[var(--foreground)] tabular-nums">{1 + CONFIRMED_MATCHES.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Writes to</p>
                    <p className="text-[12px] text-[var(--foreground)]">trustline.ownership_flags</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Source</p>
                    <p className="text-[12px] text-[var(--foreground)]">secretary_of_state · verified_transaction</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
