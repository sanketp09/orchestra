"""
Single Claude vision call. This service's only job is extraction — it never decides
whether the stamp matches anything; that's stamp_matcher.py's job.
"""
from __future__ import annotations

import base64
from pathlib import Path

from app.core.llm import call_claude_structured
from app.schemas.materials import ExtractedStampData

EXTRACTION_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "visible_text": {"type": "string"},
        "heat_number": {"type": ["string", "null"]},
        "manufacturer_mark": {"type": ["string", "null"]},
        "estimated_font_style": {"type": "string"},
        "spacing_notes": {"type": "string"},
    },
    "required": ["visible_text", "estimated_font_style", "spacing_notes"],
}

SYSTEM_PROMPT = (
    "You are extracting information from a photo of a metal mill stamp. Report exactly "
    "what is visible: the raw visible text, the heat number if one is present, the "
    "manufacturer's mark if present, and descriptive notes on the font style and character "
    "spacing. Do not guess whether this matches any manufacturer's known pattern — only "
    "describe what you see in the photo itself."
)

_MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def _guess_media_type(photo_path: str) -> str:
    return _MEDIA_TYPES.get(Path(photo_path).suffix.lower(), "image/jpeg")


async def extract_stamp_data(photo_path: str) -> ExtractedStampData:
    image_bytes = Path(photo_path).read_bytes()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    user_content = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": _guess_media_type(photo_path),
                "data": image_b64,
            },
        },
        {"type": "text", "text": "Extract the stamp data from this material photo."},
    ]

    output = await call_claude_structured(
        system=SYSTEM_PROMPT,
        user_content=user_content,
        tool_schema=EXTRACTION_TOOL_SCHEMA,
        tool_name="submit_stamp_extraction",
    )

    return ExtractedStampData(**output)
