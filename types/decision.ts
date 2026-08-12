export type DecisionCategory = "risk" | "recommendation" | "alert" | "approval" | "opportunity" | "neutral";

export interface Decision {
  id: string;
  entity_id?: string;
  type: DecisionCategory;
  title: string;
  description?: string;
  context?: string;
  status?: "open" | "resolved" | "pending";
  value?: number;
  previous_value?: number;
  urgency?: number;
  actionLabel?: string;
  href?: string;
  created_at?: string;
}
