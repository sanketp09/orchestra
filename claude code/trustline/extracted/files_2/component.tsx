"use client";

/**
 * Trustline — Supplier Workspace (vendor-facing)
 *
 * Meridian Steel Fabrication logging into their own compliance workspace.
 * Calmer than the buyer-side bento grid, but still infographic — a 4-card
 * bento layout: one glass-treated hero completion ring, three supporting
 * stat cards. Every number here matches route.py exactly: 67% completion
 * (25/30/20/25 max points, 25/12/20/10 earned), 80th-percentile response
 * time on a 4.0-day average.
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
 * Surface system for this screen — soft embossed cards (dual shadow) as
 * the default, with a real glass/blur treatment reserved for exactly one
 * hero element so it stays special rather than generic.
 * ==========================================================================*/

const CARD_EMBOSSED =
  "border border-white/5 rounded-[12px] bg-white/[0.02] backdrop-blur-md shadow-lg";

const HERO_GLASS =
  "border border-white/10 rounded-[12px] bg-white/[0.04] backdrop-blur-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.2)]";

/* ============================================================================
 * Types — mirror route.py's WorkspaceStatus / DocumentRequirement shape
 * ==========================================================================*/

type DocumentType = "insurance" | "osha" | "catalog" | "bond";
type DocumentStatusValue = "complete" | "attention" | "missing";

interface DocumentRequirement {
  docType: DocumentType;
  label: string;
  maxPoints: number;
  earnedPoints: number;
  status: DocumentStatusValue;
  note: string | null;
}

interface ResponseMetrics {
  avgResponseDays: number;
  percentileFasterThan: number;
}

/* ============================================================================
 * Mock data — matches route.py's Meridian Steel seed exactly
 * ==========================================================================*/

const INITIAL_DOCUMENTS: DocumentRequirement[] = [
  { docType: "insurance", label: "Insurance", maxPoints: 25, earnedPoints: 25, status: "complete", note: null },
  {
    docType: "osha",
    label: "OSHA Certification",
    maxPoints: 30,
    earnedPoints: 12,
    status: "attention",
    note: "Certificate references an 8-month-old recordable incident — upload the renewed certificate.",
  },
  { docType: "catalog", label: "Product Catalog", maxPoints: 20, earnedPoints: 20, status: "complete", note: null },
  {
    docType: "bond",
    label: "Bond Letter",
    maxPoints: 25,
    earnedPoints: 10,
    status: "attention",
    note: "Bonding line is at $2.4M of $4M capacity — upload an updated bond letter.",
  },
];

const RESPONSE_METRICS: ResponseMetrics = {
  avgResponseDays: 4.0,
  percentileFasterThan: 80,
};

function computeCompletionPct(documents: DocumentRequirement[]): number {
  const totalMax = documents.reduce((sum, d) => sum + d.maxPoints, 0);
  if (totalMax === 0) return 0;
  const totalEarned = documents.reduce((sum, d) => sum + d.earnedPoints, 0);
  return Math.round((1000 * totalEarned) / totalMax) / 10;
}

// Stubbed network call — swap for a real POST to
// /trustline/vendor/{id}/workspace/upload once wired to the backend.
async function stubUploadRequest(_docType: DocumentType): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

/* ============================================================================
 * Inline icons — plain SVG, zero extra dependencies
 * ==========================================================================*/

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={1.5} />
      <path d="M8.5 12.5l2.2 2.2L16 9.5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlertTriangle({ className }: { className?: string }) {
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
 * Animated number — spring-driven, never an instant swap
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

/* ============================================================================
 * Hand-built SVG radial gauge — sweep-fills via stroke-dasharray, never a
 * static pre-filled ring. Takes an already-animated display value rather
 * than animating internally, so the ring and the centered number share
 * one spring instead of drifting slightly apart from two.
 * ==========================================================================*/

function RadialGauge({
  displayPct,
  size = 168,
  strokeWidth = 14,
}: {
  displayPct: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(displayPct, 0), 100);
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#C6FF33"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

/* ============================================================================
 * Hero card — glass treatment, the one place it's used on this screen
 * ==========================================================================*/

function HeroCompletionCard({
  vendorName,
  documents,
}: {
  vendorName: string;
  documents: DocumentRequirement[];
}) {
  const completionPct = computeCompletionPct(documents);
  const displayPct = useAnimatedNumber(completionPct);
  const incompleteCount = documents.filter((d) => d.status !== "complete").length;

  const subtitle =
    incompleteCount === 0
      ? "You're fully compliant — nothing outstanding."
      : `Almost there — ${incompleteCount} document${incompleteCount === 1 ? "" : "s"} away from full compliance.`;

  return (
    <Card className={cn("flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:justify-center sm:gap-10", HERO_GLASS)}>
      <div className="relative flex shrink-0 items-center justify-center">
        <RadialGauge displayPct={displayPct} />
        <div className="absolute flex flex-col items-center">
          <span className="text-[40px] font-bold leading-none tabular-nums text-white">
            {Math.round(displayPct)}%
          </span>
          <span className="mt-1 text-[12px] leading-4 text-white/50">Complete</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 sm:items-start sm:text-left">
        <span className="text-[16px] font-bold leading-5 text-white">{vendorName}</span>
        <p className="max-w-xs text-[13px] leading-5 text-white/60">{subtitle}</p>
      </div>
    </Card>
  );
}

/* ============================================================================
 * Document Status card — 2x2 mini-grid of chips with inline upload
 * ==========================================================================*/

function DocumentChip({
  doc,
  isUploading,
  onUpload,
}: {
  doc: DocumentRequirement;
  isUploading: boolean;
  onUpload: (docType: DocumentType) => void;
}) {
  const isComplete = doc.status === "complete";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[8px] p-3 border",
        isComplete ? "bg-[#C6FF33]/5 border-[#C6FF33]/15" : "bg-[#FBBF24]/5 border-[#FBBF24]/15"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold leading-4 text-white">{doc.label}</span>
        {isComplete ? (
          <IconCheckCircle className="h-4 w-4 shrink-0 text-[#C6FF33]" />
        ) : (
          <IconAlertTriangle className="h-4 w-4 shrink-0 text-[#FBBF24]" />
        )}
      </div>
      {!isComplete && (
        <AnimatePresence mode="wait" initial={false}>
          {isUploading ? (
            <motion.div
              key="progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-1 w-full overflow-hidden rounded-full bg-white/5"
            >
              <motion.div
                className="h-full rounded-full bg-[#7D39EB]"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
            </motion.div>
          ) : (
            <motion.button
              key="upload"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileHover={{ opacity: 0.8 }}
              onClick={() => onUpload(doc.docType)}
              className="self-start text-[12px] font-bold leading-4 text-[#7D39EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7D39EB]"
            >
              Upload
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function DocumentStatusCard({
  documents,
  uploadingType,
  onUpload,
}: {
  documents: DocumentRequirement[];
  uploadingType: DocumentType | null;
  onUpload: (docType: DocumentType) => void;
}) {
  return (
    <Card className={cn("flex flex-col gap-4 p-5", CARD_EMBOSSED)}>
      <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-white/40">
        Document Status
      </span>
      <div className="grid grid-cols-2 gap-2.5">
        {documents.map((doc) => (
          <DocumentChip
            key={doc.docType}
            doc={doc}
            isUploading={uploadingType === doc.docType}
            onUpload={onUpload}
          />
        ))}
      </div>
    </Card>
  );
}

/* ============================================================================
 * Response Metrics card — framed as a compliment, not surveillance
 * ==========================================================================*/

function ResponseMetricsCard({ metrics }: { metrics: ResponseMetrics }) {
  const displayPct = Math.round(useAnimatedNumber(metrics.percentileFasterThan));

  return (
    <Card className={cn("flex flex-col gap-4 p-5", CARD_EMBOSSED)}>
      <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-white/40">
        Response Time
      </span>
      <p className="text-[13px] leading-5 text-white/70">
        You respond faster than{" "}
        <span className="font-bold tabular-nums text-[#C6FF33]">{displayPct}%</span> of vendors
        on this platform.
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full bg-[#C6FF33]"
          initial={{ width: 0 }}
          animate={{ width: `${metrics.percentileFasterThan}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[12px] leading-4 text-white/40 font-medium">
        Avg. response: {metrics.avgResponseDays.toFixed(1)} days
      </span>
    </Card>
  );
}

/* ============================================================================
 * Next Steps card — prioritized, each with an inline upload
 * ==========================================================================*/

function NextStepsCard({
  documents,
  uploadingType,
  onUpload,
}: {
  documents: DocumentRequirement[];
  uploadingType: DocumentType | null;
  onUpload: (docType: DocumentType) => void;
}) {
  // Biggest point gap first — the single upload that moves completion the
  // most, matching route.py's _derive_next_steps ordering.
  const outstanding = [...documents]
    .filter((d) => d.status !== "complete")
    .sort((a, b) => (b.maxPoints - b.earnedPoints) - (a.maxPoints - a.earnedPoints));

  return (
    <Card className={cn("flex flex-col gap-4 p-5", CARD_EMBOSSED)}>
      <span className="text-[12px] uppercase leading-4 tracking-[0.08em] text-white/40">
        Next Steps
      </span>
      {outstanding.length === 0 ? (
        <p className="text-[14px] leading-5 text-white/70">
          You&apos;re fully compliant — nothing outstanding.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {outstanding.map((doc, i) => (
            <motion.li
              key={doc.docType}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3, ease: "easeOut" }}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-[13px] font-bold leading-5 text-white">
                  {doc.label}
                </span>
                {doc.note && (
                  <span className="mt-0.5 text-[11px] leading-4 text-white/40">
                    {doc.note}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10"
                onClick={() => onUpload(doc.docType)}
                disabled={uploadingType !== null}
              >
                {uploadingType === doc.docType ? "Uploading..." : "Upload"}
              </Button>
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ============================================================================
 * Screen
 * ==========================================================================*/

function fadeInSection(index: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.1, duration: 0.3, ease: "easeOut" as const },
  };
}

export default function SupplierWorkspaceScreen(): ReactNode {
  const [documents, setDocuments] = useState<DocumentRequirement[]>(INITIAL_DOCUMENTS);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);

  const handleUpload = useCallback(
    async (docType: DocumentType) => {
      if (uploadingType) return; // one upload in flight at a time
      setUploadingType(docType);
      await stubUploadRequest(docType);
      setDocuments((docs) =>
        docs.map((d) =>
          d.docType === docType
            ? { ...d, status: "complete" as const, earnedPoints: d.maxPoints, note: null }
            : d
        )
      );
      setUploadingType(null);
    },
    [uploadingType]
  );

  return (
    <div className="w-full px-6 py-8">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[24px] font-bold leading-8 text-white">Your Workspace</h1>
            <Badge className="bg-[#C6FF33] text-black border-0">
              SAM.gov active · License active
            </Badge>
          </div>
          <p className="mt-1 text-[13px] leading-5 text-white/50">
            Meridian Steel Fabrication — Structural Steel, Houston, TX
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.div {...fadeInSection(0)} className="lg:col-span-3">
            <HeroCompletionCard
              vendorName="Meridian Steel Fabrication"
              documents={documents}
            />
          </motion.div>

          <motion.div {...fadeInSection(1)}>
            <DocumentStatusCard
              documents={documents}
              uploadingType={uploadingType}
              onUpload={handleUpload}
            />
          </motion.div>

          <motion.div {...fadeInSection(2)}>
            <ResponseMetricsCard metrics={RESPONSE_METRICS} />
          </motion.div>

          <motion.div {...fadeInSection(3)}>
            <NextStepsCard
              documents={documents}
              uploadingType={uploadingType}
              onUpload={handleUpload}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
