'use client';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from 'react';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
  MotionValue,
} from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/* ============================================================================
   ORCHESTRA — Landing Page
   Construction procurement intelligence. Every number has receipts.
   Single-file screen: hero (r3f belief graph), scroll-pinned problem
   statements, scroll-driven X-Ray assembly, six system cards, closing CTA.
============================================================================ */

/* ----------------------------------------------------------------------------
   Content
---------------------------------------------------------------------------- */

const PROBLEM_STATEMENTS = [
  {
    eyebrow: 'Friday, 4:47pm',
    text: 'A change order lands on your desk. You have eleven minutes before the crew stands down waiting on it.',
  },
  {
    eyebrow: 'Six weeks ago',
    text: "The vendor's certificate of insurance expired. Nobody on the job caught it until the claim.",
  },
  {
    eyebrow: 'Three bids, one line item',
    text: 'Three subs quoted the same scope. Only one number actually reconciled against the drawings.',
  },
];

const SYSTEMS = [
  {
    name: 'Sentinel',
    tagline: 'Continuous vendor monitoring',
    description:
      'Watches every active vendor for anomalies — cost spikes, sudden ownership changes, filing gaps — and flags before the invoice clears.',
    accent: 'info' as const,
  },
  {
    name: 'Trustline',
    tagline: 'Compliance, verified live',
    description:
      'Confirms subcontractor licensing, insurance, and lien status against source registries, not last quarter\u2019s PDF.',
    accent: 'success' as const,
  },
  {
    name: 'Compass',
    tagline: 'Pricing benchmarked',
    description:
      'Checks every quote against your own historical bid data to surface inflated line items before signature.',
    accent: 'ai' as const,
  },
  {
    name: 'Precedent',
    tagline: 'History that travels with the vendor',
    description:
      'Surfaces prior disputes, change-order patterns, and claim history tied to a vendor across every project.',
    accent: 'warning' as const,
  },
  {
    name: 'Arbiter',
    tagline: 'Exceptions, routed correctly',
    description:
      'Sends flagged decisions to the right reviewer with the full evidence trail attached — no cold handoffs.',
    accent: 'danger' as const,
  },
  {
    name: 'Atlas',
    tagline: 'Ownership, mapped',
    description:
      'Traces entity structures across shell companies and joint ventures so you know who is actually being paid.',
    accent: 'info' as const,
  },
];

const SEMANTIC_HEX: Record<string, string> = {
  success: '#4A7A5C',
  warning: '#B8873A',
  danger: '#A6432F',
  info: '#4A6A8A',
  ai: '#6B5A7A',
};

/* ----------------------------------------------------------------------------
   Small utilities
---------------------------------------------------------------------------- */

/** Animates a numeric value toward `target` over ~600ms using a spring. */
function useAnimatedNumber(target: number, active: boolean) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: 0.6, bounce: 0 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (active) motionVal.set(target);
  }, [active, target, motionVal]);

  useMotionValueEvent(spring, 'change', (v) => setDisplay(Math.round(v)));

  return display;
}

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
      <rect x="6" y="9" width="24" height="20" rx="2" />
      <path d="M6 15h24" />
      <path d="M12 21h4" />
      <path d="M12 25h9" />
    </svg>
  );
}

/* ----------------------------------------------------------------------------
   Belief graph — lazy-loaded r3f canvas
---------------------------------------------------------------------------- */

/* This screen is the one exception permitted to carry a heavy 3D dependency.
   Since everything must live in a single file, the r3f scene is not a
   separate module — it's lazy-loaded via React.lazy against a factory that
   dynamically imports @react-three/fiber and three only when this component
   actually mounts, keeping them out of the initial bundle. */
const BeliefGraph3D = React.lazy(async () => {
  const [{ Canvas, useFrame }, THREE] = await Promise.all([
    import('@react-three/fiber'),
    import('three'),
  ]);

  const NODE_COUNT = 22;

  function Graph() {
    const groupRef = useRef<any>(null);
    const pointer = useRef({ x: 0, y: 0 });

    const nodes = useMemo(() => {
      const pts: [number, number, number][] = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 2.2 + Math.random() * 0.6;
        pts.push([
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta) * 0.6,
          r * Math.cos(phi),
        ]);
      }
      return pts;
    }, []);

    const edges = useMemo(() => {
      const lines: [number, number][] = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        const connections = 1 + Math.floor(Math.random() * 2);
        for (let c = 0; c < connections; c++) {
          const j = Math.floor(Math.random() * NODE_COUNT);
          if (j !== i) lines.push([i, j]);
        }
      }
      return lines;
    }, []);

    useFrame((state: any) => {
      if (!groupRef.current) return;
      groupRef.current.rotation.y += 0.0018;
      pointer.current.x = state.pointer.x;
      pointer.current.y = state.pointer.y;
      groupRef.current.rotation.x = pointer.current.y * 0.15;
      groupRef.current.rotation.z = pointer.current.x * -0.06;
    });

    return (
      <group ref={groupRef}>
        {edges.map(([a, b], i) => {
          const start = nodes[a];
          const end = nodes[b];
          const positions = new Float32Array([...start, ...end]);
          return (
            <line key={`edge-${i}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={positions}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#AC723E" transparent opacity={0.35} />
            </line>
          );
        })}
        {nodes.map((pos, i) => (
          <mesh key={`node-${i}`} position={pos}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color="#DDA871" />
          </mesh>
        ))}
      </group>
    );
  }

  function Scene() {
    return (
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.6} />
        <Graph />
      </Canvas>
    );
  }

  return { default: Scene };
});

/* ----------------------------------------------------------------------------
   Hero
---------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative flex min-h-screen w-full flex-col justify-center overflow-hidden px-8 py-24 md:px-16">
      <div className="grid w-full max-w-7xl grid-cols-1 items-center gap-12 md:grid-cols-2">
        <div>
          <Badge
            className="mb-6 rounded-[4px] border border-[var(--muted)] bg-transparent px-2 py-1 text-[12px] font-normal text-[var(--muted-foreground)]"
          >
            Enterprise procurement intelligence
          </Badge>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-[56px] font-medium leading-[1.05] tracking-tight text-[var(--foreground)] md:text-[64px]"
          >
            Every number has receipts.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
            className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--muted-foreground)]"
          >
            Orchestra traces every dollar in a construction procurement decision back to its
            evidence — vendor history, pricing precedent, compliance status — before you sign.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
            className="mt-8"
          >
            <Button className="rounded-[6px] bg-[var(--accent)] px-6 py-2.5 text-[14px] font-medium text-white transition-transform duration-150 hover:brightness-105 active:scale-[0.98]">
              Request a walkthrough
            </Button>
          </motion.div>
        </div>

        <div className="relative h-[420px] w-full overflow-hidden rounded-[8px] border border-[var(--muted)] bg-[#141210]">
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
              </div>
            }
          >
            <BeliefGraph3D />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
   Scroll-pinned problem statements
---------------------------------------------------------------------------- */

function ProblemStatements() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  return (
    <section ref={ref} className="relative h-[300vh] w-full bg-[var(--background)]">
      <div className="sticky top-0 flex h-screen w-full items-center justify-center px-8">
        <div className="relative h-64 w-full max-w-3xl">
          {PROBLEM_STATEMENTS.map((p, i) => {
            const segment = 1 / PROBLEM_STATEMENTS.length;
            const start = i * segment;
            const mid = start + segment * 0.5;
            const end = start + segment;
            const opacity = useTransform(
              scrollYProgress,
              [start, start + segment * 0.15, end - segment * 0.15, end],
              [0, 1, 1, 0]
            );
            const y = useTransform(scrollYProgress, [start, mid, end], [16, 0, -16]);
            return (
              <motion.div
                key={p.text}
                style={{ opacity, y }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center"
              >
                <span className="mb-4 text-[12px] font-normal uppercase tracking-wide text-[var(--muted-foreground)]">
                  {p.eyebrow}
                </span>
                <p className="text-[32px] font-medium leading-tight text-[var(--foreground)] md:text-[38px]">
                  {p.text}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
   Scroll-driven X-Ray card assembly
---------------------------------------------------------------------------- */

function XRayReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  const titleOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);
  const titleY = useTransform(scrollYProgress, [0, 0.2], [10, 0]);

  const scoreProgress = useTransform(scrollYProgress, [0.2, 0.55], [0, 1]);
  const [scoreActive, setScoreActive] = useState(false);
  useMotionValueEvent(scoreProgress, 'change', (v) => {
    if (v > 0.05 && !scoreActive) setScoreActive(true);
  });
  const riskScore = useAnimatedNumber(74, scoreActive);

  const traceProgress = useTransform(scrollYProgress, [0.55, 0.95], [0, 1]);
  const traceLength = useTransform(traceProgress, [0, 1], [0, 1]);

  const evidenceLines = [
    'Insurance certificate — expired 43 days prior',
    'Bid variance — 22% above trailing average',
    'Change orders — 3 filed on comparable scope',
  ];

  return (
    <section ref={ref} className="relative h-[280vh] w-full bg-[var(--background)]">
      <div className="sticky top-0 flex h-screen w-full items-center justify-center px-8">
        <Card className="relative w-full max-w-xl rounded-[8px] border border-[var(--muted)] bg-[#FAF5EF] p-8">
          <motion.div style={{ opacity: titleOpacity, y: titleY }}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-[14px] font-medium text-[var(--foreground)]">
                Procurement X-Ray — PO-88213
              </h3>
              <span className="text-[12px] font-normal text-[var(--muted-foreground)]">
                Reviewed just now
              </span>
            </div>
            <p className="mt-1 text-[12px] font-normal text-[var(--muted-foreground)]">
              Steelwork subcontract · Riverside Tower, Phase 2
            </p>
          </motion.div>

          <div className="mt-6 flex items-center gap-4">
            <div className="text-[40px] font-medium tabular-nums text-[var(--danger)]">
              {riskScore}
            </div>
            <div>
              <div className="text-[14px] font-medium text-[var(--foreground)]">Risk score</div>
              <div className="text-[12px] font-normal text-[var(--muted-foreground)]">
                Out of 100 — elevated
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-[var(--muted)] pt-5">
            {evidenceLines.map((line, i) => {
              const segStart = i / evidenceLines.length;
              const segEnd = (i + 1) / evidenceLines.length;
              const lineOpacity = useTransform(traceLength, [segStart, segStart + 0.05], [0, 1]);
              const scaleX = useTransform(traceLength, [segStart, segEnd], [0, 1]);
              return (
                <motion.div key={line} style={{ opacity: lineOpacity }} className="flex items-center gap-3">
                  <div className="relative h-px w-6 overflow-hidden bg-[var(--muted)]">
                    <motion.div
                      style={{ scaleX, originX: 0 }}
                      className="absolute inset-0 bg-[var(--accent)]"
                    />
                  </div>
                  <span className="text-[12px] font-normal text-[var(--muted-foreground)]">{line}</span>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
   Six system cards
---------------------------------------------------------------------------- */

function SystemCard({ system, index }: { system: (typeof SYSTEMS)[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [7, 0, -7]);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: index * 0.08, duration: 0.3, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-[8px] border border-[var(--muted)] p-6 transition-colors duration-150"
      style={{
        rotateX,
        transformPerspective: 900,
        backgroundColor: hovered
          ? 'color-mix(in srgb, var(--muted) 8%, #FAF5EF)'
          : '#FAF5EF',
      }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-[14px] font-medium text-[var(--foreground)]">{system.name}</h4>
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: SEMANTIC_HEX[system.accent] }}
        />
      </div>
      <p className="mt-1 text-[12px] font-normal text-[var(--muted-foreground)]">
        {system.tagline}
      </p>
      <p className="mt-4 text-[13px] font-normal leading-relaxed text-[var(--foreground)]">
        {system.description}
      </p>
    </motion.div>
  );
}

function SystemGrid() {
  return (
    <section className="w-full bg-[var(--background)] px-8 py-24 md:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-lg">
          <span className="text-[12px] font-normal uppercase tracking-wide text-[var(--muted-foreground)]">
            The system
          </span>
          <h2 className="mt-2 text-[32px] font-medium leading-tight text-[var(--foreground)]">
            Six systems, one evidence trail.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SYSTEMS.map((system, i) => (
            <SystemCard key={system.name} system={system} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
   Closing statement, CTA, footer
---------------------------------------------------------------------------- */

function ClosingCTA() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="w-full bg-[var(--background)] px-8 py-32 md:px-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mx-auto max-w-2xl text-center"
      >
        <h2 className="text-[36px] font-medium leading-tight text-[var(--foreground)]">
          Procurement decisions get made in seconds. Make sure they hold up in months.
        </h2>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="form"
                exit={{ opacity: 0 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
                className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
              >
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Work email"
                  className="rounded-[6px] border border-[var(--muted)] bg-transparent px-3 py-2.5 text-[14px]"
                />
                <Button
                  type="submit"
                  className="rounded-[6px] bg-[var(--accent)] px-6 py-2.5 text-[14px] font-medium text-white transition-transform duration-150 hover:brightness-105 active:scale-[0.98]"
                >
                  Request a walkthrough
                </Button>
              </motion.form>
            ) : (
              <motion.p
                key="confirmed"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[14px] font-medium text-[var(--foreground)]"
              >
                Request received. Someone from our team will reach out within a day.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <footer className="mx-auto mt-32 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-[var(--muted)] pt-8 text-[12px] font-normal text-[var(--muted-foreground)] sm:flex-row">
        <span>Orchestra — construction procurement intelligence</span>
        <div className="flex gap-6">
          <a href="#" className="transition-colors duration-150 hover:text-[var(--foreground)]">
            Security
          </a>
          <a href="#" className="transition-colors duration-150 hover:text-[var(--foreground)]">
            Privacy
          </a>
          <a href="#" className="transition-colors duration-150 hover:text-[var(--foreground)]">
            Contact
          </a>
        </div>
      </footer>
    </section>
  );
}

/* ----------------------------------------------------------------------------
   Page
---------------------------------------------------------------------------- */

export default function Page() {
  return (
    <main className="w-full bg-[var(--background)]">
      <Hero />
      <ProblemStatements />
      <XRayReveal />
      <SystemGrid />
      <ClosingCTA />
    </main>
  );
}
