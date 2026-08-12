"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Search, FolderOpen, ChevronDown, ChevronUp,
  Clock, AlertTriangle, CheckCircle2, Scale, Sparkles,
  EyeOff, Eye, Lock, Unlock, SlidersHorizontal, ArrowRight,
  FileText, FileSearch, BarChart2
} from "lucide-react";

/* ── DESIGN SYSTEM TOKENS ─────────────────────────────────
   Match globals.css Cyberpunk Glassmorphic system exactly:
   Canvas: #08070C   Surface: #120E1C   Border: rgba(255,255,255,0.08)
   Ink: #FFFFFF      Accent: #7D39EB    Lime: #C6FF33
   Danger: #F87171   Warning: #FBBF24   Success: #C6FF33  Info: #60A5FA
──────────────────────────────────────────────────────────── */
const CANVAS  = "#08070C";
const SURFACE = "#120E1C";
const BORDER  = "rgba(255, 255, 255, 0.08)";
const BORDER_MID = "rgba(255, 255, 255, 0.12)";
const INK     = "#FFFFFF";
const INK2    = "rgba(255, 255, 255, 0.6)";
const MUTED   = "rgba(255, 255, 255, 0.4)";
const ACCENT  = "#7D39EB";
const LIME    = "#C6FF33";
const DANGER  = "#F87171";
const WARNING = "#FBBF24";
const SUCCESS = "#C6FF33";
const INFO    = "#60A5FA";
const AI      = "#7D39EB";

/* ── TOP-LEVEL FEATURE TABS ─────────────────────────────── */
type FeatureTab = "decision" | "project" | "blind-score" | "clause-memory" | "negotiation" | "submittal" | "golden-thread" | "memory" | "overrides";
type OutcomeType = "confirmed_good" | "confirmed_bad" | "pending";

/* ── BLIND SCORING TYPES ────────────────────────────────── */
interface ScoreCriteria { id: string; label: string; weight: number; }
interface VendorProposal {
  id: string; name: string; scope: string; approach: string;
  experience: string; certifications: string[]; timeline: string;
}
interface PricingReveal {
  vendorId: string; totalPrice: number; priceRank: number;
  breakdown: { label: string; amount: number }[];
}
interface VendorScore { vendorId: string; scores: Record<string, number>; total?: number; }

const SCORE_CRITERIA: ScoreCriteria[] = [
  { id: "technical",  label: "Technical Approach",  weight: 0.35 },
  { id: "experience", label: "Relevant Experience", weight: 0.30 },
  { id: "schedule",   label: "Schedule Confidence", weight: 0.20 },
  { id: "compliance", label: "Compliance & Certs",  weight: 0.15 },
];

const VENDOR_PROPOSALS: VendorProposal[] = [
  {
    id: "vendor_meridian_steel", name: "Meridian Steel Fabrication",
    scope: "Full structural steel package — columns, beams, and connection hardware for Tower B. Includes shop drawings, mill cert provision, and 3rd-party inspection coordination.",
    approach: "Pre-fabricate all connection assemblies offsite under controlled mill conditions. Deliver in sequenced drops matched to erection schedule. Deploy dedicated QC inspector on-site during erection phase.",
    experience: "14 completed data center and semiconductor fab projects. AISC Certified Fabricator (Standard + Advanced). Average rework rate 0.4% across last 8 projects.",
    certifications: ["AISC Advanced Certified", "ISO 9001:2015", "AWS D1.1 Compliant"],
    timeline: "18 weeks from NTP to final bolt inspection sign-off.",
  },
  {
    id: "vendor_titan_fab", name: "Titan Fabricators",
    scope: "Structural steel frame supply and erection. Scope includes steel procurement, fabrication, delivery, and complete erection with certified ironworkers.",
    approach: "Integrated supply-and-erect model. Single-vendor accountability eliminates coordination gaps between fabricator and erector. Uses proprietary BIM clash detection prior to fabrication release.",
    experience: "8 semiconductor and cleanroom projects in Texas and California. AISC Standard Certified. One prior rework event (bolt grade substitution, 2024) — remediated within budget.",
    certifications: ["AISC Standard Certified", "OSHA 30-Hour All Ironworkers"],
    timeline: "21 weeks from NTP, including erection and punch-list closeout.",
  },
  {
    id: "vendor_coastal_bolt", name: "Coastal Bolt & Fastener Systems",
    scope: "Anchor bolt, connection hardware, and specialty fastener supply package only. Excludes fabrication and erection — hardware supply to GC's erector.",
    approach: "Dedicated semiconductor/cleanroom hardware line. All anchor bolts are pre-inspected, tagged, and shipped in installation-sequence packaging. On-site hardware support rep for first 2 weeks of erection.",
    experience: "Focused hardware supplier with 22 data center and fab projects. Specialist in anchor systems and connection hardware only.",
    certifications: ["ASTM F1554 Compliant", "ISO 9001:2015", "AISC-Compatible Supplier"],
    timeline: "6 weeks from approved shop drawings to site delivery.",
  },
];

const PRICING_DATA: PricingReveal[] = [
  { vendorId: "vendor_meridian_steel", totalPrice: 1_240_000, priceRank: 2, breakdown: [{ label: "Fabrication", amount: 720_000 }, { label: "Erection", amount: 380_000 }, { label: "QC & Inspection", amount: 140_000 }] },
  { vendorId: "vendor_titan_fab",      totalPrice: 1_180_000, priceRank: 1, breakdown: [{ label: "Supply & Erect (integrated)", amount: 980_000 }, { label: "BIM & Coordination", amount: 120_000 }, { label: "Warranty Provision", amount: 80_000 }] },
  { vendorId: "vendor_coastal_bolt",   totalPrice: 285_000,   priceRank: 3, breakdown: [{ label: "Hardware Supply", amount: 240_000 }, { label: "On-site Support", amount: 28_000 }, { label: "Packaging & Sequencing", amount: 17_000 }] },
];

/* ── CLAUSE MEMORY SEED DATA ─────────────────────────────── */
const CLAUSE_TYPES = [
  "Liquidated Damages Cap",
  "Force Majeure Extension",
  "Retainage Release Trigger",
  "Indemnification Limit",
  "Pay-If-Paid Provision",
  "Differing Site Conditions",
];

interface ClauseRecord {
  id: string;
  clauseType: string;
  contractId: string;
  vendorId: string;
  vendorName: string;
  wasTriggered: boolean;
  disputeLengthDays: number | null;
  projectName: string;
  year: number;
  outcome: "resolved_favorable" | "resolved_unfavorable" | "settled" | "not_triggered";
}

const CLAUSE_HISTORY: ClauseRecord[] = [
  { id: "ch1",  clauseType: "Liquidated Damages Cap",    contractId: "PO-88213", vendorId: "vendor_meridian_steel", vendorName: "Meridian Steel Fabrication", wasTriggered: true,  disputeLengthDays: 94,  projectName: "Riverside Commerce Towers", year: 2024, outcome: "resolved_unfavorable" },
  { id: "ch2",  clauseType: "Liquidated Damages Cap",    contractId: "PO-44102", vendorId: "vendor_titan_fab",      vendorName: "Titan Fabricators",          wasTriggered: false, disputeLengthDays: null, projectName: "Austin Semiconductor Fab",  year: 2024, outcome: "not_triggered" },
  { id: "ch3",  clauseType: "Liquidated Damages Cap",    contractId: "PO-30021", vendorId: "vendor_meridian_steel", vendorName: "Meridian Steel Fabrication", wasTriggered: true,  disputeLengthDays: 127, projectName: "Coastal Logistics Hub",     year: 2023, outcome: "settled" },
  { id: "ch4",  clauseType: "Liquidated Damages Cap",    contractId: "PO-11882", vendorId: "vendor_coastal_bolt",   vendorName: "Coastal Bolt & Fastener",    wasTriggered: false, disputeLengthDays: null, projectName: "Meridian HQ Expansion",    year: 2023, outcome: "not_triggered" },
  { id: "ch5",  clauseType: "Liquidated Damages Cap",    contractId: "PO-55019", vendorId: "vendor_titan_fab",      vendorName: "Titan Fabricators",          wasTriggered: false, disputeLengthDays: null, projectName: "Titan Bridge Overpass",     year: 2024, outcome: "not_triggered" },
  { id: "ch6",  clauseType: "Liquidated Damages Cap",    contractId: "PO-77341", vendorId: "vendor_meridian_steel", vendorName: "Meridian Steel Fabrication", wasTriggered: false, disputeLengthDays: null, projectName: "Austin Semiconductor Fab",  year: 2025, outcome: "not_triggered" },
  { id: "ch7",  clauseType: "Force Majeure Extension",   contractId: "PO-88213", vendorId: "vendor_meridian_steel", vendorName: "Meridian Steel Fabrication", wasTriggered: true,  disputeLengthDays: 42,  projectName: "Riverside Commerce Towers", year: 2024, outcome: "resolved_favorable" },
  { id: "ch8",  clauseType: "Force Majeure Extension",   contractId: "PO-44102", vendorId: "vendor_titan_fab",      vendorName: "Titan Fabricators",          wasTriggered: true,  disputeLengthDays: 18,  projectName: "Austin Semiconductor Fab",  year: 2024, outcome: "resolved_favorable" },
  { id: "ch9",  clauseType: "Force Majeure Extension",   contractId: "PO-30021", vendorId: "vendor_coastal_bolt",   vendorName: "Coastal Bolt & Fastener",    wasTriggered: false, disputeLengthDays: null, projectName: "Coastal Logistics Hub",     year: 2023, outcome: "not_triggered" },
  { id: "ch10", clauseType: "Retainage Release Trigger", contractId: "PO-88213", vendorId: "vendor_meridian_steel", vendorName: "Meridian Steel Fabrication", wasTriggered: true,  disputeLengthDays: 61,  projectName: "Riverside Commerce Towers", year: 2024, outcome: "settled" },
  { id: "ch11", clauseType: "Retainage Release Trigger", contractId: "PO-55019", vendorId: "vendor_titan_fab",      vendorName: "Titan Fabricators",          wasTriggered: false, disputeLengthDays: null, projectName: "Titan Bridge Overpass",     year: 2024, outcome: "not_triggered" },
  { id: "ch12", clauseType: "Indemnification Limit",     contractId: "PO-30021", vendorId: "vendor_meridian_steel", vendorName: "Meridian Steel Fabrication", wasTriggered: false, disputeLengthDays: null, projectName: "Coastal Logistics Hub",     year: 2023, outcome: "not_triggered" },
  { id: "ch13", clauseType: "Pay-If-Paid Provision",     contractId: "PO-11882", vendorId: "vendor_coastal_bolt",   vendorName: "Coastal Bolt & Fastener",    wasTriggered: true,  disputeLengthDays: 33,  projectName: "Meridian HQ Expansion",    year: 2023, outcome: "resolved_unfavorable" },
  { id: "ch14", clauseType: "Differing Site Conditions", contractId: "PO-44102", vendorId: "vendor_meridian_steel", vendorName: "Meridian Steel Fabrication", wasTriggered: true,  disputeLengthDays: 88,  projectName: "Austin Semiconductor Fab",  year: 2024, outcome: "resolved_unfavorable" },
  { id: "ch15", clauseType: "Differing Site Conditions", contractId: "PO-77341", vendorId: "vendor_titan_fab",      vendorName: "Titan Fabricators",          wasTriggered: false, disputeLengthDays: null, projectName: "Austin Semiconductor Fab",  year: 2025, outcome: "not_triggered" },
];

/* ── NEGOTIATION MEMORY SEED DATA ───────────────────────── */
interface NegIssue {
  issue: string; // e.g. "payment_terms"
  label: string;
  icon: string;  // emoji shorthand for rendering
  conceded: boolean;
  negotiationId: string;
  notes: string;
}

interface TradeoffPoint {
  negotiationId: string;
  label: string;
  priceConcessionPct: number;   // % price drop from ask
  scheduleConcessionDays: number; // days of schedule relief given
  outcome: "accepted" | "rejected" | "counter-accepted";
  year: number;
}

interface NegotiationProfile {
  vendorId: string;
  vendorName: string;
  issues: NegIssue[];
  tradeoffPoints: TradeoffPoint[];
  summary: string;
}

const NEGOTIATION_PROFILES: Record<string, NegotiationProfile> = {
  vendor_meridian_steel: {
    vendorId: "vendor_meridian_steel",
    vendorName: "Meridian Steel Fabrication",
    summary: "Conceded on payment terms in 2 of 3 past negotiations, held firm on unit price every time. Flexible on schedule when given lead-time notice, resistant on warranty scope.",
    issues: [
      { issue: "payment_terms", label: "Payment Terms",  icon: "💳", conceded: true,  negotiationId: "neg-1", notes: "Agreed Net-45 in 2 of 3 contracts; held Net-30 once when backlog was low." },
      { issue: "payment_terms", label: "Payment Terms",  icon: "💳", conceded: true,  negotiationId: "neg-2", notes: "Conceded 2% early-pay discount in exchange for Net-45." },
      { issue: "payment_terms", label: "Payment Terms",  icon: "💳", conceded: false, negotiationId: "neg-3", notes: "Held firm on Net-30 during peak demand period." },
      { issue: "unit_price",    label: "Unit Price",     icon: "💰", conceded: false, negotiationId: "neg-1", notes: "Refused any reduction on fabrication unit price — cited steel index." },
      { issue: "unit_price",    label: "Unit Price",     icon: "💰", conceded: false, negotiationId: "neg-2", notes: "No movement on price; redirected to scope reduction instead." },
      { issue: "unit_price",    label: "Unit Price",     icon: "💰", conceded: false, negotiationId: "neg-3", notes: "Held firm. Final price within 0.5% of original ask." },
      { issue: "schedule",      label: "Schedule",       icon: "📅", conceded: true,  negotiationId: "neg-1", notes: "Agreed to accelerate 2 weeks with crew increase." },
      { issue: "schedule",      label: "Schedule",       icon: "📅", conceded: false, negotiationId: "neg-2", notes: "Could not compress timeline due to mill lead time." },
      { issue: "schedule",      label: "Schedule",       icon: "📅", conceded: true,  negotiationId: "neg-3", notes: "Moved delivery 5 days earlier when given 3-week advance notice." },
      { issue: "warranty",      label: "Warranty",       icon: "🛡️", conceded: false, negotiationId: "neg-1", notes: "Held 12-month standard warranty; rejected 24-month ask." },
      { issue: "warranty",      label: "Warranty",       icon: "🛡️", conceded: false, negotiationId: "neg-2", notes: "No extension offered; cited insurance policy limits." },
      { issue: "warranty",      label: "Warranty",       icon: "🛡️", conceded: false, negotiationId: "neg-3", notes: "Offered extended inspection only, not extended warranty period." },
    ],
    tradeoffPoints: [
      { negotiationId: "neg-1", label: "Riverside 2024", priceConcessionPct: 0,   scheduleConcessionDays: 14, outcome: "accepted",          year: 2024 },
      { negotiationId: "neg-2", label: "Austin Fab 2024", priceConcessionPct: 0,   scheduleConcessionDays: 0,  outcome: "counter-accepted",  year: 2024 },
      { negotiationId: "neg-3", label: "Coastal Hub 2023", priceConcessionPct: 0,  scheduleConcessionDays: 5,  outcome: "accepted",          year: 2023 },
    ],
  },
  vendor_titan_fab: {
    vendorId: "vendor_titan_fab",
    vendorName: "Titan Fabricators",
    summary: "Willing to move on price when schedule slack exists. Holds firm on warranty and erection crew size. Has accepted payment term extensions in 2 prior contracts.",
    issues: [
      { issue: "payment_terms", label: "Payment Terms",  icon: "💳", conceded: true,  negotiationId: "neg-4", notes: "Accepted Net-45 with milestone-based billing structure." },
      { issue: "payment_terms", label: "Payment Terms",  icon: "💳", conceded: true,  negotiationId: "neg-5", notes: "Agreed to 15% retainage reduction at structural completion." },
      { issue: "unit_price",    label: "Unit Price",     icon: "💰", conceded: true,  negotiationId: "neg-4", notes: "Reduced integrated erect price by 3.5% when scope was confirmed early." },
      { issue: "unit_price",    label: "Unit Price",     icon: "💰", conceded: false, negotiationId: "neg-5", notes: "No price movement — had competing offer at higher value." },
      { issue: "schedule",      label: "Schedule",       icon: "📅", conceded: true,  negotiationId: "neg-4", notes: "Advanced mobilization by 1 week for fixed startup bonus." },
      { issue: "schedule",      label: "Schedule",       icon: "📅", conceded: false, negotiationId: "neg-5", notes: "Could not accelerate — ironworker crew already at max." },
      { issue: "warranty",      label: "Warranty",       icon: "🛡️", conceded: false, negotiationId: "neg-4", notes: "Held 12-month warranty across both fabrication and erection." },
      { issue: "warranty",      label: "Warranty",       icon: "🛡️", conceded: false, negotiationId: "neg-5", notes: "Rejected extended warranty — union labor cost risk cited." },
    ],
    tradeoffPoints: [
      { negotiationId: "neg-4", label: "Austin Fab 2024", priceConcessionPct: 3.5, scheduleConcessionDays: 7,  outcome: "accepted",         year: 2024 },
      { negotiationId: "neg-5", label: "Riverside 2023", priceConcessionPct: 0,   scheduleConcessionDays: 0,  outcome: "counter-accepted", year: 2023 },
    ],
  },
  vendor_coastal_bolt: {
    vendorId: "vendor_coastal_bolt",
    vendorName: "Coastal Bolt & Fastener",
    summary: "Highly flexible on delivery timing and packaging. Price is firm on specialty items, negotiable on standard stock. Warranty terms are standard and non-negotiable.",
    issues: [
      { issue: "payment_terms", label: "Payment Terms",  icon: "💳", conceded: true,  negotiationId: "neg-6", notes: "Accepted Net-45 for orders above $100k." },
      { issue: "unit_price",    label: "Unit Price",     icon: "💰", conceded: true,  negotiationId: "neg-6", notes: "Reduced standard anchor bolt price 2% on volume commitment." },
      { issue: "unit_price",    label: "Unit Price",     icon: "💰", conceded: false, negotiationId: "neg-7", notes: "Held firm on specialty F1554 Grade 105 pricing." },
      { issue: "schedule",      label: "Schedule",       icon: "📅", conceded: true,  negotiationId: "neg-6", notes: "Accelerated delivery 3 weeks with sequence packaging included." },
      { issue: "schedule",      label: "Schedule",       icon: "📅", conceded: true,  negotiationId: "neg-7", notes: "Split shipment at no cost to hit 2 separate erection windows." },
      { issue: "warranty",      label: "Warranty",       icon: "🛡️", conceded: false, negotiationId: "neg-6", notes: "Standard 12-month material warranty; no extension offered." },
      { issue: "warranty",      label: "Warranty",       icon: "🛡️", conceded: false, negotiationId: "neg-7", notes: "Warranty is product-standard; non-negotiable per supplier policy." },
    ],
    tradeoffPoints: [
      { negotiationId: "neg-6", label: "Meridian HQ 2023", priceConcessionPct: 2,   scheduleConcessionDays: 21, outcome: "accepted",         year: 2023 },
      { negotiationId: "neg-7", label: "Austin Fab 2024",  priceConcessionPct: 0,   scheduleConcessionDays: 0,  outcome: "counter-accepted", year: 2024 },
    ],
  },
};

/* ── GOLDEN THREAD SEED DATA ─────────────────────────────── */
type GoldenEntryCategory = "material_substitution" | "inspection" | "design_change" | "vendor_decision" | "compliance_check";

interface GoldenThreadEntry {
  id: string;
  projectId: string;
  date: string;
  category: GoldenEntryCategory;
  title: string;
  summary: string;
  decidedBy: string;
  outcome: "approved" | "rejected" | "flagged" | "verified";
  evidenceRef: string;
  safetyRelevance: string;
  needsHuman: boolean;
}

interface GoldenProject { id: string; name: string; client: string; status: string; }

const GOLDEN_PROJECTS: GoldenProject[] = [
  { id: "project_austin_fab",       name: "Austin Semiconductor Fab",   client: "TechCore Systems Inc.",      status: "Active"    },
  { id: "project_riverside_towers", name: "Riverside Commerce Towers",   client: "Meridian Development Group", status: "Completed" },
  { id: "project_coastal_hub",      name: "Coastal Logistics Hub Ph. II", client: "Pacific Industrial LLC",     status: "Active"    },
];

const GOLDEN_THREAD_RECORDS: GoldenThreadEntry[] = [
  // Austin Semiconductor Fab
  {
    id: "gt-001", projectId: "project_austin_fab",
    date: "2024-09-03", category: "vendor_decision",
    title: "Vendor qualification override denied — structural steel fabricator",
    summary: "Vendor lacked AISC certification for semiconductor fab structural scope. Override denied; competitive re-bid directed. Compliant vendor identified within 12 days.",
    decidedBy: "ORCHESTRA / Procurement Lead", outcome: "rejected",
    evidenceRef: "prec-004 · AISC registry · AUS-FAB-PREQ-2024",
    safetyRelevance: "Structural steel certification directly impacts load-path integrity of cleanroom slab connections.",
    needsHuman: false,
  },
  {
    id: "gt-002", projectId: "project_austin_fab",
    date: "2024-10-18", category: "design_change",
    title: "Cleanroom floor slab tolerance specification revised",
    summary: "Structural engineer of record issued Revision C to slab tolerance spec following vibration sensitivity analysis for semiconductor tool footings. Delta of ±0.5mm applied.",
    decidedBy: "EOR — K. Yamamoto, SE", outcome: "approved",
    evidenceRef: "SD-208-Rev1 · Vibration Analysis Report VAR-2024-10",
    safetyRelevance: "Tighter tolerance prevents differential settlement under precision semiconductor equipment loads.",
    needsHuman: false,
  },
  {
    id: "gt-003", projectId: "project_austin_fab",
    date: "2024-11-14", category: "material_substitution",
    title: "Anchor bolt substitution approved with QA witness testing",
    summary: "Substitution of anchor bolt anchor type approved for cleanroom floor connections. Independent QA witness testing required. Structural engineer of record requested 72-hour review hold.",
    decidedBy: "ORCHESTRA / Structural EOR review", outcome: "approved",
    evidenceRef: "prec-005 · MTR-77294 · WTL-204",
    safetyRelevance: "Anchor bolt specifications critical for seismic anchorage of semiconductor fab equipment.",
    needsHuman: true,
  },
  {
    id: "gt-004", projectId: "project_austin_fab",
    date: "2024-11-17", category: "inspection",
    title: "QA witness test — anchor bolt substitution FAILED vibration tolerance",
    summary: "Approved substitution failed vibration tolerance test for cleanroom floor slab connections. Rework ordered. Original spec reinstated. 18-day schedule impact; $240k remediation cost.",
    decidedBy: "QA Inspector — WTL-204", outcome: "flagged",
    evidenceRef: "WTL-204 · Rework Order RW-2024-11-17 · prec-005",
    safetyRelevance: "Vibration tolerance failure in cleanroom anchor connections is a structural safety deficiency — must be remediated before tool installation.",
    needsHuman: true,
  },
  {
    id: "gt-005", projectId: "project_austin_fab",
    date: "2024-12-09", category: "compliance_check",
    title: "Rework inspection — original anchor bolt spec reinstated and verified",
    summary: "Independent inspection confirmed original specification anchor bolts installed correctly. All connections passed torque verification. Structural safety clearance issued.",
    decidedBy: "Third-party Inspector · TPI-CERT-2024-12", outcome: "verified",
    evidenceRef: "TPI-CERT-2024-12 · Torque Log TL-2024-12-09",
    safetyRelevance: "Final structural clearance for cleanroom anchor system prior to semiconductor tool installation.",
    needsHuman: false,
  },
  {
    id: "gt-006", projectId: "project_austin_fab",
    date: "2025-01-22", category: "material_substitution",
    title: "Structural steel column splice plate material upgrade — approved",
    summary: "GC requested upgrade from A36 to A572 Gr.50 plate for column splices at Level 3 to address revised loading from updated equipment manifest. Upgrade approved without further review.",
    decidedBy: "EOR approval · Meridian Steel Fabrication", outcome: "approved",
    evidenceRef: "Mill cert MTR-A572-2025 · CO-0041 · EOR-LTR-2025-01",
    safetyRelevance: "Higher-strength plate ensures splice connection meets revised equipment live load requirements.",
    needsHuman: false,
  },
  {
    id: "gt-007", projectId: "project_austin_fab",
    date: "2025-02-14", category: "inspection",
    title: "Weld inspection — Level 2 structural connections",
    summary: "UT and visual weld inspection completed on all Level 2 moment connections. 2 welds flagged for minor undercut defects; repaired and re-inspected within 48 hours. Final result: PASS.",
    decidedBy: "Certified Weld Inspector · CWI-BADGE-8821", outcome: "verified",
    evidenceRef: "UT Report UTR-2025-02-14 · Weld Repair Log WRL-2025-02",
    safetyRelevance: "Moment connection weld quality is critical for lateral load resistance under seismic loading.",
    needsHuman: false,
  },
  // Riverside Commerce Towers
  {
    id: "gt-008", projectId: "project_riverside_towers",
    date: "2024-03-12", category: "compliance_check",
    title: "COI gap detected — Steel Rebar Co. insurance expired",
    summary: "Certificate of insurance for Steel Rebar Co. expired 43 days prior to audit. Payment hold issued pending renewal. Subcontractor renewed within 5 business days.",
    decidedBy: "ORCHESTRA Trustline", outcome: "flagged",
    evidenceRef: "e1 · COI Archive · Vendor COI Registry",
    safetyRelevance: "Lapsed COI creates uninsured exposure for structural reinforcement scope — direct project liability risk.",
    needsHuman: true,
  },
  // Coastal Logistics Hub
  {
    id: "gt-009", projectId: "project_coastal_hub",
    date: "2024-06-30", category: "inspection",
    title: "Precast panel mill certificate authentication failure",
    summary: "2 of 8 precast panel shipments failed mill certificate authentication — heat numbers not traceable to delivery ticket. Panels quarantined pending re-certification.",
    decidedBy: "ORCHESTRA Material Authentication", outcome: "flagged",
    evidenceRef: "e3 · Mill Cert Archive · Auth Report AUTH-2024-06",
    safetyRelevance: "Unverified precast panels cannot be installed in structural bays — load-bearing capacity unconfirmed.",
    needsHuman: true,
  },
];

/* ── GOLDEN THREAD FEATURE ──────────────────────────────── */
function GoldenThreadFeature() {
  const [selectedProject, setSelectedProject] = useState(GOLDEN_PROJECTS[0].id);
  const [exporting, setExporting]             = useState(false);
  const [exported, setExported]               = useState(false);

  const project = GOLDEN_PROJECTS.find(p => p.id === selectedProject)!;
  const entries = GOLDEN_THREAD_RECORDS
    .filter(e => e.projectId === selectedProject)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const CATEGORY_META: Record<GoldenEntryCategory, { label: string; color: string; dot: string }> = {
    material_substitution: { label: "Material Substitution", color: WARNING, dot: "🔄" },
    inspection:            { label: "Inspection",            color: SUCCESS, dot: "🔍" },
    design_change:         { label: "Design Change",         color: AI,      dot: "✏️" },
    vendor_decision:       { label: "Vendor Decision",       color: ACCENT, dot: "🏢" },
    compliance_check:      { label: "Compliance Check",      color: MUTED, dot: "✅" },
  };

  const OUTCOME_META = {
    approved:  { label: "Approved",  color: SUCCESS, bg: `${SUCCESS}12`, border: `${SUCCESS}28` },
    rejected:  { label: "Rejected",  color: DANGER,  bg: `${DANGER}12`,  border: `${DANGER}28`  },
    flagged:   { label: "Flagged",   color: WARNING, bg: `${WARNING}12`, border: `${WARNING}28` },
    verified:  { label: "Verified",  color: SUCCESS, bg: `${SUCCESS}12`, border: `${SUCCESS}28` },
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await fetch(`/api/precedent/golden-thread/${selectedProject}/export`, { method: "POST" });
    } catch { /* backend optional */ }
    await new Promise(r => setTimeout(r, 1400));
    setExporting(false);
    setExported(true);
    setTimeout(() => setExported(false), 4000);
  };

  const flaggedCount  = entries.filter(e => e.outcome === "flagged").length;
  const humanCount    = entries.filter(e => e.needsHuman).length;

  return (
    <div className="space-y-8">

      {/* Project selector */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: MUTED }}>
          Select Project
        </label>
        <div className="flex flex-wrap gap-2">
          {GOLDEN_PROJECTS.map(p => (
            <button key={p.id}
              onClick={() => { setSelectedProject(p.id); setExported(false); }}
              className="px-4 py-2 rounded-xl border text-left transition-all"
              style={{
                background: selectedProject === p.id ? "#0C0A14" : SURFACE,
                borderColor: selectedProject === p.id ? ACCENT : BORDER,
                boxShadow: selectedProject === p.id ? "0 0 12px rgba(125, 57, 235, 0.2)" : "none",
              }}>
              <p className="text-[13px] font-bold" style={{ color: selectedProject === p.id ? INK : INK2 }}>
                {p.name}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: selectedProject === p.id ? INK2 : MUTED }}>
                {p.client} · {p.status}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Header + export button */}
      <motion.div
        key={selectedProject}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border overflow-hidden"
        style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.07)" }}
      >
        <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)" }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
                style={{ background: `${INK}08`, borderColor: `${INK}18`, color: ACCENT }}>
                Golden Thread
              </span>
              <span className="text-[10.5px] font-mono" style={{ color: MUTED }}>
                Safety-Relevant Compliance Record
              </span>
            </div>
            <h3 className="text-[16px] font-bold" style={{ color: INK }}>{project.name}</h3>
            <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
              {project.client} · {entries.length} entries · {flaggedCount > 0 && `${flaggedCount} flagged · `}{humanCount} required human review
            </p>
          </div>

          <motion.button
            onClick={handleExport}
            disabled={exporting}
            whileHover={{ scale: exporting || exported ? 1 : 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[13.5px] font-bold transition-all shrink-0 disabled:cursor-wait border"
            style={{
              background: exported ? SUCCESS : "#0C0A14",
              color: exported ? "#08070C" : INK,
              borderColor: exported ? SUCCESS : ACCENT,
              boxShadow: exported ? `0 0 16px ${SUCCESS}40` : "0 0 12px rgba(125, 57, 235, 0.2)",
            }}
          >
            {exporting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: `${INK}40`, borderTopColor: INK }} />
                Generating Record...
              </>
            ) : exported ? (
              <>
                <CheckCircle2 size={16} />
                Compliance Record Exported
              </>
            ) : (
              <>
                <ArrowRight size={16} />
                Export Compliance Record
              </>
            )}
          </motion.button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0"
          style={{ borderColor: BORDER }}>
          {[
            { label: "Total Entries",      value: entries.length,                             color: INK      },
            { label: "Flagged / At Risk",  value: flaggedCount,                               color: flaggedCount > 0 ? DANGER : SUCCESS },
            { label: "Human Reviews",      value: humanCount,                                 color: humanCount > 0 ? WARNING : SUCCESS  },
            { label: "Verified / Passed",  value: entries.filter(e => e.outcome === "verified").length, color: SUCCESS },
          ].map((s, i) => (
            <div key={s.label} className="px-4 py-3 text-center">
              <motion.div className="text-[22px] font-bold font-mono" style={{ color: s.color }}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07 }}>
                {s.value}
              </motion.div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider mt-0.5" style={{ color: MUTED }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Vertical timeline */}
      <div className="relative space-y-0 pb-4">
        {/* Vertical connector line */}
        <div className="absolute left-[19px] top-5 bottom-5 w-[2px]" style={{ background: BORDER }} />

        {entries.map((entry, i) => {
          const cat = CATEGORY_META[entry.category];
          const out = OUTCOME_META[entry.outcome];

          return (
            <motion.div key={entry.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex gap-5 pb-6"
            >
              {/* Timeline node */}
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-[15px]"
                style={{ background: SURFACE, borderColor: cat.color }}>
                {cat.dot}
              </div>

              {/* Content card */}
              <div className="flex-1 rounded-xl border overflow-hidden"
                style={{
                  background: SURFACE,
                  borderColor: entry.outcome === "flagged" ? `${DANGER}30` : BORDER,
                  boxShadow: "0 1px 4px rgba(41,28,14,0.06)"
                }}>

                {/* Card header */}
                <div className="px-4 py-3 border-b flex items-start justify-between gap-3"
                  style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider"
                        style={{ color: cat.color }}>
                        {cat.label}
                      </span>
                      <span className="text-[10.5px] font-mono" style={{ color: MUTED }}>
                        {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <h4 className="text-[13.5px] font-bold leading-snug" style={{ color: INK }}>
                      {entry.title}
                    </h4>
                  </div>
                  <span className="shrink-0 text-[10.5px] font-bold px-2.5 py-1 rounded-full border"
                    style={{ background: out.bg, color: out.color, borderColor: out.border }}>
                    {out.label}
                  </span>
                </div>

                {/* Body */}
                <div className="px-4 py-3 space-y-2.5">
                  <p className="text-[13px] leading-relaxed" style={{ color: INK2 }}>
                    {entry.summary}
                  </p>

                  {/* Safety relevance */}
                  <div className="flex items-start gap-2 rounded-lg px-3 py-2 border-l-2 text-[12px]"
                    style={{ background: `${WARNING}08`, borderLeftColor: WARNING, color: INK2 }}>
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" style={{ color: WARNING }} />
                    <span><span className="font-bold" style={{ color: INK }}>Safety relevance:</span> {entry.safetyRelevance}</span>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <div className="flex items-center gap-4">
                      <span className="text-[11px]" style={{ color: MUTED }}>
                        By: <span className="font-semibold" style={{ color: INK }}>{entry.decidedBy}</span>
                      </span>
                      {entry.needsHuman && (
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded border"
                          style={{ background: `${WARNING}10`, color: WARNING, borderColor: `${WARNING}25` }}>
                          Human Review Required
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono" style={{ color: MUTED }}>
                      Evidence: {entry.evidenceRef.split(" · ")[0]}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ── INSTITUTIONAL MEMORY SEED DATA ────────────────────── */
interface MemoryRecord {
  id: string;
  situationType: string;
  entityId: string;
  entityName: string;
  decisionMade: string;
  confidenceAtTime: number;
  dissentingView: string | null;
  outcome: "confirmed_good" | "confirmed_bad" | "pending";
  reasoning: string;
  needsHuman: boolean;
  decisionMakerRole: string;
  decisionMakerYear: number;
  decisionMakerStillActive: boolean;
  date: string;
  tags: string[];
}

const MEMORY_RECORDS: MemoryRecord[] = [
  {
    id: "mem-001",
    situationType: "vendor_qualification_override",
    entityId: "vendor_meridian_steel", entityName: "Meridian Steel Fabrication",
    decisionMade: "Qualification override approved with enhanced inspection protocol and 10% retention holdback.",
    confidenceAtTime: 0.71,
    dissentingView: "Project controls flagged insufficient vendor track record for scale of structural scope.",
    outcome: "confirmed_bad",
    reasoning: "Override bypassed standard qualification threshold. Three structural connections required rework after approval, resulting in 11-day schedule impact and $88k remediation cost.",
    needsHuman: true,
    decisionMakerRole: "Senior Project Executive",
    decisionMakerYear: 2023,
    decisionMakerStillActive: false,
    date: "2023-08-14",
    tags: ["vendor", "structural", "qualification", "override"],
  },
  {
    id: "mem-002",
    situationType: "material_substitution",
    entityId: "vendor_coastal_bolt", entityName: "Coastal Bolt & Fastener",
    decisionMade: "Substitution denied. Original Grade-8 bolt specification maintained; expedited re-order placed.",
    confidenceAtTime: 0.91,
    dissentingView: null,
    outcome: "confirmed_good",
    reasoning: "Mid-pour substitution of a lower-grade bolt in foundation anchor connections carries unacceptable load-path risk. Denial was correct; re-order arrived within tolerance of original schedule.",
    needsHuman: false,
    decisionMakerRole: "Structural Engineer of Record",
    decisionMakerYear: 2025,
    decisionMakerStillActive: true,
    date: "2025-01-08",
    tags: ["material", "bolt", "substitution", "foundation"],
  },
  {
    id: "mem-003",
    situationType: "clause_negotiation",
    entityId: "vendor_titan_fab", entityName: "Titan Fabricators",
    decisionMade: "14-day force majeure extension granted; liquidated damages clause adjusted proportionally.",
    confidenceAtTime: 0.68,
    dissentingView: "Legal flagged precedent risk — future contracts on similar scopes may invoke same clause language.",
    outcome: "pending",
    reasoning: "Weather data confirmed 3 qualifying rain days, supporting partial extension. Full 14-day grant exceeds verified excusable days; outcome still under monitoring.",
    needsHuman: true,
    decisionMakerRole: "Director of Contracts",
    decisionMakerYear: 2024,
    decisionMakerStillActive: false,
    date: "2024-06-04",
    tags: ["clause", "force majeure", "extension", "legal"],
  },
  {
    id: "mem-004",
    situationType: "vendor_qualification_override",
    entityId: "project_austin_fab", entityName: "Austin Semiconductor Fab",
    decisionMade: "Override denied. Procurement directed to run competitive re-bid with prequalified vendors.",
    confidenceAtTime: 0.88,
    dissentingView: null,
    outcome: "confirmed_good",
    reasoning: "Vendor lacked AISC certification required for semiconductor fab structural steel. Re-bid surfaced a compliant vendor at comparable cost within 12 days.",
    needsHuman: false,
    decisionMakerRole: "VP Procurement",
    decisionMakerYear: 2024,
    decisionMakerStillActive: true,
    date: "2024-09-03",
    tags: ["vendor", "qualification", "semiconductor", "AISC"],
  },
  {
    id: "mem-005",
    situationType: "material_substitution",
    entityId: "project_austin_fab", entityName: "Austin Semiconductor Fab",
    decisionMade: "Substitution approved with independent QA witness testing at vendor facility.",
    confidenceAtTime: 0.79,
    dissentingView: "Structural engineer of record requested additional 72-hour hold for review.",
    outcome: "confirmed_bad",
    reasoning: "Approved substitution caused vibration tolerance failure in cleanroom floor slab connections. Rework cost $240k and 18-day delay on semiconductor tool install.",
    needsHuman: true,
    decisionMakerRole: "Senior Project Manager",
    decisionMakerYear: 2024,
    decisionMakerStillActive: false,
    date: "2024-11-14",
    tags: ["material", "substitution", "cleanroom", "vibration", "rework"],
  },
  {
    id: "mem-006",
    situationType: "clause_negotiation",
    entityId: "vendor_meridian_steel", entityName: "Meridian Steel Fabrication",
    decisionMade: "Payment terms renegotiated from Net-30 to Net-45; 2% early-pay discount offered.",
    confidenceAtTime: 0.84,
    dissentingView: null,
    outcome: "confirmed_good",
    reasoning: "Renegotiation preserved cash-flow buffer during peak structural phase without triggering lien risk. Vendor honored revised terms; no disputes filed.",
    needsHuman: false,
    decisionMakerRole: "Chief Financial Officer",
    decisionMakerYear: 2025,
    decisionMakerStillActive: true,
    date: "2025-02-01",
    tags: ["payment", "terms", "negotiation", "cash flow"],
  },
  {
    id: "mem-007",
    situationType: "change_order_approval",
    entityId: "vendor_meridian_steel", entityName: "Meridian Steel Fabrication",
    decisionMade: "Change order rejected pending independent quantity take-off verification.",
    confidenceAtTime: 0.77,
    dissentingView: "Field superintendent argued delays would compound if approval was deferred.",
    outcome: "confirmed_good",
    reasoning: "Independent QTO found 22% quantity overstatement in the change order. Rejection saved $63k; renegotiated CO approved at corrected quantity within 5 days.",
    needsHuman: false,
    decisionMakerRole: "Project Controls Manager",
    decisionMakerYear: 2025,
    decisionMakerStillActive: false,
    date: "2025-04-22",
    tags: ["change order", "quantity", "overstatement", "cost control"],
  },
  {
    id: "mem-008",
    situationType: "material_substitution",
    entityId: "vendor_coastal_bolt", entityName: "Coastal Bolt & Fastener",
    decisionMade: "Substitution approved for non-structural ancillary hardware only; primary spec unchanged.",
    confidenceAtTime: 0.93,
    dissentingView: null,
    outcome: "confirmed_good",
    reasoning: "Clear scope boundary between structural and ancillary hardware made partial substitution low-risk. No rework required; cost saving of $12k realized.",
    needsHuman: false,
    decisionMakerRole: "Procurement Lead",
    decisionMakerYear: 2025,
    decisionMakerStillActive: true,
    date: "2025-03-05",
    tags: ["material", "substitution", "ancillary", "hardware", "cost saving"],
  },
];

/* ── INSTITUTIONAL MEMORY FEATURE ───────────────────────── */
function InstitutionalMemoryFeature() {
  const [query, setQuery]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState<MemoryRecord[] | null>(null);

  const OUTCOME_META = {
    confirmed_good: { label: "Confirmed Good",  color: SUCCESS, bg: `${SUCCESS}12`, border: `${SUCCESS}28` },
    confirmed_bad:  { label: "Confirmed Bad",   color: DANGER,  bg: `${DANGER}12`,  border: `${DANGER}28`  },
    pending:        { label: "Pending",          color: WARNING, bg: `${WARNING}12`, border: `${WARNING}28` },
  };

  const STYPE_LABEL: Record<string, string> = {
    vendor_qualification_override: "Vendor Qualification Override",
    material_substitution:         "Material Substitution",
    clause_negotiation:            "Clause Negotiation",
    change_order_approval:         "Change Order",
  };

  const search = async () => {
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch(`/api/precedent/institutional-memory?search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.records);
      } else { throw new Error(); }
    } catch {
      // Local fallback — simple keyword filter
      const q = query.trim().toLowerCase();
      const filtered = q
        ? MEMORY_RECORDS.filter(r =>
            r.decisionMade.toLowerCase().includes(q) ||
            r.reasoning.toLowerCase().includes(q) ||
            r.entityName.toLowerCase().includes(q) ||
            r.situationType.toLowerCase().includes(q) ||
            r.tags.some(t => t.toLowerCase().includes(q))
          )
        : MEMORY_RECORDS;
      await new Promise(r => setTimeout(r, 400));
      setResults(filtered);
    }
    setLoading(false);
  };

  // Load all on mount
  useEffect(() => {
    search();
  }, []);

  return (
    <div className="space-y-8">

      {/* Header banner */}
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border-l-4 px-5 py-4 flex items-start gap-3"
        style={{ background: `${AI}08`, borderLeftColor: AI, borderColor: `${AI}22` }}
      >
        <BookOpen size={18} className="shrink-0 mt-0.5" style={{ color: AI }} />
        <div>
          <p className="text-[13.5px] font-bold" style={{ color: INK }}>
            Organizational memory that survives someone leaving
          </p>
          <p className="text-[12.5px] mt-0.5 leading-relaxed" style={{ color: INK2 }}>
            Every major decision, with its reasoning and outcome, archived regardless of who made it.
            Decisions made by people no longer with the company are flagged so you know exactly what context may be missing.
          </p>
        </div>
      </motion.div>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") search(); }}
            placeholder="Search decisions, vendors, reasoning, tags…"
            className="w-full rounded-xl border pl-10 pr-4 py-3 text-[13.5px] outline-none transition-all"
            style={{ background: SURFACE, borderColor: BORDER, color: INK }}
            onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
            onBlur={e  => { e.currentTarget.style.borderColor = BORDER; }}
          />
        </div>
        <button onClick={search} disabled={loading}
          className="flex items-center gap-2 px-5 rounded-xl text-[13.5px] font-semibold transition-all hover:bg-[#7D39EB] hover:text-[#08070C] hover:shadow-[0_0_20px_rgba(125,57,235,0.4)] disabled:opacity-50 shrink-0 border border-[#7D39EB] bg-[#0C0A14] text-white shadow-[0_0_12px_rgba(125,57,235,0.15)]"
        >
          {loading
            ? <><span className="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white" /> Searching</>
            : <><Search size={14} /> Search</>}
        </button>
      </div>

      {/* Stats row */}
      {!loading && results && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ background: INK }} />
            <span className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: INK }}>
              Decision Archive
            </span>
            <span className="text-[12px] font-mono" style={{ color: MUTED }}>
              ({results.length} records)
            </span>
          </div>
          <span className="text-[11px]" style={{ color: MUTED }}>·</span>
          <span className="text-[11.5px]" style={{ color: DANGER }}>
            {results.filter(r => !r.decisionMakerStillActive).length} by people no longer with company
          </span>
        </motion.div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          {[0, 1, 2, 3].map(i => <ResultSkeleton key={i} index={i} />)}
        </div>
      )}

      {/* Results */}
      {!loading && results && results.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-xl border p-12 text-center" style={{ background: SURFACE, borderColor: BORDER }}>
          <BookOpen size={32} className="mx-auto mb-3" style={{ color: MUTED }} />
          <p className="text-[14px] font-semibold" style={{ color: INK }}>No decisions found</p>
          <p className="text-[13px] mt-1" style={{ color: MUTED }}>Try different search terms</p>
        </motion.div>
      )}

      {!loading && results && results.length > 0 && (
        <div className="space-y-4 pb-6">
          <AnimatePresence mode="popLayout">
            {results.map((record, i) => {
              const out = OUTCOME_META[record.outcome];
              return (
                <motion.div key={record.id}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.38, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-xl border overflow-hidden"
                  style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.07)" }}
                >
                  {/* Top accent */}
                  <div className="h-[3px]" style={{
                    background: `linear-gradient(90deg, ${out.color}, transparent)`
                  }} />

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
                          style={{ background: `${INK}08`, borderColor: `${INK}18`, color: ACCENT }}>
                          {STYPE_LABEL[record.situationType] ?? record.situationType.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px]" style={{ color: MUTED }}>
                          {record.entityName}
                        </span>
                        <span className="text-[11px] font-mono" style={{ color: MUTED }}>
                          · {new Date(record.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10.5px] font-bold px-2.5 py-1 rounded-full border"
                        style={{ background: out.bg, color: out.color, borderColor: out.border }}>
                        {out.label}
                      </span>
                    </div>

                    {/* Decision */}
                    <div className="rounded-lg px-3 py-2.5 mb-3 border-l-2 text-[13px] leading-relaxed"
                      style={{ background: "rgba(255,255,255,0.04)", borderLeftColor: ACCENT, color: INK2 }}>
                      <span className="font-bold text-[10px] uppercase tracking-wider block mb-1" style={{ color: MUTED }}>
                        Decision Made
                      </span>
                      {record.decisionMade}
                    </div>

                    {/* Reasoning */}
                    <p className="text-[13px] leading-relaxed mb-3" style={{ color: INK2 }}>
                      <span className="font-bold" style={{ color: INK }}>Reasoning: </span>
                      {record.reasoning}
                    </p>

                    {/* Dissent */}
                    {record.dissentingView && (
                      <div className="rounded-lg px-3 py-2 mb-3 flex items-start gap-2 border text-[12.5px]"
                        style={{ background: `${WARNING}08`, borderColor: `${WARNING}22`, color: WARNING }}>
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>{record.dissentingView}</span>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t"
                      style={{ borderColor: BORDER }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11.5px] font-semibold" style={{ color: INK }}>
                          {record.decisionMakerRole}, {record.decisionMakerYear}
                        </span>
                        {!record.decisionMakerStillActive && (
                          <motion.span
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.07 + 0.2 }}
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                            style={{ background: `${DANGER}10`, color: DANGER, borderColor: `${DANGER}25` }}
                          >
                            No longer with company
                          </motion.span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {record.tags.slice(0, 4).map(tag => (
                          <span key={tag}
                            className="text-[10.5px] px-2 py-0.5 rounded-full border font-medium"
                            style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER, color: MUTED }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ── OVERRIDE STATISTICS SEED DATA ─────────────────────── */
interface OverrideRecord {
  id: string;
  situationType: string;
  categoryLabel: string;
  recommendationGiven: string;
  wasOverridden: boolean;
  outcomeAfterOverride: "worse" | "better" | "same" | null;
  entityName: string;
  year: number;
  costImpact: string | null;
}

const OVERRIDE_RECORDS: OverrideRecord[] = [
  // Vendor qualification overrides — 4 overrides, 3 worse, 1 better
  { id: "ov-01", situationType: "vendor_qualification_override", categoryLabel: "Vendor Qualification",  recommendationGiven: "Deny qualification — vendor below AISC threshold",          wasOverridden: true,  outcomeAfterOverride: "worse",  entityName: "Meridian Steel (2023)",      year: 2023, costImpact: "$88k rework + 11d delay" },
  { id: "ov-02", situationType: "vendor_qualification_override", categoryLabel: "Vendor Qualification",  recommendationGiven: "Run competitive re-bid before awarding scope",              wasOverridden: false, outcomeAfterOverride: null,     entityName: "Austin Fab (2024)",          year: 2024, costImpact: null },
  { id: "ov-03", situationType: "vendor_qualification_override", categoryLabel: "Vendor Qualification",  recommendationGiven: "Reject vendor — expired safety certifications",              wasOverridden: true,  outcomeAfterOverride: "worse",  entityName: "Coastal Logistics (2023)",   year: 2023, costImpact: "$42k remediation" },
  { id: "ov-04", situationType: "vendor_qualification_override", categoryLabel: "Vendor Qualification",  recommendationGiven: "Require EMR re-certification before award",                  wasOverridden: true,  outcomeAfterOverride: "better", entityName: "Riverside Towers (2024)",    year: 2024, costImpact: null },
  // Material substitutions — 4 overrides, 3 worse, 1 same
  { id: "ov-05", situationType: "material_substitution",         categoryLabel: "Material Substitution", recommendationGiven: "Deny bolt substitution mid-pour — spec mismatch",           wasOverridden: true,  outcomeAfterOverride: "worse",  entityName: "Austin Fab (2024)",          year: 2024, costImpact: "$240k rework + 18d delay" },
  { id: "ov-06", situationType: "material_substitution",         categoryLabel: "Material Substitution", recommendationGiven: "Deny Grade-8 substitution — load path risk",                wasOverridden: false, outcomeAfterOverride: null,     entityName: "Coastal Bolt (2025)",        year: 2025, costImpact: null },
  { id: "ov-07", situationType: "material_substitution",         categoryLabel: "Material Substitution", recommendationGiven: "Require mill re-certification before installation",          wasOverridden: true,  outcomeAfterOverride: "same",   entityName: "Riverside Towers (2023)",    year: 2023, costImpact: "No measurable impact" },
  { id: "ov-08", situationType: "material_substitution",         categoryLabel: "Material Substitution", recommendationGiven: "Hold anchor bolt substitution — 72hr EOR review required",  wasOverridden: true,  outcomeAfterOverride: "worse",  entityName: "Austin Fab (2024 Q4)",       year: 2024, costImpact: "$55k inspection + delay" },
  // Change order approvals — 2 overrides, 2 worse
  { id: "ov-09", situationType: "change_order_approval",         categoryLabel: "Change Order",          recommendationGiven: "Reject CO pending independent QTO — overstatement flagged", wasOverridden: false, outcomeAfterOverride: null,     entityName: "Meridian Steel (2025)",      year: 2025, costImpact: null },
  { id: "ov-10", situationType: "change_order_approval",         categoryLabel: "Change Order",          recommendationGiven: "Reject CO — unit rates above regional benchmark by 28%",   wasOverridden: true,  outcomeAfterOverride: "worse",  entityName: "Titan Fab (2024)",           year: 2024, costImpact: "$91k overpayment" },
  { id: "ov-11", situationType: "change_order_approval",         categoryLabel: "Change Order",          recommendationGiven: "Require backup documentation before approval",               wasOverridden: true,  outcomeAfterOverride: "better", entityName: "Coastal Hub (2024)",         year: 2024, costImpact: null },
  // Clause negotiations — 1 override, worse
  { id: "ov-12", situationType: "clause_negotiation",            categoryLabel: "Clause Negotiation",    recommendationGiven: "Limit force majeure extension to verified weather days only", wasOverridden: true,  outcomeAfterOverride: "worse",  entityName: "Titan Fab (2024)",           year: 2024, costImpact: "Ongoing dispute" },
  { id: "ov-13", situationType: "clause_negotiation",            categoryLabel: "Clause Negotiation",    recommendationGiven: "Accept Net-45 renegotiation — low lien risk",                wasOverridden: false, outcomeAfterOverride: null,     entityName: "Meridian Steel (2025)",      year: 2025, costImpact: null },
];

/* ── OVERRIDE STATISTICS FEATURE ───────────────────────── */
function OverrideStatisticsFeature() {
  const overrides   = OVERRIDE_RECORDS.filter(r => r.wasOverridden);
  const total       = overrides.length;
  const worseCount  = overrides.filter(r => r.outcomeAfterOverride === "worse").length;
  const betterCount = overrides.filter(r => r.outcomeAfterOverride === "better").length;
  const sameCount   = overrides.filter(r => r.outcomeAfterOverride === "same").length;
  const worsePct    = Math.round((worseCount / total) * 100);

  // Per-category breakdown
  const categories = Array.from(new Set(OVERRIDE_RECORDS.map(r => r.categoryLabel)));
  const catStats = categories.map(cat => {
    const all      = OVERRIDE_RECORDS.filter(r => r.categoryLabel === cat);
    const ov       = all.filter(r => r.wasOverridden);
    const ovWorse  = ov.filter(r => r.outcomeAfterOverride === "worse");
    const ovBetter = ov.filter(r => r.outcomeAfterOverride === "better");
    return {
      label:         cat,
      total:         all.length,
      overrideCount: ov.length,
      worseCount:    ovWorse.length,
      betterCount:   ovBetter.length,
      overrideRate:  all.length > 0 ? Math.round((ov.length / all.length) * 100) : 0,
      worseRate:     ov.length > 0 ? Math.round((ovWorse.length / ov.length) * 100) : 0,
    };
  }).sort((a, b) => b.overrideCount - a.overrideCount);

  return (
    <div className="space-y-10">

      {/* Hero scorecard */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border overflow-hidden"
        style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 4px 16px rgba(41,28,14,0.08)" }}
      >
        {/* Dark header band */}
        <div className="px-8 py-6 border-b" style={{ background: INK, borderColor: `${INK}20` }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: MUTED }}>
            Override Accuracy Report · Honest Scorecard
          </p>
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-[22px] font-bold leading-snug"
            style={{ color: INK }}
          >
            When teams overrode our top recommendation,
            outcomes were worse in{" "}
            <motion.span
              style={{ color: "#F87171" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {worseCount} of {total} cases
            </motion.span>{" "}
            <span style={{ color: MUTED }}>({worsePct}%)</span>
          </motion.h2>
        </div>

        {/* Dot pictogram + summary */}
        <div className="px-8 py-7 flex flex-col md:flex-row items-start gap-8">
          {/* Dot grid — instant pictogram */}
          <div className="shrink-0">
            <p className="text-[10.5px] font-bold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
              Each dot = 1 overridden recommendation
            </p>
            <div className="flex flex-wrap gap-2 max-w-[280px]">
              {overrides.map((o, i) => (
                <motion.div
                  key={o.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.06, type: "spring", stiffness: 300, damping: 18 }}
                  className="w-6 h-6 rounded-full border-2"
                  title={`${o.entityName} — ${o.outcomeAfterOverride ?? "no outcome yet"}`}
                  style={{
                    background: o.outcomeAfterOverride === "worse"
                      ? `${DANGER}20`
                      : o.outcomeAfterOverride === "better"
                      ? `${SUCCESS}20`
                      : `${MUTED}30`,
                    borderColor: o.outcomeAfterOverride === "worse"
                      ? DANGER
                      : o.outcomeAfterOverride === "better"
                      ? SUCCESS
                      : MUTED,
                  }}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="flex gap-4 mt-4">
              {[
                { color: DANGER,  label: `Worse (${worseCount})`  },
                { color: SUCCESS, label: `Better (${betterCount})` },
                { color: MUTED,    label: `Same (${sameCount})`     },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: MUTED }}>
                  <span className="w-3 h-3 rounded-full border-2 shrink-0"
                    style={{ borderColor: l.color, background: `${l.color}20` }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* Large animated number */}
          <div className="flex-1">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="mb-2"
            >
              <span className="text-[72px] font-bold font-mono leading-none" style={{ color: DANGER }}>
                {worsePct}%
              </span>
            </motion.div>
            <p className="text-[14px] leading-relaxed max-w-sm" style={{ color: INK2 }}>
              of overrides led to a worse outcome — cost overruns, rework, schedule slippage, or disputes.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Total Overrides",  value: total,       color: INK    },
                { label: "Worse Outcomes",   value: worseCount,  color: DANGER  },
                { label: "Better Outcomes",  value: betterCount, color: SUCCESS },
              ].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="rounded-xl border p-3 text-center"
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER }}
                >
                  <div className="text-[24px] font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: MUTED }}>{s.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Per-category breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-xl border overflow-hidden"
        style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.07)" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)" }}>
          <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: INK }}>
            Override Rate by Decision Category
          </p>
          <p className="text-[11.5px] mt-0.5" style={{ color: MUTED }}>
            Which types get overridden most, and how that played out
          </p>
        </div>

        <div className="p-5 space-y-5">
          {catStats.map((cat, i) => (
            <motion.div key={cat.label}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.35 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13.5px] font-semibold" style={{ color: INK }}>{cat.label}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11.5px] font-mono" style={{ color: MUTED }}>
                    {cat.overrideCount}/{cat.total} overridden
                  </span>
                  {cat.overrideCount > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                      style={{
                        background: cat.worseRate >= 70 ? `${DANGER}12` : cat.worseRate >= 40 ? `${WARNING}12` : `${SUCCESS}12`,
                        color: cat.worseRate >= 70 ? DANGER : cat.worseRate >= 40 ? WARNING : SUCCESS,
                        borderColor: cat.worseRate >= 70 ? `${DANGER}28` : cat.worseRate >= 40 ? `${WARNING}28` : `${SUCCESS}28`,
                      }}>
                      {cat.worseRate}% worse
                    </span>
                  )}
                </div>
              </div>

              {/* Stacked bar: overridden vs not */}
              <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.08)" }}>
                {cat.overrideCount > 0 && (
                  <>
                    {/* Overridden-worse portion */}
                    <motion.div
                      className="h-full"
                      style={{ background: DANGER }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.worseCount / cat.total) * 100}%` }}
                      transition={{ duration: 0.7, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    />
                    {/* Overridden-better portion */}
                    <motion.div
                      className="h-full"
                      style={{ background: WARNING }}
                      initial={{ width: 0 }}
                      animate={{ width: `${((cat.overrideCount - cat.worseCount) / cat.total) * 100}%` }}
                      transition={{ duration: 0.7, delay: 0.25 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </>
                )}
                {/* Not overridden (accepted) */}
                <motion.div
                  className="h-full"
                  style={{ background: SUCCESS }}
                  initial={{ width: 0 }}
                  animate={{ width: `${((cat.total - cat.overrideCount) / cat.total) * 100}%` }}
                  transition={{ duration: 0.7, delay: 0.3 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </motion.div>
          ))}

          {/* Bar legend */}
          <div className="flex gap-5 pt-2 border-t" style={{ borderColor: BORDER }}>
            {[
              { color: DANGER,  label: "Override → Worse"    },
              { color: WARNING, label: "Override → Better/Same" },
              { color: SUCCESS, label: "Recommendation Accepted" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: MUTED }}>
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Individual override log */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="rounded-xl border overflow-hidden"
        style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.07)" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)" }}>
          <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: INK }}>
            Individual Override Log
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: BORDER }}>
          {overrides.map((o, i) => (
            <motion.div key={o.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.06, duration: 0.3 }}
              className="flex items-start gap-4 px-5 py-4"
            >
              <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                style={{
                  background: o.outcomeAfterOverride === "worse" ? DANGER
                    : o.outcomeAfterOverride === "better" ? SUCCESS : MUTED
                }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: MUTED }}>{o.categoryLabel}</span>
                  <span className="text-[11px] font-mono" style={{ color: MUTED }}>
                    {o.entityName} · {o.year}
                  </span>
                </div>
                <p className="text-[13px] leading-snug" style={{ color: INK }}>{o.recommendationGiven}</p>
                {o.costImpact && (
                  <p className="text-[11.5px] mt-0.5 font-semibold" style={{ color: DANGER }}>
                    Impact: {o.costImpact}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[10.5px] font-bold px-2 py-0.5 rounded-full border"
                style={{
                  background: o.outcomeAfterOverride === "worse" ? `${DANGER}12` : o.outcomeAfterOverride === "better" ? `${SUCCESS}12` : `${MUTED}14`,
                  color: o.outcomeAfterOverride === "worse" ? DANGER : o.outcomeAfterOverride === "better" ? SUCCESS : MUTED,
                  borderColor: o.outcomeAfterOverride === "worse" ? `${DANGER}28` : o.outcomeAfterOverride === "better" ? `${SUCCESS}28` : `${MUTED}35`,
                }}>
                {o.outcomeAfterOverride ?? "pending"}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

interface DecisionResult {
  id: string;
  situation: string;
  decided: string;
  dissent: string | null;
  outcome: OutcomeType;
  similarity: number;
  date: string;
  entity: string;
}

interface ProjectResult {
  id: string;
  name: string;
  similarity: number;
  tags: string[];
  issues: string[];
  date: string;
  outcome: OutcomeType;
}

/* ── STATIC DEMO DATA — Decision mode ───────────────────── */
const DECISION_SEED: DecisionResult[] = [
  {
    id: "d1",
    situation: "Vendor qualification override requested mid-project for structural steel supplier",
    decided: "Override approved with enhanced inspection protocol and 10% retention holdback.",
    dissent: "Project controls flagged insufficient vendor track record for scale of scope.",
    outcome: "confirmed_bad",
    similarity: 94,
    date: "Mar 2025",
    entity: "Meridian Steel Fabrication",
  },
  {
    id: "d2",
    situation: "Substitution of specified bolt grade during active foundation pour phase",
    decided: "Substitution denied. Original spec maintained with expedited re-order.",
    dissent: null,
    outcome: "confirmed_good",
    similarity: 87,
    date: "Jan 2025",
    entity: "Coastal Bolt & Fastener",
  },
  {
    id: "d3",
    situation: "Clause negotiation — force majeure window extension requested by subcontractor",
    decided: "14-day extension granted, penalty clauses adjusted proportionally.",
    dissent: "Legal flagged precedent risk for future disputes on similar contracts.",
    outcome: "pending",
    similarity: 81,
    date: "Jun 2025",
    entity: "Titan Fabricators",
  },
];

/* ── STATIC DEMO DATA — Project mode ───────────────────── */
const PROJECT_SEED: ProjectResult[] = [
  {
    id: "p1",
    name: "Austin Semiconductor Fab",
    similarity: 92,
    tags: ["Data Center", "Structural Steel Primary", "12-Month Timeline", "High-Precision Tolerances"],
    issues: [
      "Vendor qualification overrides led to rework on 3 structural connections.",
      "Bolt substitution mid-pour caused 18-day schedule slip.",
      "Force majeure clause ambiguity triggered $240k dispute.",
    ],
    date: "2024–2025",
    outcome: "confirmed_bad",
  },
  {
    id: "p2",
    name: "Riverside Commerce Towers",
    similarity: 84,
    tags: ["Commercial Office", "Mixed Steel & Concrete", "6-Month Timeline", "Urban Site"],
    issues: [
      "Duplicate PO for rebar caught late — $156k exposure.",
      "Weather delay claims disputed on 2 occasions.",
    ],
    date: "2023–2024",
    outcome: "confirmed_good",
  },
  {
    id: "p3",
    name: "Coastal Logistics Hub Phase II",
    similarity: 76,
    tags: ["Industrial Warehouse", "Precast Primary", "9-Month Timeline", "Coastal Environment"],
    issues: [
      "Mill certificate authentication failure on 2 shipments.",
      "Pay application overbilling detected at Draw 5.",
    ],
    date: "2024",
    outcome: "pending",
  },
];

/* ── OUTCOME BADGE ──────────────────────────────────────── */
function OutcomeBadge({ outcome }: { outcome: OutcomeType }) {
  const cfg = {
    confirmed_good: { label: "Confirmed Good",  icon: CheckCircle2, color: SUCCESS, bg: `${SUCCESS}14`, border: `${SUCCESS}30` },
    confirmed_bad:  { label: "Confirmed Bad",   icon: AlertTriangle, color: DANGER,  bg: `${DANGER}14`,  border: `${DANGER}30`  },
    pending:        { label: "Pending",          icon: Clock,         color: WARNING, bg: `${WARNING}14`, border: `${WARNING}30` },
  }[outcome];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider border"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

/* ── SIMILARITY COUNTER ─────────────────────────────────── */
function SimilarityBar({ pct, index }: { pct: number; index: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: ACCENT }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, delay: index * 0.12 + 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <motion.span
        className="text-[15px] font-bold font-mono shrink-0 w-12 text-right"
        style={{ color: INK }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.12 + 0.5 }}
      >
        {pct}%
      </motion.span>
    </div>
  );
}

/* ── DECISION RESULT CARD ───────────────────────────────── */
function DecisionCard({ result, index }: { result: DecisionResult; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border overflow-hidden"
      style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.08)" }}
    >
      <div
        className="h-[3px] w-full"
        style={{
          background: index === 0
            ? `linear-gradient(90deg, ${ACCENT}, transparent)`
            : `linear-gradient(90deg, ${MUTED}, transparent)`
        }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span
              className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
              style={{ background: `${INK}08`, borderColor: `${INK}18`, color: ACCENT }}
            >
              #{index + 1} Match
            </span>
            <span className="text-[11px]" style={{ color: MUTED }}>{result.entity}</span>
            <span className="text-[11px] font-mono" style={{ color: MUTED }}>· {result.date}</span>
          </div>
          <OutcomeBadge outcome={result.outcome} />
        </div>
        <p className="text-[13.5px] font-semibold leading-snug mb-2" style={{ color: INK }}>
          {result.situation}
        </p>
        <div
          className="rounded-lg px-3 py-2.5 mb-3 text-[13px] leading-relaxed border-l-2"
          style={{ background: "rgba(255,255,255,0.04)", borderLeftColor: ACCENT, color: INK2 }}
        >
          <span className="font-bold text-[10px] uppercase tracking-wider block mb-1" style={{ color: MUTED }}>
            Decision Made
          </span>
          {result.decided}
        </div>
        {result.dissent && (
          <div
            className="rounded-lg px-3 py-2 mb-3 text-[12.5px] leading-relaxed flex items-start gap-2 border"
            style={{ background: `${WARNING}08`, borderColor: `${WARNING}25`, color: WARNING }}
          >
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>{result.dissent}</span>
          </div>
        )}
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: MUTED }}>
            Similarity Match
          </span>
          <SimilarityBar pct={result.similarity} index={index} />
        </div>
      </div>
    </motion.div>
  );
}

/* ── PROJECT RESULT CARD ────────────────────────────────── */
function ProjectCard({ result, index }: { result: ProjectResult; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border overflow-hidden"
      style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.08)" }}
    >
      <div className="h-[3px]" style={{
        background: index === 0
          ? `linear-gradient(90deg, ${ACCENT}, transparent)`
          : `linear-gradient(90deg, ${MUTED}, transparent)`
      }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
                style={{ background: `${INK}08`, borderColor: `${INK}18`, color: ACCENT }}
              >
                #{index + 1} Match
              </span>
              <span className="text-[11px] font-mono" style={{ color: MUTED }}>· {result.date}</span>
            </div>
            <h3 className="text-[15px] font-bold" style={{ color: INK }}>{result.name}</h3>
          </div>
          <OutcomeBadge outcome={result.outcome} />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {result.tags.map(tag => (
            <span
              key={tag}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full border"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER, color: INK2 }}
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mb-4">
          <span className="text-[10.5px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: MUTED }}>
            Similarity Match
          </span>
          <SimilarityBar pct={result.similarity} index={index} />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors text-[12.5px] font-semibold"
          style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)", color: INK2 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; }}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={13} style={{ color: WARNING }} />
            Known issues on projects like this ({result.issues.length})
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2">
                {result.issues.map((issue, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-2.5 text-[12.5px] leading-relaxed"
                    style={{ color: INK2 }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: DANGER }} />
                    {issue}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ── LOADING SKELETON ───────────────────────────────────── */
function ResultSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border p-5 space-y-3"
      style={{ background: SURFACE, borderColor: BORDER }}
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded shimmer-modern" />
        <div className="h-6 w-28 rounded-full shimmer-modern" />
      </div>
      <div className="h-4 w-3/4 rounded shimmer-modern" />
      <div className="h-14 rounded-lg shimmer-modern" />
      <div className="h-2 rounded-full shimmer-modern" />
    </motion.div>
  );
}

/* ── EMPTY STATE ────────────────────────────────────────── */
function EmptyState({ mode }: { mode: "decision" | "project" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 rounded-xl border"
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      {mode === "decision"
        ? <Scale size={36} className="mb-4" style={{ color: MUTED }} />
        : <FolderOpen size={36} className="mb-4" style={{ color: MUTED }} />
      }
      <p className="text-[15px] font-semibold mb-1" style={{ color: INK }}>
        {mode === "decision" ? "Describe the situation" : "Describe the project"}
      </p>
      <p className="text-[13px] text-center max-w-xs" style={{ color: MUTED }}>
        {mode === "decision"
          ? "Enter the ambiguous decision you're facing and Precedent will surface the most similar past cases."
          : "Describe your project's scope, type, and key characteristics to find historically similar projects."
        }
      </p>
    </motion.div>
  );
}

/* ── CLAUSE MEMORY FEATURE ──────────────────────────────── */
function ClauseMemoryFeature() {
  const VENDORS = [
    { id: "vendor_meridian_steel", name: "Meridian Steel Fabrication" },
    { id: "vendor_titan_fab",      name: "Titan Fabricators"          },
    { id: "vendor_coastal_bolt",   name: "Coastal Bolt & Fastener"    },
  ];

  const [selectedClause, setSelectedClause] = useState(CLAUSE_TYPES[0]);
  const [selectedVendor, setSelectedVendor] = useState(VENDORS[0].id);

  const global = CLAUSE_HISTORY.filter(r => r.clauseType === selectedClause);
  const globalTriggered = global.filter(r => r.wasTriggered);
  const globalTriggerRate = global.length > 0 ? Math.round((globalTriggered.length / global.length) * 100) : 0;
  const globalAvgDisputeDays = globalTriggered.length > 0
    ? Math.round(globalTriggered.filter(r => r.disputeLengthDays).reduce((s, r) => s + (r.disputeLengthDays ?? 0), 0) / globalTriggered.filter(r => r.disputeLengthDays).length)
    : null;

  const vendorRecords = global.filter(r => r.vendorId === selectedVendor);
  const vendorTriggered = vendorRecords.filter(r => r.wasTriggered);
  const vendorTriggerRate = vendorRecords.length > 0 ? Math.round((vendorTriggered.length / vendorRecords.length) * 100) : 0;
  const vendorAvgDisputeDays = vendorTriggered.length > 0
    ? Math.round(vendorTriggered.filter(r => r.disputeLengthDays).reduce((s, r) => s + (r.disputeLengthDays ?? 0), 0) / vendorTriggered.filter(r => r.disputeLengthDays).length)
    : null;

  const selectedVendorName = VENDORS.find(v => v.id === selectedVendor)?.name ?? "";

  const outcomeColor = (outcome: ClauseRecord["outcome"]) => ({
    resolved_favorable:   SUCCESS,
    resolved_unfavorable: DANGER,
    settled:              WARNING,
    not_triggered:        MUTED,
  }[outcome]);

  const outcomeLabel = (outcome: ClauseRecord["outcome"]) => ({
    resolved_favorable:   "Resolved — Favorable",
    resolved_unfavorable: "Resolved — Unfavorable",
    settled:              "Settled",
    not_triggered:        "Not Triggered",
  }[outcome]);

  return (
    <div className="space-y-8">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: MUTED }}>
            Clause Type
          </label>
          <div className="flex flex-wrap gap-2">
            {CLAUSE_TYPES.map(ct => (
              <button key={ct} onClick={() => setSelectedClause(ct)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all"
                style={{
                  background: selectedClause === ct ? "#0C0A14" : SURFACE,
                  color: selectedClause === ct ? INK : INK2,
                  borderColor: selectedClause === ct ? ACCENT : BORDER,
                  boxShadow: selectedClause === ct ? "0 0 12px rgba(125, 57, 235, 0.2)" : "none",
                }}>
                {ct}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 min-w-[200px]">
          <label className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: MUTED }}>
            Vendor Context
          </label>
          <div className="flex flex-col gap-1.5">
            {VENDORS.map(v => (
              <button key={v.id} onClick={() => setSelectedVendor(v.id)}
                className="px-3 py-2 rounded-lg text-[12.5px] font-semibold border text-left transition-all"
                style={{
                  background: selectedVendor === v.id ? "#0C0A14" : SURFACE,
                  color: selectedVendor === v.id ? INK : INK2,
                  borderColor: selectedVendor === v.id ? ACCENT : BORDER,
                  boxShadow: selectedVendor === v.id ? "0 0 12px rgba(125, 57, 235, 0.2)" : "none",
                }}>
                {v.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Global track record card */}
      <motion.div
        key={selectedClause}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border overflow-hidden"
        style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.07)" }}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2">
            <BarChart2 size={15} style={{ color: ACCENT }} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: INK }}>
              Company-wide Track Record
            </span>
          </div>
          <span className="text-[11px] font-mono" style={{ color: MUTED }}>
            {global.length} contracts
          </span>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Trigger Rate",    value: `${globalTriggerRate}%`, sub: `${globalTriggered.length} of ${global.length}` },
              { label: "Avg Dispute",     value: globalAvgDisputeDays ? `${globalAvgDisputeDays}d` : "—",  sub: "when triggered" },
              { label: "Total Contracts", value: `${global.length}`,  sub: "across all vendors" },
            ].map((stat, i) => (
              <motion.div key={stat.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.35 }}
                className="rounded-lg p-3 border text-center"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER }}
              >
                <div className="text-[22px] font-bold font-mono" style={{ color: INK }}>{stat.value}</div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider mt-0.5" style={{ color: MUTED }}>{stat.label}</div>
                <div className="text-[10px] mt-0.5" style={{ color: MUTED }}>{stat.sub}</div>
              </motion.div>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>Triggered vs. Not</span>
              <span className="text-[11px] font-mono" style={{ color: INK2 }}>{globalTriggered.length} triggered · {global.length - globalTriggered.length} clean</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div
                className="h-full rounded-l-full"
                style={{ background: DANGER }}
                initial={{ width: 0 }}
                animate={{ width: `${globalTriggerRate}%` }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.div
                className="h-full rounded-r-full"
                style={{ background: SUCCESS }}
                initial={{ width: 0 }}
                animate={{ width: `${100 - globalTriggerRate}%` }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className="flex gap-4 mt-1.5">
              <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: DANGER }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: DANGER }} />
                Triggered ({globalTriggerRate}%)
              </div>
              <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: SUCCESS }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: SUCCESS }} />
                Not triggered ({100 - globalTriggerRate}%)
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Per-vendor breakdown */}
      <motion.div
        key={`${selectedClause}-${selectedVendor}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border overflow-hidden"
        style={{ background: SURFACE, borderColor: vendorTriggered.length > 0 ? `${WARNING}40` : BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.07)" }}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: BORDER, background: vendorTriggered.length > 0 ? `${WARNING}08` : "rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: INK }}>
              {selectedVendorName}
            </span>
            <span className="text-[10.5px] px-2 py-0.5 rounded-full border font-semibold"
              style={{ background: `${INK}08`, borderColor: BORDER, color: MUTED }}>
              Vendor-specific history
            </span>
          </div>
          <span className="text-[11px] font-mono" style={{ color: MUTED }}>{vendorRecords.length} contracts</span>
        </div>
        <div className="p-5 space-y-4">
          {vendorRecords.length === 0 ? (
            <div className="py-8 text-center" style={{ color: MUTED }}>
              <FileSearch size={28} className="mx-auto mb-2" style={{ color: MUTED }} />
              <p className="text-[13px]">No clause history found for {selectedVendorName} on {selectedClause}.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-3 border" style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER }}>
                  <div className="text-[20px] font-bold font-mono" style={{ color: vendorTriggerRate >= 50 ? DANGER : SUCCESS }}>
                    {vendorTriggerRate}%
                  </div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                    Trigger Rate vs. {globalTriggerRate}% global
                  </div>
                </div>
                <div className="rounded-lg p-3 border" style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER }}>
                  <div className="text-[20px] font-bold font-mono" style={{ color: INK }}>
                    {vendorAvgDisputeDays ? `${vendorAvgDisputeDays}d` : "—"}
                  </div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                    Avg dispute vs. {globalAvgDisputeDays ? `${globalAvgDisputeDays}d` : "—"} global
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {vendorRecords.map((rec, i) => (
                  <motion.div key={rec.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.3 }}
                    className="flex items-center gap-4 rounded-lg border p-3.5"
                    style={{ background: rec.wasTriggered ? `${DANGER}06` : SURFACE, borderColor: rec.wasTriggered ? `${DANGER}20` : BORDER }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: outcomeColor(rec.outcome) }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold" style={{ color: INK }}>{rec.projectName}</span>
                        <span className="text-[11px] font-mono" style={{ color: MUTED }}>{rec.contractId}</span>
                      </div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: MUTED }}>
                        {rec.year} · {rec.wasTriggered ? `Triggered — ${rec.disputeLengthDays}d dispute` : "Not triggered"}
                      </div>
                    </div>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                      style={{ background: `${outcomeColor(rec.outcome)}14`, color: outcomeColor(rec.outcome), borderColor: `${outcomeColor(rec.outcome)}30` }}>
                      {outcomeLabel(rec.outcome)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── SUBMITTAL REVIEWER SEED DATA ───────────────────────── */
interface RejectionRecord {
  reviewerId: string;
  submittalType: string;
  rejectionReason: string;
  reasonKey: string; // machine-readable keyword for matching
}

interface SubmittalOption {
  id: string;
  label: string;
  type: string;
  presentFields: string[]; // what this submittal declares it contains
}

interface ReviewerProfile {
  id: string;
  name: string;
  title: string;
  firm: string;
  totalReviewed: number;
}

const REVIEWER_PROFILES: ReviewerProfile[] = [
  { id: "rev_diana_chang",    name: "Diana Chang",    title: "Senior Structural Engineer",      firm: "Apex Engineering Group",      totalReviewed: 10 },
  { id: "rev_marcus_okafor",  name: "Marcus Okafor",  title: "Principal Architect",             firm: "Vantage Design Partners",     totalReviewed: 8  },
  { id: "rev_leila_nazari",   name: "Leila Nazari",   title: "Fire Protection Engineer",        firm: "SafeSpec Consulting",         totalReviewed: 9  },
];

const REVIEWER_REJECTIONS: RejectionRecord[] = [
  // Diana Chang — skews toward missing structural calcs and bolt schedules
  { reviewerId: "rev_diana_chang",   submittalType: "Structural Steel Shop Drawing",  rejectionReason: "Missing connection bolt torque schedule",         reasonKey: "bolt_torque_schedule"       },
  { reviewerId: "rev_diana_chang",   submittalType: "Structural Steel Shop Drawing",  rejectionReason: "Missing connection bolt torque schedule",         reasonKey: "bolt_torque_schedule"       },
  { reviewerId: "rev_diana_chang",   submittalType: "Structural Steel Shop Drawing",  rejectionReason: "Missing connection bolt torque schedule",         reasonKey: "bolt_torque_schedule"       },
  { reviewerId: "rev_diana_chang",   submittalType: "Structural Steel Shop Drawing",  rejectionReason: "Incomplete weld procedure specification (WPS)",    reasonKey: "weld_procedure_spec"        },
  { reviewerId: "rev_diana_chang",   submittalType: "Structural Steel Shop Drawing",  rejectionReason: "Incomplete weld procedure specification (WPS)",    reasonKey: "weld_procedure_spec"        },
  { reviewerId: "rev_diana_chang",   submittalType: "Anchor Bolt Submittal",          rejectionReason: "Missing connection bolt torque schedule",         reasonKey: "bolt_torque_schedule"       },
  { reviewerId: "rev_diana_chang",   submittalType: "Anchor Bolt Submittal",          rejectionReason: "Spec section cross-reference not cited",          reasonKey: "spec_cross_reference"       },
  { reviewerId: "rev_diana_chang",   submittalType: "Mill Test Report",               rejectionReason: "Heat number not traceable to delivery ticket",     reasonKey: "heat_number_traceability"   },
  { reviewerId: "rev_diana_chang",   submittalType: "Concrete Mix Design",            rejectionReason: "Incomplete weld procedure specification (WPS)",    reasonKey: "weld_procedure_spec"        },
  { reviewerId: "rev_diana_chang",   submittalType: "Concrete Mix Design",            rejectionReason: "Spec section cross-reference not cited",          reasonKey: "spec_cross_reference"       },
  // Marcus Okafor — skews toward incomplete spec cross-references and missing fire ratings
  { reviewerId: "rev_marcus_okafor", submittalType: "Curtain Wall Shop Drawing",      rejectionReason: "Missing fire-rated assembly documentation",       reasonKey: "fire_rated_assembly_docs"   },
  { reviewerId: "rev_marcus_okafor", submittalType: "Curtain Wall Shop Drawing",      rejectionReason: "Missing fire-rated assembly documentation",       reasonKey: "fire_rated_assembly_docs"   },
  { reviewerId: "rev_marcus_okafor", submittalType: "Door & Frame Submittal",         rejectionReason: "Missing fire-rated assembly documentation",       reasonKey: "fire_rated_assembly_docs"   },
  { reviewerId: "rev_marcus_okafor", submittalType: "Door & Frame Submittal",         rejectionReason: "Incomplete spec cross-reference",                 reasonKey: "spec_cross_reference"       },
  { reviewerId: "rev_marcus_okafor", submittalType: "Door & Frame Submittal",         rejectionReason: "Incomplete spec cross-reference",                 reasonKey: "spec_cross_reference"       },
  { reviewerId: "rev_marcus_okafor", submittalType: "Curtain Wall Shop Drawing",      rejectionReason: "Finish schedule not included",                    reasonKey: "finish_schedule"            },
  { reviewerId: "rev_marcus_okafor", submittalType: "Roofing Submittal",              rejectionReason: "Missing fire-rated assembly documentation",       reasonKey: "fire_rated_assembly_docs"   },
  { reviewerId: "rev_marcus_okafor", submittalType: "Roofing Submittal",              rejectionReason: "Spec section cross-reference not cited",          reasonKey: "spec_cross_reference"       },
  // Leila Nazari — skews heavily toward fire suppression and code compliance gaps
  { reviewerId: "rev_leila_nazari",  submittalType: "Fire Suppression Shop Drawing",  rejectionReason: "NFPA 13 hydraulic calc sheet missing",            reasonKey: "hydraulic_calc_sheet"       },
  { reviewerId: "rev_leila_nazari",  submittalType: "Fire Suppression Shop Drawing",  rejectionReason: "NFPA 13 hydraulic calc sheet missing",            reasonKey: "hydraulic_calc_sheet"       },
  { reviewerId: "rev_leila_nazari",  submittalType: "Fire Suppression Shop Drawing",  rejectionReason: "NFPA 13 hydraulic calc sheet missing",            reasonKey: "hydraulic_calc_sheet"       },
  { reviewerId: "rev_leila_nazari",  submittalType: "Fire Suppression Shop Drawing",  rejectionReason: "Pipe schedule & hanger spacing not shown",        reasonKey: "pipe_schedule_hangers"      },
  { reviewerId: "rev_leila_nazari",  submittalType: "Fire Suppression Shop Drawing",  rejectionReason: "Pipe schedule & hanger spacing not shown",        reasonKey: "pipe_schedule_hangers"      },
  { reviewerId: "rev_leila_nazari",  submittalType: "Fire Alarm Submittal",           rejectionReason: "AHJ approval letter not attached",                reasonKey: "ahj_approval_letter"        },
  { reviewerId: "rev_leila_nazari",  submittalType: "Fire Alarm Submittal",           rejectionReason: "NFPA 13 hydraulic calc sheet missing",            reasonKey: "hydraulic_calc_sheet"       },
  { reviewerId: "rev_leila_nazari",  submittalType: "Fire Alarm Submittal",           rejectionReason: "Battery backup calculation missing",              reasonKey: "battery_backup_calc"        },
  { reviewerId: "rev_leila_nazari",  submittalType: "Sprinkler Head Schedule",        rejectionReason: "Pipe schedule & hanger spacing not shown",        reasonKey: "pipe_schedule_hangers"      },
];

// Submittals the user can select to check
const SUBMITTAL_OPTIONS: SubmittalOption[] = [
  {
    id: "sub_steel_tower_b",
    label: "Tower B Steel Shop Drawings (Meridian Steel)",
    type: "Structural Steel Shop Drawing",
    presentFields: ["connection_details", "material_grades", "weld_procedure_spec", "erection_sequence"],
    // NOTE: deliberately missing bolt_torque_schedule — Diana will flag it
  },
  {
    id: "sub_anchor_bolts",
    label: "Anchor Bolt Package (Coastal Bolt)",
    type: "Anchor Bolt Submittal",
    presentFields: ["bolt_spec", "material_certification", "spec_cross_reference", "installation_notes"],
    // NOTE: has spec_cross_reference — Diana won't flag that one
  },
  {
    id: "sub_fire_suppression",
    label: "Fire Suppression Shop Drawing (Austin Fab Level 2)",
    type: "Fire Suppression Shop Drawing",
    presentFields: ["pipe_schedule_hangers", "sprinkler_head_schedule", "coverage_area_plan"],
    // NOTE: missing hydraulic_calc_sheet — Leila will flag it
  },
  {
    id: "sub_curtain_wall",
    label: "North Curtain Wall System Submittal",
    type: "Curtain Wall Shop Drawing",
    presentFields: ["elevation_drawings", "section_details", "spec_cross_reference", "finish_schedule"],
    // NOTE: missing fire_rated_assembly_docs — Marcus will flag it
  },
];

/* ── SUBMITTAL REVIEWER FEATURE ─────────────────────────── */
function SubmittalReviewerFeature() {
  const [selectedReviewer, setSelectedReviewer] = useState(REVIEWER_PROFILES[0].id);
  const [selectedSubmittal, setSelectedSubmittal] = useState(SUBMITTAL_OPTIONS[0].id);

  const reviewer  = REVIEWER_PROFILES.find(r => r.id === selectedReviewer)!;
  const submittal = SUBMITTAL_OPTIONS.find(s => s.id === selectedSubmittal)!;

  // Compute rejection reason frequency for this reviewer
  const reviewerRejections = REVIEWER_REJECTIONS.filter(r => r.reviewerId === selectedReviewer);
  const reasonCounts: Record<string, { reason: string; key: string; count: number }> = {};
  for (const r of reviewerRejections) {
    if (!reasonCounts[r.reasonKey]) {
      reasonCounts[r.reasonKey] = { reason: r.rejectionReason, key: r.reasonKey, count: 0 };
    }
    reasonCounts[r.reasonKey].count++;
  }
  const sortedReasons = Object.values(reasonCounts).sort((a, b) => b.count - a.count);
  const topReason = sortedReasons[0];

  // Predictive match — does submittal's present fields cover top rejection reason?
  const submittalCoversTopReason = submittal.presentFields.includes(topReason?.key ?? "");
  const atRisk = !submittalCoversTopReason && topReason;

  const maxCount = sortedReasons[0]?.count ?? 1;

  return (
    <div className="space-y-8">

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reviewer selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: MUTED }}>
            Select Reviewer
          </label>
          <div className="space-y-2">
            {REVIEWER_PROFILES.map(r => (
              <button key={r.id} onClick={() => setSelectedReviewer(r.id)}
                className="w-full text-left px-4 py-3 rounded-xl border transition-all"
                style={{
                  background: selectedReviewer === r.id ? "#0C0A14" : SURFACE,
                  borderColor: selectedReviewer === r.id ? ACCENT : BORDER,
                  boxShadow: selectedReviewer === r.id ? "0 0 12px rgba(125, 57, 235, 0.2)" : "none",
                }}>
                <p className="text-[13.5px] font-bold" style={{ color: selectedReviewer === r.id ? INK : INK2 }}>
                  {r.name}
                </p>
                <p className="text-[11.5px] mt-0.5" style={{ color: selectedReviewer === r.id ? INK2 : MUTED }}>
                  {r.title} · {r.firm}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Submittal selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: MUTED }}>
            Select Submittal to Check
          </label>
          <div className="space-y-2">
            {SUBMITTAL_OPTIONS.map(s => (
              <button key={s.id} onClick={() => setSelectedSubmittal(s.id)}
                className="w-full text-left px-4 py-3 rounded-xl border transition-all"
                style={{
                  background: selectedSubmittal === s.id ? "#0C0A14" : SURFACE,
                  borderColor: selectedSubmittal === s.id ? ACCENT : BORDER,
                  boxShadow: selectedSubmittal === s.id ? "0 0 12px rgba(125, 57, 235, 0.2)" : "none",
                }}>
                <p className="text-[13px] font-semibold leading-snug" style={{ color: selectedSubmittal === s.id ? INK : INK2 }}>
                  {s.label}
                </p>
                <p className="text-[11px] mt-0.5 font-mono" style={{ color: selectedSubmittal === s.id ? INK2 : MUTED }}>
                  {s.type}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Predictive risk callout banner */}
      <AnimatePresence mode="wait">
        {atRisk ? (
          <motion.div
            key={`risk-${selectedReviewer}-${selectedSubmittal}`}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border-l-4 p-5 flex items-start gap-4"
            style={{ background: `${DANGER}08`, borderLeftColor: DANGER, borderColor: `${DANGER}30` }}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2"
              style={{ background: `${DANGER}14`, borderColor: `${DANGER}40` }}>
              <AlertTriangle size={18} style={{ color: DANGER }} />
            </div>
            <div className="flex-1">
              <p className="text-[13.5px] font-bold mb-1" style={{ color: DANGER }}>
                High Risk of Rejection — Pattern Match
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: INK2 }}>
                <span className="font-semibold" style={{ color: INK }}>{reviewer.name}</span> rejects submittals
                most often for: <span className="font-semibold" style={{ color: INK }}>"{topReason.reason}"</span> ({topReason.count}/{reviewer.totalReviewed} reviews).
                This submittal does not appear to include this item.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border"
                  style={{ background: `${DANGER}14`, color: DANGER, borderColor: `${DANGER}30` }}>
                  Add before submission
                </span>
                <span className="text-[11.5px]" style={{ color: MUTED }}>
                  Missing field: <span className="font-mono">{topReason.key.replace(/_/g, " ")}</span>
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`clear-${selectedReviewer}-${selectedSubmittal}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border px-5 py-4 flex items-center gap-3"
            style={{ background: `${SUCCESS}08`, borderColor: `${SUCCESS}25` }}
          >
            <CheckCircle2 size={18} style={{ color: SUCCESS }} />
            <p className="text-[13px] font-semibold" style={{ color: SUCCESS }}>
              This submittal covers {reviewer.name}'s most common rejection reason. Looks good.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviewer Pattern card */}
      <motion.div
        key={`pattern-${selectedReviewer}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border overflow-hidden"
        style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.07)" }}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)" }}>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: INK }}>
              Reviewer Pattern — {reviewer.name}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
              Historical rejection reasons across {reviewer.totalReviewed} submittals reviewed
            </p>
          </div>
          <span className="font-mono text-[13px] font-bold px-3 py-1.5 rounded-lg border"
            style={{ background: `${DANGER}10`, color: DANGER, borderColor: `${DANGER}25` }}>
            {reviewerRejections.length} rejections
          </span>
        </div>

        <div className="p-5 space-y-3">
          {sortedReasons.map((r, i) => {
            const pct = (r.count / reviewer.totalReviewed) * 100;
            const isTop = i === 0;
            return (
              <motion.div key={r.key}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.35 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isTop && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: `${DANGER}14`, color: DANGER }}>
                        #1
                      </span>
                    )}
                    <span className="text-[13px] leading-snug truncate" style={{ color: INK, fontWeight: isTop ? 600 : 400 }}>
                      {r.reason}
                    </span>
                  </div>
                  <span className="text-[12px] font-bold font-mono shrink-0" style={{ color: isTop ? DANGER : INK2 }}>
                    {r.count}/{reviewer.totalReviewed}
                  </span>
                </div>
                {/* Horizontal bar */}
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: isTop ? DANGER : (i === 1 ? WARNING : MUTED) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(r.count / maxCount) * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Submittal field coverage */}
      <motion.div
        key={`coverage-${selectedSubmittal}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="rounded-xl border overflow-hidden"
        style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.07)" }}
      >
        <div className="px-5 py-3.5 border-b" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)" }}>
          <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: INK }}>
            Submittal Declared Contents
          </p>
        </div>
        <div className="p-5 flex flex-wrap gap-2">
          {submittal.presentFields.map(f => (
            <span key={f}
              className="text-[11.5px] font-medium px-3 py-1.5 rounded-full border"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER, color: INK2 }}>
              ✓ {f.replace(/_/g, " ")}
            </span>
          ))}
          {atRisk && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-[11.5px] font-bold px-3 py-1.5 rounded-full border"
              style={{ background: `${DANGER}10`, borderColor: `${DANGER}30`, color: DANGER }}>
              ✗ {topReason.key.replace(/_/g, " ")} — MISSING
            </motion.span>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── NEGOTIATION MEMORY FEATURE ─────────────────────────── */
function NegotiationMemoryFeature() {
  const VENDORS = [
    { id: "vendor_meridian_steel", name: "Meridian Steel Fabrication" },
    { id: "vendor_titan_fab",      name: "Titan Fabricators"          },
    { id: "vendor_coastal_bolt",   name: "Coastal Bolt & Fastener"    },
  ];

  const [selectedVendor, setSelectedVendor] = useState(VENDORS[0].id);
  const profile = NEGOTIATION_PROFILES[selectedVendor];

  // Compute per-issue tendency from majority count
  const ISSUE_KEYS = ["payment_terms", "unit_price", "schedule", "warranty"] as const;
  type IssueKey = typeof ISSUE_KEYS[number];

  const issueTendency = (issueKey: IssueKey) => {
    const records = profile.issues.filter(i => i.issue === issueKey);
    const conceded = records.filter(i => i.conceded).length;
    const held     = records.length - conceded;
    return {
      concedes: conceded > held,
      concededCount: conceded,
      totalCount: records.length,
      notes: records[0]?.notes ?? "",
    };
  };

  const ISSUE_META: Record<IssueKey, { label: string; icon: string }> = {
    payment_terms: { label: "Payment Terms", icon: "💳" },
    unit_price:    { label: "Unit Price",    icon: "💰" },
    schedule:      { label: "Schedule",      icon: "📅" },
    warranty:      { label: "Warranty",      icon: "🛡️" },
  };

  // Plot dimensions
  const W = 380; const H = 280;
  const PAD = { t: 24, r: 24, b: 48, l: 52 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const pts = profile.tradeoffPoints;
  const maxX = Math.max(...pts.map(p => p.priceConcessionPct), 6);
  const maxY = Math.max(...pts.map(p => p.scheduleConcessionDays), 25);

  const toSvgX = (v: number) => PAD.l + (v / maxX) * plotW;
  const toSvgY = (v: number) => PAD.t + plotH - (v / maxY) * plotH;

  const outcomeColor = (o: TradeoffPoint["outcome"]) =>
    o === "accepted" ? SUCCESS : o === "counter-accepted" ? WARNING : DANGER;

  return (
    <div className="space-y-8">

      {/* Vendor selector */}
      <div className="flex flex-wrap gap-2">
        {VENDORS.map(v => (
          <button key={v.id} onClick={() => setSelectedVendor(v.id)}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold border transition-all"
            style={{
              background: selectedVendor === v.id ? INK : SURFACE,
              color: selectedVendor === v.id ? INK : ACCENT,
              borderColor: selectedVendor === v.id ? INK : BORDER,
              boxShadow: selectedVendor === v.id ? "0 2px 8px rgba(41,28,14,0.18)" : "none",
            }}>
            {v.name}
          </button>
        ))}
      </div>

      {/* Negotiation Profile card */}
      <motion.div
        key={selectedVendor}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border overflow-hidden"
        style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.07)" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: INK }}>
              Negotiation Profile
            </span>
            <span className="text-[10.5px] px-2 py-0.5 rounded-full border font-semibold"
              style={{ background: `${INK}08`, borderColor: BORDER, color: MUTED }}>
              {profile.vendorName}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: INK2 }}>{profile.summary}</p>
        </div>

        {/* Issue tendency grid */}
        <div className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider block mb-4" style={{ color: MUTED }}>
            Documented Behavior per Issue
          </span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ISSUE_KEYS.map((key, i) => {
              const t = issueTendency(key);
              const meta = ISSUE_META[key];
              return (
                <motion.div key={key}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.35 }}
                  className="rounded-xl border p-4 flex flex-col gap-2"
                  style={{
                    background: t.concedes ? `${SUCCESS}08` : `${DANGER}06`,
                    borderColor: t.concedes ? `${SUCCESS}25` : `${DANGER}20`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[18px]">{meta.icon}</span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                      style={{
                        background: t.concedes ? `${SUCCESS}18` : `${DANGER}14`,
                        color: t.concedes ? SUCCESS : DANGER,
                        borderColor: t.concedes ? `${SUCCESS}35` : `${DANGER}28`,
                      }}
                    >
                      {t.concedes ? "Concedes" : "Holds Firm"}
                    </span>
                  </div>
                  <div>
                    <p className="text-[12.5px] font-bold" style={{ color: INK }}>{meta.label}</p>
                    <p className="text-[10.5px] mt-0.5 font-mono" style={{ color: MUTED }}>
                      {t.concededCount}/{t.totalCount} negotiations
                    </p>
                  </div>
                  {/* Mini ratio bar */}
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: t.concedes ? SUCCESS : DANGER }}
                      initial={{ width: 0 }}
                      animate={{ width: `${t.totalCount > 0 ? (t.concededCount / t.totalCount) * 100 : 0}%` }}
                      transition={{ duration: 0.7, delay: 0.3 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Trade-off Frontier */}
      <motion.div
        key={`${selectedVendor}-frontier`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border overflow-hidden"
        style={{ background: SURFACE, borderColor: BORDER, boxShadow: "0 2px 8px rgba(41,28,14,0.07)" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)" }}>
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: INK }}>
            Trade-off Frontier
          </span>
          <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
            Past negotiated outcomes — price concession vs. schedule concession
          </p>
        </div>

        <div className="p-5">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* SVG scatter plot */}
            <div className="flex-1 min-w-0">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full max-w-[420px]"
                style={{ overflow: "visible" }}
              >
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(t => {
                  const y = PAD.t + t * plotH;
                  const val = Math.round(maxY * (1 - t));
                  return (
                    <g key={t}>
                      <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
                        stroke={BORDER} strokeDasharray="4 3" strokeWidth="1" />
                      <text x={PAD.l - 6} y={y + 4} textAnchor="end"
                        fill={MUTED} fontSize="10" fontFamily="monospace">{val}d</text>
                    </g>
                  );
                })}
                {[0, 0.25, 0.5, 0.75, 1].map(t => {
                  const x = PAD.l + t * plotW;
                  const val = (maxX * t).toFixed(1);
                  return (
                    <g key={t}>
                      <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + plotH}
                        stroke={BORDER} strokeDasharray="4 3" strokeWidth="1" />
                      <text x={x} y={PAD.t + plotH + 16} textAnchor="middle"
                        fill={MUTED} fontSize="10" fontFamily="monospace">{val}%</text>
                    </g>
                  );
                })}

                {/* Axis labels */}
                <text x={PAD.l + plotW / 2} y={H - 4} textAnchor="middle"
                  fill={INK2} fontSize="11" fontWeight="600">Price Concession (%)</text>
                <text x={12} y={PAD.t + plotH / 2} textAnchor="middle"
                  fill={INK2} fontSize="11" fontWeight="600"
                  transform={`rotate(-90, 12, ${PAD.t + plotH / 2})`}>
                  Schedule Concession (days)
                </text>

                {/* Axes */}
                <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + plotH}
                  stroke={MUTED} strokeWidth="1.5" />
                <line x1={PAD.l} y1={PAD.t + plotH} x2={W - PAD.r} y2={PAD.t + plotH}
                  stroke={MUTED} strokeWidth="1.5" />

                {/* Data points */}
                {pts.map((pt, i) => {
                  const cx = toSvgX(pt.priceConcessionPct);
                  const cy = toSvgY(pt.scheduleConcessionDays);
                  const color = outcomeColor(pt.outcome);
                  return (
                    <g key={pt.negotiationId}>
                      <motion.circle
                        cx={cx} cy={cy} r={9}
                        fill={`${color}22`}
                        stroke={color}
                        strokeWidth={2}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.4 + i * 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      />
                      <motion.text
                        x={cx + 13} y={cy + 4}
                        fill={INK} fontSize="10" fontWeight="600"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 + i * 0.15 }}
                      >
                        {pt.label}
                      </motion.text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Legend + outcome list */}
            <div className="space-y-3 min-w-[180px]">
              <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: MUTED }}>
                Past Outcomes
              </span>
              {pts.map((pt, i) => (
                <motion.div key={pt.negotiationId}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="rounded-lg border p-3 space-y-1.5"
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold" style={{ color: INK }}>{pt.label}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                      style={{
                        background: `${outcomeColor(pt.outcome)}14`,
                        color: outcomeColor(pt.outcome),
                        borderColor: `${outcomeColor(pt.outcome)}30`,
                      }}
                    >
                      {pt.outcome.replace("-", " ")}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[11px] font-mono" style={{ color: MUTED }}>
                    <span>Price −{pt.priceConcessionPct}%</span>
                    <span>Sched +{pt.scheduleConcessionDays}d</span>
                  </div>
                </motion.div>
              ))}

              {/* Legend */}
              <div className="pt-2 space-y-1">
                {(["accepted", "counter-accepted", "rejected"] as const).map(o => (
                  <div key={o} className="flex items-center gap-2 text-[11px]" style={{ color: MUTED }}>
                    <span className="w-3 h-3 rounded-full border-2 shrink-0"
                      style={{ borderColor: outcomeColor(o), background: `${outcomeColor(o)}22` }} />
                    {o.replace("-", " ")}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── BLIND SCORING FEATURE ──────────────────────────────── */
function BlindScoringFeature() {
  const initScores = (): VendorScore[] =>
    VENDOR_PROPOSALS.map(v => ({ vendorId: v.id, scores: Object.fromEntries(SCORE_CRITERIA.map(c => [c.id, 5])) }));

  const [scores, setScores]       = useState<VendorScore[]>(initScores);
  const [locked, setLocked]       = useState(false);
  const [revealed, setRevealed]   = useState(false);
  const [locking, setLocking]     = useState(false);

  const setScore = (vendorId: string, criteriaId: string, val: number) => {
    if (locked) return;
    setScores(prev => prev.map(v =>
      v.vendorId === vendorId ? { ...v, scores: { ...v.scores, [criteriaId]: val } } : v
    ));
  };

  const weightedTotal = (vs: VendorScore) =>
    Math.round(SCORE_CRITERIA.reduce((sum, c) => sum + (vs.scores[c.id] ?? 5) * c.weight * 10, 0));

  const handleLock = async () => {
    setLocking(true);
    try {
      await fetch("/api/precedent/blind-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluation_id: "eval-demo-001",
          scores: scores.map(v => ({ vendor_id: v.vendorId, scores: v.scores })),
        }),
      });
    } catch { /* backend not required for demo */ }
    await new Promise(r => setTimeout(r, 600));
    setLocked(true);
    setLocking(false);
    setTimeout(() => setRevealed(true), 400);
  };

  const handleReset = () => { setScores(initScores()); setLocked(false); setRevealed(false); };

  const sortedByScore = [...scores].map(v => ({ ...v, total: weightedTotal(v) }))
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

  const techRank = (vendorId: string) => sortedByScore.findIndex(v => v.vendorId === vendorId) + 1;
  const getPricing = (vendorId: string) => PRICING_DATA.find(p => p.vendorId === vendorId)!;

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border-l-4 px-5 py-4 flex items-start gap-4"
        style={{ background: `${AI}0A`, borderLeftColor: AI, borderColor: `${AI}25` }}
      >
        <EyeOff size={20} className="shrink-0 mt-0.5" style={{ color: AI }} />
        <div>
          <p className="text-[13.5px] font-bold" style={{ color: INK }}>
            Price is withheld until you lock your scores
          </p>
          <p className="text-[12.5px] mt-0.5 leading-relaxed" style={{ color: ACCENT }}>
            Score each vendor on technical merit only. Once you click "Lock Scores & Reveal Pricing",
            your scores become read-only and pricing animates in — judgment first, price second.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {VENDOR_PROPOSALS.map((vendor, vi) => {
          const vs = scores.find(s => s.vendorId === vendor.id)!;
          const total = weightedTotal(vs);
          const pricing = getPricing(vendor.id);

          return (
            <motion.div
              key={vendor.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: vi * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border overflow-hidden flex flex-col"
              style={{ background: SURFACE, borderColor: locked && techRank(vendor.id) === 1 ? ACCENT : BORDER, boxShadow: locked && techRank(vendor.id) === 1 ? `0 0 0 2px ${ACCENT}40` : "0 2px 6px rgba(41,28,14,0.07)" }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.04)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                    Vendor {vi + 1}
                  </span>
                  {locked && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="text-[10.5px] font-bold px-2 py-0.5 rounded-full border"
                      style={{ background: techRank(vendor.id) === 1 ? `${ACCENT}18` : "rgba(255,255,255,0.04)", color: techRank(vendor.id) === 1 ? ACCENT : MUTED, borderColor: techRank(vendor.id) === 1 ? `${ACCENT}40` : BORDER }}
                    >
                      #{techRank(vendor.id)} Technical
                    </motion.span>
                  )}
                </div>
                <h3 className="text-[14px] font-bold mt-1" style={{ color: INK }}>{vendor.name}</h3>
              </div>
              <div className="p-4 space-y-3 flex-1">
                {[
                  { label: "Scope",       value: vendor.scope       },
                  { label: "Approach",    value: vendor.approach    },
                  { label: "Experience",  value: vendor.experience  },
                  { label: "Timeline",    value: vendor.timeline    },
                ].map(row => (
                  <div key={row.label}>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: MUTED }}>{row.label}</span>
                    <p className="text-[12px] leading-relaxed" style={{ color: INK2 }}>{row.value}</p>
                  </div>
                ))}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: MUTED }}>Certifications</span>
                  <div className="flex flex-wrap gap-1">
                    {vendor.certifications.map(c => (
                      <span key={c} className="text-[10.5px] px-2 py-0.5 rounded-full border font-medium" style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER, color: INK2 }}>{c}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t p-4 space-y-3" style={{ borderColor: BORDER }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                    Technical Score
                  </span>
                  {locked
                    ? <Lock size={12} style={{ color: MUTED }} />
                    : <Unlock size={12} style={{ color: MUTED }} />
                  }
                </div>
                {SCORE_CRITERIA.map(criteria => (
                  <div key={criteria.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: INK2 }}>{criteria.label}</span>
                      <span className="text-[12px] font-bold font-mono w-6 text-right" style={{ color: INK }}>
                        {vs.scores[criteria.id] ?? 5}
                      </span>
                    </div>
                    <input
                      type="range" min={1} max={10} step={1}
                      value={vs.scores[criteria.id] ?? 5}
                      disabled={locked}
                      onChange={e => setScore(vendor.id, criteria.id, Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
                      style={{ accentColor: locked ? MUTED : ACCENT, opacity: locked ? 0.6 : 1 }}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: BORDER }}>
                  <span className="text-[11px] font-bold" style={{ color: MUTED }}>Weighted Total</span>
                  <motion.span
                    key={total}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-[20px] font-bold font-mono"
                    style={{ color: INK }}
                  >
                    {total}
                    <span className="text-[11px] font-normal ml-0.5" style={{ color: MUTED }}>/100</span>
                  </motion.span>
                </div>
              </div>

              <AnimatePresence>
                {revealed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    transition={{ duration: 0.5, delay: vi * 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="border-t overflow-hidden"
                    style={{ borderColor: `${ACCENT}40`, borderTopWidth: 2 }}
                  >
                    <div className="p-4 space-y-2" style={{ background: `${ACCENT}08` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Eye size={13} style={{ color: ACCENT }} />
                        <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                          Price Revealed
                        </span>
                        <span className="ml-auto text-[10.5px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: pricing.priceRank === 1 ? `${SUCCESS}14` : "rgba(255,255,255,0.04)", color: pricing.priceRank === 1 ? SUCCESS : MUTED, borderColor: pricing.priceRank === 1 ? `${SUCCESS}30` : BORDER }}>
                          #{pricing.priceRank} Price
                        </span>
                      </div>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: vi * 0.15 + 0.2 }}
                        className="text-[24px] font-bold font-mono"
                        style={{ color: INK }}
                      >
                        ${pricing.totalPrice.toLocaleString()}
                      </motion.div>
                      <div className="space-y-1 mt-2">
                        {pricing.breakdown.map((row, bi) => (
                          <motion.div key={row.label}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: vi * 0.15 + 0.3 + bi * 0.06 }}
                            className="flex justify-between text-[11.5px]"
                          >
                            <span style={{ color: MUTED }}>{row.label}</span>
                            <span className="font-mono font-semibold" style={{ color: INK2 }}>
                              ${row.amount.toLocaleString()}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                      {techRank(vendor.id) < pricing.priceRank && (
                        <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: vi * 0.15 + 0.6 }}
                          className="mt-2 rounded-lg px-3 py-2 text-[11.5px] font-semibold border"
                          style={{ background: `${SUCCESS}10`, borderColor: `${SUCCESS}25`, color: SUCCESS }}
                        >
                          ★ Best value — ranked #{techRank(vendor.id)} technically, #{pricing.priceRank} by price
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        {!locked ? (
          <motion.button
            onClick={handleLock}
            disabled={locking}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-[14px] font-bold transition-all hover:bg-[#7D39EB] hover:text-[#08070C] hover:shadow-[0_0_20px_rgba(125,57,235,0.4)] disabled:opacity-60 border border-[#7D39EB] bg-[#0C0A14] text-white shadow-[0_0_12px_rgba(125,57,235,0.15)]"
          >
            {locking
              ? <><span className="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white" /> Locking scores...</>
              : <><Lock size={16} /> Lock Scores &amp; Reveal Pricing</>
            }
          </motion.button>
        ) : (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-[13px] font-semibold"
            style={{ color: SUCCESS }}
          >
            <CheckCircle2 size={16} />
            Scores locked — pricing revealed below each proposal
          </motion.div>
        )}
        {locked && (
          <button onClick={handleReset} className="text-[12px] underline underline-offset-2" style={{ color: MUTED }}>
            Reset &amp; rescore
          </button>
        )}
      </div>
    </div>
  );
}

/* ── MAIN PAGE ──────────────────────────────────────────── */
export default function PrecedentPage() {
  const [activeTab, setActiveTab] = useState<FeatureTab>("decision");
  const [query, setQuery]                   = useState("");
  const [loading, setLoading]               = useState(false);
  const [decisionResults, setDecisionResults] = useState<DecisionResult[] | null>(null);
  const [projectResults, setProjectResults]   = useState<ProjectResult[] | null>(null);
  const [searchMode, setSearchMode]           = useState<"decision" | "project">("decision");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setDecisionResults(null);
    setProjectResults(null);
    try {
      if (searchMode === "decision") {
        const res = await fetch("/api/precedent/similar-decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ situation: query }) });
        if (res.ok) {
          const data = await res.json();
          setDecisionResults(data.map((d: any) => ({ id: d.decision_id, situation: d.situation_summary, decided: d.decided, dissent: d.dissent ?? null, outcome: d.outcome ?? "pending", similarity: Math.round(d.similarity), date: d.date, entity: d.entity_id.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) })));
        } else { setDecisionResults([...DECISION_SEED].sort((a, b) => b.similarity - a.similarity).slice(0, 3)); }
      } else {
        const res = await fetch("/api/precedent/similar-projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: query }) });
        if (res.ok) {
          const data = await res.json();
          setProjectResults(data.map((p: any) => ({ id: p.project_id, name: p.name, similarity: Math.round(p.similarity), tags: p.tags, issues: p.known_issues, date: p.date_range, outcome: p.outcome ?? "pending" })));
        } else { setProjectResults([...PROJECT_SEED].sort((a, b) => b.similarity - a.similarity).slice(0, 3)); }
      }
    } catch {
      if (searchMode === "decision") { setDecisionResults([...DECISION_SEED].sort((a, b) => b.similarity - a.similarity).slice(0, 3)); }
      else { setProjectResults([...PROJECT_SEED].sort((a, b) => b.similarity - a.similarity).slice(0, 3)); }
    } finally { setLoading(false); }
  };

  const switchSearchMode = (m: "decision" | "project") => {
    setSearchMode(m); setQuery(""); setDecisionResults(null); setProjectResults(null);
  };

  const hasResults = searchMode === "decision" ? decisionResults !== null : projectResults !== null;

  const TABS = [
    { id: "decision"      as FeatureTab, label: "Similarity Search",      icon: Search            },
    { id: "project"       as FeatureTab, label: "Project Match",           icon: FolderOpen        },
    { id: "blind-score"   as FeatureTab, label: "Blind Scoring",           icon: SlidersHorizontal },
    { id: "clause-memory" as FeatureTab, label: "Clause Memory",           icon: FileText          },
    { id: "negotiation"   as FeatureTab, label: "Negotiation Memory",      icon: BarChart2         },
    { id: "submittal"     as FeatureTab, label: "Submittal Reviewer",        icon: FileSearch        },
    { id: "golden-thread" as FeatureTab, label: "Golden Thread",              icon: CheckCircle2      },
    { id: "memory"        as FeatureTab, label: "Institutional Memory",        icon: BookOpen          },
    { id: "overrides"     as FeatureTab, label: "Override Statistics",          icon: BarChart2         },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 space-y-8">

      {/* ── PAGE HEADER ──────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="pb-6 border-b" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em]"
            style={{ background: `${INK}08`, borderColor: `${INK}18`, color: ACCENT }}>
            <BookOpen size={9} /> Precedent Intelligence
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono" style={{ color: AI }}>
            <Sparkles size={10} /> Embedding-based similarity · Blind scoring
          </span>
        </div>
        <h1 className="text-[30px] font-bold tracking-tight leading-none" style={{ color: INK }}>Precedent</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed max-w-2xl" style={{ color: ACCENT }}>
          Surface past decisions by situation shape, find similar projects by characteristics,
          and score vendor proposals on technical merit before price is revealed.
        </p>
      </motion.div>

      {/* ── FEATURE TABS ─────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-wrap rounded-xl border p-1.5 gap-1"
        style={{ background: SURFACE, borderColor: BORDER }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2 text-[12.5px] font-semibold transition-all duration-150 border"
            style={{
              background: activeTab === id ? "#0C0A14" : "transparent",
              color: activeTab === id ? INK : MUTED,
              borderColor: activeTab === id ? ACCENT : "transparent",
              boxShadow: activeTab === id ? "0 0 12px rgba(125, 57, 235, 0.2)" : "none"
            }}>
            <Icon size={14} />
            <span className="inline">{label}</span>
          </button>
        ))}
      </motion.div>

      {/* ── TAB CONTENT ──────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* ── FEATURE 1 — Similarity Search ──────────── */}
        {(activeTab === "decision") && (
          <motion.div key="decision" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="space-y-6">
            <div className="flex rounded-lg border p-1 gap-1 max-w-xs" style={{ background: SURFACE, borderColor: BORDER }}>
              {([{ id: "decision", label: "Single Decision", icon: Scale }, { id: "project", label: "Whole Project", icon: FolderOpen }] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => switchSearchMode(id)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-semibold transition-all border"
                  style={{
                    background: searchMode === id ? "#0C0A14" : "transparent",
                    borderColor: searchMode === id ? ACCENT : "transparent",
                    color: searchMode === id ? INK : MUTED
                  }}>
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <label className="text-[12px] font-bold uppercase tracking-wider block" style={{ color: MUTED }}>
                {searchMode === "decision" ? "Describe the ambiguous situation you're facing" : "Describe the project scope, type, and key characteristics"}
              </label>
              <div className="flex gap-3">
                <textarea value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch(); }}
                  placeholder={searchMode === "decision" ? "e.g. Should we approve a mid-project substitution for structural bolts from a new vendor?" : "e.g. Data center build, structural steel primary scope, 12-month timeline, high-precision tolerances"}
                  rows={3} className="flex-1 rounded-xl border px-4 py-3 text-[13.5px] resize-none outline-none transition-all"
                  style={{ background: SURFACE, borderColor: BORDER, color: INK }}
                  onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = BORDER; }}
                />
                <button onClick={handleSearch} disabled={!query.trim() || loading}
                  className="flex items-center gap-2 px-5 rounded-xl text-[13.5px] font-semibold transition-all hover:bg-[#7D39EB] hover:text-[#08070C] hover:shadow-[0_0_20px_rgba(125,57,235,0.4)] disabled:opacity-40 disabled:pointer-events-none shrink-0 border border-[#7D39EB] bg-[#0C0A14] text-white shadow-[0_0_12px_rgba(125,57,235,0.15)]"
                >
                  {loading ? <><span className="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white" /> Searching</> : <><Search size={15} /> Search</>}
                </button>
              </div>
              <p className="text-[11px]" style={{ color: MUTED }}>⌘ + Enter to search</p>
            </div>

            <div className="space-y-5 pb-4">
              {loading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ACCENT }} />
                    <span className="text-[12.5px] font-mono" style={{ color: MUTED }}>
                      Computing similarity across {searchMode} records...
                    </span>
                  </div>
                  {[0, 1, 2].map(i => <ResultSkeleton key={i} index={i} />)}
                </div>
              )}
              {!loading && hasResults && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center justify-between pb-2 border-b" style={{ borderColor: BORDER }}>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full" style={{ background: INK }} />
                    <span className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: INK }}>
                      {searchMode === "decision" ? "Similar Past Decisions" : "Similar Past Projects"}
                    </span>
                    <span className="text-[12px] font-mono" style={{ color: MUTED }}>
                      ({searchMode === "decision" ? decisionResults!.length : projectResults!.length} results)
                    </span>
                  </div>
                  <span className="text-[11px]" style={{ color: MUTED }}>Ranked by similarity</span>
                </motion.div>
              )}
              <AnimatePresence mode="wait">
                {!loading && searchMode === "decision" && decisionResults && (
                  <motion.div key="dr" className="space-y-4">
                    {decisionResults.map((r, i) => <DecisionCard key={r.id} result={r} index={i} />)}
                  </motion.div>
                )}
                {!loading && searchMode === "project" && projectResults && (
                  <motion.div key="pr" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projectResults.map((r, i) => <ProjectCard key={r.id} result={r} index={i} />)}
                  </motion.div>
                )}
                {!loading && !hasResults && <EmptyState key="empty" mode={searchMode} />}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── FEATURE 2 — Project Match (whole project) ── */}
        {activeTab === "project" && (
          <motion.div key="project" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[12px] font-bold uppercase tracking-wider block" style={{ color: MUTED }}>
                Describe the project — scope, type, and key characteristics
              </label>
              <div className="flex gap-3">
                <textarea value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { setSearchMode("project"); handleSearch(); } }}
                  placeholder="e.g. Semiconductor fab, structural steel primary, 12-month timeline, cleanroom tolerance requirements, Texas"
                  rows={3} className="flex-1 rounded-xl border px-4 py-3 text-[13.5px] resize-none outline-none transition-all"
                  style={{ background: SURFACE, borderColor: BORDER, color: INK }}
                  onFocus={e => { e.currentTarget.style.borderColor = ACCENT; setSearchMode("project"); }}
                  onBlur={e  => { e.currentTarget.style.borderColor = BORDER; }}
                />
                 <button onClick={() => { setSearchMode("project"); handleSearch(); }}
                  disabled={!query.trim() || loading}
                  className="flex items-center gap-2 px-5 rounded-xl text-[13.5px] font-semibold transition-all hover:bg-[#7D39EB] hover:text-[#08070C] hover:shadow-[0_0_20px_rgba(125,57,235,0.4)] disabled:opacity-40 disabled:pointer-events-none shrink-0 border border-[#7D39EB] bg-[#0C0A14] text-white shadow-[0_0_12px_rgba(125,57,235,0.15)]"
                >
                  {loading ? <><span className="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white" /> Matching</> : <><FolderOpen size={15} /> Find Similar</>}
                </button>
              </div>
              <p className="text-[11px]" style={{ color: MUTED }}>⌘ + Enter to search</p>
            </div>
            <div className="space-y-4 pb-4">
              {loading && <div className="space-y-4">{[0,1,2].map(i => <ResultSkeleton key={i} index={i} />)}</div>}
              <AnimatePresence mode="wait">
                {!loading && projectResults && (
                  <motion.div key="pr2" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projectResults.map((r, i) => <ProjectCard key={r.id} result={r} index={i} />)}
                  </motion.div>
                )}
                {!loading && !projectResults && <EmptyState key="empty2" mode="project" />}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── FEATURE 3 — Blind Technical Scoring ──────── */}
        {activeTab === "blind-score" && (
          <motion.div key="blind" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <BlindScoringFeature />
          </motion.div>
        )}

        {/* ── FEATURE 4 — Clause Memory ──────────────── */}
        {activeTab === "clause-memory" && (
          <motion.div key="clause" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <ClauseMemoryFeature />
          </motion.div>
        )}

        {/* ── FEATURE 5 — Negotiation Memory ──────────── */}
        {activeTab === "negotiation" && (
          <motion.div key="negotiation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <NegotiationMemoryFeature />
          </motion.div>
        )}

        {/* ── FEATURE 6 — Submittal Reviewer Pattern ───── */}
        {activeTab === "submittal" && (
          <motion.div key="submittal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <SubmittalReviewerFeature />
          </motion.div>
        )}

        {/* ── FEATURE 7 — Golden Thread ─────────────────── */}
        {activeTab === "golden-thread" && (
          <motion.div key="golden-thread" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <GoldenThreadFeature />
          </motion.div>
        )}

        {/* ── FEATURE 8 — Institutional Memory ──────────── */}
        {activeTab === "memory" && (
          <motion.div key="memory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <InstitutionalMemoryFeature />
          </motion.div>
        )}

        {/* ── FEATURE 9 — Override Statistics ───────────── */}
        {activeTab === "overrides" && (
          <motion.div key="overrides" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <OverrideStatisticsFeature />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
