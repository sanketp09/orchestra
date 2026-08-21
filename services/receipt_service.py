import uuid
from datetime import datetime
from typing import Any, Dict
from services.supabase_service import SupabaseClient

class ReceiptService:
    def __init__(self):
        self.supabase = SupabaseClient()

    def create_receipt(self, task_id: str, agent: str, capability: str, result_data: Dict[str, Any]) -> str:
        receipt_id = str(uuid.uuid4())
        receipt = {
            "receipt_id": receipt_id,
            "task_id": task_id,
            "agent": agent,
            "capability": capability,
            "timestamp": datetime.utcnow().isoformat(),
            "output_summary": result_data.get("summary", ""),
            "confidence": result_data.get("confidence", 0.0),
        }
        try:
            self.supabase.insert("receipts", receipt)
        except Exception as e:
            print(f"[ReceiptService] failed to persist receipt: {e}")
        return receipt_id
