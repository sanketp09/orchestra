from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.graphs.material_auth_graph import build_material_auth_graph
from app.models.materials import MillReference
from app.schemas.materials import MaterialAuthResult

router = APIRouter(prefix="/sentinel/material-auth", tags=["material-auth"])
_graph = build_material_auth_graph()

UPLOAD_DIR = Path(os.environ.get("MATERIAL_PHOTO_DIR", "./uploads/material_photos"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Stand-in for the history stretch-goal endpoint below. Replace with a real query against
# MaterialInspection once persistence is wired up in the graph's finalize node.
_history_cache: dict[str, list[MaterialAuthResult]] = {}


@router.post("", response_model=MaterialAuthResult)
async def analyze_material_photo(
    photo: UploadFile = File(...),
    claimed_manufacturer: str = Form(...),
    po_line_item_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    reference_exists = (
        db.query(MillReference)
        .filter(MillReference.manufacturer_name == claimed_manufacturer)
        .first()
    )
    if reference_exists is None:
        raise HTTPException(
            status_code=404,
            detail=f"No mill reference on file for '{claimed_manufacturer}'",
        )

    dest_path = UPLOAD_DIR / f"{uuid.uuid4()}_{photo.filename}"
    dest_path.write_bytes(await photo.read())

    final_state = await _graph.ainvoke(
        {
            "photo_path": str(dest_path),
            "claimed_manufacturer": claimed_manufacturer,
            "po_line_item_id": po_line_item_id,
            "db": db,
        }
    )
    result: MaterialAuthResult = final_state["result"]
    _history_cache.setdefault(claimed_manufacturer, []).append(result)
    return result


@router.get("/history/{manufacturer_name}", response_model=list[MaterialAuthResult])
def get_match_history(manufacturer_name: str):
    """Stretch goal: match score trend over time for a given mill — the hook for
    Trustline's per-mill reliability signal (a mill trending toward more mismatches
    becomes a supply-chain risk signal, not just a one-off inspection result)."""
    return _history_cache.get(manufacturer_name, [])
