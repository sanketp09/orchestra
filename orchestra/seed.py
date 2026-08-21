import asyncio
from typing import Dict, Any, List
from common.supabase_client import get_supabase_client
from orchestra.cases_data import ALL_CASES


def safe_upsert(client, table_name: str, pk_col: str, data: Any):
    """
    Idempotent upsert helper compatible with all Postgrest library versions
    and MockSupabaseClient. Performs a lookup and routes to insert/update.
    """
    if isinstance(data, list):
        for item in data:
            safe_upsert(client, table_name, pk_col, item)
        return

    pk_val = data[pk_col]
    try:
        existing = client.table(table_name).select("*").eq(pk_col, pk_val).execute().data
    except Exception as e:
        # Log and raise clear database access failures
        print(f"[Supabase] Error checking existence in {table_name}: {e}")
        raise e

    if existing:
        # Special logic to merge projects array for vendors
        if table_name == "vendors":
            merged_projects = list(set(existing[0].get("projects", []) + data["projects"]))
            data = {**data, "projects": merged_projects}
        
        try:
            client.table(table_name).update(data).eq(pk_col, pk_val).execute()
        except Exception as e:
            print(f"[Supabase] Error updating {table_name} record {pk_val}: {e}")
            raise e
    else:
        try:
            client.table(table_name).insert(data).execute()
        except Exception as e:
            print(f"[Supabase] Error inserting {table_name} record {pk_val}: {e}")
            raise e


def seed_dataset(case_data: Dict[str, Any]):
    client = get_supabase_client()
    project_id = case_data["project"]["project_id"]
    print(f"\nSeeding Case Study Project: {project_id}...")

    # 1. Upsert Project Case Metadata
    safe_upsert(client, "projects", "project_id", case_data["project"])

    # 2. Upsert Sources
    if case_data["sources"]:
        safe_upsert(client, "sources", "source_id", case_data["sources"])

    # 3. Upsert Vendors
    if case_data["vendors"]:
        safe_upsert(client, "vendors", "vendor_id", case_data["vendors"])

    # 4. Upsert Procurement Items
    if case_data["procurement_items"]:
        safe_upsert(client, "procurement_items", "item_id", case_data["procurement_items"])

    # 5. Upsert Purchase Orders
    if case_data["purchase_orders"]:
        safe_upsert(client, "purchase_orders", "po_id", case_data["purchase_orders"])

    # 6. Upsert Engineering Changes
    if case_data["engineering_changes"]:
        safe_upsert(client, "engineering_changes", "change_id", case_data["engineering_changes"])

    # 7. Upsert Schedule Events
    if case_data["schedule_events"]:
        safe_upsert(client, "schedule_events", "event_id", case_data["schedule_events"])

    # 8. Upsert Vendor Performances
    if case_data["vendor_performances"]:
        safe_upsert(client, "vendor_performances", "performance_id", case_data["vendor_performances"])

    # 9. Upsert Claims
    if case_data["claims"]:
        safe_upsert(client, "claims", "claim_id", case_data["claims"])

    # 10. Upsert Evidence (Map schema parameters to align with Sentinel)
    if case_data["evidence"]:
        evidence_rows = []
        for ev in case_data["evidence"]:
            row = {
                "evidence_id": ev["evidence_id"],
                "project_id": ev["project_id"],
                "vendor_id": ev["vendor_id"],
                "source_type": ev["source_type"],
                "source_name": ev["metadata"].get("title", ev["source_type"]),
                "document_id": ev["source_ref"],
                "source_ref": ev["source_ref"],
                "content": ev["extracted_text"],
                "extracted_text": ev["extracted_text"],
                "origin": ev["origin"],
                "metadata": ev["metadata"]
            }
            evidence_rows.append(row)
        safe_upsert(client, "evidence", "evidence_id", evidence_rows)

    print(f"Project {project_id} successfully seeded.")


def run_seeding():
    print("Connecting to Supabase...")
    for project_id, case_data in ALL_CASES.items():
        try:
            seed_dataset(case_data)
        except Exception as e:
            print(f"\n[CRITICAL] Seeding failed for project {project_id}: {e}")
            print("Please ensure database schema migrations have been applied to the Supabase instance.")
            raise e
    print("\nDatabase seeding completed successfully.")


if __name__ == "__main__":
    run_seeding()
