"""
Shared SQLAlchemy session infra.

ASSUMED TO ALREADY EXIST in the Orchestra backend from earlier features. Included here as
a minimal, working stub so this package runs standalone. If your project already defines
`Base` / `SessionLocal` / `get_db` elsewhere, delete this file and repoint the imports in
app/models/bids.py, app/models/materials.py, and app/api/routes/*.py.
"""
from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./orchestra.db")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
