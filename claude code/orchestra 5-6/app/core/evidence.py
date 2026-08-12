"""
Writes analysis results into the shared evidence graph so trust scores propagate to the
right nodes (vendor, mill, etc).

ASSUMED TO ALREADY EXIST from earlier features — this is where the real Neo4j/Postgres
graph client lives. Included here as a logging-only stub so bid_integrity_graph.py and
material_auth_graph.py import something real. Replace `write_evidence` with the actual
client call; the `writes_to` contract (a list of "kind:id:field" strings) is the piece
that needs to stay stable for both features.
"""
from __future__ import annotations

import logging

logger = logging.getLogger("evidence_graph")


def write_evidence(writes_to: list[str], payload: dict) -> None:
    for target in writes_to:
        logger.info("evidence_graph write -> %s : %s", target, payload)
