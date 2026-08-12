"use client";

/**
 * COMPASS — Ripple Check
 * "What else does this decision affect?"
 *
 * Center: the proposed decision. Around it: SPEC / TRADE / MATERIAL /
 * SCHEDULE / COST / COMMISSIONING. The ripple travels outward tier by tier
 * (decision -> direct impact -> secondary impact -> project impact) rather
 * than the whole graph appearing at once. Clicking a node explains why it's
 * connected. "Change Decision" swaps the underlying option and the whole
 * graph recalculates and re-ripples, so the user sees the blast radius
 * change in front of them.
 *
 * Mirrors the response shape of POST /api/compass/ripple-check (ripple_check.py).
 * If that endpoint isn't reachable (e.g. viewing this component standalone),
 * it falls back to the same seeded demo data the backend would return.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror ripple_check.py's response schema
// ---------------------------------------------------------------------------

type NodeCategory =
  | "decision"
  | "spec"
  | "trade"
  | "material"
  | "schedule"
  | "cost"
  | "commissioning"
  | "milestone";

type Relationship = "references" | "depends_on" | "blocks" | "scheduled_before";
type EvidenceType = "drawing" | "specification" | "schedule" | "purchase_package";

type EvidenceRef = { type: EvidenceType; label: string };

type RippleNode = {
  id: string;
  label: string;
  category: NodeCategory;
  tier: number; // 0 decision, 1 direct, 2 secondary, 3 project impact
  description: string;
  evidence: EvidenceRef[];
  cost_usd_impact: number;
  schedule_days_impact: number;
  on_critical_path: boolean;
};

type RippleEdge = { source: string; target: string; relationship: Relationship };

type ImpactSummary = {
  dependencies_found: number;
  direct_dependencies: number;
  secondary_dependencies: number;
  affected_trades: number;
  affected_milestones: number;
  cost_impact_usd: number;
  schedule_impact_days: number;
};

type RippleCheckResponse = {
  decision_id: string;
  decision_label: string;
  nodes: RippleNode[];
  edges: RippleEdge[];
  impact_summary: ImpactSummary;
  evidence: EvidenceRef[];
  confidence: number;
  reasoning: string;
};

// ---------------------------------------------------------------------------
// Decision options ("Change Decision") + local fallback data
//
// This mirrors exactly what /api/compass/ripple-check returns for these two
// decision_ids — see ripple_check.py's _TRANSFORMER_B_SEEDS / _TRANSFORMER_C_SEEDS.
// Kept in sync by hand for the demo; a real build would drop this fallback
// once the endpoint is always available.
// ---------------------------------------------------------------------------

const DECISION_OPTIONS = [
  {
    id: "transformer_b",
    label: "Transformer B",
    sublabel: "2500kVA Dry-Type — ElectroCorp",
  },
  {
    id: "transformer_c",
    label: "Transformer C",
    sublabel: "2500kVA Oil-Filled — PowerTech",
  },
] as const;

const FALLBACK_DATA: Record<string, RippleCheckResponse> = {
  transformer_b: {
    decision_id: "transformer_b",
    decision_label: "Replace Transformer A → Transformer B (2500kVA Dry-Type, ElectroCorp)",
    nodes: [
      { id: "decision", label: "Replace Transformer A → Transformer B", category: "decision", tier: 0, description: "Proposed substitution of the specified dry-type transformer for an equivalent unit from a different manufacturer.", evidence: [{ type: "purchase_package", label: "PO-3381 — Transformer A" }], cost_usd_impact: 42000, schedule_days_impact: 6, on_critical_path: false },
      { id: "cat_spec", label: "Specification", category: "spec", tier: 1, description: "Electrical equipment specification governing transformer selection.", evidence: [], cost_usd_impact: 500, schedule_days_impact: 0, on_critical_path: false },
      { id: "cat_trade", label: "Trade Packages", category: "trade", tier: 1, description: "Subcontractor packages whose scope depends on the installed transformer.", evidence: [], cost_usd_impact: 27500, schedule_days_impact: 0, on_critical_path: false },
      { id: "cat_material", label: "Material", category: "material", tier: 1, description: "Materials sized or selected around the transformer's electrical characteristics.", evidence: [], cost_usd_impact: 11000, schedule_days_impact: 3, on_critical_path: false },
      { id: "cat_schedule", label: "Schedule", category: "schedule", tier: 1, description: "Installation sequencing tied to transformer delivery and footprint.", evidence: [], cost_usd_impact: 2000, schedule_days_impact: 2, on_critical_path: false },
      { id: "cat_cost", label: "Cost", category: "cost", tier: 1, description: "Aggregate cost exposure rolled up from every affected dependency.", evidence: [], cost_usd_impact: 42000, schedule_days_impact: 0, on_critical_path: false },
      { id: "cat_commissioning", label: "Commissioning", category: "commissioning", tier: 1, description: "Test and turnover plan tied to the installed equipment's specifications.", evidence: [], cost_usd_impact: 1000, schedule_days_impact: 1, on_critical_path: false },
      { id: "spec_1", label: "Electrical Spec — Section 26 05 00", category: "spec", tier: 2, description: "Base spec section references Transformer A by model number; needs a substitution addendum.", evidence: [{ type: "specification", label: "Spec Section 26 05 00, Rev 3" }], cost_usd_impact: 500, schedule_days_impact: 0, on_critical_path: false },
      { id: "trade_1", label: "Electrical Package — ABC Electric Co.", category: "trade", tier: 2, description: "Termination and conduit rough-in sized to Transformer A's connection points.", evidence: [{ type: "purchase_package", label: "Subcontract SC-114 — ABC Electric" }], cost_usd_impact: 9000, schedule_days_impact: 0, on_critical_path: false },
      { id: "trade_2", label: "Low-Voltage Controls — XYZ Systems", category: "trade", tier: 2, description: "Controls integration is sequenced immediately after transformer energization.", evidence: [{ type: "schedule", label: "Look-Ahead Schedule, Week 34" }], cost_usd_impact: 6000, schedule_days_impact: 0, on_critical_path: false },
      { id: "trade_3", label: "Concrete Foundation Package — Foundation Co.", category: "trade", tier: 2, description: "Pad dimensions and anchor layout are specific to Transformer A's footprint and weight.", evidence: [{ type: "drawing", label: "Dwg E-501 — Transformer Pad Detail" }], cost_usd_impact: 12500, schedule_days_impact: 3, on_critical_path: false },
      { id: "material_1", label: "500 MCM Feeder Cable — Reorder Required", category: "material", tier: 2, description: "Transformer B's terminal lugs require a different feeder gauge than what's already on order.", evidence: [{ type: "purchase_package", label: "PO-3402 — Feeder Cable" }], cost_usd_impact: 11000, schedule_days_impact: 3, on_critical_path: true },
      { id: "schedule_1", label: "Substation Rough-In Sequence", category: "schedule", tier: 2, description: "Rough-in sequence assumes Transformer A's delivery window and dimensions.", evidence: [{ type: "schedule", label: "Master Schedule, Activity A-2201" }], cost_usd_impact: 2000, schedule_days_impact: 2, on_critical_path: true },
      { id: "commissioning_1", label: "Commissioning Test Plan Revision", category: "commissioning", tier: 2, description: "Factory and field test procedures are written against Transformer A's technical data sheet.", evidence: [{ type: "specification", label: "Commissioning Plan, Section 4.2" }], cost_usd_impact: 1000, schedule_days_impact: 1, on_critical_path: true },
      { id: "milestone_1", label: "Substation Energization Milestone", category: "milestone", tier: 3, description: "Cannot energize the substation until the installed transformer and its documentation reconcile.", evidence: [{ type: "schedule", label: "Master Schedule, Milestone M-14" }], cost_usd_impact: 0, schedule_days_impact: 0, on_critical_path: false },
      { id: "milestone_2", label: "Building Turnover Milestone", category: "milestone", tier: 3, description: "Turnover is sequenced after substation energization.", evidence: [{ type: "schedule", label: "Master Schedule, Milestone M-19" }], cost_usd_impact: 0, schedule_days_impact: 0, on_critical_path: false },
    ],
    edges: [
      { source: "decision", target: "cat_spec", relationship: "references" },
      { source: "decision", target: "cat_trade", relationship: "depends_on" },
      { source: "decision", target: "cat_material", relationship: "depends_on" },
      { source: "decision", target: "cat_schedule", relationship: "blocks" },
      { source: "decision", target: "cat_cost", relationship: "depends_on" },
      { source: "decision", target: "cat_commissioning", relationship: "blocks" },
      { source: "cat_spec", target: "spec_1", relationship: "references" },
      { source: "cat_trade", target: "trade_1", relationship: "depends_on" },
      { source: "cat_trade", target: "trade_2", relationship: "scheduled_before" },
      { source: "cat_trade", target: "trade_3", relationship: "depends_on" },
      { source: "cat_material", target: "material_1", relationship: "depends_on" },
      { source: "cat_schedule", target: "schedule_1", relationship: "blocks" },
      { source: "cat_commissioning", target: "commissioning_1", relationship: "scheduled_before" },
      { source: "schedule_1", target: "milestone_1", relationship: "blocks" },
      { source: "milestone_1", target: "milestone_2", relationship: "scheduled_before" },
    ],
    impact_summary: {
      dependencies_found: 7,
      direct_dependencies: 6,
      secondary_dependencies: 7,
      affected_trades: 3,
      affected_milestones: 2,
      cost_impact_usd: 42000,
      schedule_impact_days: 6,
    },
    evidence: [],
    confidence: 0.86,
    reasoning:
      "Traversed 6 direct dependency categories and 7 concrete downstream items. 3 trade package(s) and 2 milestone(s) sit on the affected path; critical-path schedule exposure is 6 day(s), total cost exposure $42,000.",
  },
  transformer_c: {
    decision_id: "transformer_c",
    decision_label: "Replace Transformer A → Transformer C (2500kVA Oil-Filled, PowerTech)",
    nodes: [
      { id: "decision", label: "Replace Transformer A → Transformer C", category: "decision", tier: 0, description: "Alternate substitution that preserves Transformer A's footprint and feeder termination.", evidence: [{ type: "purchase_package", label: "PO-3381 — Transformer A" }], cost_usd_impact: 14000, schedule_days_impact: 3, on_critical_path: false },
      { id: "cat_spec", label: "Specification", category: "spec", tier: 1, description: "Electrical equipment specification governing transformer selection.", evidence: [], cost_usd_impact: 500, schedule_days_impact: 0, on_critical_path: false },
      { id: "cat_trade", label: "Trade Packages", category: "trade", tier: 1, description: "Subcontractor packages whose scope depends on the installed transformer.", evidence: [], cost_usd_impact: 10500, schedule_days_impact: 0, on_critical_path: false },
      { id: "cat_material", label: "Material", category: "material", tier: 1, description: "Not triggered for this option — same footprint and feeder termination as Transformer A.", evidence: [], cost_usd_impact: 0, schedule_days_impact: 0, on_critical_path: false },
      { id: "cat_schedule", label: "Schedule", category: "schedule", tier: 1, description: "Installation sequencing tied to transformer delivery and footprint.", evidence: [], cost_usd_impact: 2000, schedule_days_impact: 2, on_critical_path: false },
      { id: "cat_cost", label: "Cost", category: "cost", tier: 1, description: "Aggregate cost exposure rolled up from every affected dependency.", evidence: [], cost_usd_impact: 14000, schedule_days_impact: 0, on_critical_path: false },
      { id: "cat_commissioning", label: "Commissioning", category: "commissioning", tier: 1, description: "Test and turnover plan tied to the installed equipment's specifications.", evidence: [], cost_usd_impact: 1000, schedule_days_impact: 1, on_critical_path: false },
      { id: "spec_1", label: "Electrical Spec — Section 26 05 00", category: "spec", tier: 2, description: "Base spec section references Transformer A by model number; needs a substitution addendum.", evidence: [{ type: "specification", label: "Spec Section 26 05 00, Rev 3" }], cost_usd_impact: 500, schedule_days_impact: 0, on_critical_path: false },
      { id: "trade_1", label: "Electrical Package — ABC Electric Co.", category: "trade", tier: 2, description: "Termination points are compatible, but oil-filled clearance code requires a minor conduit revision.", evidence: [{ type: "purchase_package", label: "Subcontract SC-114 — ABC Electric" }], cost_usd_impact: 6000, schedule_days_impact: 0, on_critical_path: false },
      { id: "trade_2", label: "Low-Voltage Controls — XYZ Systems", category: "trade", tier: 2, description: "Controls integration is sequenced immediately after transformer energization.", evidence: [{ type: "schedule", label: "Look-Ahead Schedule, Week 34" }], cost_usd_impact: 4500, schedule_days_impact: 0, on_critical_path: false },
      { id: "schedule_1", label: "Substation Rough-In Sequence", category: "schedule", tier: 2, description: "Rough-in sequence assumes Transformer A's delivery window; footprint is unchanged for this option.", evidence: [{ type: "schedule", label: "Master Schedule, Activity A-2201" }], cost_usd_impact: 2000, schedule_days_impact: 2, on_critical_path: true },
      { id: "commissioning_1", label: "Commissioning Test Plan Revision", category: "commissioning", tier: 2, description: "Factory and field test procedures are written against Transformer A's technical data sheet.", evidence: [{ type: "specification", label: "Commissioning Plan, Section 4.2" }], cost_usd_impact: 1000, schedule_days_impact: 1, on_critical_path: true },
      { id: "milestone_1", label: "Substation Energization Milestone", category: "milestone", tier: 3, description: "Cannot energize the substation until the installed transformer and its documentation reconcile.", evidence: [{ type: "schedule", label: "Master Schedule, Milestone M-14" }], cost_usd_impact: 0, schedule_days_impact: 0, on_critical_path: false },
    ],
    edges: [
      { source: "decision", target: "cat_spec", relationship: "references" },
      { source: "decision", target: "cat_trade", relationship: "depends_on" },
      { source: "decision", target: "cat_material", relationship: "depends_on" },
      { source: "decision", target: "cat_schedule", relationship: "blocks" },
      { source: "decision", target: "cat_cost", relationship: "depends_on" },
      { source: "decision", target: "cat_commissioning", relationship: "blocks" },
      { source: "cat_spec", target: "spec_1", relationship: "references" },
      { source: "cat_trade", target: "trade_1", relationship: "depends_on" },
      { source: "cat_trade", target: "trade_2", relationship: "scheduled_before" },
      { source: "cat_schedule", target: "schedule_1", relationship: "blocks" },
      { source: "cat_commissioning", target: "commissioning_1", relationship: "scheduled_before" },
      { source: "schedule_1", target: "milestone_1", relationship: "blocks" },
    ],
    impact_summary: {
      dependencies_found: 5,
      direct_dependencies: 6,
      secondary_dependencies: 5,
      affected_trades: 2,
      affected_milestones: 1,
      cost_impact_usd: 14000,
      schedule_impact_days: 3,
    },
    evidence: [],
    confidence: 0.86,
    reasoning:
      "Traversed 6 direct dependency categories and 5 concrete downstream items. 2 trade package(s) and 1 milestone(s) sit on the affected path; critical-path schedule exposure is 3 day(s), total cost exposure $14,000.",
  },
};

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const THEME_VARS = {
  "--background": "#08070C",
  "--foreground": "#FFFFFF",
  "--muted": "rgba(255, 255, 255, 0.08)",
  "--muted-foreground": "rgba(245, 243, 239, 0.45)",
  "--accent": "#7D39EB",
  "--surface-card": "#120E1C",
  "--surface-floating": "#1C172E",
  "--success": "#C6FF33",
  "--warning": "#FBBF24",
  "--danger": "#F87171",
  "--info": "#60A5FA",
  "--ai": "#7D39EB",
} as CSSProperties;

const SOFT_SHADOW = "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)";

const CATEGORY_COLOR: Record<NodeCategory, string> = {
  decision: "var(--foreground)",
  spec: "var(--info)",
  trade: "var(--accent)",
  material: "var(--ai)",
  schedule: "var(--warning)",
  cost: "var(--danger)",
  commissioning: "var(--success)",
  milestone: "var(--foreground)",
};

const CATEGORY_LABEL: Record<NodeCategory, string> = {
  decision: "Decision",
  spec: "Spec",
  trade: "Trade",
  material: "Material",
  schedule: "Schedule",
  cost: "Cost",
  commissioning: "Commissioning",
  milestone: "Milestone",
};

const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  drawing: "Drawing",
  specification: "Specification",
  schedule: "Schedule",
  purchase_package: "Purchase package",
};

// SVG viewBox for the graph canvas
const VB_W = 760;
const VB_H = 560;
const CENTER = { x: VB_W / 2, y: VB_H / 2 - 10 };

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

// ---------------------------------------------------------------------------
// Layout — deterministic node positions, computed once per graph
// ---------------------------------------------------------------------------

type PositionedNode = RippleNode & { x: number; y: number };

function layoutNodes(nodes: RippleNode[]): PositionedNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = (parentId: string) =>
    nodes.filter((n) => n.tier === (byId.get(parentId)?.tier ?? 0) + 1);

  const tier1 = nodes.filter((n) => n.tier === 1);
  const tier2 = nodes.filter((n) => n.tier === 2);
  const tier3 = nodes.filter((n) => n.tier === 3);

  const positioned: PositionedNode[] = [];
  const angleOf = new Map<string, number>();

  // Tier 0 — decision, dead center
  const decision = nodes.find((n) => n.tier === 0);
  if (decision) positioned.push({ ...decision, x: CENTER.x, y: CENTER.y });

  // Tier 1 — category ring, evenly spaced
  const step1 = 360 / Math.max(tier1.length, 1);
  tier1.forEach((node, i) => {
    const angle = i * step1;
    angleOf.set(node.id, angle);
    const p = polar(CENTER.x, CENTER.y, 150, angle);
    positioned.push({ ...node, x: p.x, y: p.y });
  });

  // Tier 2 — leaves fan out near their parent category's angle
  const byParentCategory = new Map<string, RippleNode[]>();
  tier2.forEach((node) => {
    const key = node.category;
    byParentCategory.set(key, [...(byParentCategory.get(key) ?? []), node]);
  });
  byParentCategory.forEach((siblings, category) => {
    const parent = tier1.find((n) => n.category === category);
    const baseAngle = parent ? angleOf.get(parent.id) ?? 0 : 0;
    const spread = 26;
    siblings.forEach((node, i) => {
      const offset = siblings.length === 1 ? 0 : (i - (siblings.length - 1) / 2) * spread;
      const angle = baseAngle + offset;
      angleOf.set(node.id, angle);
      const p = polar(CENTER.x, CENTER.y, 250, angle);
      positioned.push({ ...node, x: p.x, y: p.y });
    });
  });

  // Tier 3 — milestones, stacked further out near the schedule angle
  const scheduleAngle = tier1.find((n) => n.category === "schedule")
    ? angleOf.get(tier1.find((n) => n.category === "schedule")!.id) ?? 90
    : 90;
  tier3.forEach((node, i) => {
    const angle = scheduleAngle + (i - (tier3.length - 1) / 2) * 18;
    const p = polar(CENTER.x, CENTER.y, 345 + i * 8, angle);
    positioned.push({ ...node, x: p.x, y: p.y });
  });

  return positioned;
}

// ---------------------------------------------------------------------------
// Data fetching (with local fallback)
// ---------------------------------------------------------------------------

async function fetchRippleCheck(decisionId: string): Promise<RippleCheckResponse> {
  try {
    const res = await fetch("/api/compass/ripple-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision_id: decisionId }),
    });
    if (!res.ok) throw new Error(`Ripple check failed: ${res.status}`);
    return (await res.json()) as RippleCheckResponse;
  } catch {
    // Endpoint not reachable in this environment — use the same seeded
    // demo data the backend would return.
    return FALLBACK_DATA[decisionId] ?? FALLBACK_DATA.transformer_b;
  }
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function RippleCheck({ data: propData }: { data?: any }) {
  const [decisionId, setDecisionId] = useState<string>(propData?.decision_id || DECISION_OPTIONS[0].id);
  const [data, setData] = useState<RippleCheckResponse>(propData || FALLBACK_DATA[decisionId]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0); // 0..4, how far the ripple has traveled
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const runToken = useRef(0);

  useEffect(() => {
    // If the data was passed via props and matches the active decisionId, skip fetching
    if (propData && propData.decision_id === decisionId) {
      setData(propData);
      setStage(0);
      setSelectedNodeId(null);
      const maxTier = Math.max(...propData.nodes.map((n: any) => n.tier));
      let current = 0;
      const timer = setInterval(() => {
        current += 1;
        setStage(current);
        if (current >= maxTier + 1) clearInterval(timer);
      }, 550);
      return;
    }

    const token = ++runToken.current;
    setLoading(true);
    setStage(0);
    setSelectedNodeId(null);

    fetchRippleCheck(decisionId).then((response) => {
      if (runToken.current !== token) return; // a newer request superseded this one
      setData(response);
      setLoading(false);

      // Ripple the reveal outward: decision -> direct -> secondary -> project impact
      const maxTier = Math.max(...response.nodes.map((n) => n.tier));
      let current = 0;
      const timer = setInterval(() => {
        current += 1;
        setStage(current);
        if (current >= maxTier + 1) clearInterval(timer);
      }, 550);
    });
  }, [decisionId, propData]);

  const positionedNodes = useMemo(() => layoutNodes(data.nodes), [data]);
  const nodesById = useMemo(() => new Map(positionedNodes.map((n) => [n.id, n])), [positionedNodes]);
  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) ?? null : null;
  const selectedEdge = selectedNode
    ? data.edges.find((e) => e.target === selectedNode.id)
    : null;
  const selectedParent = selectedEdge ? nodesById.get(selectedEdge.source) ?? null : null;

  const summary = data.impact_summary;

  return (
    <div className="w-full rounded-xl p-6" style={{ ...THEME_VARS, background: "var(--background)" }}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge
            className="mb-2 rounded-[8px] border-0 text-[11px] uppercase tracking-wide"
            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            COMPASS · Ripple Check
          </Badge>
          <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            What else does this decision affect?
          </h2>
          <p className="mt-1 max-w-lg text-sm" style={{ color: "var(--muted-foreground)" }}>
            {data.decision_label}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
            Change decision
          </span>
          <div className="flex gap-1.5 rounded-[10px] p-1" style={{ background: "var(--muted)" }}>
            {DECISION_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setDecisionId(option.id)}
                className={cn(
                  "rounded-[8px] px-3 py-1.5 text-left text-xs transition-colors",
                  decisionId === option.id ? "shadow-sm" : "opacity-70 hover:opacity-100"
                )}
                style={{
                  background: decisionId === option.id ? "var(--surface-floating)" : "transparent",
                  color: "var(--foreground)",
                }}
              >
                <span className="block font-medium">{option.label}</span>
                <span className="block text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  {option.sublabel}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Hero — dependency graph, the one glass element on this screen */}
        <Card
          className="relative col-span-1 overflow-hidden rounded-xl border p-4 lg:col-span-2"
          style={{
            background: "var(--surface-card)",
            borderColor: "var(--muted)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: SOFT_SHADOW,
          }}
        >
          <RippleGraph
            key={decisionId}
            nodes={positionedNodes}
            edges={data.edges}
            stage={stage}
            loading={loading}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </Card>

        {/* Impact panel */}
        <div className="col-span-1 flex flex-col gap-4">
          <Card
            className="rounded-xl border-0 p-5"
            style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
          >
            <p className="mb-3 text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              Impact summary
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ImpactStat value={summary.dependencies_found} label="Dependencies found" show={stage >= 2} />
              <ImpactStat value={summary.affected_trades} label="Trade packages affected" show={stage >= 2} />
              <ImpactStat value={summary.affected_milestones} label="Milestones affected" show={stage >= 4} />
              <ImpactStat
                value={`+$${(summary.cost_impact_usd / 1000).toFixed(0)}K`}
                label="Estimated exposure"
                show={stage >= 2}
                tone="var(--danger)"
              />
              <ImpactStat
                value={`+${summary.schedule_impact_days}d`}
                label="Potential schedule impact"
                show={stage >= 3}
                tone="var(--warning)"
                span
              />
            </div>
          </Card>

          {/* Node detail — appears on click */}
          <Card
            className="min-h-[220px] flex-1 rounded-xl border-0 p-5"
            style={{ background: "var(--surface-card)", boxShadow: SOFT_SHADOW }}
          >
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <motion.div
                  key={selectedNode.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge
                        className="rounded-[6px] border-0 text-[10px] uppercase tracking-wide"
                        style={{
                          background: CATEGORY_COLOR[selectedNode.category],
                          color: "var(--surface-floating)",
                        }}
                      >
                        {CATEGORY_LABEL[selectedNode.category]}
                      </Badge>
                      <p className="mt-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {selectedNode.label}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedNodeId(null)}
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Close
                    </button>
                  </div>

                  {selectedParent && (
                    <p className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      Why connected? {" "}
                      <span style={{ color: "var(--foreground)" }}>{selectedParent.label}</span>{" "}
                      <code
                        className="rounded-[4px] px-1 py-0.5 text-[10px]"
                        style={{ background: "var(--muted)", color: "var(--foreground)" }}
                      >
                        {selectedEdge?.relationship}
                      </code>{" "}
                      this
                    </p>
                  )}

                  <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
                    {selectedNode.description}
                  </p>

                  {selectedNode.evidence.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                        Evidence
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {selectedNode.evidence.map((ref, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground)" }}>
                            <span
                              className="rounded-[4px] px-1.5 py-0.5 text-[10px]"
                              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                            >
                              {EVIDENCE_LABEL[ref.type]}
                            </span>
                            {ref.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(selectedNode.cost_usd_impact > 0 || selectedNode.schedule_days_impact > 0) && (
                    <div className="mt-4 flex gap-4 text-xs">
                      {selectedNode.cost_usd_impact > 0 && (
                        <span style={{ color: "var(--danger)" }}>
                          +${selectedNode.cost_usd_impact.toLocaleString()}
                        </span>
                      )}
                      {selectedNode.schedule_days_impact > 0 && (
                        <span style={{ color: "var(--warning)" }}>
                          +{selectedNode.schedule_days_impact}d
                          {selectedNode.on_critical_path ? " · critical path" : ""}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-full min-h-[180px] flex-col items-center justify-center text-center"
                >
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Click any node in the graph to see why it&apos;s connected and what evidence backs it.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Impact stat cell — counts up once its ripple stage is reached
// ---------------------------------------------------------------------------

function ImpactStat({
  value,
  label,
  show,
  tone,
  span,
}: {
  value: number | string;
  label: string;
  show: boolean;
  tone?: string;
  span?: boolean;
}) {
  return (
    <div className={cn("rounded-[8px] p-3", span && "col-span-2")} style={{ background: "var(--muted)" }}>
      <AnimatePresence mode="wait">
        {show ? (
          <motion.p
            key="value"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
            className="text-2xl font-semibold tabular-nums"
            style={{ color: tone ?? "var(--foreground)" }}
          >
            {value}
          </motion.p>
        ) : (
          <motion.p
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            className="text-2xl font-semibold"
            style={{ color: "var(--muted-foreground)" }}
          >
            —
          </motion.p>
        )}
      </AnimatePresence>
      <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ripple Graph — the signature dependency visualization
// ---------------------------------------------------------------------------

function RippleGraph({
  nodes,
  edges,
  stage,
  loading,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: PositionedNode[];
  edges: RippleEdge[];
  stage: number;
  loading: boolean;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div className="relative h-[420px] w-full sm:h-[520px]">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-full w-full">
        {/* Edges */}
        {edges.map((edge, i) => {
          const source = byId.get(edge.source);
          const target = byId.get(edge.target);
          if (!source || !target) return null;
          const revealed = stage >= target.tier;
          const isActive =
            selectedNodeId && (selectedNodeId === edge.source || selectedNodeId === edge.target);
          return (
            <motion.line
              key={`${edge.source}-${edge.target}-${i}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={isActive ? "var(--accent)" : "var(--muted-foreground)"}
              strokeWidth={isActive ? 2 : 1.25}
              strokeOpacity={isActive ? 0.9 : 0.35}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={revealed ? { pathLength: 1, opacity: isActive ? 0.9 : 0.35 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const revealed = stage >= node.tier;
          const isDecision = node.tier === 0;
          const radius = isDecision ? 34 : node.tier === 1 ? 24 : node.tier === 3 ? 16 : 18;
          const color = CATEGORY_COLOR[node.category];
          const isSelected = selectedNodeId === node.id;

          return (
            <g key={node.id}>
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={isDecision ? "var(--foreground)" : "var(--surface-floating)"}
                stroke={color}
                strokeWidth={isSelected ? 3 : 2}
                initial={{ scale: 0, opacity: 0 }}
                animate={revealed ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay: revealed ? 0.05 : 0 }}
                onClick={() => onSelectNode(node.id)}
                style={{ cursor: "pointer" }}
              />
              {revealed && (
                <motion.text
                  x={node.x}
                  y={node.y + radius + 14}
                  textAnchor="middle"
                  fontSize={isDecision ? 12 : 10}
                  fontWeight={isDecision ? 600 : 500}
                  fill="var(--foreground)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  style={{ pointerEvents: "none" }}
                >
                  {truncateLabel(node.label, isDecision ? 34 : 20)}
                </motion.text>
              )}
            </g>
          );
        })}
      </svg>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Recalculating ripple…
          </span>
        </div>
      )}
    </div>
  );
}

function truncateLabel(label: string, max: number) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
