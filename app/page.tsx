'use client';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from 'react';
import Link from 'next/link';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PublicNavbar } from '@/components/public-navbar';
import { ScrollFramesAnimation } from '@/components/scroll-frames-animation';
import { Sparkles, ArrowRight, ShieldCheck, Activity, Award, BarChart3, Database } from 'lucide-react';

/* ============================================================================
   ORCHESTRA — Landing Page (Glassmorphic Neo-Industrial Cyber Revamp)
   Colors: Black (#000000) · Violet (#7D39EB) · Lime (#C6FF33) · White (#FFFFFF)
   ============================================================================ */

const STATS = [
  { value: '98.4%', label: 'AI confidence accuracy' },
  { value: '$12.4M', label: 'Audited contract value' },
  { value: '0', label: 'COI gaps missed' },
  { value: '< 2.4s', label: 'Ingestion parsing time' },
];

const SIGNATURE_FEATURES = [
  {
    title: 'Continuous Ingestion',
    description: 'Auto-extracts compliance documents, subcontractor COIs, and invoices directly from raw mail streams and portals.',
    icon: Database,
  },
  {
    title: '3-Node Reason Trace',
    description: 'Every recommendation is linked to a visual trace: Recommendation → Confidence → Underlying Evidence.',
    icon: Sparkles,
  },
  {
    title: 'Autonomous Compliance Alerts',
    description: 'Never miss an expired license or COI umbrella gap again. Orchestra audits registries live.',
    icon: ShieldCheck,
  },
  {
    title: 'Smart Price Benchmarking',
    description: 'Compares itemized contractor lines against historical bid sheets and regional indexes instantly.',
    icon: BarChart3,
  },
  {
    title: 'Instant Evidence Receipts',
    description: 'Unfold evidence down to weather archives, GPS logs, and subcontracts with one click.',
    icon: Activity,
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
      'Confirms subcontractor licensing, insurance, and lien status against source registries, not last quarter’s PDF.',
    accent: 'success' as const,
  },
  {
    name: 'Compass',
    tagline: 'Pricing benchmarked',
    description:
      'Checks every quote against your own historical bid data to surface inflated line items before signature.',
    accent: 'ai' as const,
  },
];

const TICKER_ITEMS = [
  "Verified: ABC Steel umbrella COI updated (expiring 2027) · Confidence 99%",
  "Flagged: Switchgear Q3 invoice is 18% above regional mean cost index · Confidence 96%",
  "Audit Log: Site 4 crane stand-down weather correlation verified · Confidence 98%",
  "Verified: Ferrovial MEP license registration current · Confidence 99%",
  "Dispute: ABC Steel delivery penalty clause applied · Confidence 91%",
];

// @ts-ignore
const BeliefGraph3D = React.lazy(async () => {
  // @ts-ignore
  const [{ Canvas, useFrame }] = await Promise.all([
    // @ts-ignore
    import('@react-three/fiber'),
    // @ts-ignore
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
              <lineBasicMaterial color="#7D39EB" transparent opacity={0.6} />
            </line>
          );
        })}
        {nodes.map((pos, i) => (
          <mesh key={`node-${i}`} position={pos}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshBasicMaterial color="#C6FF33" />
          </mesh>
        ))}
      </group>
    );
  }

  function Scene() {
    return (
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.8} />
        <Graph />
      </Canvas>
    );
  }

  return { default: Scene };
});

const revealVariants = {
  initial: {
    opacity: 0,
    rotateX: 8,
    z: -100,
    y: 40,
  },
  whileInView: {
    opacity: 1,
    rotateX: 0,
    z: 0,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as any,
    },
  },
};

export default function LandingPage() {
  return (
    <main className="w-full bg-[#08070C] text-white">
      {/* Fixed mesh glows */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="bg-mesh-glow-1 top-[-10%] left-[-15%]" />
        <div className="bg-mesh-glow-2 bottom-[30%] right-[-10%]" />
      </div>

      {/* Sticky Public Navbar */}
      <PublicNavbar />

      {/* ── SECTION 1: Frame sequence — locks page scroll until last frame ── */}
      <ScrollFramesAnimation />

      {/* All sections below only become scrollable after frames complete */}
      <div className="relative z-10">

      {/* 2. Stats Band Section */}
      <motion.section
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, margin: "-100px" }}
        variants={revealVariants}
        className="w-full border-y border-white/8 py-16 px-8 relative z-10"
        style={{ background: "rgba(255, 255, 255, 0.01)", backdropFilter: "blur(20px)", transformStyle: "preserve-3d" }}
      >
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-8 md:grid-cols-4 text-center">
          {STATS.map((stat) => (
            <div key={stat.label} className="space-y-1">
              <div className="text-[38px] font-black font-mono leading-none tracking-tight text-[#C6FF33] drop-shadow-[0_0_12px_rgba(198,255,51,0.25)]">
                {stat.value}
              </div>
              <div className="text-[11.5px] font-bold uppercase tracking-wider text-white/50">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 3. Five Signature Features */}
      <motion.section
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, margin: "-100px" }}
        variants={revealVariants}
        className="w-full py-24 px-8 max-w-7xl mx-auto relative z-10"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="mb-12 max-w-xl">
          <Badge className="bg-[#7D39EB]/20 text-[#C6FF33] border-[#7D39EB]/35 py-1 px-3 rounded-[6px]">Signature Capabilities</Badge>
          <h2 className="mt-4 text-[32px] font-bold tracking-tight text-white">
            Designed for heavy infrastructure compliance.
          </h2>
          <p className="mt-2 text-[14.5px] text-white/60">
            Subcontracts carry hidden risk. Orchestra continuously monitors, traces, and confirms compliance automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {SIGNATURE_FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="p-6 border glass-panel glass-hover flex flex-col justify-between"
                style={{ background: "rgba(255, 255, 255, 0.02)", borderColor: "rgba(255, 255, 255, 0.06)" }}>
                <div>
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center mb-4 bg-[#7D39EB]/15 text-[#C6FF33] border border-[#7D39EB]/30">
                    <Icon size={20} />
                  </div>
                  <h4 className="text-[16px] font-bold text-white">{feat.title}</h4>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-white/50">
                    {feat.description}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-[#C6FF33] text-[12.5px] font-bold group pointer-events-none">
                  <span>Explore trace</span>
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-[3px]" />
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* 4. One Brain, Six Systems Section */}
      <motion.section
        id="systems"
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, margin: "-100px" }}
        variants={revealVariants}
        className="w-full py-24 px-8 border-t border-white/8 relative z-10"
        style={{ background: "rgba(125, 57, 235, 0.01)", transformStyle: "preserve-3d" }}
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-5">
            <Badge className="bg-white/5 text-white/70 border-white/10 rounded-[6px]">AI Knowledge Base</Badge>
            <h2 className="mt-4 text-[32px] font-bold tracking-tight text-white">
              One brain, six specialized systems.
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-white/60">
              Every system feeds the same unified knowledge base. Hover over any node in the live 3D graph to trace data relations across modules.
            </p>

            <div className="mt-8 space-y-4">
              {SYSTEMS.map((sys) => (
                <div key={sys.name} className="border-l-2 pl-4 border-[#7D39EB]">
                  <h4 className="text-[15px] font-bold text-white">{sys.name}</h4>
                  <p className="text-[12.5px] text-white/50">{sys.tagline}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-7 h-[450px] w-full overflow-hidden rounded-[16px] border border-white/8 bg-black/40 relative shadow-2xl backdrop-blur-md">
            <Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-[#C6FF33]" />
                </div>
              }
            >
              <BeliefGraph3D />
            </Suspense>
          </div>
        </div>
      </motion.section>

      {/* 5. Live Receipts Ticker */}
      <section className="w-full py-10 bg-black/40 border-y border-white/8 overflow-hidden flex items-center relative z-10">
        <div className="flex whitespace-nowrap gap-8 animate-marquee font-mono text-[12px] text-white/50">
          {TICKER_ITEMS.concat(TICKER_ITEMS).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C6FF33] drop-shadow-[0_0_6px_#C6FF33]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Closing CTA Section with Dark/Inverted Surface */}
      <motion.section
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, margin: "-100px" }}
        variants={revealVariants}
        className="w-full bg-[#08070C] text-white px-8 py-32 md:px-16 relative z-10"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[36px] font-bold leading-tight tracking-tight text-white md:text-[44px]">
            Procure with absolute audit safety.
          </h2>
          <p className="mt-4 text-white/50 text-[15px] max-w-md mx-auto">
            Audit subcontractor bids in seconds. Run a pilot quote package on the X-Ray scanner today.
          </p>

          <div className="mt-8 flex justify-center gap-3">
            <Button asChild className="rounded-[8px] btn-lime border-0 px-8 py-6 text-sm font-bold">
              <Link href="/dashboard">Launch Dashboard</Link>
            </Button>
          </div>
        </div>

        <footer className="mx-auto mt-32 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-[12px] font-normal text-white/50 sm:flex-row">
          <span>Orchestra — construction procurement intelligence</span>
          <div className="flex gap-6">
            <Link href="/xray" className="transition-colors duration-150 hover:text-[#C6FF33]">
              X-Ray
            </Link>
            <Link href="/vendor/v1" className="transition-colors duration-150 hover:text-[#C6FF33]">
              Trustline
            </Link>
            <Link href="/evidence" className="transition-colors duration-150 hover:text-[#C6FF33]">
              Evidence
            </Link>
          </div>
        </footer>
      </motion.section>
      </div>{/* end sections wrapper */}
    </main>
  );
}
