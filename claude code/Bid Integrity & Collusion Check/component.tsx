"use client";

import * as React from "react";
import {
  motion,
  AnimatePresence,
  useSpring,
  useTransform,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (mirror route.py's Bid / EvidenceResult / BidIntegrityResult shapes)
// ---------------------------------------------------------------------------

type LineItem = { item: string; price: number };

type SuspiciousBid = { vendor_id: string; reason: string };

type EvidenceItem = {
  source: string;
  reliability_tier: "self_reported" | "third_party_observed" | "verified_transaction";
  timestamp: string;
  raw_ref: string;
};

type BidRow = {
  vendor_id: string;
  registered_address: string;
  submitted_at: string;
  line_items: LineItem[];
  flagged: boolean;
};

type ScanResult = {
  fairness_score: number;
  suspicious_bids: SuspiciousBid[];
  collusion_indicators: string[];
  bids: BidRow[];
  evidence: EvidenceItem[];
  reasoning: string;
  needs_human: boolean;
};

type ScanStatus = "scanning" | "results" | "error";

// ---------------------------------------------------------------------------
// Mock data — Riverside Bridge Rehabilitation, Contract #NJ-2026-0447
// ---------------------------------------------------------------------------

const ITEM_ORDER = [
  "Mobilization",
  "Excavation",
  "Structural Steel",
  "Concrete Pour",
  "Electrical",
  "Finishing / Punch List",
];

function buildMockResult(): ScanResult {
  const bids: BidRow[] = [
    {
      vendor_id: "SteelCo Industries",
      registered_address: "4471 Foundry Lane, Unit 12B, Newark, NJ",
      submitted_at: "2026-08-04T14:00:00Z",
      flagged: true,
      line_items: [
        { item: "Mobilization", price: 42000 },
        { item: "Excavation", price: 88000 },
        { item: "Structural Steel", price: 410000 },
        { item: "Concrete Pour", price: 265000 },
        { item: "Electrical", price: 140000 },
        { item: "Finishing / Punch List", price: 38000 },
      ],
    },
    {
      vendor_id: "MetroFab Construction",
      registered_address: "4471 Foundry Lane, Unit 12B, Newark, NJ",
      submitted_at: "2026-08-04T14:00:47Z",
      flagged: true,
      line_items: [
        { item: "Mobilization", price: 44000 },
        { item: "Excavation", price: 91000 },
        { item: "Structural Steel", price: 400000 },
        { item: "Concrete Pour", price: 270000 },
        { item: "Electrical", price: 145000 },
        { item: "Finishing / Punch List", price: 40000 },
      ],
    },
    {
      vendor_id: "Apex Builders",
      registered_address: "19 Harrow Industrial Park, Bldg C, Trenton, NJ",
      submitted_at: "2026-08-04T20:12:00Z",
      flagged: true,
      line_items: [
        { item: "Mobilization", price: 185000 },
        { item: "Excavation", price: 210000 },
        { item: "Structural Steel", price: 395000 },
        { item: "Concrete Pour", price: 255000 },
        { item: "Electrical", price: 62000 },
        { item: "Finishing / Punch List", price: 9000 },
      ],
    },
    {
      vendor_id: "Horizon Infrastructure",
      registered_address: "880 Delancey Court, Suite 4, Jersey City, NJ",
      submitted_at: "2026-08-05T16:00:00Z",
      flagged: false,
      line_items: [
        { item: "Mobilization", price: 39500 },
        { item: "Excavation", price: 84000 },
        { item: "Structural Steel", price: 418000 },
        { item: "Concrete Pour", price: 258000 },
        { item: "Electrical", price: 137500 },
        { item: "Finishing / Punch List", price: 41200 },
      ],
    },
    {
      vendor_id: "Continental Paving Co.",
      registered_address: "27 Route 9 South, Woodbridge, NJ",
      submitted_at: "2026-08-05T19:30:00Z",
      flagged: false,
      line_items: [
        { item: "Mobilization", price: 41000 },
        { item: "Excavation", price: 86500 },
        { item: "Structural Steel", price: 405000 },
        { item: "Concrete Pour", price: 261000 },
        { item: "Electrical", price: 142000 },
        { item: "Finishing / Punch List", price: 39500 },
      ],
    },
  ];

  return {
    fairness_score: 41.5,
    suspicious_bids: [
      {
        vendor_id: "SteelCo Industries",
        reason:
          "Shares registered address with MetroFab Construction (match 100%) — see Collusion Indicators.",
      },
      {
        vendor_id: "MetroFab Construction",
        reason:
          "Shares registered address with SteelCo Industries; bid submitted 47 seconds after SteelCo's.",
      },
      {
        vendor_id: "Apex Builders",
        reason:
          "Unbalanced bid pattern: Mobilization and Excavation priced 340%+ above vendor median (z ≥ 2.8) while Electrical and Finishing are priced below cost (z ≤ -2.1) — consistent with front-loading to exploit anticipated quantity overruns.",
      },
    ],
    collusion_indicators: [
      "SteelCo Industries and MetroFab Construction share registered address: 4471 Foundry Lane, Unit 12B, Newark, NJ (match 100%)",
      "SteelCo Industries and MetroFab Construction bids submitted 47 seconds apart, both with 5 of 6 line items on round $50 increments",
      "Apex Builders shows statistically significant per-line-item deviation (|z| ≥ 2.0) on 4 of 6 items — consistent with unbalanced bidding",
    ],
    bids: bids,
    evidence: [
      {
        source: "internal_bid_ledger.line_items",
        reliability_tier: "verified_transaction",
        timestamp: "2026-08-10T09:14:02Z",
        raw_ref: "z_score_matrix(items=6, threshold=2.0)",
      },
      {
        source: "internal_bid_ledger.submitted_at",
        reliability_tier: "verified_transaction",
        timestamp: "2026-08-10T09:14:02Z",
        raw_ref: "submission_timestamp_diff(window_s=300, pairs=10)",
      },
      {
        source: "business_registry.address_officer_lookup",
        reliability_tier: "third_party_observed",
        timestamp: "2026-08-10T09:14:02Z",
        raw_ref: "fuzzy_match(address_ratio>=0.92, officer_ratio>=0.90, pairs=10)",
      },
    ],
    reasoning:
      "This bid set scores low on fairness primarily because two vendors, SteelCo Industries and MetroFab Construction, share a registered address and submitted bids less than a minute apart with closely aligned round-number pricing, a strong indicator of coordinated bidding rather than independent competition. Separately, Apex Builders' bid shows a statistically significant unbalanced pattern, with early line items priced well above peer median and late line items priced below cost, which is a classic signal of exploiting anticipated quantity overruns. Together these findings warrant a procurement officer's review before award.",
    needs_human: true,
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const totalOf = (b: BidRow) => b.line_items.reduce((sum, li) => sum + li.price, 0);

const tierMeta: Record<
  EvidenceItem["reliability_tier"],
  { label: string; variant: "success" | "warning" | "info" }
> = {
  verified_transaction: { label: "Verified transaction", variant: "success" },
  third_party_observed: { label: "Third-party observed", variant: "info" },
  self_reported: { label: "Self-reported", variant: "warning" },
};

const SCAN_STATUS_MESSAGES = [
  "Pulling submitted bids from the procurement ledger…",
  "Computing per-line-item price z-scores across vendors…",
  "Checking submission timestamps for synchronization…",
  "Cross-referencing registered addresses and officers…",
  "Scoring bid fairness and compiling suspicious-bid list…",
];

// ---------------------------------------------------------------------------
// Animated fairness score (headline metric)
// ---------------------------------------------------------------------------

function FairnessScore({ score, needsHuman }: { score: number; needsHuman: boolean }) {
  const spring = useSpring(0, { stiffness: 60, damping: 16, mass: 0.9 });
  const rounded = useTransform(spring, (v) => Math.round(v));
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    spring.set(score);
  }, [score, spring]);

  React.useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [rounded]);

  const tone =
    score >= 80 ? "var(--success)" : score >= 55 ? "var(--warning)" : "var(--danger)";

  const circumference = 2 * Math.PI * 70;
  const dashOffset = useTransform(spring, (v) => circumference * (1 - v / 100));

  return (
    <div className="flex items-center gap-8">
      <div className="relative h-[168px] w-[168px] shrink-0">
        <svg viewBox="0 0 168 168" className="h-full w-full -rotate-90">
          <circle
            cx="84"
            cy="84"
            r="70"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="10"
          />
          <motion.circle
            cx="84"
            cy="84"
            r="70"
            fill="none"
            stroke={tone}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: dashOffset }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[44px] font-bold leading-none text-[var(--foreground)]">
            {display}
            <span className="text-[22px] font-medium align-top">%</span>
          </span>
          <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Fairness Score
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Contract #NJ-2026-0447 — Riverside Bridge Rehabilitation
        </span>
        <p className="max-w-md text-sm leading-relaxed text-[var(--foreground)]">
          {score < 55
            ? "Multiple independent checks fired on this bid set. Competitive integrity is in question — review before award."
            : score < 80
            ? "Some irregularities were detected. Review the flagged items before proceeding."
            : "No material irregularities detected across pricing, timing, or registry checks."}
        </p>
        {needsHuman && (
          <Badge
            className="w-fit border-none bg-[var(--danger)]/10 text-[var(--danger)]"
          >
            Human review required
          </Badge>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / scanning state
// ---------------------------------------------------------------------------

function ScanningState() {
  const [messageIndex, setMessageIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, SCAN_STATUS_MESSAGES.length - 1));
    }, 550);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      key="scanning"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center gap-6 py-24"
    >
      <div className="relative h-16 w-16">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-[var(--muted)]"
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)]"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
        />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Running SENTINEL bid integrity audit…
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={messageIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-[var(--muted-foreground)]"
          >
            {SCAN_STATUS_MESSAGES[messageIndex]}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      key="error"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 py-20 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger)]/10 text-[var(--danger)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      </div>
      <div className="max-w-sm">
        <p className="text-sm font-medium text-[var(--foreground)]">
          The audit couldn't finish.
        </p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          SENTINEL lost connection to the bid ledger partway through the scan. No
          fairness score was produced — nothing here should be treated as a result.
        </p>
      </div>
      <Button
        onClick={onRetry}
        className="bg-[var(--accent)] text-[var(--surface-card)] hover:bg-[var(--accent)]/90"
      >
        Re-run scan
      </Button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Bid comparison table
// ---------------------------------------------------------------------------

function BidTable({ bids }: { bids: BidRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-[var(--muted)]">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--muted)] bg-[var(--muted)]/30 text-left">
            <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Vendor</th>
            <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Total</th>
            {ITEM_ORDER.map((item) => (
              <th key={item} className="px-4 py-3 font-medium text-[var(--muted-foreground)]">
                {item}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bids.map((bid, i) => (
            <motion.tr
              key={bid.vendor_id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "border-b border-[var(--muted)] last:border-none transition-colors hover:bg-[var(--muted)]/25",
                bid.flagged && "border-l-4 border-l-[var(--danger)] bg-[var(--danger)]/[0.04]"
              )}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 font-medium text-[var(--foreground)]">
                  {bid.vendor_id}
                  {bid.flagged && (
                    <Badge className="border-none bg-[var(--danger)]/10 text-[10px] text-[var(--danger)]">
                      Flagged
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">{bid.registered_address}</div>
              </td>
              <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                {currency(totalOf(bid))}
              </td>
              {bid.line_items.map((li) => (
                <td key={li.item} className="px-4 py-3 text-[var(--foreground)]">
                  {currency(li.price)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suspicious bids + collusion indicators
// ---------------------------------------------------------------------------

function SuspiciousBidsList({ items }: { items: SuspiciousBid[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No suspicious bids detected.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((sb, i) => (
        <motion.li
          key={sb.vendor_id + i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="rounded-[12px] border border-[var(--muted)] bg-[var(--surface-card)] p-4"
        >
          <div className="mb-1 font-medium text-[var(--foreground)]">{sb.vendor_id}</div>
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">{sb.reason}</p>
        </motion.li>
      ))}
    </ul>
  );
}

function CollusionIndicators({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No collusion indicators detected.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((text, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="flex items-start gap-3 rounded-[12px] border border-[var(--danger)]/30 bg-[var(--danger)]/[0.06] p-4"
        >
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]" />
          <p className="text-sm leading-relaxed text-[var(--foreground)]">{text}</p>
        </motion.li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Evidence receipt
// ---------------------------------------------------------------------------

function EvidenceReceipt({ evidence, reasoning }: { evidence: EvidenceItem[]; reasoning: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-[12px] border border-[var(--muted)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--muted)]/25"
      >
        <span className="text-sm font-medium text-[var(--foreground)]">Evidence Receipt</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-[var(--muted-foreground)]"
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 border-t border-[var(--muted)] px-4 py-4">
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">{reasoning}</p>
              <div className="flex flex-col gap-2">
                {evidence.map((e, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-[var(--muted)]/25 px-3 py-2 text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-[var(--foreground)]">{e.source}</span>
                      <span className="text-[var(--muted-foreground)]">{e.raw_ref}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          "border-none text-[10px]",
                          tierMeta[e.reliability_tier].variant === "success" &&
                            "bg-[var(--success)]/10 text-[var(--success)]",
                          tierMeta[e.reliability_tier].variant === "info" &&
                            "bg-[var(--info)]/10 text-[var(--info)]",
                          tierMeta[e.reliability_tier].variant === "warning" &&
                            "bg-[var(--warning)]/10 text-[var(--warning)]"
                        )}
                      >
                        {tierMeta[e.reliability_tier].label}
                      </Badge>
                      <span className="text-[var(--muted-foreground)]">
                        {new Date(e.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Actions bar
// ---------------------------------------------------------------------------

function ActionsBar({
  flaggedVendors,
  disqualified,
  onDisqualify,
  onProceed,
  onRequestClarification,
  logMessage,
}: {
  flaggedVendors: string[];
  disqualified: Set<string>;
  onDisqualify: (vendor: string) => void;
  onProceed: () => void;
  onRequestClarification: () => void;
  logMessage: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {flaggedVendors.map((vendor) => (
          <Button
            key={vendor}
            variant="outline"
            disabled={disqualified.has(vendor)}
            onClick={() => onDisqualify(vendor)}
            className={cn(
              "border-[var(--danger)]/40 text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10",
              disqualified.has(vendor) && "opacity-50"
            )}
          >
            {disqualified.has(vendor) ? `${vendor} disqualified` : `Disqualify ${vendor}`}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--muted)] pt-3">
        <Button
          onClick={onProceed}
          className="bg-[var(--accent)] text-[var(--surface-card)] transition-colors hover:bg-[var(--accent)]/90"
        >
          Proceed With Award
        </Button>
        <Button
          variant="outline"
          onClick={onRequestClarification}
          className="border-[var(--muted-foreground)]/30 text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/40"
        >
          Request Clarification
        </Button>
        <AnimatePresence>
          {logMessage && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-[var(--muted-foreground)]"
            >
              {logMessage}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper (staggered mount)
// ---------------------------------------------------------------------------

function Section({
  title,
  index,
  children,
}: {
  title: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35, ease: "easeOut" }}
    >
      <Card className="rounded-[12px] border-[var(--muted)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          {title}
        </h2>
        {children}
      </Card>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function BidIntegrityAudit() {
  const [status, setStatus] = React.useState<ScanStatus>("scanning");
  const [result, setResult] = React.useState<ScanResult | null>(null);
  const [disqualified, setDisqualified] = React.useState<Set<string>>(new Set());
  const [logMessage, setLogMessage] = React.useState<string | null>(null);

  const runScan = React.useCallback((forceError = false) => {
    setStatus("scanning");
    setResult(null);
    setLogMessage(null);
    setDisqualified(new Set());

    const timer = setTimeout(() => {
      if (forceError) {
        setStatus("error");
        return;
      }
      setResult(buildMockResult());
      setStatus("results");
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    return runScan(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisqualify = (vendor: string) => {
    setDisqualified((prev) => new Set(prev).add(vendor));
    setLogMessage(`${vendor} marked as disqualified — removed from award consideration.`);
  };

  const handleProceed = () => {
    setLogMessage("Award recommendation logged. Flagged vendors excluded from the award path.");
  };

  const handleRequestClarification = () => {
    setLogMessage("Clarification request queued for all flagged vendors.");
  };

  const visibleBids = result?.bids.filter((b) => !disqualified.has(b.vendor_id)) ?? [];
  const flaggedVendors = result?.suspicious_bids.map((s) => s.vendor_id) ?? [];
  const uniqueFlaggedVendors = Array.from(new Set(flaggedVendors));

  return (
    <div className="min-h-screen w-full bg-[var(--background)] p-6 font-[Inter,sans-serif] md:p-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
            SENTINEL
          </span>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Bid Integrity &amp; Collusion Check</h1>
        </div>

        <AnimatePresence mode="wait">
          {status === "scanning" && <ScanningState key="scanning" />}
          {status === "error" && <ErrorState key="error" onRetry={() => runScan(false)} />}
          {status === "results" && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-6"
            >
              <Section title="Fairness Score" index={0}>
                <FairnessScore score={result.fairness_score} needsHuman={result.needs_human} />
              </Section>

              <Section title="Suspicious Bids" index={1}>
                <SuspiciousBidsList items={result.suspicious_bids} />
              </Section>

              <Section title="Collusion Indicators" index={2}>
                <CollusionIndicators items={result.collusion_indicators} />
              </Section>

              <Section title="Bid Comparison" index={3}>
                <BidTable bids={visibleBids} />
              </Section>

              <Section title="Actions" index={4}>
                <ActionsBar
                  flaggedVendors={uniqueFlaggedVendors}
                  disqualified={disqualified}
                  onDisqualify={handleDisqualify}
                  onProceed={handleProceed}
                  onRequestClarification={handleRequestClarification}
                  logMessage={logMessage}
                />
              </Section>

              <EvidenceReceipt evidence={result.evidence} reasoning={result.reasoning} />

              <button
                onClick={() => runScan(true)}
                className="self-start text-xs text-[var(--muted-foreground)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--foreground)]"
              >
                Simulate connection failure (demo)
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
