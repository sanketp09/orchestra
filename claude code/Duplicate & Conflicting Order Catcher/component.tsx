"use client";

/**
 * Duplicate & Conflicting Order Catcher — single-file build.
 *
 * Three states — scanning, results, error — driven by one status enum.
 * Mock data below mirrors exactly what POST /sentinel/duplicate-order-check
 * (see route.py) would actually return for this same New PO vs PO-0988
 * pair: duplicate_risk 0.70, 57% keyword overlap, $142,000 financial
 * impact — so the two files agree with each other, not just with
 * themselves.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useSpring,
} from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ============================================================================
 * This screen's surface system
 *
 * Distinct from the rest of the product's border-only elevation model —
 * this brief specifically calls for --surface-card / --surface-floating
 * and a three-step shadow scale, so it's implemented locally here rather
 * than relying on the imported Card's default (border, no shadow) look.
 * Kept as class-string constants (not template-interpolated) so a real
 * Tailwind build can still statically find every class name.
 * ==========================================================================*/

const SURFACE_CARD =
  "border-0 rounded-[12px] bg-[var(--surface-card)] shadow-[0_1px_3px_rgba(12,9,4,.05)]";
const SURFACE_CARD_ELEVATED =
  "border-0 rounded-[12px] bg-[var(--surface-card)] shadow-[0_2px_6px_rgba(12,9,4,.06)]";
const SURFACE_FLOATING =
  "border-0 rounded-[12px] bg-[var(--surface-floating)] shadow-[0_8px_24px_rgba(12,9,4,.10)]";

/* ============================================================================
 * Types — mirror the backend's DuplicateCheckResult shape. Conflicting
 * orders carry full display fields here (item/qty/supplier/date) rather
 * than just ids, since this screen renders them directly; a real client
 * would resolve route.py's conflicting_order_ids against a PO lookup to
 * build this same shape before rendering.
 * ==========================================================================*/

type ReliabilityTier = "self_reported" | "third_party_observed" | "verified_transaction";

interface EvidenceItem {
  source: string;
  reliabilityTier: ReliabilityTier;
  timestamp: string;
  rawRef: string;
}

interface OrderSummary {
  poNumber: string;
  item: string;
  quantity: number;
  quantityUnit: string;
  supplier: string;
  deliveryDate: string;
  totalValue: number;
}

interface ConflictingOrder extends OrderSummary {
  href: string;
}

interface DuplicateCheckResult {
  newOrder: OrderSummary;
  conflictingOrders: ConflictingOrder[];
  duplicateRisk: number; // 0-1
  financialImpactEstimate: number;
  reasoning: string; // doubles as the "Suggested Action" sentence
  confidence: number; // 0-1
  needsHuman: boolean;
  evidence: EvidenceItem[];
}

type ScreenStatus = "scanning" | "results" | "error";

type ActionKind = "merge" | "cancel" | "keep-both";
type ActionState =
  | { kind: "idle" }
  | { kind: "submitting"; action: ActionKind }
  | { kind: "done"; action: ActionKind };

/* ============================================================================
 * Mock data — matches route.py's PO-1042 vs PO-0988 scenario exactly
 * ==========================================================================*/

const MOCK_RESULT: DuplicateCheckResult = {
  newOrder: {
    poNumber: "PO-1042",
    item: "Reinforcing steel rods (rebar), Grade 60",
    quantity: 18,
    quantityUnit: "tons",
    supplier: "Meridian Steelworks",
    deliveryDate: "Apr 2, 2026",
    totalValue: 156_000,
  },
  conflictingOrders: [
    {
      poNumber: "PO-0988",
      item: "Reinforcement bars (rebar), Grade 60",
      quantity: 16,
      quantityUnit: "tons",
      supplier: "Apex Rebar Supply",
      deliveryDate: "Apr 5, 2026",
      totalValue: 142_000,
      href: "/procurement/pos/PO-0988",
    },
  ],
  duplicateRisk: 0.7,
  financialImpactEstimate: 142_000,
  reasoning:
    "Reinforcing steel rods (rebar), Grade 60 appears to duplicate PO-0988 (Reinforcement bars (rebar), Grade 60) — risk 70%, $142,000 at stake if both proceed. Review before releasing payment.",
  confidence: 0.97,
  needsHuman: true,
  evidence: [
    {
      source: "New PO submission — Reinforcing steel rods (rebar), Grade 60",
      reliabilityTier: "self_reported",
      timestamp: "Today, 9:14 AM",
      rawRef: "internal://procurement/po-submission-form",
    },
    {
      source: "PO-0988 record — Apex Rebar Supply",
      reliabilityTier: "verified_transaction",
      timestamp: "Apr 5, 2026",
      rawRef: "internal://procurement/pos/PO-0988",
    },
    {
      source: "Keyword-overlap similarity check: 57% token overlap with PO-0988",
      reliabilityTier: "third_party_observed",
      timestamp: "Today, 9:14 AM",
      rawRef: "internal://sentinel/keyword-similarity-heuristic",
    },
    {
      source:
        "Delivery window overlap vs PO-0988: 3-day gap, different supplier (Meridian Steelworks vs Apex Rebar Supply)",
      reliabilityTier: "third_party_observed",
      timestamp: "Today, 9:14 AM",
      rawRef: "internal://sentinel/delivery-window-check",
    },
  ],
};

const SCAN_STATUS_MESSAGES = [
  "Comparing against 4 open orders for this project...",
  "Checking item name overlap...",
  "Checking delivery window and supplier conflicts...",
  "Calculating financial impact...",
];

/* ============================================================================
 * Inline icons — plain SVG, zero extra dependencies
 * ==========================================================================*/

function IconArrowUpRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ============================================================================
 * Animated number — count/currency, spring-driven, never an instant swap
 * ==========================================================================*/

function useAnimatedNumber(target: number): number {
  const spring = useSpring(0, { stiffness: 90, damping: 20, mass: 0.6 });
  const [display, setDisplay] = useState(0);

  useMotionValueEvent(spring, "change", (latest) => setDisplay(latest));

  useEffect(() => {
    spring.set(target);
  }, [target, spring]);

  return display;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/* ============================================================================
 * Scanning state
 * ==========================================================================*/

function ScanningState() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SCAN_STATUS_MESSAGES.length);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className={cn("flex flex-col items-center gap-4 px-8 py-16 text-center", SURFACE_CARD)}>
      <motion.span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full bg-accent"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative h-5 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={SCAN_STATUS_MESSAGES[index]}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[14px] leading-5 text-muted-foreground"
          >
            {SCAN_STATUS_MESSAGES[index]}
          </motion.p>
        </AnimatePresence>
      </div>
    </Card>
  );
}

/* ============================================================================
 * Error state
 * ==========================================================================*/

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className={cn("flex flex-col items-center gap-4 px-8 py-16 text-center", SURFACE_CARD)}>
      <IconAlert className="h-9 w-9 text-muted-foreground" />
      <p className="text-[14px] font-medium leading-5 text-foreground">
        Couldn&apos;t complete the duplicate check — try again.
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </Card>
  );
}

/* ============================================================================
 * Risk tier
 * ==========================================================================*/

function riskTier(risk: number): { label: string; variant: "danger" | "warning" | "success" } {
  if (risk >= 0.66) return { label: "High", variant: "danger" };
  if (risk >= 0.33) return { label: "Medium", variant: "warning" };
  return { label: "Low", variant: "success" };
}

/* ============================================================================
 * Comparison block — new PO vs the conflicting PO, side by side
 * ==========================================================================*/

function OrderColumn({ label, order }: { label: string; order: OrderSummary }) {
  const rows: [string, string][] = [
    ["Item", order.item],
    ["Quantity", `${order.quantity} ${order.quantityUnit}`],
    ["Supplier", order.supplier],
    ["Delivery date", order.deliveryDate],
  ];

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className="text-[12px] leading-4 text-muted-foreground">{order.poNumber}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map(([fieldLabel, value]) => (
          <div key={fieldLabel} className="flex flex-col gap-0.5">
            <span className="text-[12px] leading-4 text-muted-foreground">{fieldLabel}</span>
            <span className="text-[14px] font-medium leading-5 text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonBlock({
  newOrder,
  conflict,
}: {
  newOrder: OrderSummary;
  conflict: OrderSummary;
}) {
  return (
    <Card className={cn("flex flex-col gap-6 p-6 sm:flex-row sm:items-stretch", SURFACE_CARD_ELEVATED)}>
      <OrderColumn label="New order" order={newOrder} />
      <div className="hidden w-px shrink-0 bg-muted sm:block" aria-hidden />
      <div className="block h-px w-full shrink-0 bg-muted sm:hidden" aria-hidden />
      <OrderColumn label="Conflicts with" order={conflict} />
    </Card>
  );
}

/* ============================================================================
 * Evidence receipt — reliability-tagged, expandable
 * ==========================================================================*/

const RELIABILITY_LABEL: Record<ReliabilityTier, string> = {
  self_reported: "Self-reported",
  third_party_observed: "System-observed",
  verified_transaction: "Verified transaction",
};

const RELIABILITY_COLOR: Record<ReliabilityTier, "warning" | "info" | "success"> = {
  self_reported: "warning",
  third_party_observed: "info",
  verified_transaction: "success",
};

function EvidenceReceipt({ evidence, confidence }: { evidence: EvidenceItem[]; confidence: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const displayConfidence = Math.round(useAnimatedNumber(confidence * 100));

  return (
    <Card className={cn("flex flex-col p-0 overflow-hidden", SURFACE_CARD)}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors duration-[120ms] hover:bg-[rgba(219,195,179,0.08)]"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-medium leading-5 text-foreground">
            Evidence Receipt
          </span>
          <span className="mt-1 text-[12px] leading-4 text-muted-foreground">
            {evidence.length} sources · {displayConfidence}% confidence
          </span>
        </div>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <IconChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <ul className="flex flex-col gap-3 border-t border-muted px-6 py-5">
              {evidence.map((item) => (
                <li key={item.source} className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[14px] leading-5 text-foreground">{item.source}</span>
                    <Badge variant={RELIABILITY_COLOR[item.reliabilityTier]} dot>
                      {RELIABILITY_LABEL[item.reliabilityTier]}
                    </Badge>
                  </div>
                  <span className="text-[12px] leading-4 text-muted-foreground">
                    {item.timestamp}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/* ============================================================================
 * Action row — three real handlers, wired loading + confirmation states
 * ==========================================================================*/

const ACTION_LABEL: Record<ActionKind, string> = {
  merge: "Merge Orders",
  cancel: "Cancel This Order",
  "keep-both": "Confirm Different — Keep Both",
};

function getActionConfirmation(
  action: ActionKind,
  newOrderNumber: string,
  conflictOrderNumber: string
): string {
  switch (action) {
    case "merge":
      return `Orders merged — ${newOrderNumber} has been consolidated into ${conflictOrderNumber}.`;
    case "cancel":
      return `${newOrderNumber} has been canceled.`;
    case "keep-both":
      return "Confirmed as distinct — both orders will proceed.";
  }
}

// Stubbed network call — swap for a real POST to
// /sentinel/duplicate-order-check/{id}/{action} once wired to the backend.
async function stubActionRequest(_action: ActionKind): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 900));
}

function ActionRow({
  newOrderNumber,
  conflictOrderNumber,
}: {
  newOrderNumber: string;
  conflictOrderNumber: string;
}) {
  const [state, setState] = useState<ActionState>({ kind: "idle" });

  const handleAction = useCallback(async (action: ActionKind) => {
    setState({ kind: "submitting", action });
    await stubActionRequest(action);
    setState({ kind: "done", action });
  }, []);

  const isSubmitting = state.kind === "submitting";
  const isDone = state.kind === "done";
  // One narrow, done once — every other check below reads from this
  // instead of touching `state.action` on the un-narrowed union.
  const activeAction: ActionKind | null = state.kind === "idle" ? null : state.action;

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {isDone && activeAction && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className={cn("flex items-center gap-3 px-5 py-4", SURFACE_FLOATING)}>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success">
                <IconCheck className="h-3 w-3 text-white" />
              </span>
              <p className="text-[14px] leading-5 text-foreground">
                {getActionConfirmation(activeAction, newOrderNumber, conflictOrderNumber)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3 sm:flex-row">
        {(["merge", "cancel", "keep-both"] as ActionKind[]).map((action) => {
          const isThisSubmitting = isSubmitting && activeAction === action;
          const isThisDone = isDone && activeAction === action;

          return (
            <motion.div key={action} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className="flex-1">
              <Button
                variant={action === "cancel" ? "secondary" : action === "merge" ? "primary" : "secondary"}
                onClick={() => handleAction(action)}
                disabled={isSubmitting || isDone}
                className="w-full"
              >
                {isThisSubmitting
                  ? "Submitting..."
                  : isThisDone
                    ? "Done"
                    : ACTION_LABEL[action]}
              </Button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
 * Results state
 * ==========================================================================*/

function fadeInSection(index: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.1, duration: 0.3, ease: "easeOut" as const },
  };
}

function ResultsState({ result }: { result: DuplicateCheckResult }) {
  const tier = riskTier(result.duplicateRisk);
  const displayRiskPct = Math.round(useAnimatedNumber(result.duplicateRisk * 100));
  const displayImpact = useAnimatedNumber(result.financialImpactEstimate);
  const primaryConflict = result.conflictingOrders[0];

  return (
    <div className="flex flex-col gap-8">
      <motion.div {...fadeInSection(0)}>
        <ComparisonBlock newOrder={result.newOrder} conflict={primaryConflict} />
      </motion.div>

      <motion.div {...fadeInSection(1)} className="flex flex-col gap-2">
        <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
          Duplicate Risk
        </span>
        <div className="flex items-end gap-3">
          <span className="text-[40px] font-bold leading-none tabular-nums text-foreground">
            {displayRiskPct}%
          </span>
          <Badge variant={tier.variant} dot>
            {tier.label}
          </Badge>
        </div>
      </motion.div>

      <motion.div {...fadeInSection(2)} className="flex flex-col gap-3">
        <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
          Conflicting Orders
        </span>
        <ul className="flex flex-col gap-2">
          {result.conflictingOrders.map((order) => (
            <li key={order.poNumber}>
              <a
                href={order.href}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-[120ms] hover:bg-[rgba(219,195,179,0.08)]",
                  SURFACE_CARD
                )}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-medium leading-5 text-foreground">
                    {order.poNumber} — {order.item}
                  </span>
                  <span className="mt-1 text-[12px] leading-4 text-muted-foreground">
                    {order.supplier} · {order.deliveryDate}
                  </span>
                </span>
                <IconArrowUpRight className="h-4 w-4 shrink-0 text-accent" />
              </a>
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div {...fadeInSection(3)} className="flex flex-col gap-2">
        <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
          Financial Impact
        </span>
        <span className="text-[40px] font-bold leading-none tabular-nums text-accent">
          {currencyFormatter.format(Math.round(displayImpact))}
        </span>
      </motion.div>

      <motion.div {...fadeInSection(4)} className="flex flex-col gap-2">
        <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
          Suggested Action
        </span>
        <p className="text-[14px] leading-5 text-foreground">{result.reasoning}</p>
      </motion.div>

      <motion.div {...fadeInSection(5)}>
        <ActionRow
          newOrderNumber={result.newOrder.poNumber}
          conflictOrderNumber={primaryConflict.poNumber}
        />
      </motion.div>

      <motion.div {...fadeInSection(6)}>
        <EvidenceReceipt evidence={result.evidence} confidence={result.confidence} />
      </motion.div>
    </div>
  );
}

/* ============================================================================
 * Screen — the state machine
 * ==========================================================================*/

export default function DuplicateOrderCheckScreen(): ReactNode {
  const [status, setStatus] = useState<ScreenStatus>("scanning");
  // Demo-only affordance so the required error state is actually
  // reachable without needing a real failing backend — not part of the
  // production control flow.
  const [forceErrorOnNextRun, setForceErrorOnNextRun] = useState(false);

  const runCheck = useCallback((shouldFail: boolean) => {
    setStatus("scanning");
    const id = setTimeout(() => {
      setStatus(shouldFail ? "error" : "results");
    }, 2800);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => runCheck(forceErrorOnNextRun), [runCheck, forceErrorOnNextRun]);

  return (
    <div className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-[24px] font-bold leading-8 text-foreground">
              Duplicate Order Check
            </h1>
            <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
              PO-1042 — Riverside Yards, Phase 2
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setForceErrorOnNextRun((v) => !v)}
          >
            {forceErrorOnNextRun ? "Run normally" : "Simulate error"}
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {status === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <ScanningState />
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <ErrorState onRetry={() => runCheck(false)} />
            </motion.div>
          )}

          {status === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <ResultsState result={MOCK_RESULT} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
