"""Thin Supabase data-access helpers. No business logic lives here."""

from __future__ import annotations

from common.supabase_client import get_client


def fetch_vendor(vendor_id: str) -> dict | None:
    res = get_client().table("vendors").select("*").eq("vendor_id", vendor_id).execute()
    return res.data[0] if res.data else None


def fetch_trust_profile(vendor_id: str) -> dict | None:
    res = (
        get_client()
        .table("trust_profiles")
        .select("*")
        .eq("vendor_id", vendor_id)
        .execute()
    )
    return res.data[0] if res.data else None


def fetch_trust_events(
    vendor_id: str,
    impact_dimension: str | None = None,
    project_id: str | None = None,
    limit: int = 500
) -> list[dict]:
    query = get_client().table("trust_events").select("*").eq("vendor_id", vendor_id)
    if impact_dimension:
        query = query.eq("impact_dimension", impact_dimension)
    if project_id:
        query = query.eq("project_id", project_id)
    res = query.order("created_at", desc=True).limit(limit).execute()
    return res.data or []


def fetch_trust_event_by_source_id(vendor_id: str, source_event_id: str) -> dict | None:
    res = (
        get_client()
        .table("trust_events")
        .select("*")
        .eq("vendor_id", vendor_id)
        .eq("source_event_id", source_event_id)
        .execute()
    )
    return res.data[0] if res.data else None


def insert_trust_event(event: dict) -> dict | None:
    res = get_client().table("trust_events").insert(event).execute()
    return res.data[0] if res.data else None


def update_trust_profile(vendor_id: str, updates: dict) -> dict | None:
    res = (
        get_client()
        .table("trust_profiles")
        .update(updates)
        .eq("vendor_id", vendor_id)
        .execute()
    )
    return res.data[0] if res.data else None
