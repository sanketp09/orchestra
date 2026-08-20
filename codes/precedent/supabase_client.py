"""
Stand-in for the shared `common/supabase_client.py` used across the
ORCHESTRA specialists (SENTINEL, TRUSTLINE, COMPASS, ATLAS, ...).

If you already have this module in your monorepo, delete this file and
just make sure `common` is on the PYTHONPATH — Precedent only needs
`get_client()` to exist.
"""

import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


@lru_cache(maxsize=1)
def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)
