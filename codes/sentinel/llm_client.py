"""
Shared LLM client for structured-output reasoning steps (contradiction
detection, verification judgment, etc).

Specialists never hand-roll prompt parsing - they call generate_structured()
with a Pydantic schema and get back a validated instance of that schema.
Routed to Gemini by default via its native structured-output / response-schema
support, using the current `google-genai` SDK (the older
`google-generativeai` package is deprecated).
"""

import os
from typing import TypeVar

from google import genai
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

_DEFAULT_MODEL = os.environ.get("LLM_MODEL", "gemini-2.5-pro")
_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set - required for common.llm_client"
            )
        _client = genai.Client(api_key=api_key)
    return _client


def generate_structured(prompt: str, schema: type[T]) -> T:
    """
    Run `prompt` through the LLM and parse the response into `schema`.

    Uses Gemini's response_schema/response_mime_type support so the model
    is constrained to return JSON matching the Pydantic model's shape.
    Raises on malformed output rather than silently returning a half-parsed
    object - callers (specialist endpoints) are expected to catch this and
    turn it into a status="FAILED" AgentResult.
    """
    client = _get_client()

    response = client.models.generate_content(
        model=_DEFAULT_MODEL,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": schema,
        },
    )

    # response.parsed is already a validated instance of `schema` when
    # response_schema is a Pydantic model; fall back to manual validation
    # if the SDK ever hands back raw text instead.
    if response.parsed is not None:
        return response.parsed
    return schema.model_validate_json(response.text)
