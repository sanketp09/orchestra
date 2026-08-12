"use client";

/**
 * ORCHESTRA — Homepage / Decision Center
 *
 * Single self-contained screen. All screen-specific layout, sub-components,
 * and mock data live inline below. Shared primitives (Button, Card, Badge,
 * Input, cn) are assumed to already exist in the design system.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronRight,
  FileText,
  LayoutGrid,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScreenState = "loading" | "populated" | "empty" | "error";
type Severity = "danger" | "warning" | "info";

interface Decision {
  id: string;
  severity: Severity;
  title: string;
  context: string;
  actionLabel: string;
  trustScore?: number;
}

interface ActivityItem {
  id: string;
  text: string;
  actor: string;
  timestamp: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutGrid;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  { id: "decisions", label: "Decision Center", icon: LayoutGrid },
  { id: "suppliers", label: "Suppliers", icon: Building2 },
  { id: "contracts", label: "Contracts", icon: FileText },
  { id: "evidence", label: "Evidence", icon: ShieldCheck },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

const DECISIONS: Decision[] = [
  {
    id: "d1",
    severity: "danger",
    title: "Supplier trust score dropped sharply — Steel Rebar Co.",
    context: "Down 18 points in 72 hours, driven by two missed inspection reports.",
    actionLabel: "Review evidence",
    trustScore: 42,
  },
  {
    id: "d2",
    severity: "warning",
    title: "Anchor bolt reorder needs approval",
    context: "Procurement flagged a shortfall against Thursday's delivery window.",
    actionLabel: "Approve request",
  },
  {
    id: "d3",
    severity: "warning",
    title: "MEP contract renewal window closing",
    context: "Ferrovial MEP contract expires in 9 days — no response logged yet.",
    actionLabel: "Review contract",
  },
  {
    id: "d4",
    severity: "info",
    title: "Faster supplier available for precast panels",
    context: "Alternate vendor quote could cut lead time by 6 days at similar cost.",
    actionLabel: "View recommendation",
  },
];

const ACTIVITY: ActivityItem[] = [
  { id: "a1", text: "Trust score recalculated for Steel Rebar Co.", actor: "ORCHESTRA", timestamp: "12m ago" },
  { id: "a2", text: "Purchase request #4471 submitted", actor: "Priya N.", timestamp: "1h ago" },
  { id: "a3", text: "New inspection report ingested for Site 4", actor: "ORCHESTRA", timestamp: "3h ago" },
  { id: "a4", text: "Contract addendum uploaded — Ferrovial MEP", actor: "Marcus T.", timestamp: "Yesterday" },
  { id: "a5", text: "Supplier reliability review completed", actor: "ORCHESTRA", timestamp: "Yesterday" },
];

const LOADING_MESSAGES = [
  "Pulling latest trust scores…",
  "Checking supplier feeds…",
  "Loading your decisions…",
];

const SEVERITY_COLOR: Record<Severity, string> = {
  danger: "#A6432F",
  warning: "#B8873A",
  info: "#4A6A8A",
};

// ---------------------------------------------------------------------------
// Small utility hook — animated count-up, never an instant re-render of a raw number
// ---------------------------------------------------------------------------

function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(0);
  const startValueRef = useRef(0);

  useEffect(() => {
    const startValue = startValueRef.current;
    const startTime = performance.now();
    let frame: number;

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        startValueRef.current = target;
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

// ---------------------------------------------------------------------------
// Local sub-components
// ---------------------------------------------------------------------------

function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#DBC3B3] bg-[#F3EDE7] px-6">
      <div className="flex items-center gap-4">
        <span className="text-[16px] font-bold tracking-tight text-[#0C0904]">ORCHESTRA</span>
        <Badge className="rounded-[4px] border border-[#DBC3B3] bg-[#DBC3B3]/30 px-2 py-0.5 text-[12px] font-medium text-[#0C0904]">
          Meridian Construction Group
        </Badge>
      </div>

      <div className="hidden max-w-[360px] flex-1 items-center md:mx-8 md:flex">
        <div className="relative w-full">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#AA8D74]" />
          <Input
            readOnly
            placeholder="Search evidence, suppliers, projects…"
            className="h-9 rounded-[6px] border-[#DBC3B3] bg-[#F3EDE7] pl-9 text-[14px] text-[#0C0904] placeholder:text-[#AA8D74]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-[6px] text-[#AA8D74] hover:bg-[#DBC3B3]/[0.08] md:hidden"
        >
          <Search size={16} />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#AC723E] text-[12px] font-medium text-[#F3EDE7]">
          MT
        </div>
      </div>
    </header>
  );
}

function Sidebar({ activeId }: { activeId: string }) {
  return (
    <nav className="hidden w-16 shrink-0 flex-col border-r border-[#DBC3B3] bg-[#F3EDE7] py-4 sm:flex md:w-[220px]">
      <ul className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <motion.button
                type="button"
                whileHover={{ x: isActive ? 0 : 2 }}
                transition={{ duration: 0.12 }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[6px] border-l-2 px-3 py-2 text-left text-[14px] transition-colors duration-[120ms]",
                  isActive
                    ? "border-l-[#AC723E] bg-[#DBC3B3]/[0.10] font-medium text-[#0C0904]"
                    : "border-l-transparent font-normal text-[#AA8D74] hover:bg-[#DBC3B3]/[0.08] hover:text-[#0C0904]"
                )}
              >
                <Icon size={16} strokeWidth={2} className="shrink-0" />
                <span className="hidden md:inline">{item.label}</span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function GreetingHeader({ decisionCount }: { decisionCount: number }) {
  const animatedCount = useCountUp(decisionCount);
  return (
    <div className="mb-8">
      <h1 className="text-[24px] font-medium leading-tight text-[#0C0904]">Good morning, Marcus</h1>
      <p className="mt-1 text-[14px] font-normal text-[#AA8D74]">
        {animatedCount} {animatedCount === 1 ? "decision needs" : "decisions need"} your attention today.
      </p>
    </div>
  );
}

function DecisionCard({ decision, index }: { decision: Decision; index: number }) {
  const animatedScore = useCountUp(decision.trustScore ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -2 }}
    >
      <Card
        className={cn(
          "group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-[8px] border border-[#DBC3B3] bg-[#F3EDE7] py-4 pl-5 pr-4 transition-colors duration-150 hover:bg-[#DBC3B3]/[0.06]"
        )}
      >
        <span
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: SEVERITY_COLOR[decision.severity] }}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[14px] font-medium leading-snug text-[#0C0904]">{decision.title}</h3>
            {decision.trustScore !== undefined && (
              <Badge className="shrink-0 rounded-[4px] border border-[#DBC3B3] bg-transparent px-1.5 py-0 text-[12px] font-normal text-[#AA8D74]">
                Trust {animatedScore}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-[12px] font-normal leading-snug text-[#AA8D74]">{decision.context}</p>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-[6px] border-[#DBC3B3] text-[14px] font-medium text-[#0C0904] hover:bg-[#AC723E] hover:text-[#F3EDE7]"
        >
          {decision.actionLabel}
          <ChevronRight size={14} className="ml-1" />
        </Button>
      </Card>
    </motion.div>
  );
}

function ActivityRow({ item, index }: { item: ActivityItem; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.05, duration: 0.25, ease: "easeOut" }}
      className="flex items-center justify-between border-b border-[#DBC3B3] py-3 last:border-b-0"
    >
      <p className="text-[13px] font-normal text-[#AA8D74]">
        <span className="text-[#0C0904]">{item.actor}</span> — {item.text}
      </p>
      <span className="shrink-0 pl-4 text-[12px] font-normal text-[#AA8D74]">{item.timestamp}</span>
    </motion.li>
  );
}

function LoadingSkeleton() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RotateCw size={14} className="text-[#AA8D74]" />
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-[13px] font-normal text-[#AA8D74]"
          >
            {LOADING_MESSAGES[messageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="relative h-[76px] overflow-hidden rounded-[8px] border border-[#DBC3B3] bg-[#F3EDE7]"
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(219,195,179,0.35), transparent)",
                backgroundSize: "200% 100%",
              }}
              animate={{ backgroundPositionX: ["0%", "200%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear", delay: i * 0.15 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[8px] border border-[#DBC3B3] px-6 py-16 text-center">
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#AA8D74"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2l7 3.5v5.2c0 4.6-3 8.9-7 10.3-4-1.4-7-5.7-7-10.3V5.5L12 2z" />
        <path d="M9 12.5l2 2 4-4.5" />
      </svg>
      <div>
        <p className="text-[14px] font-medium text-[#0C0904]">All clear</p>
        <p className="mt-1 text-[12px] font-normal text-[#AA8D74]">
          No decisions need your attention right now.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[8px] border border-[#DBC3B3] px-6 py-16 text-center">
      <AlertTriangle size={32} strokeWidth={1.5} className="text-[#AA8D74]" />
      <div>
        <p className="text-[14px] font-medium text-[#0C0904]">Couldn&rsquo;t load your decisions</p>
        <p className="mt-1 text-[12px] font-normal text-[#AA8D74]">
          Check your connection and try again.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        className="mt-1 rounded-[6px] border-[#DBC3B3] text-[14px] font-medium text-[#0C0904] hover:bg-[#AC723E] hover:text-[#F3EDE7]"
      >
        Retry
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DecisionCenterScreen() {
  const [state, setState] = useState<ScreenState>("loading");

  useEffect(() => {
    if (state !== "loading") return;
    const timeout = setTimeout(() => setState("populated"), 1500);
    return () => clearTimeout(timeout);
  }, [state]);

  const handleRetry = () => {
    setState("loading");
  };

  return (
    <div className="flex h-screen w-full flex-col bg-[#F3EDE7]">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeId="decisions" />

        <main className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-[840px]">
            <GreetingHeader decisionCount={state === "populated" ? DECISIONS.length : 0} />

            <AnimatePresence mode="wait">
              {state === "loading" && (
                <motion.div key="loading" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <LoadingSkeleton />
                </motion.div>
              )}

              {state === "empty" && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <EmptyState />
                </motion.div>
              )}

              {state === "error" && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ErrorState onRetry={handleRetry} />
                </motion.div>
              )}

              {state === "populated" && (
                <motion.div key="populated" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex flex-col gap-3">
                    {DECISIONS.map((decision, index) => (
                      <DecisionCard key={decision.id} decision={decision} index={index} />
                    ))}
                  </div>

                  <div className="mt-10">
                    <h2 className="mb-1 text-[14px] font-medium text-[#0C0904]">Recent activity</h2>
                    <ul className="mt-3">
                      {ACTIVITY.map((item, index) => (
                        <ActivityRow key={item.id} item={item} index={index} />
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* DEV-ONLY preview control — not part of the product surface, remove before ship */}
      <div className="fixed bottom-4 right-4 flex items-center gap-1 rounded-[6px] border border-dashed border-[#AA8D74] bg-[#F3EDE7] p-1 shadow-md">
        {(["loading", "populated", "empty", "error"] as ScreenState[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setState(s)}
            className={cn(
              "rounded-[4px] px-2 py-1 text-[11px] font-medium capitalize transition-colors duration-[120ms]",
              state === s ? "bg-[#AC723E] text-[#F3EDE7]" : "text-[#AA8D74] hover:bg-[#DBC3B3]/[0.08]"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
