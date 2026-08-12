"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cormorant_Garamond } from "next/font/google";
import framesList from "@/lib/frames-list.json";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const ICON_LABELS = [
  { label: "Sentinel",   desc: "Continuous vendor monitoring",          side: "left"  },
  { label: "Trustline",  desc: "Compliance, verified live",             side: "left"  },
  { label: "Compass",    desc: "Pricing benchmarked",                   side: "left"  },
  { label: "Precedent",  desc: "History that travels with the vendor",  side: "right" },
  { label: "Arbiter",    desc: "Exceptions, routed correctly",          side: "right" },
  { label: "Atlas",      desc: "Ownership, mapped",                     side: "right" },
];

const TOTAL_FRAMES = framesList.length; // 296

export function ScrollFramesAnimation() {
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const imagesRef        = useRef<HTMLImageElement[]>([]);
  const frameRef         = useRef(0);           // current drawn frame
  const accumulatedRef   = useRef(0);           // accumulated wheel delta
  const isActiveRef      = useRef(true);        // true = we own the scroll
  const ticking          = useRef(false);

  const [phase, setPhase]                 = useState<"start" | "fade" | "split">("start");
  const [loadedCount, setLoadedCount]     = useState(0);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [progress, setProgress]           = useState(0); // 0–100 for progress bar

  // ── How much accumulated delta = one full frame advance ────────────────
  const DELTA_PER_FRAME = 18; // tune: lower = faster playback per scroll tick

  // ── Draw a specific frame to canvas ────────────────────────────────────
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = imagesRef.current[index];
    if (!img || !img.complete) return;

    const { width: cw, height: ch } = canvas;
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = cw / ch;
    let dw = cw, dh = ch, ox = 0, oy = 0;
    if (ir > cr) { dw = ch * ir; ox = (cw - dw) / 2; }
    else         { dh = cw / ir; oy = (ch - dh) / 2; }

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, ox, oy, dw, dh);
  }, []);

  // ── Resize canvas to viewport ───────────────────────────────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    drawFrame(frameRef.current);
  }, [drawFrame]);

  // ── Preload all frames ──────────────────────────────────────────────────
  useEffect(() => {
    let count = 0;
    const imgs: HTMLImageElement[] = new Array(TOTAL_FRAMES);
    imagesRef.current = imgs;

    framesList.forEach((filename, i) => {
      const img = new Image();
      img.src = `/frames/${filename}`;
      img.onload = () => {
        count++;
        setLoadedCount(count);
        if (i === 0) {
          setFirstFrameReady(true);
          drawFrame(0);
        }
      };
      imgs[i] = img;
    });
  }, [drawFrame]);

  // ── Draw first frame once ready ─────────────────────────────────────────
  useEffect(() => {
    if (firstFrameReady) {
      resizeCanvas();
    }
  }, [firstFrameReady, resizeCanvas]);

  // ── Resize listener ─────────────────────────────────────────────────────
  useEffect(() => {
    window.addEventListener("resize", resizeCanvas, { passive: true });
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  // ── CORE: intercept wheel while frames are active ───────────────────────
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const isAtTop = window.scrollY <= 2;
      const isScrollingUp = e.deltaY < 0;
      const isScrollingDown = e.deltaY > 0;

      if (!isActiveRef.current) {
        if (isAtTop) {
          if (isScrollingDown && frameRef.current < TOTAL_FRAMES - 1) {
            isActiveRef.current = true;
          } else if (isScrollingUp && frameRef.current > 0) {
            isActiveRef.current = true;
          } else {
            return;
          }
        } else {
          return;
        }
      }

      // Prevent the page from scrolling
      e.preventDefault();

      // deltaY positive = scroll down = advance frames
      // deltaY negative = scroll up = reverse frames
      const delta = e.deltaY;
      accumulatedRef.current += delta; // signed — positive forward, negative backward

      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(() => {
          const steps = Math.trunc(accumulatedRef.current / DELTA_PER_FRAME);
          if (steps !== 0) {
            accumulatedRef.current -= steps * DELTA_PER_FRAME;
            const newFrame = Math.max(0, Math.min(frameRef.current + steps, TOTAL_FRAMES - 1));
            frameRef.current = newFrame;
            drawFrame(newFrame);
            setProgress(Math.round((newFrame / (TOTAL_FRAMES - 1)) * 100));

            // Update phase
            const pct = newFrame / (TOTAL_FRAMES - 1);
            if      (pct < 0.05) setPhase("start");
            else if (pct < 0.66) setPhase("fade");
            else                 setPhase("split");

            // Release scroll lock when a boundary is reached
            if (newFrame >= TOTAL_FRAMES - 1 || newFrame <= 0) {
              isActiveRef.current = false;
            }
          }
          ticking.current = false;
        });
      }
    };

    // Touch support
    let lastTouchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const dy = lastTouchY - e.touches[0].clientY; // positive = swipe up = advance
      lastTouchY = e.touches[0].clientY;

      const isAtTop = window.scrollY <= 2;
      const isSwipingUp = dy > 0; // swipe up = scroll down
      const isSwipingDown = dy < 0; // swipe down = scroll up

      if (!isActiveRef.current) {
        if (isAtTop) {
          if (isSwipingUp && frameRef.current < TOTAL_FRAMES - 1) {
            isActiveRef.current = true;
          } else if (isSwipingDown && frameRef.current > 0) {
            isActiveRef.current = true;
          } else {
            return;
          }
        } else {
          return;
        }
      }

      e.preventDefault();
      accumulatedRef.current += dy * 2;

      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(() => {
          const steps = Math.trunc(accumulatedRef.current / DELTA_PER_FRAME);
          if (steps !== 0) {
            accumulatedRef.current -= steps * DELTA_PER_FRAME;
            const newFrame = Math.max(0, Math.min(frameRef.current + steps, TOTAL_FRAMES - 1));
            frameRef.current = newFrame;
            drawFrame(newFrame);
            setProgress(Math.round((newFrame / (TOTAL_FRAMES - 1)) * 100));
            const pct = newFrame / (TOTAL_FRAMES - 1);
            if      (pct < 0.05) setPhase("start");
            else if (pct < 0.66) setPhase("fade");
            else                 setPhase("split");
            if (newFrame >= TOTAL_FRAMES - 1 || newFrame <= 0) {
              isActiveRef.current = false;
            }
          }
          ticking.current = false;
        });
      }
    };

    // Must use non-passive so we can call preventDefault
    window.addEventListener("wheel",      onWheel,      { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove",  onTouchMove,  { passive: false });

    return () => {
      window.removeEventListener("wheel",      onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove",  onTouchMove);
    };
  }, [drawFrame]);

  return (
    /* Fixed viewport — covers 100vh, sits above the rest of the page.
       Once the last frame fires, isActiveRef = false, the fixed overlay
       is removed via CSS pointer-events, and normal page scroll resumes. */
    <div className="relative w-full h-screen overflow-hidden bg-[#08070C]">

      {/* Mesh glows */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="bg-mesh-glow-1 top-[10%] left-[-15%]" />
        <div className="bg-mesh-glow-2 bottom-[20%] right-[-10%]" />
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.85 }}
      />

      {/* Loading overlay */}
      {!firstFrameReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#08070C] z-20">
          <div className="h-8 w-8 rounded-full border-4 border-t-[#C6FF33] border-white/10 animate-spin mb-3" />
          <p className="text-[13px] font-mono text-white/50">
            Loading {loadedCount}/{TOTAL_FRAMES} frames...
          </p>
        </div>
      )}

      {/* Hero text — fades out after first few frames */}
      <AnimatePresence mode="wait">
        {phase === "start" && (
          <motion.div
            key="start"
            initial={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute left-8 md:left-20 top-1/2 -translate-y-1/2 max-w-xl z-10 pointer-events-none select-none"
          >
            <span className="text-[13px] uppercase tracking-[0.25em] font-bold text-black block mb-3">
              Welcome to Orchestra
            </span>
            <h1 className={`${cormorant.className} text-[56px] md:text-[80px] font-bold text-black leading-[1.02] tracking-tight uppercase`}>
              Procurement,<br />
              Reimagined<br />
              Through<br />
              Intelligence.
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Split HUD labels — appear at 66% progress */}
      <div className="absolute inset-0 flex justify-between items-center px-6 md:px-16 z-10 pointer-events-none select-none">
        {/* Left column */}
        <div className="flex flex-col gap-8 md:gap-12 max-w-[260px]">
          {ICON_LABELS.filter(i => i.side === "left").map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -120 }}
              animate={phase === "split" ? { opacity: 1, x: 0 } : { opacity: 0, x: -120 }}
              transition={{ duration: 0.7, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl p-4 border-l-2"
              style={{
                background: "rgba(8, 7, 12, 0.75)",
                borderLeftColor: "#C6FF33",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(198,255,51,0.15)",
              }}
            >
              <h4 className="text-[20px] md:text-[22px] font-black text-[#C6FF33] tracking-tight drop-shadow-[0_0_8px_rgba(198,255,51,0.4)]">
                {item.label}
              </h4>
              <p className="text-[12px] text-white/80 mt-1 leading-snug max-w-[220px]">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-8 md:gap-12 max-w-[260px]">
          {ICON_LABELS.filter(i => i.side === "right").map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: 120 }}
              animate={phase === "split" ? { opacity: 1, x: 0 } : { opacity: 0, x: 120 }}
              transition={{ duration: 0.7, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl p-4 border-r-2"
              style={{
                background: "rgba(8, 7, 12, 0.75)",
                borderRightColor: "#7D39EB",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                borderLeft: "1px solid rgba(255,255,255,0.06)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(125,57,235,0.2)",
              }}
            >
              <h4 className="text-[20px] md:text-[22px] font-black text-[#7D39EB] tracking-tight drop-shadow-[0_0_8px_rgba(125,57,235,0.5)]">
                {item.label}
              </h4>
              <p className="text-[12px] text-white/80 mt-1 leading-snug max-w-[220px]">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 right-8 font-mono text-[#C6FF33] text-[12px] z-10 pointer-events-none select-none"
        style={{ animation: "pulse 2s ease-in-out infinite" }}>
        Scroll Down ↓
      </div>

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 z-10">
        <motion.div
          className="h-full bg-[#C6FF33]"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.05 }}
        />
      </div>
    </div>
  );
}
