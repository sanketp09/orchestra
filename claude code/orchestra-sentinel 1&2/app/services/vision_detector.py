"""
Calls Claude with vision input to detect construction-site inventory items in
a single video frame. Detection is constrained to a tool-calling schema and to
the taxonomy pulled from the current session's PO line items, so the model is
grounded in what's actually expected on site rather than open-ended labeling.
"""

from __future__ import annotations

import base64
import logging
import os

from anthropic import Anthropic

from app.schemas.site_walk import DetectedItem
from app.services.video_processor import SampledFrame, frame_to_jpeg_bytes

logger = logging.getLogger(__name__)

_MODEL = "claude-sonnet-4-6"

_DETECTION_TOOL = {
    "name": "report_detected_items",
    "description": (
        "Report every distinct physical item visible in this construction-site "
        "photo that matches (or closely resembles) one of the provided category "
        "taxonomy entries. Only report items you can actually see — do not guess "
        "at items that are merely plausible for a construction site."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Specific name of the item, e.g. '12mm rebar bundle'.",
                        },
                        "category": {
                            "type": "string",
                            "description": "Must be one of the provided taxonomy categories.",
                        },
                        "estimated_qty": {
                            "type": "integer",
                            "description": "Best estimate of count/units visible in this frame.",
                        },
                        "condition": {
                            "type": "string",
                            "enum": ["good", "damaged", "unclear"],
                        },
                        "confidence": {
                            "type": "number",
                            "description": "0.0-1.0 confidence in this detection.",
                        },
                        "bounding_box": {
                            "type": "object",
                            "description": "Optional approximate box: {x, y, width, height} as fractions of image size (0-1).",
                            "properties": {
                                "x": {"type": "number"},
                                "y": {"type": "number"},
                                "width": {"type": "number"},
                                "height": {"type": "number"},
                            },
                        },
                    },
                    "required": ["name", "category", "estimated_qty", "condition", "confidence"],
                },
            }
        },
        "required": ["items"],
    },
}


def _client() -> Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Vision detection requires a real API key."
        )
    return Anthropic(api_key=api_key)


def detect_items_in_frame(
    sampled_frame: SampledFrame,
    category_taxonomy: list[str],
) -> list[DetectedItem]:
    """
    Run Claude vision detection against a single sampled frame.

    Args:
        sampled_frame: a SampledFrame from video_processor.extract_frames.
        category_taxonomy: category labels pulled from the current session's
            PO line items (e.g. ["rebar", "cement bags", "PVC pipe"]). Keeps
            detection grounded in what's actually expected rather than
            open-ended guessing.

    Returns:
        List of DetectedItem for this frame (may be empty if nothing matches).
    """
    if not category_taxonomy:
        raise ValueError("category_taxonomy must not be empty — pull it from PO line items first.")

    jpeg_bytes = frame_to_jpeg_bytes(sampled_frame.image)
    b64_image = base64.b64encode(jpeg_bytes).decode("utf-8")

    taxonomy_str = ", ".join(category_taxonomy)

    response = _client().messages.create(
        model=_MODEL,
        max_tokens=1024,
        tools=[_DETECTION_TOOL],
        tool_choice={"type": "tool", "name": "report_detected_items"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": b64_image,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "This is a frame from a construction-site walkthrough video. "
                            f"The expected item categories on this site (from the purchase "
                            f"order) are: {taxonomy_str}. "
                            "Identify only items visible in this frame that match one of "
                            "these categories, and report them via the tool."
                        ),
                    },
                ],
            }
        ],
    )

    items: list[DetectedItem] = []
    for block in response.content:
        if getattr(block, "type", None) != "tool_use":
            continue
        for raw_item in block.input.get("items", []):
            try:
                items.append(
                    DetectedItem(
                        name=raw_item["name"],
                        category=raw_item["category"],
                        estimated_qty=raw_item["estimated_qty"],
                        condition=raw_item["condition"],
                        confidence=raw_item["confidence"],
                        bounding_box=raw_item.get("bounding_box"),
                        frame_number=sampled_frame.frame_number,
                        frame_timestamp=sampled_frame.timestamp_seconds,
                    )
                )
            except (KeyError, ValueError) as exc:
                logger.warning("Skipping malformed detection from model output: %s", exc)

    return items
