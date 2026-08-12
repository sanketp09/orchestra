"""
Construction-site inventory detection using Google Gemini Vision (free tier).
Uses gemini-1.5-flash — free quota: 15 req/min, 1M tokens/day.

Gemini doesn't support native tool-calling with a JSON schema the same way
Anthropic does, so we use structured JSON output mode instead:
  - System prompt defines the exact schema
  - response_mime_type="application/json" forces valid JSON output
  - We parse and validate the JSON ourselves with Pydantic

Get your free key at: https://aistudio.google.com/app/apikey
"""

from __future__ import annotations

import base64
import json
import logging
import os

import google.generativeai as genai
from PIL import Image
import io

from app.schemas.site_walk import DetectedItem
from app.services.video_processor import SampledFrame, frame_to_jpeg_bytes

logger = logging.getLogger(__name__)

_MODEL = "gemini-1.5-flash"   # free tier, supports vision input

_SYSTEM_PROMPT = """You are a construction-site inventory inspector analyzing a video frame.

You will be given:
1. An image of a construction site
2. A list of expected item categories (from the project's purchase order)

Your job: identify ONLY items visible in the image that match the expected categories.
Do NOT hallucinate items that are not clearly visible.

Respond with ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "items": [
    {
      "name": "specific item name e.g. 12mm rebar bundle",
      "category": "must match one of the provided categories exactly",
      "estimated_qty": 5,
      "condition": "good" | "damaged" | "unclear",
      "confidence": 0.92,
      "bounding_box": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4} | null
    }
  ]
}

If no matching items are visible, respond with: {"items": []}
confidence is a float 0.0-1.0. bounding_box values are fractions of image dimensions (0-1).
"""


def _configure() -> None:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. "
            "Get a free key at https://aistudio.google.com/app/apikey"
        )
    genai.configure(api_key=api_key)


def detect_items_in_frame(
    sampled_frame: SampledFrame,
    category_taxonomy: list[str],
) -> list[DetectedItem]:
    """
    Run Gemini vision detection against a single sampled video frame.

    Args:
        sampled_frame: a SampledFrame from video_processor.extract_frames.
        category_taxonomy: category labels from the session's PO line items.
            Grounds detection in what's actually expected on site.

    Returns:
        List of DetectedItem for this frame (may be empty).
    """
    if not category_taxonomy:
        raise ValueError("category_taxonomy must not be empty — pull it from PO line items first.")

    _configure()

    jpeg_bytes = frame_to_jpeg_bytes(sampled_frame.image)

    # Convert to PIL Image for Gemini SDK (it accepts PIL.Image directly)
    pil_image = Image.open(io.BytesIO(jpeg_bytes))

    taxonomy_str = ", ".join(category_taxonomy)
    prompt = (
        f"Expected item categories from this project's purchase order: {taxonomy_str}\n\n"
        "Analyze the image and report all visible items matching these categories."
    )

    model = genai.GenerativeModel(
        model_name=_MODEL,
        system_instruction=_SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.1,   # low temp for consistent structured output
            max_output_tokens=1024,
        ),
    )

    response = model.generate_content([pil_image, prompt])

    try:
        raw = json.loads(response.text)
        raw_items = raw.get("items", [])
    except (json.JSONDecodeError, AttributeError) as exc:
        logger.warning("Gemini returned non-JSON output for frame %d: %s", sampled_frame.frame_number, exc)
        return []

    items: list[DetectedItem] = []
    for raw_item in raw_items:
        try:
            items.append(
                DetectedItem(
                    name=raw_item["name"],
                    category=raw_item["category"],
                    estimated_qty=int(raw_item["estimated_qty"]),
                    condition=raw_item["condition"],
                    confidence=float(raw_item["confidence"]),
                    bounding_box=raw_item.get("bounding_box"),
                    frame_number=sampled_frame.frame_number,
                    frame_timestamp=sampled_frame.timestamp_seconds,
                )
            )
        except (KeyError, ValueError, TypeError) as exc:
            logger.warning("Skipping malformed detection item: %s — raw: %s", exc, raw_item)

    return items
