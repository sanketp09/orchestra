'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
} from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/* ============================================================================
   ORCHESTRA — Trustline / Vendor Profile
   Single-file screen: header, animated trust badge with demo trigger,
   trust trajectory chart, expandable recent-changes list, toggleable
   empty state.
============================================================================ */

/* ----------------------------------------------------------------------------
   Mock data
---------------------------------------------------------------------------- */

const VENDOR = {
  name: 'Meridian Steel & Fabrication',
  trade: 'Structural steel subcontractor · Tier 1',
};

const INITIAL_TRUST_SCORE = 82;

const INITIAL_TRAJECTORY = [
  { week: 'W1', score: 71 },
  { week: 'W2', score: 73 },
  { week: 'W3', score: 72 },
  { week: 'W4', score: 76 },
  { week: 'W5', score: 75 },
  { week: 'W6', score: 78 },
  { week: 'W7', score: 74 },
  { week: 'W8', score: 79 },
  { week: 'W9', score: 80 },
  { week: 'W10', score: 79 },
  { week: 'W11', score: 81 },
  { week: 'W12', score: 82 },
];

const SEMANTIC_HEX: Record<string, string> = {
  success: '#C6FF33',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#38BDF8',
  ai: '#7D39EB',
};

type ChangeColor = keyof typeof SEMANTIC_HEX;

interface RecentChange {
  id: string;
  color: ChangeColor;
  label: string;
  date: string;
  evidence: string;
  confidence: number;
  reasoning: string;
}

const RECENT_CHANGES: RecentChange[] = [
  {
    id: 'c1',
    color: 'success',
    label: 'Insurance certificate renewed',
    date: 'Jul 24',
    evidence: 'COI on file, effective through Jul 2027',
    confidence: 96,
    reasoning: 'Broker submission verified against carrier database.',
  },
  {
    id: 'c2',
    color: 'info',
    label: 'New project awarded — Riverside Tower',
    date: 'Jul 18',
    evidence: 'Executed subcontract, $2.4M, Phase 2 steel package',
    confidence: 91,
    reasoning: 'Contract terms match historical scope and pricing profile.',
  },
  {
    id: 'c3',
    color: 'warning',
    label: 'Bid variance flagged on Phase 2 quote',
    date: 'Jul 09',
    evidence: 'Quote 14% above trailing average for comparable scope',
    confidence: 74,
    reasoning: 'Awaiting clarification from estimating team before close.',
  },
  {
    id: 'c4',
    color: 'ai',
    label: 'Ownership structure re-mapped',
    date: 'Jun 29',
    evidence: 'New minority joint-venture partner identified in filings',
    confidence: 88,
    reasoning: 'Cross-referenced state entity filings and JV agreement.',
  },
  {
    id: 'c5',
    color: 'danger',
    label: 'Change order pattern detected',
    date: 'Jun 12',
    evidence: 'Third change order this quarter on comparable scope',
    confidence: 81,
    reasoning: 'Matches precedent pattern seen on two prior projects.',
  },
];

/* ----------------------------------------------------------------------------
   Animated number hook — used for the trust badge
---------------------------------------------------------------------------- */

function useAnimatedNumber(target: number) {
  const motionVal = useMotionValue(target);
  const spring = useSpring(motionVal, { duration: 0.6, bounce: 0.15 });
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    motionVal.set(target);
  }, [target, motionVal]);

  useMotionValueEvent(spring, 'change', (v) => setDisplay(Math.round(v)));

  return display;
}

/* ----------------------------------------------------------------------------
   Empty state
---------------------------------------------------------------------------- */

function EmptyStateIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      stroke="var(--muted-foreground)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 4l12 6v8c0 8-5.2 13.6-12 15-6.8-1.4-12-7-12-15v-8z" />
      <path d="M13.5 18l3 3 6-6.5" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[8px] border border-[var(--muted)] px-8 py-20 text-center">
      <EmptyStateIcon />
      <p className="mt-4 max-w-xs text-[13px] font-normal leading-relaxed text-[var(--muted-foreground)]">
        No trust history yet — evidence will build as you work together.
      </p>
      <Button className="mt-6 rounded-[6px] bg-[var(--accent)] px-5 py-2.5 text-[14px] font-medium text-white transition-transform duration-150 hover:brightness-105 active:scale-[0.98]">
        Send prequalification request
      </Button>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Trust badge with demo trigger + transient tooltip
---------------------------------------------------------------------------- */

function TrustBadge() {
  const [score, setScore] = useState(INITIAL_TRUST_SCORE);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const displayScore = useAnimatedNumber(score);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const simulateNewEvidence = () => {
    const delta = 2 + Math.floor(Math.random() * 6);
    setScore((prev) => Math.min(100, prev + delta));

    setTooltipVisible(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => setTooltipVisible(false), 3600);
  };

  useEffect(() => {
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-end gap-4">
        <div className="text-[40px] font-medium tabular-nums text-[var(--foreground)]">
          {displayScore}
        </div>
        <div className="pb-1.5">
          <div className="text-[14px] font-medium text-[var(--foreground)]">Trust score</div>
          <div className="text-[12px] font-normal text-[var(--muted-foreground)]">
            Out of 100
          </div>
        </div>
        <Button
          onClick={simulateNewEvidence}
          className="ml-4 mb-1 rounded-[6px] border border-[var(--muted)] bg-transparent px-4 py-2 text-[12px] font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--muted)_8%,transparent)]"
        >
          Simulate new evidence
        </Button>
      </div>

      <div className="mt-1 h-4">
        <AnimatePresence>
          {tooltipVisible && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-[12px] font-normal text-[var(--muted-foreground)]"
            >
              Updated just now — Factory photo uploaded
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Trust trajectory chart
---------------------------------------------------------------------------- */

function TrustTrajectoryChart() {
  return (
    <Card className="rounded-[8px] border border-[var(--muted)] bg-transparent p-6">
      <div className="mb-4">
        <h3 className="text-[14px] font-medium text-[var(--foreground)]">Trust trajectory</h3>
        <p className="mt-1 text-[12px] font-normal text-[var(--muted-foreground)]">
          Last 12 weeks
        </p>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={INITIAL_TRAJECTORY} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <XAxis
              dataKey="week"
              tick={{ fontSize: 12, fontWeight: 400, fill: 'var(--muted-foreground)' }}
              axisLine={{ stroke: 'var(--muted)' }}
              tickLine={false}
            />
            <YAxis
              domain={[60, 100]}
              tick={{ fontSize: 12, fontWeight: 400, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <RechartsTooltip
              contentStyle={{
                background: '#12151A',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                fontSize: 12,
                color: '#FFFFFF',
              }}
              labelStyle={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 2.5, fill: 'var(--accent)', strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
   Recent changes — expandable rows
---------------------------------------------------------------------------- */

function ChangeRow({ change }: { change: RecentChange }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-[6px] border-l-2 transition-colors duration-150',
        expanded ? 'border-l-[var(--accent)]' : 'border-l-transparent'
      )}
      style={{
        backgroundColor: expanded ? 'color-mix(in srgb, var(--muted) 8%, transparent)' : 'transparent',
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--muted)_8%,transparent)]"
      >
        <div className="flex items-center gap-3">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: SEMANTIC_HEX[change.color] }}
          />
          <span className="text-[14px] font-medium leading-tight text-[var(--foreground)]">
            {change.label}
          </span>
        </div>
        <span className="shrink-0 text-[12px] font-normal text-[var(--muted-foreground)]">
          {change.date}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-4 pb-4 pl-9">
              <div className="rounded-[6px] border border-white/5 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[var(--foreground)]">
                    Evidence
                  </span>
                  <Badge
                    className="rounded-[4px] border border-[var(--muted)] bg-transparent px-2 py-0.5 text-[12px] font-normal text-[var(--muted-foreground)]"
                  >
                    {change.confidence}% confidence
                  </Badge>
                </div>
                <p className="mt-1.5 text-[12px] font-normal leading-relaxed text-[var(--muted-foreground)]">
                  {change.evidence}
                </p>
                <p className="mt-2 text-[12px] font-normal leading-relaxed text-[var(--foreground)]">
                  {change.reasoning}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecentChanges() {
  return (
    <Card className="rounded-[8px] border border-[var(--muted)] bg-transparent p-2">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-[14px] font-medium text-[var(--foreground)]">Recent changes</h3>
        <p className="mt-1 text-[12px] font-normal text-[var(--muted-foreground)]">
          Click a row for the underlying evidence
        </p>
      </div>
      <div className="space-y-1 pb-2">
        {RECENT_CHANGES.map((change, i) => (
          <motion.div
            key={change.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: 'easeOut' }}
          >
            <ChangeRow change={change} />
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
   Header
---------------------------------------------------------------------------- */

function VendorHeader({
  showEmpty,
  onToggleEmpty,
}: {
  showEmpty: boolean;
  onToggleEmpty: () => void;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-[24px] font-bold leading-tight text-[var(--foreground)]">
          {VENDOR.name}
        </h1>
        <p className="mt-1 text-[12px] font-normal text-[var(--muted-foreground)]">
          {VENDOR.trade}
        </p>
      </div>
      <button
        onClick={onToggleEmpty}
        className="rounded-[6px] border border-[var(--muted)] bg-transparent px-3 py-1.5 text-[12px] font-normal text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--muted)_8%,transparent)]"
      >
        Demo: {showEmpty ? 'show trust history' : 'show empty state'}
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Page
---------------------------------------------------------------------------- */

export default function Page() {
  const [showEmpty, setShowEmpty] = useState(false);

  return (
    <main className="w-full px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <VendorHeader showEmpty={showEmpty} onToggleEmpty={() => setShowEmpty((v) => !v)} />

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {showEmpty ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <EmptyState />
              </motion.div>
            ) : (
              <motion.div
                key="filled"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <TrustBadge />
                <TrustTrajectoryChart />
                <RecentChanges />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
