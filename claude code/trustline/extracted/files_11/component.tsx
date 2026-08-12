import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Centralized demo data — shared across every Trustline screen
// ---------------------------------------------------------------------------

type FilingType = "ucc_filing" | "mechanics_lien" | "judgment";

interface Filing {
  id: string;
  vendorId: string;
  type: FilingType;
  date: string; // ISO
  amount: number;
  description: string;
}

interface Vendor {
  id: string;
  name: string;
  trade: string;
  location: string;
  trustToday: number;
  trustTrajectory: { year: string; value: number }[];
}

const VENDORS: Record<string, Vendor> = {
  vendor_meridian_steel: {
    id: "vendor_meridian_steel",
    name: "Meridian Steel Fabrication",
    trade: "Structural Steel",
    location: "Houston, TX",
    trustToday: 76,
    trustTrajectory: [
      { year: "2023", value: 68 },
      { year: "2024", value: 74 },
      { year: "2025", value: 82 },
      { year: "Today", value: 76 },
    ],
  },
  vendor_titan_fab: {
    id: "vendor_titan_fab",
    name: "Titan Fabricators",
    trade: "Structural Steel",
    location: "Houston, TX",
    trustToday: 88,
    trustTrajectory: [
      { year: "2023", value: 85 },
      { year: "2024", value: 86 },
      { year: "2025", value: 87 },
      { year: "Today", value: 88 },
    ],
  },
  vendor_coastal_bolt: {
    id: "vendor_coastal_bolt",
    name: "Coastal Bolt & Fastener",
    trade: "Fasteners & Hardware",
    location: "Corpus Christi, TX",
    trustToday: 54,
    trustTrajectory: [
      { year: "2023", value: 71 },
      { year: "2024", value: 66 },
      { year: "2025", value: 60 },
      { year: "Today", value: 54 },
    ],
  },
};

// Same filings the Python side seeds — kept identical so the two agree.
const FILINGS: Filing[] = [
  {
    id: "filing_meridian_ucc_1",
    vendorId: "vendor_meridian_steel",
    type: "ucc_filing",
    date: "2026-06-20",
    amount: 150000,
    description: "UCC-1 financing statement filed against equipment",
  },
  {
    id: "filing_coastal_ucc_1",
    vendorId: "vendor_coastal_bolt",
    type: "ucc_filing",
    date: "2026-01-10",
    amount: 210000,
    description: "UCC-1 financing statement — inventory & receivables",
  },
  {
    id: "filing_coastal_lien_1",
    vendorId: "vendor_coastal_bolt",
    type: "mechanics_lien",
    date: "2026-06-15",
    amount: 95000,
    description: "Mechanic's lien filed by subcontractor for unpaid work",
  },
  {
    id: "filing_coastal_ucc_2",
    vendorId: "vendor_coastal_bolt",
    type: "ucc_filing",
    date: "2026-07-20",
    amount: 130000,
    description: "UCC-1 financing statement — accounts receivable",
  },
];

const FILING_TYPE_LABEL: Record<FilingType, string> = {
  ucc_filing: "UCC Filing",
  mechanics_lien: "Mechanic's Lien",
  judgment: "Judgment",
};

const FILING_TYPE_COLOR: Record<FilingType, string> = {
  ucc_filing: "var(--warning)",
  mechanics_lien: "var(--danger)",
  judgment: "var(--info)",
};

type RiskLevel = "low" | "medium" | "high" | "critical";

const RISK_ZONES: { level: RiskLevel; label: string; color: string; sweepPct: number }[] = [
  { level: "low", label: "Low", color: "var(--success)", sweepPct: 25 },
  { level: "medium", label: "Medium", color: "var(--warning)", sweepPct: 50 },
  { level: "high", label: "High", color: "var(--danger)", sweepPct: 75 },
  { level: "critical", label: "Critical", color: "var(--danger)", sweepPct: 100 },
];

function computeRisk(vendorId: string) {
  const filings = FILINGS.filter((f) => f.vendorId === vendorId);
  const now = new Date("2026-08-11T00:00:00");
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentCount = filings.filter((f) => new Date(f.date + "T00:00:00") >= sixMonthsAgo).length;

  let level: RiskLevel = "low";
  if (recentCount >= 3) level = "critical";
  else if (recentCount >= 2) level = "high";
  else if (recentCount >= 1 || filings.length >= 2) level = "medium";

  const totalExposure = filings.reduce((sum, f) => sum + f.amount, 0);

  return {
    filings: [...filings].sort((a, b) => a.date.localeCompare(b.date)),
    activeFilingsCount: filings.length,
    totalExposure,
    riskLevel: level,
  };
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function NeumorphicCard({
  className,
  glass = false,
  children,
}: {
  className?: string;
  glass?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] p-5 relative overflow-hidden",
        glass ? "border border-white/40" : "border border-[var(--muted)]/40",
        className
      )}
      style={
        glass
          ? {
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow:
                "0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
            }
          : {
              background: "var(--surface-card)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
            }
      }
    >
      {children}
    </div>
  );
}

function AnimatedCount({
  value,
  formatter,
}: {
  value: number;
  formatter: (v: number) => string;
}) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 90, damping: 22, mass: 0.7 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [spring]);

  return <span>{formatter(display)}</span>;
}

// ---------------------------------------------------------------------------
// Hero: filing timeline (glass card)
// ---------------------------------------------------------------------------

function FilingTimeline({ filings, vendorName }: { filings: Filing[]; vendorName: string }) {
  const start = new Date("2026-01-01T00:00:00").getTime();
  const end = new Date("2026-08-11T00:00:00").getTime();
  const span = end - start;

  const posPct = (iso: string) => {
    const t = new Date(iso + "T00:00:00").getTime();
    return Math.min(96, Math.max(4, ((t - start) / span) * 100));
  };

  return (
    <NeumorphicCard glass className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-[15px] font-bold text-[var(--foreground)]">
            Filing Timeline
          </h3>
          <p className="text-[12px] text-[var(--muted-foreground)]">{vendorName}</p>
        </div>
        <Badge
          className="bg-[#F87171]/10 text-[#F87171] border border-[#F87171]/20 text-[11px]"
        >
          {filings.length} record{filings.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="flex-1 relative mt-6 mb-4">
        {/* Axis line */}
        <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-[var(--muted)]/70 rounded-full" />

        <span className="absolute top-[calc(50%-30px)] left-0 text-[10px] text-[var(--muted-foreground)]">
          Jan 2026
        </span>
        <span className="absolute top-[calc(50%-30px)] right-0 text-[10px] text-[var(--muted-foreground)]">
          Today
        </span>

        {filings.map((f, i) => {
          const left = posPct(f.date);
          const above = i % 2 === 0;
          return (
            <motion.div
              key={f.id}
              className="absolute flex flex-col items-center"
              style={{ left: `${left}%`, top: "50%", transform: "translate(-50%, -50%)" }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.35, duration: 0.4, ease: "backOut" }}
            >
              {above && (
                <div className="mb-2 flex flex-col items-center -translate-y-full whitespace-nowrap">
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      color: FILING_TYPE_COLOR[f.type],
                      background: `color-mix(in srgb, ${FILING_TYPE_COLOR[f.type]} 12%, transparent)`,
                    }}
                  >
                    {FILING_TYPE_LABEL[f.type]}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                    {new Date(f.date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · ${(f.amount / 1000).toFixed(0)}k
                  </span>
                </div>
              )}
              <span
                className="block w-3 h-3 rounded-full"
                style={{
                  background: FILING_TYPE_COLOR[f.type],
                  boxShadow: `0 0 0 3px var(--surface-floating)`,
                }}
              />
              {!above && (
                <div className="mt-2 flex flex-col items-center whitespace-nowrap">
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      color: FILING_TYPE_COLOR[f.type],
                      background: `color-mix(in srgb, ${FILING_TYPE_COLOR[f.type]} 12%, transparent)`,
                    }}
                  >
                    {FILING_TYPE_LABEL[f.type]}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                    {new Date(f.date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · ${(f.amount / 1000).toFixed(0)}k
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </NeumorphicCard>
  );
}

// ---------------------------------------------------------------------------
// Risk gauge
// ---------------------------------------------------------------------------

function RiskGauge({ level }: { level: RiskLevel }) {
  const zone = RISK_ZONES.find((z) => z.level === level)!;
  const radius = 60;
  const circumference = Math.PI * radius; // semicircle arc length
  const progress = useMotionValue(0);
  const spring = useSpring(progress, { stiffness: 60, damping: 18 });
  const [dashOffset, setDashOffset] = useState(circumference);

  useEffect(() => {
    progress.set(zone.sweepPct / 100);
  }, [zone.sweepPct, progress]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      setDashOffset(circumference - v * circumference);
    });
    return () => unsub();
  }, [spring, circumference]);

  return (
    <NeumorphicCard className="h-full flex flex-col items-center justify-center">
      <span className="text-[12px] font-medium text-[var(--muted-foreground)] self-start mb-1">
        Risk Level
      </span>
      <svg viewBox="0 0 140 80" className="w-full max-w-[160px]">
        <path
          d="M 10 70 A 60 60 0 0 1 130 70"
          fill="none"
          stroke="var(--muted)"
          strokeOpacity={0.5}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <motion.path
          d="M 10 70 A 60 60 0 0 1 130 70"
          fill="none"
          stroke={zone.color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div className="flex flex-col items-center -mt-2">
        <span className="text-xl font-bold" style={{ color: zone.color }}>
          {zone.label}
        </span>
        <span className="text-[11px] text-[var(--muted-foreground)]">
          based on filing recency
        </span>
      </div>
    </NeumorphicCard>
  );
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

function ActiveFilingsCard({ count }: { count: number }) {
  return (
    <NeumorphicCard className="h-full flex flex-col justify-between">
      <span className="text-[12px] font-medium text-[var(--muted-foreground)]">
        Active Filings
      </span>
      <span className="text-4xl font-bold text-[var(--foreground)] tabular-nums mt-2">
        <AnimatedCount value={count} formatter={(v) => Math.round(v).toString()} />
      </span>
      <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
        UCC, liens, and judgments on record
      </span>
    </NeumorphicCard>
  );
}

function TotalExposureCard({ amount }: { amount: number }) {
  return (
    <NeumorphicCard className="h-full flex flex-col justify-between">
      <span className="text-[12px] font-medium text-[var(--muted-foreground)]">
        Total Exposure
      </span>
      <span className="text-4xl font-bold text-[var(--danger)] tabular-nums mt-2">
        <AnimatedCount value={amount} formatter={(v) => `$${Math.round(v).toLocaleString("en-US")}`} />
      </span>
      <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
        Sum across flagged filings
      </span>
    </NeumorphicCard>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function FinancialDistressWatch() {
  const vendor = VENDORS.vendor_coastal_bolt;
  const { filings, activeFilingsCount, totalExposure, riskLevel } = useMemo(
    () => computeRisk(vendor.id),
    [vendor.id]
  );

  return (
    <div
      className="w-full"
      style={{
        // @ts-expect-error CSS custom properties
        "--background": "#08070C",
        "--foreground": "#FFFFFF",
        "--muted": "rgba(255, 255, 255, 0.08)",
        "--muted-foreground": "rgba(255, 255, 255, 0.45)",
        "--accent": "#7D39EB",
        "--surface-card": "rgba(255, 255, 255, 0.02)",
        "--surface-floating": "rgba(255, 255, 255, 0.04)",
        "--success": "#C6FF33",
        "--warning": "#FBBF24",
        "--danger": "#F87171",
        "--info": "#38BDF8",
        "--ai": "#7D39EB",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">
            Financial Distress Watch
          </h1>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
            Trustline · {vendor.name} · {vendor.trade} · {vendor.location}
          </p>
        </div>

        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 auto-rows-[150px] gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.1 } },
          }}
        >
          <motion.div
            className="col-span-2 row-span-2"
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.4 }}
          >
            <FilingTimeline filings={filings} vendorName={vendor.name} />
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.4 }}
          >
            <RiskGauge level={riskLevel} />
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.4 }}
          >
            <ActiveFilingsCard count={activeFilingsCount} />
          </motion.div>

          <motion.div
            className="col-span-2"
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.4 }}
          >
            <TotalExposureCard amount={totalExposure} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
