"""
Shared Supabase client factory.

Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the environment (the
whole team shares one .env). Exposes a single cached `get_client()` so every
service reuses one client instance instead of reconnecting per-request.
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


@lru_cache(maxsize=1)
def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the "
            "environment (see the shared .env)."
        )
    return create_client(url, key)
