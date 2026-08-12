export type Severity = "danger" | "warning" | "info" | "success" | "ai";

export interface Vendor {
  id: string;
  name: string;
  code: string;
  trustScore: number;
  scoreChange: number;
  status: "verified" | "flagged" | "review";
  category: string;
  msaStatus: string;
  coiStatus: string;
  activeContractsCount: number;
  openDisputesCount: number;
  lastActivity: string;
}

export interface Decision {
  id: string;
  severity: Severity;
  title: string;
  context: string;
  actionLabel: string;
  href: string;
  trustScore?: number;
  vendorId?: string;
  urgency?: number;
}

export interface EvidenceItem {
  id: string;
  title: string;
  type: "document" | "inspection" | "invoice" | "dispute" | "manifest";
  source: string;
  date: string;
  confidencePct: number;
  vendorId?: string;
  summary: string;
  status: "verified" | "flagged" | "pending";
}

export interface ActivityItem {
  id: string;
  text: string;
  actor: string;
  timestamp: string;
}

export type TimelineEventTone = "success" | "warning" | "danger" | "info" | "ai";

export interface TimelineEventReceipt {
  evidence: string[];
  confidencePct: number;
  reasoning: string;
  href: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  tone: TimelineEventTone;
  receipt: TimelineEventReceipt;
}

export interface ChecklistItemDef {
  id: string;
  label: string;
}

export interface RiskScoreSummary {
  score: number;
  direction: "up" | "down" | "flat";
  deltaLabel: string;
}

export interface Flag {
  id: string;
  severity: Severity;
  title: string;
  context: string;
}

export interface FlagReceipt {
  comparisonRows: { label: string; value: string }[];
  confidencePct: number;
  recommendation: string;
  estimatedImpact: string;
  evidenceSources: { label: string; href: string }[];
}
