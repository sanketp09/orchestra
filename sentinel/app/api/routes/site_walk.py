from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.graphs.site_walk_graph import build_site_walk_graph
from app.models.inventory import SiteWalkSession

router = APIRouter(prefix="/sentinel/site-walk", tags=["site-walk"])

UPLOAD_DIR = os.environ.get("SITE_WALK_UPLOAD_DIR", "/tmp/sentinel-uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _run_site_walk(session_id: str, video_path: str):
    """
    Background task: runs the compiled LangGraph against the uploaded video.
    Opens its own db session since it runs outside the request's session
    lifecycle.
    """
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        db_session = db.get(SiteWalkSession, session_id)
        if db_session is None:
            return
        db_session.status = "processing"
        db.commit()

        graph = build_site_walk_graph(db)
        graph.invoke(
            {"video_path": video_path, "session_id": session_id},
            config={"configurable": {"thread_id": session_id}},
        )
    except Exception as exc:  # noqa: BLE001 - surface any failure onto the session row
        db_session = db.get(SiteWalkSession, session_id)
        if db_session is not None:
            db_session.status = "error"
            db_session.error_message = str(exc)
            db.commit()
    finally:
        db.close()


@router.post("/upload")
async def upload_site_walk_video(
    background_tasks: BackgroundTasks,
    project_id: str,
    video: UploadFile,
    db: Session = Depends(get_db),
):
    if video.content_type not in ("video/mp4", "video/quicktime"):
        raise HTTPException(status_code=400, detail="Only .mp4/.mov video uploads are supported")

    session_id = str(uuid.uuid4())
    video_path = os.path.join(UPLOAD_DIR, f"{session_id}_{video.filename}")

    with open(video_path, "wb") as f:
        f.write(await video.read())

    db_session = SiteWalkSession(
        id=session_id,
        project_id=project_id,
        video_path=video_path,
        status="pending",
    )
    db.add(db_session)
    db.commit()

    background_tasks.add_task(_run_site_walk, session_id, video_path)

    return {"session_id": session_id, "status": "pending"}


@router.get("/{session_id}")
async def get_site_walk_result(session_id: str, db: Session = Depends(get_db)):
    db_session = db.get(SiteWalkSession, session_id)
    if db_session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "status": db_session.status,
        "error_message": db_session.error_message,
        "result": db_session.result,
    }
