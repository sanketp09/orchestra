from typing import TypedDict, Optional

class ErrorDetail(TypedDict):
    code: str  # e.g. INVALID_INPUT, MISSING_REQUIRED_CONTEXT, INSUFFICIENT_EVIDENCE, SPECIALIST_UNAVAILABLE, PROCESSING_FAILED, TIMEOUT
    message: str
    retryable: bool
