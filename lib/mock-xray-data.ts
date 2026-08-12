import type {
  ChecklistItemDef,
  Flag,
  FlagReceipt,
  RiskScoreSummary,
} from "@/types";

/**
 * Sequential checklist shown during the scanning state. Order matters —
 * these appear one at a time, each with its own realistic label. This is
 * the whole point of the state: visible, specific reasoning, not a spinner.
 */
export const CHECKLIST_ITEMS: ChecklistItemDef[] = [
  { id: "parse", label: "Parsing document structure" },
  { id: "scope", label: "Checking scope vs. drawings" },
  { id: "clauses", label: "Checking clause history with this vendor" },
  { id: "pricing", label: "Checking pricing pattern across bidders" },
  { id: "compile", label: "Compiling flags and evidence" },
];

// Delay before each item completes, ms — deliberately uneven so the
// checklist doesn't read as a mechanical, evenly-spaced animation.
export const CHECKLIST_STEP_DELAYS_MS = [650, 780, 720, 800, 640];

export const MOCK_RISK_SCORE: RiskScoreSummary = {
  score: 78,
  direction: "up",
  deltaLabel: "+12 vs. last quote",
};

export const MOCK_FLAGS: Flag[] = [
  {
    id: "flag-insurance",
    severity: "danger",
    title: "Missing insurance clause",
    context:
      "Certificate of insurance excluded from SteelCo's submitted quote package.",
  },
  {
    id: "flag-price",
    severity: "warning",
    title: "Price 18% above market median",
    context:
      "Switchgear line item sits well above comparable recent bids for this scope.",
  },
  {
    id: "flag-terms",
    severity: "info",
    title: "Payment terms shifted to Net-45",
    context:
      "Standard terms with this vendor have been Net-30 on the last four contracts.",
  },
];

export const MOCK_RECEIPTS: Record<string, FlagReceipt> = {
  "flag-insurance": {
    comparisonRows: [
      { label: "This quote", value: "Not included" },
      { label: "Contract requirement", value: "$2,000,000 GL" },
      { label: "Vendor's last 3 contracts", value: "Included every time" },
    ],
    confidencePct: 88,
    recommendation:
      "Request an updated certificate of insurance before approval.",
    estimatedImpact: "Coverage gap",
    evidenceSources: [
      { label: "Master services agreement, §7.2", href: "#" },
      { label: "SteelCo COI archive (3 prior contracts)", href: "#" },
    ],
  },
  "flag-price": {
    comparisonRows: [
      { label: "Current quote", value: "$282,000" },
      { label: "Past project", value: "$238,000" },
      { label: "Market median", value: "$241,000" },
    ],
    confidencePct: 94,
    recommendation: "Renegotiate the switchgear line item before signing.",
    estimatedImpact: "$44,000",
    evidenceSources: [
      { label: "SteelCo quote #Q-4471", href: "#" },
      { label: "Meridian Yards final invoice", href: "#" },
      { label: "RSMeans regional index, Q2", href: "#" },
    ],
  },
  "flag-terms": {
    comparisonRows: [
      { label: "Proposed terms", value: "Net-45" },
      { label: "Last 4 contracts", value: "Net-30" },
      { label: "Industry standard", value: "Net-30" },
    ],
    confidencePct: 81,
    recommendation: "Hold at Net-30 or price in the cost of the float.",
    estimatedImpact: "$6,400",
    evidenceSources: [
      { label: "Contract history — 4 prior POs", href: "#" },
      { label: "Vendor terms sheet, revised", href: "#" },
    ],
  },
};
