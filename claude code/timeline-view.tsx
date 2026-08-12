"use client";

/**
 * Timeline View — single-file, generic and reusable.
 *
 * `Timeline` takes a typed `events` array via props — it has no knowledge
 * of "construction procurement" or any other domain baked in. The demo
 * wrapper at the bottom of this file supplies realistic sample data purely
 * so the component is viewable standalone; a consumer elsewhere would pass
 * their own `TimelineEvent[]` instead.
 */

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useSpring } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ============================================================================
 * Public types
 * ==========================================================================*/

/** Semantic tone — reuses the product's badge/dot colors directly, so a
 * consumer picks whichever one fits their event rather than the component
 * inventing a second color vocabulary. */
export type TimelineEventTone = "success" | "warning" | "danger" | "info" | "ai";

export interface TimelineEventReceipt {
  /** Short, named evidence sources — kept to a handful of compact labels. */
  evidence: string[];
  confidencePct: number;
  /** One plain sentence — the "why" behind this event. */
  reasoning: string;
  /** Destination for "View full receipt". */
  href: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  /** Pre-formatted display date — the component never formats dates itself. */
  date: string;
  tone: TimelineEventTone;
  receipt: TimelineEventReceipt;
}

export interface TimelineProps {
  events: TimelineEvent[];
  emptyMessage?: string;
}

/* ============================================================================
 * Inline icons — plain SVG, zero extra dependencies
 * ==========================================================================*/

function IconClock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx={12} cy={12} r={8.5} stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 12h14m0 0-5-5m5 5-5 5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ============================================================================
 * Tone -> color mapping
 * ==========================================================================*/

const TONE_DOT_COLOR: Record<TimelineEventTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  ai: "bg-ai",
};

/* ============================================================================
 * Animated confidence number — never an instant swap
 * ==========================================================================*/

function useAnimatedPercent(value: number): number {
  const spring = useSpring(0, { stiffness: 100, damping: 22, mass: 0.5 });
  const [display, setDisplay] = useState(0);

  useMotionValueEvent(spring, "change", (latest) => setDisplay(Math.round(latest)));

  // Kick the spring toward its target on mount — the expanded receipt is
  // remounted fresh each time it opens, so this always starts from 0.
  useState(() => {
    spring.set(value);
  });

  return display;
}

/* ============================================================================
 * Compact receipt — the accordion's expanded content
 * ==========================================================================*/

function CompactReceipt({
  receipt,
  tone,
}: {
  receipt: TimelineEventReceipt;
  tone: TimelineEventTone;
}) {
  const displayPct = useAnimatedPercent(receipt.confidencePct);

  return (
    <Card className="ml-8 mt-2 flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
          Evidence
        </span>
        <ul className="flex flex-col gap-1">
          {receipt.evidence.map((item) => (
            <li key={item} className="text-[12px] leading-4 text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
            Confidence
          </span>
          <span className="text-[14px] font-medium leading-5 tabular-nums text-foreground">
            {displayPct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className={cn("h-full rounded-full", TONE_DOT_COLOR[tone])}
            initial={{ width: 0 }}
            animate={{ width: `${receipt.confidencePct}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          />
        </div>
      </div>

      <p className="text-[14px] leading-5 text-foreground">{receipt.reasoning}</p>

      <a
        href={receipt.href}
        className="flex items-center gap-1 self-start rounded-sm text-[14px] font-medium leading-5 text-accent transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        View full receipt
        <IconArrowRight className="h-3.5 w-3.5" />
      </a>
    </Card>
  );
}

/* ============================================================================
 * A single timeline row — dot on the line, title/date, expandable receipt
 * ==========================================================================*/

function TimelineRow({
  event,
  isExpanded,
  onToggle,
}: {
  event: TimelineEvent;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <li className="relative pl-8">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-background",
          TONE_DOT_COLOR[event.tone]
        )}
      />

      <button
        type="button"
        onClick={() => onToggle(event.id)}
        aria-expanded={isExpanded}
        className={cn(
          "-mx-3 flex w-full flex-col gap-0.5 rounded-[6px] border-l-2 px-3 py-2 text-left transition-colors duration-[120ms]",
          "hover:bg-[rgba(219,195,179,0.08)]",
          isExpanded
            ? "border-l-accent bg-[rgba(219,195,179,0.08)]"
            : "border-l-transparent"
        )}
      >
        <span className="text-[14px] font-medium leading-5 text-foreground">
          {event.title}
        </span>
        <span className="mt-1 text-[12px] font-normal leading-4 text-muted-foreground">
          {event.date}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <CompactReceipt receipt={event.receipt} tone={event.tone} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/* ============================================================================
 * Empty state
 * ==========================================================================*/

function TimelineEmptyState({ message }: { message: string }) {
  return (
    <Card className="flex flex-col items-center gap-4 px-8 py-16 text-center">
      <IconClock className="h-9 w-9 text-muted-foreground" />
      <p className="text-[14px] font-medium leading-5 text-foreground">{message}</p>
    </Card>
  );
}

/* ============================================================================
 * Timeline — the generic, reusable component
 * ==========================================================================*/

export function Timeline({
  events,
  emptyMessage = "No events recorded yet for this project.",
}: TimelineProps): ReactNode {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  if (events.length === 0) {
    return <TimelineEmptyState message={emptyMessage} />;
  }

  return (
    <div className="relative">
      {/* One continuous line behind every row — because it's a single
          element rather than per-row segments, it never has to account for
          how tall an expanded accordion gets; it just keeps running behind
          whatever content sits between the first and last dot. */}
      <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-px bg-muted" />

      <ul className="relative flex flex-col gap-10">
        {events.map((event) => (
          <TimelineRow
            key={event.id}
            event={event}
            isExpanded={expandedId === event.id}
            onToggle={handleToggle}
          />
        ))}
      </ul>
    </div>
  );
}

/* ============================================================================
 * Demo — realistic construction procurement sample data
 * ==========================================================================*/

const SAMPLE_EVENTS: TimelineEvent[] = [
  {
    id: "evt-1",
    title: "Quote received from Meridian Steelworks",
    date: "Mar 3, 2026",
    tone: "info",
    receipt: {
      evidence: ["Quote #Q-4471", "Switchgear package, Tower B"],
      confidencePct: 96,
      reasoning: "Quote parsed cleanly against the approved scope of work.",
      href: "#",
    },
  },
  {
    id: "evt-2",
    title: "Trustline flagged pricing 18% above market",
    date: "Mar 4, 2026",
    tone: "warning",
    receipt: {
      evidence: ["RSMeans regional index, Q2", "Riverside Yards final invoice"],
      confidencePct: 94,
      reasoning: "Switchgear line item sits well above comparable recent bids.",
      href: "#",
    },
  },
  {
    id: "evt-3",
    title: "Missing insurance clause detected",
    date: "Mar 4, 2026",
    tone: "danger",
    receipt: {
      evidence: ["Master services agreement, §7.2", "Vendor COI archive"],
      confidencePct: 88,
      reasoning: "Certificate of insurance excluded from the submitted quote package.",
      href: "#",
    },
  },
  {
    id: "evt-4",
    title: "Atlas flagged a regional lumber shortage",
    date: "Mar 6, 2026",
    tone: "ai",
    receipt: {
      evidence: ["Regional supplier index", "3 correlated news sources"],
      confidencePct: 76,
      reasoning: "Supply signal may affect framing procurement later this phase.",
      href: "#",
    },
  },
  {
    id: "evt-5",
    title: "Vendor certification verified",
    date: "Mar 9, 2026",
    tone: "success",
    receipt: {
      evidence: ["AISC registry", "Certification #AC-88213"],
      confidencePct: 99,
      reasoning: "Certification confirmed current and matched to this vendor.",
      href: "#",
    },
  },
  {
    id: "evt-6",
    title: "Change order CO-0192 approved",
    date: "Mar 12, 2026",
    tone: "success",
    receipt: {
      evidence: ["Change order log", "Compass impact analysis"],
      confidencePct: 91,
      reasoning: "Downstream schedule impact confirmed within acceptable range.",
      href: "#",
    },
  },
];

export default function TimelineDemo() {
  const [showEmpty, setShowEmpty] = useState(false);

  return (
    <div className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-[24px] font-bold leading-8 text-foreground">
              Project timeline
            </h1>
            <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
              Riverside Yards — Phase 2
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowEmpty((v) => !v)}>
            {showEmpty ? "Show sample events" : "Show empty state"}
          </Button>
        </div>

        <Timeline events={showEmpty ? [] : SAMPLE_EVENTS} />
      </div>
    </div>
  );
}
