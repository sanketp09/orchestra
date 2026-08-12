"""
Deterministic shared-entity check across "independent" bidders.

Implemented as a single filtered query plus a Python-side comparison rather than a raw SQL
self-join — same result, and it reads more clearly. If you already have Neo4j from the
architecture doc, swap this for a Cypher query; a Postgres-backed query is completely
sufficient here and simpler to demo.
"""
from __future__ import annotations

from itertools import combinations

from sqlalchemy.orm import Session

from app.models.bids import VendorEntity
from app.schemas.bids import SharedEntityMatch


def find_shared_entities(vendor_ids: list[str], db: Session) -> list[SharedEntityMatch]:
    vendors = (
        db.query(VendorEntity)
        .filter(VendorEntity.vendor_id.in_(vendor_ids))
        .all()
    )

    matches: list[SharedEntityMatch] = []

    for vendor_a, vendor_b in combinations(vendors, 2):
        officers_a = set(vendor_a.registered_officers or [])
        officers_b = set(vendor_b.registered_officers or [])
        for officer in officers_a & officers_b:
            matches.append(
                SharedEntityMatch(
                    vendor_a=vendor_a.vendor_id,
                    vendor_b=vendor_b.vendor_id,
                    shared_field="officer",
                    value=officer,
                )
            )

        if (
            vendor_a.registered_address
            and vendor_b.registered_address
            and vendor_a.registered_address.strip().lower()
            == vendor_b.registered_address.strip().lower()
        ):
            matches.append(
                SharedEntityMatch(
                    vendor_a=vendor_a.vendor_id,
                    vendor_b=vendor_b.vendor_id,
                    shared_field="address",
                    value=vendor_a.registered_address,
                )
            )

        if (
            vendor_a.bonding_agent
            and vendor_b.bonding_agent
            and vendor_a.bonding_agent.strip().lower() == vendor_b.bonding_agent.strip().lower()
        ):
            matches.append(
                SharedEntityMatch(
                    vendor_a=vendor_a.vendor_id,
                    vendor_b=vendor_b.vendor_id,
                    shared_field="bonding_agent",
                    value=vendor_a.bonding_agent,
                )
            )

    return matches
