"use client";

/**
 * Timeline View — single-file, generic and reusable.
 */

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useSpring } from "framer-motion";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimelineEvent, TimelineEventReceipt, TimelineEventTone } from "@/types";

export interface TimelineProps {
  events: TimelineEvent[];
  emptyMessage?: string;
}

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

const TONE_DOT_COLOR: Record<TimelineEventTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  ai: "bg-ai",
};

function useAnimatedPercent(value: number): number {
  const spring = useSpring(0, { stiffness: 100, damping: 22, mass: 0.5 });
  const [display, setDisplay] = useState(0);

  useMotionValueEvent(spring, "change", (latest) => setDisplay(Math.round(latest)));

  useState(() => {
    spring.set(value);
  });

  return display;
}

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

function TimelineEmptyState({ message }: { message: string }) {
  return (
    <Card className="flex flex-col items-center gap-4 px-8 py-16 text-center">
      <IconClock className="h-9 w-9 text-muted-foreground" />
      <p className="text-[14px] font-medium leading-5 text-foreground">{message}</p>
    </Card>
  );
}

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
