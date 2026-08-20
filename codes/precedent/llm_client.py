"""
Stand-in for the shared `common/llm_client.py`.

Routed to Gemini by default. None of Precedent's five endpoints currently
need LLM generation (they're pure retrieval), but this is wired in so
future capabilities (e.g. an LLM-written precedent summary) can use it
without a new dependency.
"""

import os

from pydantic import BaseModel

try:
    import google.generativeai as genai

    genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
    _MODEL = genai.GenerativeModel("gemini-1.5-flash")
except ImportError:  # pragma: no cover - optional dependency in this stub
    _MODEL = None


def generate_structured(prompt: str, schema: type[BaseModel]) -> BaseModel:
    if _MODEL is None:
        raise RuntimeError(
            "google-generativeai not installed — this is a stub. "
            "Swap in the real shared common/llm_client.py."
        )
    response = _MODEL.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json"},
    )
    return schema.model_validate_json(response.text)
