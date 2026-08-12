import { Evidence } from "./evidence";

export interface ReceiptEvidenceItem {
  source: string;
  detail: string;
}

export interface ComparisonRow {
  label: string;
  value: string;
}

export interface Receipt {
  id?: string;
  decision_id: string;
  evidence_ids: string[];
  confidence: number; // 0 to 1
  confidencePct?: number; // 0 to 100
  reasoning: string;
  created_at?: string;

  // Additional detail fields for panels
  evidence?: Evidence[];
  evidenceSources?: ReceiptEvidenceItem[];
  comparisonRows?: ComparisonRow[];
  recommendation?: string;
  estimatedImpact?: string;
}
