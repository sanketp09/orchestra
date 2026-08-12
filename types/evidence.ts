export type EvidenceType =
  | "photo"
  | "contract"
  | "email"
  | "weather"
  | "delivery_ticket"
  | "invoice"
  | "inspection"
  | "drawing"
  | "video";

export type ReliabilityTier =
  | "verified_transaction"
  | "third_party_observed"
  | "self_reported";

export interface LinkedDecision {
  id: string;
  label: string;
  href: string;
}

export interface Evidence {
  id: string;
  entity_id?: string;
  type: EvidenceType;
  reliability_tier: ReliabilityTier;
  raw_file_url?: string;
  uploaded_by?: string;
  uploaded_at?: string;
  extracted_data?: Record<string, any>;

  // Display/UI helper fields
  description?: string;
  source?: string;
  supports?: string;
  linkedDecisions?: LinkedDecision[];
}
