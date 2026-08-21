import os
from supabase import create_client, Client
from dotenv import load_dotenv

class SupabaseClient:
    _instance: Client = None

    def __init__(self):
        # Load .env from the project root explicitly
        import pathlib
        env_path = pathlib.Path(__file__).resolve().parents[1] / ".env"
        load_dotenv(dotenv_path=env_path)
        if not SupabaseClient._instance:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_ANON_KEY")
            if not url or not key:
                raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
            SupabaseClient._instance = create_client(url, key)
        self.client = SupabaseClient._instance
        # Duplicate initialization block removed – client already set above

    def fetch(self, table: str, query: dict | None = None):
        """Fetch rows from a table, optionally filtered by a query dict."""
        if query:
            return self.client.table(table).select("*").match(query).execute().data
        return self.client.table(table).select("*").execute().data

    def insert(self, table: str, data: dict):
        """Insert a row into a table and return the inserted record(s)."""
        return self.client.table(table).insert(data).execute().data

    def upsert(self, table: str, data: dict, primary_key: str = "id"):
        """Upsert a row using the primary key (or specified column)."""
        return self.client.table(table).upsert(data, on_conflict=primary_key).execute().data
