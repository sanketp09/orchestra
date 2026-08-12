import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types & mock data
// ---------------------------------------------------------------------------

type DocStatus = 'empty' | 'uploading' | 'complete' | 'error' | 'flagged';

interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  status: DocStatus;
  progress: number; // 0-100, only meaningful while uploading
  errorMessage?: string;
  fileName?: string;
}

const INITIAL_ITEMS: ChecklistItem[] = [
  {
    id: 'coi',
    label: 'Certificate of Insurance',
    hint: 'General liability, min. $2M aggregate',
    status: 'complete',
    progress: 100,
    fileName: 'coi_2026_liberty-mutual.pdf',
  },
  {
    id: 'w9',
    label: 'W-9 Tax Form',
    hint: 'Signed within the last 12 months',
    status: 'uploading',
    progress: 42,
    fileName: 'w9_signed.pdf',
  },
  {
    id: 'msa',
    label: 'Signed Master Services Agreement',
    hint: 'Countersigned copy, all pages',
    status: 'error',
    progress: 0,
    errorMessage: "That file didn't match what we expected — try re-uploading.",
  },
  {
    id: 'bank',
    label: 'Bank Details Verification',
    hint: 'Voided check or bank letter',
    status: 'flagged',
    progress: 100,
    fileName: 'void_check.jpg',
    errorMessage: 'Routing number could not be verified — our team is reviewing this.',
  },
  {
    id: 'safety',
    label: 'Safety Compliance Certification',
    hint: 'OSHA 30 or equivalent, per site',
    status: 'empty',
    progress: 0,
  },
];

// ---------------------------------------------------------------------------
// Small utility hook: animates a number toward a target over `duration` ms
// ---------------------------------------------------------------------------

function useAnimatedNumber(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;

    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + delta * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

// ---------------------------------------------------------------------------
// Icons — plain inline outline SVGs, no icon library dependency
// ---------------------------------------------------------------------------

function EmptyCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="var(--muted-foreground)" strokeWidth="1.5" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="var(--success)" strokeWidth="1.5" fill="none" />
      <motion.path
        d="M6.2 10.2L8.7 12.6L13.6 7.6"
        stroke="var(--success)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </svg>
  );
}

function WarningTriangleIcon({ color = 'var(--danger)' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 3.2L17.3 15.8H2.7L10 3.2Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line x1="10" y1="8.2" x2="10" y2="11.4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10" cy="13.2" r="0.9" fill={color} />
    </svg>
  );
}

function UploadingRingIcon({ progress }: { progress: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r={r} stroke="var(--muted)" strokeWidth="1.5" />
      <motion.circle
        cx="10"
        cy="10"
        r={r}
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={c}
        transform="rotate(-90 10 10)"
        initial={false}
        animate={{ strokeDashoffset: c - (c * progress) / 100 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </svg>
  );
}

function EmptyStateIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="8" y="5" width="20" height="26" rx="2" stroke="var(--muted-foreground)" strokeWidth="1.5" />
      <line x1="13" y1="13" x2="23" y2="13" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="18" x2="23" y2="18" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="23" x2="19" y2="23" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Checklist row
// ---------------------------------------------------------------------------

function ChecklistRow({
  item,
  index,
  onUpload,
}: {
  item: ChecklistItem;
  index: number;
  onUpload: (id: string) => void;
}) {
  const isActive = item.status === 'uploading';
  const hasIssue = item.status === 'error' || item.status === 'flagged';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3, ease: 'easeOut' }}
    >
      <div
        className={cn(
          'relative rounded-lg border-l-2 px-4 py-3 transition-colors duration-[120ms]',
          isActive ? 'border-l-[var(--accent)]' : 'border-l-transparent',
          'hover:bg-[color-mix(in_srgb,var(--muted-foreground)_8%,var(--card,#FBF8F4))]'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
            <AnimatePresence mode="wait" initial={false}>
              {item.status === 'empty' && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <EmptyCircleIcon />
                </motion.div>
              )}
              {item.status === 'uploading' && (
                <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <UploadingRingIcon progress={item.progress} />
                </motion.div>
              )}
              {item.status === 'complete' && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CheckCircleIcon />
                </motion.div>
              )}
              {item.status === 'error' && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <WarningTriangleIcon color="var(--danger)" />
                </motion.div>
              )}
              {item.status === 'flagged' && (
                <motion.div key="flagged" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <WarningTriangleIcon color="var(--warning)" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-[14px] font-medium leading-[20px] text-[var(--foreground)]">
                {item.label}
              </p>
              {item.status === 'complete' && (
                <Badge className="flex-shrink-0 border-none bg-transparent px-0 text-[11px] font-normal text-[var(--success)]">
                  Verified
                </Badge>
              )}
              {item.status === 'flagged' && (
                <Badge className="flex-shrink-0 border-none bg-transparent px-0 text-[11px] font-normal text-[var(--warning)]">
                  In review
                </Badge>
              )}
            </div>
            <p className="mt-[2px] text-[12px] font-normal leading-[16px] text-[var(--muted-foreground)]">
              {item.hint}
            </p>

            {item.status === 'uploading' && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--accent)]"
                    animate={{ width: `${item.progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums">
                  {Math.round(item.progress)}%
                </span>
              </div>
            )}

            {hasIssue && item.errorMessage && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'mt-1 text-[12px] leading-[16px]',
                  item.status === 'error' ? 'text-[var(--danger)]' : 'text-[var(--warning)]'
                )}
              >
                {item.errorMessage}
              </motion.p>
            )}
          </div>

          <div className="flex-shrink-0">
            {item.status === 'empty' && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-[6px] border-[var(--muted)] text-[12px]"
                onClick={() => onUpload(item.id)}
              >
                Upload
              </Button>
            )}
            {item.status === 'error' && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-[6px] border-[var(--danger)] text-[12px] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]"
                onClick={() => onUpload(item.id)}
              >
                Re-upload
              </Button>
            )}
            {item.status === 'complete' && (
              <button
                className="text-[12px] font-medium text-[var(--accent)] transition-opacity hover:opacity-70"
                onClick={() => onUpload(item.id)}
              >
                View
              </button>
            )}
            {item.status === 'flagged' && (
              <button
                className="text-[12px] font-medium text-[var(--accent)] transition-opacity hover:opacity-70"
                onClick={() => onUpload(item.id)}
              >
                View
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SupplierWorkspace() {
  const [items, setItems] = useState<ChecklistItem[]>(INITIAL_ITEMS);
  const timersRef = useRef<Record<string, number>>({});

  const completedCount = items.filter((i) => i.status === 'complete' || i.status === 'flagged').length;
  const pctTarget = Math.round((completedCount / items.length) * 100);
  const animatedPct = useAnimatedNumber(pctTarget, 700);

  // Auto-advance the demo "uploading" row so the completion animation is
  // visible without requiring interaction.
  useEffect(() => {
    const id = 'w9';
    const interval = window.setInterval(() => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id || it.status !== 'uploading') return it;
          const next = Math.min(it.progress + 9, 100);
          if (next >= 100) {
            window.clearInterval(interval);
            window.setTimeout(() => {
              setItems((p) =>
                p.map((x) => (x.id === id ? { ...x, status: 'complete', progress: 100 } : x))
              );
            }, 250);
          }
          return { ...it, progress: next };
        })
      );
    }, 220);
    return () => window.clearInterval(interval);
  }, []);

  const startUpload = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, status: 'uploading', progress: 0, errorMessage: undefined }
          : it
      )
    );

    if (timersRef.current[id]) window.clearInterval(timersRef.current[id]);
    const interval = window.setInterval(() => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id || it.status !== 'uploading') return it;
          const next = Math.min(it.progress + 14, 100);
          if (next >= 100) {
            window.clearInterval(interval);
            window.setTimeout(() => {
              setItems((p) =>
                p.map((x) => (x.id === id ? { ...x, status: 'complete', progress: 100 } : x))
              );
            }, 250);
          }
          return { ...it, progress: next };
        })
      );
    }, 180);
    timersRef.current[id] = interval;
  }, []);

  const total = items.length;
  const remaining = total - completedCount;
  const hasEmptyState = items.length === 0;

  return (
    <div
      className="min-h-screen w-full"
      style={{
        // Local token fallbacks so this screen renders correctly even if the
        // host app hasn't already registered these CSS variables globally.
        ['--background' as any]: '#F3EDE7',
        ['--foreground' as any]: '#0C0904',
        ['--muted' as any]: '#DBC3B3',
        ['--muted-foreground' as any]: '#AA8D74',
        ['--accent' as any]: '#AC723E',
        ['--success' as any]: '#4A7A5C',
        ['--warning' as any]: '#B8873A',
        ['--danger' as any]: '#A6432F',
        ['--info' as any]: '#4A6A8A',
        ['--ai' as any]: '#6B5A7A',
        ['--card' as any]: '#FBF8F4',
        backgroundColor: 'var(--background)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Minimal top bar */}
      <header className="flex h-14 w-full items-center justify-between border-b border-[var(--muted)] px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-[var(--foreground)]">
            <span className="text-[10px] font-medium text-[var(--background)]">O</span>
          </div>
          <span className="text-[13px] font-medium text-[var(--foreground)]">Orchestra</span>
          <span className="text-[13px] text-[var(--muted-foreground)]">/ Supplier Workspace</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[var(--muted-foreground)]">Meridian Steel &amp; Fabrication</span>
          <div className="h-7 w-7 rounded-full bg-[var(--muted)]" />
        </div>
      </header>

      {/* Centered narrow column */}
      <main className="mx-auto w-full max-w-[560px] px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <h1 className="text-[20px] font-medium leading-[28px] text-[var(--foreground)]">
            Onboarding checklist
          </h1>
          <p className="mt-1 text-[12px] font-normal leading-[16px] text-[var(--muted-foreground)]">
            Complete every item below to be approved for the Riverfront Logistics Hub bid package.
            Due Aug 12, 2026.
          </p>
        </motion.div>

        {/* Progress */}
        <Card className="mt-6 rounded-[8px] border border-[var(--muted)] bg-[var(--card)] p-4 shadow-none">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-normal text-[var(--muted-foreground)]">
              {remaining > 0 ? `${remaining} item${remaining === 1 ? '' : 's'} remaining` : 'All items complete'}
            </span>
            <span className="text-[14px] font-medium tabular-nums text-[var(--foreground)]">
              {Math.round(animatedPct)}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
            <motion.div
              className="h-full rounded-full bg-[var(--accent)]"
              animate={{ width: `${pctTarget}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </Card>

        {/* Checklist */}
        <div className="mt-6">
          {hasEmptyState ? (
            <Card className="flex flex-col items-center justify-center rounded-[8px] border border-[var(--muted)] bg-[var(--card)] px-6 py-16 text-center shadow-none">
              <EmptyStateIcon />
              <p className="mt-3 text-[13px] text-[var(--muted-foreground)]">
                No requirements assigned to this bid package yet.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-[var(--muted)] overflow-hidden rounded-[8px] border border-[var(--muted)] bg-[var(--card)] p-1 shadow-none">
              {items.map((item, i) => (
                <ChecklistRow key={item.id} item={item} index={i} onUpload={startUpload} />
              ))}
            </Card>
          )}
        </div>

        {/* Footer helper row */}
        <div className="mt-6 flex items-center justify-between rounded-[8px] border border-[var(--muted)] bg-[var(--card)] px-4 py-3">
          <p className="text-[12px] text-[var(--muted-foreground)]">
            Questions about a requirement? Reach your procurement contact directly.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-shrink-0 rounded-[6px] border-[var(--muted)] text-[12px]"
          >
            Contact buyer
          </Button>
        </div>
      </main>
    </div>
  );
}
