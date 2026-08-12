from __future__ import annotations

from fastapi import FastAPI

from app.api.routes import bids, materials
from app.db import Base, engine

app = FastAPI(title="Orchestra — Sentinel")

# Assumes app.models.bids / app.models.materials are imported somewhere before this runs
# so their tables register on Base.metadata. Replace with your real migration flow
# (Alembic, etc) — create_all is a dev convenience only.
Base.metadata.create_all(bind=engine)

app.include_router(bids.router)
app.include_router(materials.router)
