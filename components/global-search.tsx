"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Search, ShieldCheck, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ResultCategory = "Vendors" | "Decisions" | "Evidence";
type SearchStatus = "idle" | "loading" | "results" | "empty";

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  href: string;
}

interface ResultGroup {
  category: ResultCategory;
  items: SearchResult[];
}

const EXAMPLE_PROMPTS: string[] = [
  "Why hasn't the chiller shipped?",
  "Show every dispute with ABC Steel",
  "What's our trust score for Steel Rebar Co.?",
  "Which contracts expire this month?",
];

const CATEGORY_ICON: Record<ResultCategory, typeof Truck> = {
  Vendors: Truck,
  Decisions: AlertCircle,
  Evidence: ShieldCheck,
};

const SEARCH_INDEX: ResultGroup[] = [
  {
    category: "Vendors",
    items: [
      {
        id: "v1",
        title: "ABC Steel",
        snippet: "3 open disputes on record — 2 related to late chiller delivery, 1 billing.",
        href: "/vendor/v1",
      },
      {
        id: "v2",
        title: "Steel Rebar Co.",
        snippet: "Trust score 42, down 18 points in the last 72 hours.",
        href: "/vendor/v2",
      },
      {
        id: "v3",
        title: "Ferrovial MEP",
        snippet: "Chiller unit shipment delayed 9 days against the original PO date.",
        href: "/vendor/v3",
      },
    ],
  },
  {
    category: "Decisions",
    items: [
      {
        id: "d1",
        title: "Supplier trust score dropped sharply — Steel Rebar Co.",
        snippet: "Two missed inspection reports drove the trust score down this week.",
        href: "/vendor/v2",
      },
      {
        id: "d2",
        title: "Chiller delivery delay — Ferrovial MEP",
        snippet: "Chiller unit now 9 days behind schedule, mechanical rough-in at risk.",
        href: "/xray",
      },
      {
        id: "d3",
        title: "MEP contract renewal window closing",
        snippet: "Ferrovial MEP contract expires in 9 days — no response logged yet.",
        href: "/vendor/v3",
      },
    ],
  },
  {
    category: "Evidence",
    items: [
      {
        id: "e1",
        title: "Shipping manifest — chiller unit CH-40",
        snippet: "Manifest shows chiller departed origin warehouse 6 days late.",
        href: "/evidence",
      },
      {
        id: "e2",
        title: "Dispute filing — ABC Steel, case #2291",
        snippet: "Formal dispute opened over late chiller delivery penalty clause.",
        href: "/evidence",
      },
      {
        id: "e3",
        title: "Inspection report — Site 4",
        snippet: "Two missed inspection windows logged against Steel Rebar Co.",
        href: "/evidence",
      },
    ],
  },
];

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.trim().toLowerCase() ? (
      <span key={i} className="font-bold text-[#C6FF33] drop-shadow-[0_0_8px_rgba(198,255,51,0.4)]">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function filterIndex(query: string): ResultGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_INDEX.map((group) => ({
    category: group.category,
    items: group.items.filter(
      (item) => item.title.toLowerCase().includes(q) || item.snippet.toLowerCase().includes(q)
    ),
  })).filter((group) => group.items.length > 0);
}

export function SearchPill({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex h-9 w-full max-w-[380px] items-center gap-2 rounded-lg border px-3 text-left transition-all duration-150 bg-white/3 border-white/8 hover:bg-white/6 hover:border-[#7D39EB]/40 focus:outline-none focus:ring-1 focus:ring-[#7D39EB]"
    >
      <Search size={14} className="shrink-0 transition-transform duration-150 group-hover:translate-x-[2px] text-white/50" />
      <span className="flex-1 truncate text-[14px] font-normal text-white/50">
        Ask ORCHESTRA anything...
      </span>
      <kbd className="shrink-0 rounded border px-1.5 py-0.5 text-[10.5px] font-medium bg-white/5 border-white/10 text-white/50">
        ⌘K
      </kbd>
    </button>
  );
}

function SuggestionPills({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {EXAMPLE_PROMPTS.map((prompt) => (
        <motion.button
          key={prompt} type="button"
          whileHover={{ y: -1 }} transition={{ duration: 0.12 }}
          onClick={() => onPick(prompt)}
          className="rounded-lg border px-3 py-1.5 text-[13px] font-normal transition-all duration-150 bg-white/3 border-white/8 text-white/70 hover:bg-[#7D39EB]/15 hover:border-[#7D39EB]/30 hover:text-white"
        >
          {prompt}
        </motion.button>
      ))}
    </div>
  );
}

function ResultRow({
  item,
  query,
  index,
  onSelect,
}: {
  item: SearchResult;
  query: string;
  index: number;
  onSelect: (href: string) => void;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2, ease: "easeOut" }}
      whileHover={{ x: 2 }}
      onClick={() => onSelect(item.href)}
      className="flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left transition-colors duration-[120ms] hover:bg-[#7D39EB]/15 group"
    >
      <span className="text-[14px] font-medium leading-snug text-white group-hover:text-[#C6FF33] transition-colors">{item.title}</span>
      <span className="text-[12px] font-normal leading-snug text-white/60">
        {highlightMatch(item.snippet, query)}
      </span>
    </motion.button>
  );
}

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setStatus("idle");
      setGroups([]);
      return;
    }
    setStatus("loading");
    const timeout = setTimeout(() => {
      const matches = filterIndex(query);
      setGroups(matches);
      setStatus(matches.length > 0 ? "results" : "empty");
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelectResult = (href: string) => {
    onClose();
    router.push(href);
  };

  const totalResults = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.length, 0),
    [groups]
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-45 bg-[#08070C]/80 backdrop-blur-md"
        aria-hidden="true"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="fixed left-1/2 top-24 z-50 w-full max-w-[560px] -translate-x-1/2 px-4"
      >
        <Card className="max-h-[70vh] overflow-hidden rounded-2xl border p-0 glass-panel-elevated"
          style={{ borderColor: "rgba(255, 255, 255, 0.15)", boxShadow: "0 16px 48px rgba(125,57,235,0.25)" }}>
          <div className="flex items-center gap-2 border-b px-4 py-3 border-white/8 bg-white/2">
            <Search size={16} className="shrink-0 text-[#C6FF33]" />
            <Input
              ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask ORCHESTRA anything..."
              className="h-auto flex-1 border-0 bg-transparent p-0 text-[15px] shadow-none focus-visible:ring-0 text-white placeholder-white/40"
            />
            <kbd className="shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium bg-white/5 border-white/10 text-white/50">esc</kbd>
          </div>

          <div className="max-h-[calc(70vh-56px)] overflow-y-auto px-2 py-3 scrollbar-cyber">
            {status === "idle" && (
              <div className="px-2 py-2">
                <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Try asking
                </p>
                <SuggestionPills onPick={setQuery} />
              </div>
            )}
            {status === "loading" && (
              <div className="px-3 py-6">
                <p className="text-[13px] text-white/50">Searching evidence and decisions...</p>
              </div>
            )}
            {status === "empty" && (
              <div className="px-4 py-8 text-center text-[14px] text-white/50">
                No matching records found.
              </div>
            )}
            {status === "results" && (
              <AnimatePresence mode="wait">
                <motion.div key={query} className="flex flex-col gap-4 px-1">
                  {groups.map((group) => {
                    const Icon = CATEGORY_ICON[group.category];
                    return (
                      <div key={group.category}>
                         <div className="mb-1 flex items-center gap-1.5 px-2">
                           <Icon size={13} className="text-[#7D39EB]" />
                           <p className="text-[10.5px] font-bold uppercase tracking-wider text-white/45">
                             {group.category}
                           </p>
                         </div>
                         <div className="flex flex-col">
                           {group.items.map((item, index) => (
                             <ResultRow key={item.id} item={item} query={query} index={index} onSelect={handleSelectResult} />
                           ))}
                         </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </Card>
      </motion.div>
    </>
  );
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setIsOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  return (
    <>
      <SearchPill onOpen={() => setIsOpen(true)} />
      <AnimatePresence>{isOpen && <SearchPanel onClose={() => setIsOpen(false)} />}</AnimatePresence>
    </>
  );
}
