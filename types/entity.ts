export type EntityType = "vendor" | "project" | "contract" | "purchase_order";

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  metadata?: {
    trade?: string;
    contact?: string;
    location?: string;
    [key: string]: any;
  };
  created_at?: string;
}
