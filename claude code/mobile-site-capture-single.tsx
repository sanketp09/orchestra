"use client";

/**
 * ORCHESTRA — Mobile Site Capture
 *
 * Single self-contained screen. All layout, sub-components, and mock data
 * live inline below. Shared primitives (Button, Card, Badge, cn) are
 * assumed to already exist in the design system.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Mic, Receipt, RotateCcw, Square, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CaptureMode = "voice" | "video";
type CaptureState = "idle" | "recording" | "processing" | "transcribed" | "confirmed" | "error";

interface ConfirmedAction {
  id: string;
  title: string;
  summary: string;
}

interface CaptureResult {
  transcript: string;
  actions: ConfirmedAction[];
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const VOICE_RESULT: CaptureResult = {
  transcript: "Running low on the 5/8 anchor bolts, might need more by Thursday.",
  actions: [
    {
      id: "a1",
      title: "Purchase Request Created",
      summary: "5/8 anchor bolts — routed to procurement for Thursday delivery.",
    },
    {
      id: "a2",
      title: "Supplier Lead Time Flagged",
      summary: "Current vendor's fulfillment window may miss the Thursday need-by.",
    },
  ],
};

const VIDEO_RESULT: CaptureResult = {
  transcript:
    "Walking the east stair core — spalling on two support columns, looks worse than last week.",
  actions: [
    {
      id: "b1",
      title: "Site Condition Flag Created",
      summary: "East stair core routed to structural review, priority: high.",
    },
  ],
};

const STATE_ORDER: CaptureState[] = [
  "idle",
  "recording",
  "processing",
  "transcribed",
  "confirmed",
  "error",
];

// ---------------------------------------------------------------------------
// Local sub-components
// ---------------------------------------------------------------------------

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: CaptureMode;
  onChange: (mode: CaptureMode) => void;
  disabled: boolean;
}) {
  const options: { value: CaptureMode; label: string; icon: typeof Mic }[] = [
    { value: "voice", label: "Voice", icon: Mic },
    { value: "video", label: "Video", icon: Video },
  ];

  return (
    <div className="inline-flex items-center rounded-[6px] border border-[#DBC3B3] bg-[#F3EDE7] p-1">
      {options.map(({ value, label, icon: Icon }) => {
        const active = mode === value;
        return (
          <motion.button
            key={value}
            type="button"
            disabled={disabled}
            whileHover={{ y: active ? 0 : -1 }}
            transition={{ duration: 0.12 }}
            onClick={() => onChange(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[12px] font-medium transition-colors duration-150",
              active ? "bg-[#AC723E] text-[#F3EDE7]" : "text-[#AA8D74] hover:bg-[#DBC3B3]/[0.08]",
              disabled && "opacity-50"
            )}
          >
            <Icon size={14} strokeWidth={2} />
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}

function Waveform() {
  const bars = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="flex h-10 items-center justify-center gap-[3px]" aria-hidden="true">
      {bars.map((i) => {
        const base = 6 + ((i * 37) % 20);
        const peak = 14 + ((i * 53) % 26);
        return (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-[#AC723E]"
            initial={{ height: base }}
            animate={{ height: [base, peak, base * 0.8, peak * 0.7, base] }}
            transition={{
              duration: 1.1 + (i % 5) * 0.08,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (i % 8) * 0.05,
            }}
          />
        );
      })}
    </div>
  );
}

function RecordButton({
  mode,
  isRecording,
  onPress,
}: {
  mode: CaptureMode;
  isRecording: boolean;
  onPress: () => void;
}) {
  const ModeIcon = mode === "voice" ? Mic : Video;
  return (
    <div className="relative flex h-[144px] w-[144px] items-center justify-center">
      {isRecording && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-[#AC723E]"
          animate={{ scale: [1, 1.14, 1], opacity: [0.6, 0.15, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <motion.button
        type="button"
        onClick={onPress}
        aria-pressed={isRecording}
        aria-label={isRecording ? "Stop recording" : `Start ${mode} capture`}
        whileHover={{ scale: isRecording ? 1 : 1.03 }}
        whileTap={{ scale: 0.96 }}
        animate={isRecording ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={
          isRecording
            ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.15 }
        }
        className="relative flex h-[112px] w-[112px] items-center justify-center rounded-full bg-[#AC723E]"
      >
        {isRecording ? (
          <Square size={30} className="fill-[#F3EDE7] text-[#F3EDE7]" strokeWidth={0} />
        ) : (
          <ModeIcon size={36} strokeWidth={2} className="text-[#F3EDE7]" />
        )}
      </motion.button>
    </div>
  );
}

function ProcessingIndicator({ mode }: { mode: CaptureMode }) {
  const label =
    mode === "voice" ? "Understanding what you said..." : "Understanding what you captured...";
  return (
    <div className="flex h-[144px] w-[144px] flex-col items-center justify-center gap-4">
      <div className="flex h-11 items-center justify-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2.5 w-2.5 rounded-full bg-[#AC723E]"
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
          />
        ))}
      </div>
      <p className="max-w-[180px] text-center text-[14px] font-normal text-[#AA8D74]" role="status">
        {label}
      </p>
    </div>
  );
}

function TranscriptBlock({ transcript }: { transcript: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full rounded-[8px] border border-[#DBC3B3] bg-[#F3EDE7] px-4 py-4"
    >
      <p className="mb-1.5 text-[12px] font-normal uppercase tracking-wide text-[#AA8D74]">Heard</p>
      <p className="text-[16px] font-normal leading-relaxed text-[#0C0904]">&ldquo;{transcript}&rdquo;</p>
    </motion.div>
  );
}

const cardStackVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function ConfirmationCard({ action, index }: { action: ConfirmedAction; index: number }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
      <Card className="w-full rounded-[8px] border border-[#DBC3B3] bg-[#F3EDE7] p-4 shadow-none">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4A7A5C]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <motion.path
                d="M2.5 7.2L5.5 10.2L11.5 3.8"
                stroke="#F3EDE7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, delay: 0.08 * index + 0.15, ease: "easeOut" }}
              />
            </svg>
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-medium leading-snug text-[#0C0904]">{action.title}</h3>
            <p className="mt-1.5 text-[12px] font-normal leading-snug text-[#AA8D74]">
              {action.summary}
            </p>

            <motion.button
              type="button"
              whileHover={{ x: 1 }}
              transition={{ duration: 0.12 }}
              className="mt-3 inline-flex items-center gap-1 rounded-[4px] text-[12px] font-medium text-[#AC723E] hover:underline"
            >
              <Receipt size={12} strokeWidth={2} />
              View receipt
            </motion.button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function ErrorState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col items-center gap-3 rounded-[8px] px-6 py-4 text-center"
    >
      <AlertCircle size={36} strokeWidth={1.5} className="text-[#A6432F]" />
      <p className="text-[14px] font-medium text-[#0C0904]">
        Didn&rsquo;t catch that clearly — try again.
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SiteCaptureScreen() {
  const [state, setState] = useState<CaptureState>("idle");
  const [mode, setMode] = useState<CaptureMode>("voice");
  const [result, setResult] = useState<CaptureResult | null>(null);
  const interactedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const runCapture = (chosenMode: CaptureMode) => {
    clearTimeouts();
    setState("recording");
    const t1 = setTimeout(() => {
      setState("processing");
      const t2 = setTimeout(() => {
        const captured = chosenMode === "voice" ? VOICE_RESULT : VIDEO_RESULT;
        setResult(captured);
        setState("transcribed");
        const t3 = setTimeout(() => setState("confirmed"), 1600);
        timeoutsRef.current.push(t3);
      }, 1900);
      timeoutsRef.current.push(t2);
    }, 2200);
    timeoutsRef.current.push(t1);
  };

  // Demo auto-advance: walks through the full happy path once so every state
  // is viewable without a real microphone. Cancelled the moment the person
  // interacts manually.
  useEffect(() => {
    const t0 = setTimeout(() => {
      if (!interactedRef.current) runCapture("voice");
    }, 1000);
    timeoutsRef.current.push(t0);
    return () => clearTimeouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualPress = () => {
    interactedRef.current = true;
    clearTimeouts();
    if (state === "idle" || state === "error") {
      runCapture(mode);
    } else if (state === "recording") {
      clearTimeouts();
      setState("processing");
      const t = setTimeout(() => {
        const captured = mode === "voice" ? VOICE_RESULT : VIDEO_RESULT;
        setResult(captured);
        setState("transcribed");
        const t2 = setTimeout(() => setState("confirmed"), 1600);
        timeoutsRef.current.push(t2);
      }, 1600);
      timeoutsRef.current.push(t);
    }
  };

  const reset = () => {
    interactedRef.current = true;
    clearTimeouts();
    setResult(null);
    setState("idle");
  };

  const jumpTo = (target: CaptureState) => {
    interactedRef.current = true;
    clearTimeouts();
    if (target === "transcribed" || target === "confirmed") {
      setResult(mode === "voice" ? VOICE_RESULT : VIDEO_RESULT);
    }
    setState(target);
  };

  const showToggle = state === "idle" || state === "recording";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[428px] flex-col bg-[#F3EDE7]">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="text-[12px] font-medium uppercase tracking-wide text-[#AA8D74]">
          Site Capture
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="h-8 gap-1 rounded-[6px] px-2 text-[12px] font-medium text-[#AA8D74] hover:bg-[#DBC3B3]/[0.08] hover:text-[#0C0904]"
        >
          <RotateCcw size={12} />
          Reset
        </Button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-24">
        <div className="flex h-8 items-center">
          <AnimatePresence>
            {showToggle && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ModeToggle mode={mode} onChange={setMode} disabled={state === "recording"} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {(state === "idle" || state === "recording") && (
            <motion.div
              key="record"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-6"
            >
              <RecordButton mode={mode} isRecording={state === "recording"} onPress={handleManualPress} />
              <div className="h-10">{state === "recording" && <Waveform />}</div>
              <p className="text-[14px] font-normal text-[#AA8D74]">
                {state === "recording" ? "Listening — tap to stop" : "Tap to capture a site note"}
              </p>
            </motion.div>
          )}

          {state === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ProcessingIndicator mode={mode} />
            </motion.div>
          )}

          {(state === "transcribed" || state === "confirmed") && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex w-full flex-col gap-4"
            >
              <AnimatePresence mode="wait">
                {state === "transcribed" && (
                  <motion.div key="transcript" exit={{ opacity: 0, height: 0 }}>
                    <TranscriptBlock transcript={result.transcript} />
                  </motion.div>
                )}

                {state === "confirmed" && (
                  <motion.div
                    key="cards"
                    variants={cardStackVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col gap-3"
                  >
                    {result.actions.slice(0, 3).map((action, index) => (
                      <ConfirmationCard key={action.id} action={action} index={index} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {state === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-6"
            >
              <ErrorState />
              <RecordButton mode={mode} isRecording={false} onPress={handleManualPress} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DEV-ONLY state switcher — not part of the product surface, lets every
          state be inspected without a real microphone. Remove before ship. */}
      <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-[6px] border border-dashed border-[#AA8D74] bg-[#F3EDE7] p-1 shadow-md">
        {STATE_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => jumpTo(s)}
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
