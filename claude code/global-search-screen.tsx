"use client";

/**
 * ORCHESTRA — Global Search
 *
 * Single self-contained screen/component. All layout, sub-components, and
 * mock data live inline below. Shared primitives (Button, Card, Badge,
 * Input, cn) are assumed to already exist in the design system.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Search, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResultCategory = "Vendors" | "Decisions" | "Evidence";
type SearchStatus = "idle" | "loading" | "results" | "empty";

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
}

interface ResultGroup {
  category: ResultCategory;
  items: SearchResult[];
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

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
      },
      {
        id: "v2",
        title: "Steel Rebar Co.",
        snippet: "Trust score 42, down 18 points in the last 72 hours.",
      },
      {
        id: "v3",
        title: "Ferrovial MEP",
        snippet: "Chiller unit shipment delayed 9 days against the original PO date.",
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
      },
      {
        id: "d2",
        title: "Chiller delivery delay — Ferrovial MEP",
        snippet: "Chiller unit now 9 days behind schedule, mechanical rough-in at risk.",
      },
      {
        id: "d3",
        title: "MEP contract renewal window closing",
        snippet: "Ferrovial MEP contract expires in 9 days — no response logged yet.",
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
      },
      {
        id: "e2",
        title: "Dispute filing — ABC Steel, case #2291",
        snippet: "Formal dispute opened over late chiller delivery penalty clause.",
      },
      {
        id: "e3",
        title: "Inspection report — Site 4",
        snippet: "Two missed inspection windows logged against Steel Rebar Co.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.trim().toLowerCase() ? (
      <span key={i} className="font-medium text-[#AC723E]">
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

// ---------------------------------------------------------------------------
// Local sub-components
// ---------------------------------------------------------------------------

function SearchPill({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-9 w-full max-w-[360px] items-center gap-2 rounded-[6px] border border-[#DBC3B3] bg-[#F3EDE7] px-3 text-left transition-colors duration-150 hover:border-[#AA8D74]"
    >
      <Search size={14} className="shrink-0 text-[#AA8D74]" />
      <span className="flex-1 truncate text-[14px] font-normal text-[#AA8D74]">
        Ask ORCHESTRA anything...
      </span>
      <kbd className="shrink-0 rounded-[4px] border border-[#DBC3B3] bg-[#DBC3B3]/20 px-1.5 py-0.5 text-[11px] font-medium text-[#AA8D74]">
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
          key={prompt}
          type="button"
          whileHover={{ y: -1 }}
          transition={{ duration: 0.12 }}
          onClick={() => onPick(prompt)}
          className="rounded-[4px] border border-[#DBC3B3] bg-[#F3EDE7] px-3 py-1.5 text-[13px] font-normal text-[#0C0904] transition-colors duration-150 hover:bg-[#DBC3B3]/[0.10]"
        >
          {prompt}
        </motion.button>
      ))}
    </div>
  );
}

function ResultRow({ item, query, index }: { item: SearchResult; query: string; index: number }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25, ease: "easeOut" }}
      whileHover={{ x: 1 }}
      className="flex w-full flex-col items-start gap-1 rounded-[6px] px-3 py-2.5 text-left transition-colors duration-[120ms] hover:bg-[#DBC3B3]/[0.08]"
    >
      <span className="text-[14px] font-medium leading-snug text-[#0C0904]">{item.title}</span>
      <span className="text-[12px] font-normal leading-snug text-[#AA8D74]">
        {highlightMatch(item.snippet, query)}
      </span>
    </motion.button>
  );
}

function EmptyResultsState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <Search size={36} strokeWidth={1.5} className="text-[#AA8D74]" />
      <p className="max-w-[320px] text-[14px] font-normal leading-snug text-[#AA8D74]">
        Nothing matches yet — try rephrasing, or ask a broader question.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded panel
// ---------------------------------------------------------------------------

function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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
    }, 550);
    return () => clearTimeout(timeout);
  }, [query]);

  const totalResults = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.length, 0),
    [groups]
  );

  return (
    <>
      {/*
        DELIBERATE EXCEPTION: every other panel in ORCHESTRA (side panels,
        detail panes, accordions) coexists with the page behind it and never
        dims the background. Global Search is the one genuinely temporary,
        modal overlay in the product, so a soft dim + blur behind it is
        intentional here and nowhere else.
      */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[#0C0904]/25 backdrop-blur-sm"
        aria-hidden="true"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed left-1/2 top-24 z-50 w-full max-w-[560px] -translate-x-1/2 px-4"
      >
        <Card className="max-h-[70vh] overflow-hidden rounded-[8px] border border-[#DBC3B3] bg-[#F3EDE7] p-0 shadow-lg">
          <div className="flex items-center gap-2 border-b border-[#DBC3B3] px-4 py-3">
            <Search size={16} className="shrink-0 text-[#AA8D74]" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask ORCHESTRA anything..."
              className="h-auto flex-1 border-0 bg-transparent p-0 text-[16px] text-[#0C0904] shadow-none placeholder:text-[#AA8D74] focus-visible:ring-0"
            />
            <kbd className="shrink-0 rounded-[4px] border border-[#DBC3B3] bg-[#DBC3B3]/20 px-1.5 py-0.5 text-[11px] font-medium text-[#AA8D74]">
              esc
            </kbd>
          </div>

          <div className="max-h-[calc(70vh-56px)] overflow-y-auto px-2 py-3">
            {status === "idle" && (
              <div className="px-2 py-2">
                <p className="mb-2 px-1 text-[12px] font-normal uppercase tracking-wide text-[#AA8D74]">
                  Try asking
                </p>
                <SuggestionPills onPick={setQuery} />
              </div>
            )}

            {status === "loading" && (
              <div className="px-3 py-6">
                <p className="text-[13px] font-normal text-[#AA8D74]">
                  Searching evidence and decisions...
                </p>
              </div>
            )}

            {status === "empty" && (
              <div>
                <EmptyResultsState />
                <div className="border-t border-[#DBC3B3] px-4 py-4">
                  <p className="mb-2 text-[12px] font-normal uppercase tracking-wide text-[#AA8D74]">
                    Try asking
                  </p>
                  <SuggestionPills onPick={setQuery} />
                </div>
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
                          <Icon size={12} className="text-[#AA8D74]" />
                          <p className="text-[12px] font-normal uppercase tracking-wide text-[#AA8D74]">
                            {group.category}
                          </p>
                        </div>
                        <div className="flex flex-col">
                          {group.items.map((item, index) => (
                            <ResultRow key={item.id} item={item} query={query} index={index} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {status === "results" && (
            <div className="border-t border-[#DBC3B3] px-4 py-2">
              <Badge className="rounded-[4px] border border-[#DBC3B3] bg-transparent px-1.5 py-0 text-[12px] font-normal text-[#AA8D74]">
                {totalResults} {totalResults === 1 ? "result" : "results"}
              </Badge>
            </div>
          )}
        </Card>
      </motion.div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function GlobalSearchScreen() {
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
    <div className="flex h-screen w-full flex-col bg-[#F3EDE7]">
      <header className="flex h-16 shrink-0 items-center gap-6 border-b border-[#DBC3B3] px-6">
        <span className="text-[16px] font-bold tracking-tight text-[#0C0904]">ORCHESTRA</span>
        <SearchPill onOpen={() => setIsOpen(true)} />
        <div className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#AC723E] text-[12px] font-medium text-[#F3EDE7]">
          MT
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[14px] font-normal text-[#AA8D74]">
            Press <span className="font-medium text-[#0C0904]">⌘K</span> or click the search bar
            above to ask ORCHESTRA anything.
          </p>
        </div>
      </main>

      <AnimatePresence>{isOpen && <SearchPanel onClose={() => setIsOpen(false)} />}</AnimatePresence>
    </div>
  );
}
