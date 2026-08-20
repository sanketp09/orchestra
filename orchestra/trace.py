from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field


class ExecutionTraceEntry(BaseModel):
    """
    Schema for tracking and auditing steps executed inside an ORCHESTRA run.
    """
    run_id: str
    task_id: str
    capability: str
    resolved_specialist: str
    start_time: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    end_time: Optional[str] = None
    status: str = "PENDING"
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    retry_count: int = 0

    def complete(
        self,
        status: str,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[Dict[str, Any]] = None
    ) -> ExecutionTraceEntry:
        """
        Finalizes the trace entry with timestamp, final execution status, and outcomes.
        """
        self.end_time = datetime.now(timezone.utc).isoformat()
        self.status = status
        self.result = result
        self.error = error
        return self
