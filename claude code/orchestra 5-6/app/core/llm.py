"""
Shared Claude client wrapper used across every feature that needs structured,
tool-calling output (synthesis nodes, vision extraction, etc).

ASSUMED TO ALREADY EXIST from earlier features. Included here as a minimal, working stub
using the Anthropic SDK directly so bid_integrity_graph.py and stamp_extractor.py have
something real to call. Replace with your project's actual shared wrapper if one exists —
the call signature below (`system`, `user_content`, `tool_schema`, `tool_name` -> dict) is
the contract both features rely on.
"""
from __future__ import annotations

import os
from typing import Any

from anthropic import Anthropic

MODEL = "claude-sonnet-4-6"

_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


async def call_claude_structured(
    system: str,
    user_content: Any,
    tool_schema: dict,
    tool_name: str,
) -> dict:
    """Calls Claude with a single forced tool-call and returns the tool's input dict.

    `user_content` can be a plain string or the Anthropic content-block list format
    (e.g. for image + text messages, as used by stamp_extractor.py).
    """
    response = _client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system,
        tools=[{"name": tool_name, "input_schema": tool_schema}],
        tool_choice={"type": "tool", "name": tool_name},
        messages=[{"role": "user", "content": user_content}],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == tool_name:
            return block.input

    raise ValueError(f"Claude did not return the expected '{tool_name}' tool call")
