"use client";

/**
 * ORCHESTRA — Receipt Center / Evidence Explorer
 *
 * Single self-contained screen. All screen-specific layout, sub-components,
 * and mock data live inline below. Shared primitives (Button, Card, Badge,
 * Input, cn) are assumed to already exist in the design system.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ClipboardCheck,
  CloudRain,
  FileText,
  Image as ImageIcon,
  Mail,
  PencilRuler,
  Receipt as ReceiptIcon,
  Search,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EvidenceType =
  | "Contract"
  | "Invoice"
  | "Photo"
  | "Video"
  | "Inspection"
  | "Drawing"
  | "Email"
  | "Weather";

type ReliabilityTier = "Verified Transaction" | "Third-Party Observed" | "Self-Reported";

interface EvidenceItem {
  id: string;
  type: EvidenceType;
  description: string;
  reliability: ReliabilityTier;
  timestamp: string;
  source: string;
  uploader: string;
  date: string;
  supports: string;
  linkedDecisions: string[];
}

type FilterTab = "All" | EvidenceType;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const FILTER_TABS: FilterTab[] = [
  "All",
  "Contract",
  "Invoice",
  "Photo",
  "Video",
  "Inspection",
  "Drawing",
  "Email",
  "Weather",
];

const TYPE_ICON: Record<EvidenceType, typeof FileText> = {
  Contract: FileText,
  Invoice: ReceiptIcon,
  Photo: ImageIcon,
  Video: Video,
  Inspection: ClipboardCheck,
  Drawing: PencilRuler,
  Email: Mail,
  Weather: CloudRain,
};

const EVIDENCE: EvidenceItem[] = [
  {
    id: "e1",
    type: "Inspection",
    description: "Rebar spacing inspection — East stair core, level 4",
    reliability: "Third-Party Observed",
    timestamp: "2h ago",
    source: "Turner Inspection Services",
    uploader: "Field team, Site 4",
    date: "Jul 27, 2026",
    supports: "Structural review flag on the east stair core.",
    linkedDecisions: ["Site condition flag — east stair core"],
  },
  {
    id: "e2",
    type: "Invoice",
    description: "Steel Rebar Co. — late delivery invoice, PO #8821",
    reliability: "Verified Transaction",
    timestamp: "5h ago",
    source: "Procurement ledger",
    uploader: "System sync",
    date: "Jul 27, 2026",
    supports: "Trust score decrease for Steel Rebar Co.",
    linkedDecisions: [
      "Supplier trust score dropped sharply — Steel Rebar Co.",
      "Anchor bolt reorder needs approval",
    ],
  },
  {
    id: "e3",
    type: "Photo",
    description: "Spalling on support column B-12",
    reliability: "Self-Reported",
    timestamp: "Yesterday",
    source: "Site foreman upload",
    uploader: "Marcus T.",
    date: "Jul 26, 2026",
    supports: "Structural review flag on the east stair core.",
    linkedDecisions: ["Site condition flag — east stair core"],
  },
  {
    id: "e4",
    type: "Weather",
    description: "Heavy rainfall recorded, Site 4 region",
    reliability: "Third-Party Observed",
    timestamp: "Yesterday",
    source: "NOAA regional feed",
    uploader: "System sync",
    date: "Jul 26, 2026",
    supports: "Delivery delay context for anchor bolt reorder.",
    linkedDecisions: [],
  },
  {
    id: "e5",
    type: "Contract",
    description: "Ferrovial MEP contract, renewal clause 4.2",
    reliability: "Verified Transaction",
    timestamp: "2 days ago",
    source: "Contract repository",
    uploader: "Legal team",
    date: "Jul 25, 2026",
    supports: "MEP contract renewal window closing.",
    linkedDecisions: ["MEP contract renewal window closing"],
  },
  {
    id: "e6",
    type: "Email",
    description: "Vendor correspondence — precast panel lead time",
    reliability: "Self-Reported",
    timestamp: "2 days ago",
    source: "Outlook sync",
    uploader: "Priya N.",
    date: "Jul 25, 2026",
    supports: "Faster supplier available for precast panels.",
    linkedDecisions: ["Faster supplier available for precast panels"],
  },
  {
    id: "e7",
    type: "Drawing",
    description: "Revised structural drawing, east stair core",
    reliability: "Verified Transaction",
    timestamp: "3 days ago",
    source: "Drawing management system",
    uploader: "Structural engineering",
    date: "Jul 24, 2026",
    supports: "Structural review flag on the east stair core.",
    linkedDecisions: ["Site condition flag — east stair core"],
  },
  {
    id: "e8",
    type: "Video",
    description: "Site walkthrough — east stair core condition",
    reliability: "Self-Reported",
    timestamp: "3 days ago",
    source: "Mobile capture",
    uploader: "Field team, Site 4",
    date: "Jul 24, 2026",
    supports: "Structural review flag on the east stair core.",
    linkedDecisions: ["Site condition flag — east stair core"],
  },
  {
    id: "e9",
    type: "Invoice",
    description: "Precast panel supplier quote, alternate vendor",
    reliability: "Verified Transaction",
    timestamp: "4 days ago",
    source: "Procurement ledger",
    uploader: "System sync",
    date: "Jul 23, 2026",
    supports: "Faster supplier available for precast panels.",
    linkedDecisions: ["Faster supplier available for precast panels"],
  },
];

const RELIABILITY_STYLE: Record<ReliabilityTier, string> = {
  "Verified Transaction": "bg-[#4A7A5C]/10 text-[#4A7A5C] border border-[#4A7A5C]/20",
  "Third-Party Observed": "bg-[#4A6A8A]/10 text-[#4A6A8A] border border-[#4A6A8A]/20",
  "Self-Reported": "bg-[#DBC3B3]/40 text-[#AA8D74] border border-[#DBC3B3]",
};

// ---------------------------------------------------------------------------
// Local sub-components
// ---------------------------------------------------------------------------

function ReliabilityBadge({ tier, size = "sm" }: { tier: ReliabilityTier; size?: "sm" | "lg" }) {
  return (
    <Badge
      className={cn(
        "inline-flex shrink-0 items-center rounded-[4px] font-medium",
        RELIABILITY_STYLE[tier],
        size === "sm" ? "px-2 py-0.5 text-[12px]" : "px-2.5 py-1 text-[14px]"
      )}
    >
      {tier}
    </Badge>
  );
}

function FilterTabs({
  active,
  onChange,
}: {
  active: FilterTab;
  onChange: (tab: FilterTab) => void;
}) {
  return (
    <div className="flex gap-5 overflow-x-auto border-b border-[#DBC3B3] px-1">
      {FILTER_TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              "relative shrink-0 whitespace-nowrap py-2.5 text-[13px] font-normal transition-colors duration-[120ms]",
              isActive ? "font-medium text-[#0C0904]" : "text-[#AA8D74] hover:text-[#0C0904]"
            )}
          >
            {tab}
            {isActive && (
              <motion.span
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#AC723E]"
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function EvidenceRow({
  item,
  isSelected,
  onSelect,
  index,
}: {
  item: EvidenceItem;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const Icon = TYPE_ICON[item.type];

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.25, ease: "easeOut" }}
      whileHover={{ x: isSelected ? 0 : 1 }}
      aria-pressed={isSelected}
      className={cn(
        "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors duration-[120ms]",
        isSelected
          ? "border-l-[#AC723E] bg-[#DBC3B3]/[0.10]"
          : "border-l-transparent hover:bg-[#DBC3B3]/[0.08]"
      )}
    >
      <Icon size={16} strokeWidth={2} className="shrink-0 text-[#AA8D74]" />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[14px] leading-snug text-[#0C0904]",
            isSelected ? "font-medium" : "font-normal"
          )}
        >
          {item.description}
        </p>
        <div className="mt-1.5">
          <ReliabilityBadge tier={item.reliability} />
        </div>
      </div>

      <span className="shrink-0 pl-2 text-[12px] font-normal text-[#AA8D74]">{item.timestamp}</span>
    </motion.button>
  );
}

function LinkedDecisionsAccordion({ decisions }: { decisions: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[8px] border border-[#DBC3B3]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={decisions.length === 0}
        className={cn(
          "flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-[120ms]",
          decisions.length > 0 && "hover:bg-[#DBC3B3]/[0.08]"
        )}
      >
        <span className="text-[14px] font-medium text-[#0C0904]">
          Linked decisions
          <span className="ml-2 text-[12px] font-normal text-[#AA8D74]">({decisions.length})</span>
        </span>
        {decisions.length > 0 && (
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} className="text-[#AA8D74]" />
          </motion.span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && decisions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <ul className="border-t border-[#DBC3B3] px-4 py-2">
              {decisions.map((decision) => (
                <li
                  key={decision}
                  className="border-b border-[#DBC3B3] py-2 text-[13px] font-normal text-[#AA8D74] last:border-b-0"
                >
                  <span className="text-[#0C0904]">{decision}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyDetailState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-16 text-center">
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
        <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M14 3v4h4" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </svg>
      <p className="max-w-[220px] text-[14px] font-normal leading-snug text-[#AA8D74]">
        Select a piece of evidence to see its full receipt.
      </p>
    </div>
  );
}

function DetailPanel({ item }: { item: EvidenceItem }) {
  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-full flex-col px-6 py-6"
    >
      <p className="text-[12px] font-normal uppercase tracking-wide text-[#AA8D74]">{item.type}</p>
      <h2 className="mt-1 text-[16px] font-medium leading-snug text-[#0C0904]">{item.description}</h2>

      <div className="mt-4">
        <ReliabilityBadge tier={item.reliability} size="lg" />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4">
        <div>
          <dt className="text-[12px] font-normal text-[#AA8D74]">Source</dt>
          <dd className="mt-1 text-[14px] font-normal text-[#0C0904]">{item.source}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-normal text-[#AA8D74]">Uploaded by</dt>
          <dd className="mt-1 text-[14px] font-normal text-[#0C0904]">{item.uploader}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-normal text-[#AA8D74]">Date</dt>
          <dd className="mt-1 text-[14px] font-normal text-[#0C0904]">{item.date}</dd>
        </div>
      </dl>

      <Card className="mt-6 rounded-[8px] border border-[#DBC3B3] bg-[#F3EDE7] px-4 py-3 shadow-none">
        <p className="text-[12px] font-normal text-[#AA8D74]">Supports</p>
        <p className="mt-1 text-[14px] font-normal leading-snug text-[#0C0904]">{item.supports}</p>
      </Card>

      <div className="mt-4">
        <LinkedDecisionsAccordion decisions={item.linkedDecisions} />
      </div>

      <div className="mt-auto flex gap-2 pt-6">
        <Button
          variant="outline"
          size="sm"
          className="rounded-[6px] border-[#DBC3B3] text-[14px] font-medium text-[#0C0904] hover:bg-[#AC723E] hover:text-[#F3EDE7]"
        >
          Open original source
        </Button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ReceiptCenterScreen() {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(EVIDENCE[1].id);

  const filtered = useMemo(() => {
    return EVIDENCE.filter((item) => {
      const matchesTab = activeTab === "All" || item.type === activeTab;
      const matchesQuery =
        query.trim().length === 0 ||
        item.description.toLowerCase().includes(query.trim().toLowerCase()) ||
        item.source.toLowerCase().includes(query.trim().toLowerCase());
      return matchesTab && matchesQuery;
    });
  }, [activeTab, query]);

  const selectedItem = useMemo(
    () => EVIDENCE.find((item) => item.id === selectedId) ?? null,
    [selectedId]
  );

  return (
    <div className="flex h-screen w-full flex-col bg-[#F3EDE7]">
      <header className="border-b border-[#DBC3B3] px-8 py-6">
        <h1 className="text-[24px] font-medium leading-tight text-[#0C0904]">Receipt Center</h1>
        <p className="mt-1 text-[14px] font-normal text-[#AA8D74]">
          Every number ORCHESTRA shows traces back to real evidence. Explore the trail here.
        </p>
      </header>

      <div className="grid flex-1 grid-cols-[11fr_9fr] overflow-hidden">
        {/* Left pane — evidence list */}
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex flex-col gap-3 px-6 pt-5">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#AA8D74]"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search evidence by description or source…"
                className="h-9 rounded-[6px] border-[#DBC3B3] bg-[#F3EDE7] pl-9 text-[14px] text-[#0C0904] placeholder:text-[#AA8D74]"
              />
            </div>
            <FilterTabs active={activeTab} onChange={setActiveTab} />
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
                <Search size={36} strokeWidth={1.5} className="text-[#AA8D74]" />
                <p className="text-[14px] font-normal text-[#AA8D74]">
                  No evidence matches this search.
                </p>
              </div>
            ) : (
              filtered.map((item, index) => (
                <EvidenceRow
                  key={item.id}
                  item={item}
                  index={index}
                  isSelected={item.id === selectedId}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right pane — evidence detail. Distinct warm tint + left border make the
            boundary structural, not implied by whitespace. */}
        <div className="h-full overflow-y-auto border-l border-[#DBC3B3] bg-[#DBC3B3]/[0.15]">
          <AnimatePresence mode="wait">
            {selectedItem ? (
              <DetailPanel key={selectedItem.id} item={selectedItem} />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <EmptyDetailState />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
