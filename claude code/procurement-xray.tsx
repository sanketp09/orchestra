"use client";

/**
 * Procurement X-Ray — single-file build.
 *
 * Four states (upload -> scanning -> results, error as a sibling of
 * scanning) driven by one `XRayStatus` enum, cross-faded with
 * AnimatePresence. Everything screen-specific — sub-components, mock
 * data, the animated counter hook — lives inline below. Only the shared
 * design-system primitives are imported from outside this file.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
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

// Card already carries the canonical surface styling (background fill, 1px
// muted border, 8px radius, no shadow) — wrap it with `motion()` wherever a
// card-like surface also needs enter/hover animation, instead of
// re-implementing that styling on a plain motion.div.
const MotionCard = motion(Card);

/* ============================================================================
 * Types
 * ==========================================================================*/

type XRayStatus = "upload" | "scanning" | "results" | "error";

interface FileMeta {
  name: string;
  sizeLabel: string;
}

type FlagSeverity = "danger" | "warning" | "info";

interface Flag {
  id: string;
  severity: FlagSeverity;
  title: string;
  context: string;
}

interface ComparisonRow {
  label: string;
  value: string;
}

interface EvidenceSource {
  label: string;
  href: string;
}

interface FlagReceipt {
  comparisonRows: ComparisonRow[];
  confidencePct: number;
  recommendation: string;
  estimatedImpact: string;
  evidenceSources: EvidenceSource[];
}

/* ============================================================================
 * Mock data — realistic construction procurement scenario
 * ==========================================================================*/

const CHECKLIST_ITEMS: { id: string; label: string }[] = [
  { id: "parse", label: "Parsing document structure" },
  { id: "scope", label: "Checking scope vs. drawings" },
  { id: "clauses", label: "Checking clause history with this vendor" },
  { id: "pricing", label: "Checking pricing pattern across bidders" },
  { id: "compile", label: "Compiling flags and evidence" },
];

// Uneven on purpose — a metronome-even reveal reads as fake.
const CHECKLIST_DELAYS_MS = [650, 780, 720, 800, 660];

const RISK_SCORE = { value: 78, direction: "up" as const, deltaLabel: "+12 vs. last quote" };

const FLAGS: Flag[] = [
  {
    id: "flag-insurance",
    severity: "danger",
    title: "Missing insurance clause",
    context: "Certificate of insurance excluded from Meridian Steelworks' quote package.",
  },
  {
    id: "flag-price",
    severity: "warning",
    title: "Price 18% above market median",
    context: "Switchgear line item sits well above comparable recent bids for this scope.",
  },
  {
    id: "flag-terms",
    severity: "info",
    title: "Payment terms shifted to Net-45",
    context: "Standard terms with this vendor have been Net-30 on the last four contracts.",
  },
];

const RECEIPTS: Record<string, FlagReceipt> = {
  "flag-insurance": {
    comparisonRows: [
      { label: "This quote", value: "Not included" },
      { label: "Contract requirement", value: "$2,000,000 GL" },
      { label: "Vendor's last 3 contracts", value: "Included every time" },
    ],
    confidencePct: 88,
    recommendation: "Request an updated certificate of insurance before approval.",
    estimatedImpact: "Coverage gap",
    evidenceSources: [
      { label: "Master services agreement, §7.2", href: "#" },
      { label: "Meridian Steelworks COI archive (3 prior contracts)", href: "#" },
    ],
  },
  "flag-price": {
    comparisonRows: [
      { label: "Current quote", value: "$282,000" },
      { label: "Past project", value: "$238,000" },
      { label: "Market median", value: "$241,000" },
    ],
    confidencePct: 94,
    recommendation: "Renegotiate the switchgear line item before signing.",
    estimatedImpact: "$44,000",
    evidenceSources: [
      { label: "Meridian Steelworks quote #Q-4471", href: "#" },
      { label: "Riverside Yards final invoice", href: "#" },
      { label: "RSMeans regional index, Q2", href: "#" },
    ],
  },
  "flag-terms": {
    comparisonRows: [
      { label: "Proposed terms", value: "Net-45" },
      { label: "Last 4 contracts", value: "Net-30" },
      { label: "Industry standard", value: "Net-30" },
    ],
    confidencePct: 81,
    recommendation: "Hold at Net-30 or price in the cost of the float.",
    estimatedImpact: "$6,400",
    evidenceSources: [
      { label: "Contract history — 4 prior POs", href: "#" },
      { label: "Vendor terms sheet, revised", href: "#" },
    ],
  },
};

const ACCEPTABLE_FILENAME = /\.(pdf|docx?|txt)$/i;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/* ============================================================================
 * Inline icons — kept as plain SVG so this file has zero extra dependencies
 * ==========================================================================*/

function IconUploadCloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M7 18a4.5 4.5 0 0 1-.5-8.97A5.5 5.5 0 0 1 17.2 8.02 4 4 0 0 1 17 16H7Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12v6m0-6 2.5 2.5M12 12l-2.5 2.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth={2.25}
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

function IconArrowUpRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M7 17 17 7M7 7h10v10"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFileWarning({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M12 11v4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={12} cy={17.5} r={0.9} fill="currentColor" />
    </svg>
  );
}

function IconFile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/* ============================================================================
 * Animated counter — requestAnimation-backed spring, never an instant swap
 * ==========================================================================*/

function useAnimatedNumber(value: number): number {
  const spring = useSpring(0, { stiffness: 90, damping: 20, mass: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useMotionValueEvent(spring, "change", (latest) => {
    setDisplay(Math.round(latest));
  });

  return display;
}

/* ============================================================================
 * Dropzone — upload state
 * ==========================================================================*/

function Dropzone({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
      e.target.value = "";
    },
    [onFileSelected]
  );

  return (
    <MotionCard
      role="button"
      tabIndex={0}
      aria-label="Drop a quote or contract, or click to browse"
      whileHover={{ scale: 1.002 }}
      whileTap={{ scale: 0.998 }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragActive(false);
      }}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-[12px] border-dashed px-8 py-16 text-center transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        isDragActive ? "border-accent bg-[rgba(172,114,62,0.05)]" : "border-muted hover:border-accent"
      )}
    >
      <IconUploadCloud
        className={cn(
          "h-8 w-8 transition-colors duration-150",
          isDragActive ? "text-accent" : "text-muted-foreground"
        )}
      />
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-medium leading-5 text-foreground">
          Drop a quote or contract
        </p>
        <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
          or click to browse
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="sr-only"
        onChange={handleInputChange}
      />
    </MotionCard>
  );
}

/* ============================================================================
 * File chip — shown during scanning, error, and results
 * ==========================================================================*/

function FileChip({ file }: { file: FileMeta }) {
  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      <IconFile className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-[14px] font-medium leading-5 text-foreground">
        {file.name}
      </span>
      <span className="ml-auto shrink-0 text-[12px] leading-4 text-muted-foreground">
        {file.sizeLabel}
      </span>
    </Card>
  );
}

/* ============================================================================
 * Scanning checklist — sequential reveal, the actual point of this state
 * ==========================================================================*/

function ScanningChecklist({ completedCount }: { completedCount: number }) {
  const visibleCount = Math.min(completedCount + 1, CHECKLIST_ITEMS.length);

  return (
    <ul className="flex flex-col gap-4">
      {CHECKLIST_ITEMS.slice(0, visibleCount).map((item, index) => {
        const isDone = index < completedCount;
        const isActive = index === completedCount;

        return (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex items-center gap-3"
          >
            <span
              className={cn(
                "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                isDone ? "border-success bg-success" : isActive ? "border-accent" : "border-muted"
              )}
            >
              <AnimatePresence mode="wait">
                {isDone ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <IconCheck className="h-3 w-3 text-background" />
                  </motion.span>
                ) : isActive ? (
                  <motion.span
                    key="pulse"
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                ) : null}
              </AnimatePresence>
            </span>
            <span
              className={cn(
                "text-[14px] leading-5 transition-colors duration-200",
                isDone || isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}

/* ============================================================================
 * Error state
 * ==========================================================================*/

function XRayErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-4 px-8 py-16 text-center">
      <IconFileWarning className="h-9 w-9 text-muted-foreground" />
      <p className="text-[14px] font-medium leading-5 text-foreground">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try another file
      </Button>
    </Card>
  );
}

/* ============================================================================
 * Risk score — animated counter + directional arrow
 * ==========================================================================*/

function RiskScoreDisplay() {
  const displayScore = useAnimatedNumber(RISK_SCORE.value);
  const isUp = RISK_SCORE.direction === "up";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-normal uppercase leading-4 tracking-[0.1em] text-muted-foreground">
        Risk score
      </span>
      <div className="flex items-end gap-3">
        <span className="text-[40px] font-bold leading-none tabular-nums text-foreground">
          {displayScore}
        </span>
        <span
          className={cn(
            "mb-1.5 flex items-center gap-1 text-[14px] font-medium leading-5",
            isUp ? "text-danger" : "text-success"
          )}
        >
          <IconArrowUpRight
            className={cn("h-4 w-4", !isUp && "rotate-90")}
          />
          {RISK_SCORE.deltaLabel}
        </span>
      </div>
    </div>
  );
}

/* ============================================================================
 * Flag cards — stagger-fade-in, hover tint, click opens the Receipt panel
 * ==========================================================================*/

const STRIPE_COLOR: Record<FlagSeverity, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
};

const SEVERITY_LABEL: Record<FlagSeverity, string> = {
  danger: "High risk",
  warning: "Needs review",
  info: "For review",
};

function FlagCard({
  flag,
  index,
  isActive,
  onSelect,
}: {
  flag: Flag;
  index: number;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <MotionCard
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -1 }}
      onClick={() => onSelect(flag.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(flag.id);
      }}
      className={cn(
        "flex cursor-pointer overflow-hidden p-0 transition-colors duration-[120ms]",
        "hover:bg-[rgba(219,195,179,0.08)]",
        isActive ? "border-l-2 border-l-accent bg-[rgba(219,195,179,0.08)]" : ""
      )}
    >
      <span aria-hidden className={cn("w-1 shrink-0", STRIPE_COLOR[flag.severity])} />
      <div className="flex flex-1 flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-[14px] font-medium leading-5 text-foreground">{flag.title}</h3>
            <p className="mt-1 text-[12px] font-normal leading-4 text-muted-foreground">
              {flag.context}
            </p>
          </div>
          <Badge variant={flag.severity} dot>
            {SEVERITY_LABEL[flag.severity]}
          </Badge>
        </div>
        <span className="flex shrink-0 items-center gap-1 self-start text-[14px] font-medium leading-5 text-accent sm:self-center">
          View Receipt
          <IconArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </MotionCard>
  );
}

/* ============================================================================
 * Receipt panel — slides in from the right, pushes content, no backdrop
 * ==========================================================================*/

function ReceiptPanel({
  flag,
  receipt,
  onClose,
}: {
  flag: Flag;
  receipt: FlagReceipt;
  onClose: () => void;
}) {
  return (
    <motion.aside
      key="receipt-panel"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-muted bg-[#F7F2EC] sm:w-[40%] sm:min-w-[380px] sm:max-w-[520px] sm:border-l sm:border-t-0"
    >
      <div className="flex items-start justify-between gap-4 border-b border-muted p-6">
        <h2 className="text-[16px] font-medium leading-6 text-foreground">{flag.title}</h2>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={onClose}
          aria-label="Close panel"
          className="shrink-0 rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <IconClose className="h-4 w-4" />
        </motion.button>
      </div>

      <div className="flex flex-col gap-8 p-6">
        {/* Comparison rows */}
        <div className="flex flex-col">
          {receipt.comparisonRows.map((row, i) => (
            <div
              key={row.label}
              className={cn(
                "flex items-baseline justify-between gap-4 py-3",
                i > 0 && "border-t border-muted"
              )}
            >
              <span className="text-[12px] leading-4 text-muted-foreground">{row.label}</span>
              <span className="font-mono text-[16px] font-medium leading-6 tabular-nums text-foreground">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Confidence bar */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
              Confidence
            </span>
            <span className="text-[16px] font-medium leading-6 tabular-nums text-foreground">
              {receipt.confidencePct}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${receipt.confidencePct}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
            />
          </div>
        </div>

        {/* Recommendation */}
        <div className="flex flex-col gap-2">
          <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
            Recommendation
          </span>
          <p className="text-[16px] leading-6 text-foreground">{receipt.recommendation}</p>
        </div>

        {/* Estimated impact */}
        <Card className="flex flex-col gap-2 p-5">
          <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
            Estimated impact
          </span>
          <span className="text-[40px] font-bold leading-none tabular-nums text-accent">
            {receipt.estimatedImpact}
          </span>
        </Card>

        {/* Evidence sources */}
        <div className="flex flex-col gap-1 border-t border-muted pt-6">
          <span className="mb-2 text-[12px] uppercase leading-4 tracking-[0.08em] text-muted-foreground">
            Evidence
          </span>
          <ul className="flex flex-col">
            {receipt.evidenceSources.map((source) => (
              <li key={source.label}>
                <a
                  href={source.href}
                  className="block rounded-sm px-2 py-1.5 -mx-2 text-[12px] leading-4 text-muted-foreground transition-colors duration-[120ms] hover:bg-[rgba(219,195,179,0.08)] hover:text-accent"
                >
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.aside>
  );
}

/* ============================================================================
 * Main screen — the state machine
 * ==========================================================================*/

export default function ProcurementXRayScreen(): ReactNode {
  const [status, setStatus] = useState<XRayStatus>("upload");
  const [file, setFile] = useState<FileMeta | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [completedCount, setCompletedCount] = useState(0);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const handleFileSelected = useCallback(
    (selected: File) => {
      clearTimers();
      setSelectedFlagId(null);
      setCompletedCount(0);
      const meta: FileMeta = { name: selected.name, sizeLabel: formatFileSize(selected.size) };
      setFile(meta);

      if (!ACCEPTABLE_FILENAME.test(selected.name)) {
        setErrorMessage("Couldn't read this file — try a text-based PDF.");
        setStatus("error");
        return;
      }

      setStatus("scanning");
    },
    [clearTimers]
  );

  const handleRetry = useCallback(() => {
    clearTimers();
    setSelectedFlagId(null);
    setCompletedCount(0);
    setFile(null);
    setStatus("upload");
  }, [clearTimers]);

  useEffect(() => {
    if (status !== "scanning") return;

    let cumulative = 0;
    CHECKLIST_DELAYS_MS.forEach((delay, i) => {
      cumulative += delay;
      const t = setTimeout(() => setCompletedCount(i + 1), cumulative);
      timeoutsRef.current.push(t);
    });

    const finalTimeout = setTimeout(() => setStatus("results"), cumulative + 400);
    timeoutsRef.current.push(finalTimeout);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => clearTimers, [clearTimers]);

  const activeFlag = selectedFlagId ? FLAGS.find((f) => f.id === selectedFlagId) ?? null : null;
  const activeReceipt = selectedFlagId ? RECEIPTS[selectedFlagId] ?? null : null;

  return (
    <div className="flex h-full min-h-screen w-full bg-background">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-8 px-6 py-16">
          <div className="flex flex-col gap-2">
            <h1 className="text-[24px] font-bold leading-8 text-foreground">
              Procurement X-Ray
            </h1>
            <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
              Drop a quote or contract to check it against scope, vendor history, and
              market pricing.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {status === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <Dropzone onFileSelected={handleFileSelected} />
              </motion.div>
            )}

            {status === "scanning" && file && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex flex-col gap-8"
              >
                <FileChip file={file} />
                <ScanningChecklist completedCount={completedCount} />
              </motion.div>
            )}

            {status === "error" && file && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex flex-col gap-8"
              >
                <FileChip file={file} />
                <XRayErrorState message={errorMessage} onRetry={handleRetry} />
              </motion.div>
            )}

            {status === "results" && file && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex flex-col gap-10"
              >
                <FileChip file={file} />
                <RiskScoreDisplay />
                <div className="flex flex-col gap-3">
                  {FLAGS.map((flag, i) => (
                    <FlagCard
                      key={flag.id}
                      flag={flag}
                      index={i}
                      isActive={flag.id === selectedFlagId}
                      onSelect={setSelectedFlagId}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {activeFlag && activeReceipt && (
          <ReceiptPanel
            key={activeFlag.id}
            flag={activeFlag}
            receipt={activeReceipt}
            onClose={() => setSelectedFlagId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
