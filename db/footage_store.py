"""
db/footage_store.py
-------------------
PostgreSQL-backed store for CCTV footage metadata and persistent incident analysis records.

Schemas (created automatically on startup via init()):

    cctv_footage
    ├── id            SERIAL PRIMARY KEY
    ├── filename      TEXT UNIQUE NOT NULL       -- e.g. "fire_01.mp4"
    ├── display_name  TEXT NOT NULL              -- e.g. "fire_01"
    ├── storage_key   TEXT NOT NULL              -- local path, S3 key, or MinIO object name
    ├── size_mb       NUMERIC(10,2)
    └── created_at    TIMESTAMPTZ DEFAULT now()

    incidents
    ├── incident_id   TEXT PRIMARY KEY           -- e.g. "CAM01_001"
    ├── camera_id     TEXT NOT NULL
    ├── type          TEXT NOT NULL
    ├── severity_score INT NOT NULL
    ├── severity_label TEXT NOT NULL
    ├── data          JSONB NOT NULL             -- Full incident dictionary (features, evidence, report, dispatches, etc.)
    └── created_at    TIMESTAMPTZ DEFAULT now()
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

_conn = None

class FootageStoreUnavailable(RuntimeError):
    """Raised when the footage metadata database cannot be reached."""

def _get_conn():
    global _conn
    if _conn is not None:
        try:
            _conn.cursor().execute("SELECT 1")
            return _conn
        except Exception:
            _conn = None

    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        return None

    try:
        import psycopg2
        _conn = psycopg2.connect(db_url, connect_timeout=5)
        _conn.autocommit = True
        logger.info("[FootageStore] Connected to PostgreSQL.")
        return _conn
    except Exception as exc:
        logger.warning(f"[FootageStore] PostgreSQL unavailable: {exc}.")
        return None


# ── Schema bootstrap ──────────────────────────────────────────────────────────

_FOOTAGE_DDL = """
CREATE TABLE IF NOT EXISTS cctv_footage (
    id           SERIAL PRIMARY KEY,
    filename     TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    storage_key  TEXT NOT NULL,
    size_mb      NUMERIC(10,2),
    created_at   TIMESTAMPTZ DEFAULT now()
);
"""

_INCIDENTS_DDL = """
CREATE TABLE IF NOT EXISTS incidents (
    incident_id    TEXT PRIMARY KEY,
    camera_id      TEXT NOT NULL,
    type           TEXT NOT NULL,
    severity_score INT NOT NULL,
    severity_label TEXT NOT NULL,
    data           JSONB NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now()
);
"""

def init():
    """Call once at application startup to create tables if they do not exist."""
    conn = _get_conn()
    if conn is None:
        return
    try:
        cur = conn.cursor()
        cur.execute(_FOOTAGE_DDL)
        cur.execute(_INCIDENTS_DDL)
        logger.info("[FootageStore] PostgreSQL tables cctv_footage and incidents initialized.")
    except Exception as exc:
        logger.warning(f"[FootageStore] Could not initialize DDL: {exc}")


# ── Footage API ───────────────────────────────────────────────────────────────

def _list_local_footage() -> List[Dict[str, Any]]:
    """Fallback: Enumerate local video files from car_accidents directory."""
    from config.settings import VIDEOS_DIR
    supported = {".mp4", ".avi", ".mov", ".mkv"}
    records = []
    if VIDEOS_DIR.exists():
        files = sorted([f for f in VIDEOS_DIR.iterdir() if f.is_file() and f.suffix.lower() in supported])
        for idx, f in enumerate(files):
            size_mb = round(f.stat().st_size / (1024 * 1024), 2)
            records.append({
                "id": idx + 1,
                "filename": f.name,
                "display_name": f.stem,
                "storage_key": f"car_accidents/{f.name}",
                "size_mb": size_mb
            })
    return records


def list_footage() -> List[Dict[str, Any]]:
    """
    Returns available footage metadata from PostgreSQL, or local folder fallback.
    Each record: { id, filename, display_name, storage_key, size_mb }
    """
    conn = _get_conn()
    if conn is not None:
        try:
            from psycopg2.extras import RealDictCursor
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "SELECT id, filename, display_name, storage_key, size_mb "
                "FROM cctv_footage ORDER BY display_name, id"
            )
            rows = [dict(r) for r in cur.fetchall()]
            if rows:
                return rows
        except Exception as exc:
            logger.warning(f"[FootageStore] list_footage DB error: {exc}")

    return _list_local_footage()


def get_footage_by_id(footage_id: int) -> Optional[Dict[str, Any]]:
    """
    Looks up a single footage record by its database ID or local fallback index.
    Returns: { id, filename, display_name, storage_key, size_mb } or None.
    """
    conn = _get_conn()
    if conn is not None:
        try:
            from psycopg2.extras import RealDictCursor
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "SELECT id, filename, display_name, storage_key, size_mb "
                "FROM cctv_footage WHERE id = %s",
                (footage_id,)
            )
            row = cur.fetchone()
            if row:
                return dict(row)
        except Exception as exc:
            logger.warning(f"[FootageStore] get_footage_by_id DB error: {exc}")

    local_list = _list_local_footage()
    for rec in local_list:
        if rec["id"] == footage_id:
            return rec
    return None


# ── Incident Persistence API ─────────────────────────────────────────────────

def save_incident(incident_data: Dict[str, Any]) -> bool:
    """
    Persists a completed incident analysis into PostgreSQL.
    Overwrites if incident_id already exists.
    """
    conn = _get_conn()
    if conn is None:
        return False
    try:
        inc_id = incident_data.get("incident_id", "INC-001")
        cam_id = incident_data.get("camera_id", "CAM-01")
        inc_type = str(incident_data.get("type", "COLLISION"))
        sev_score = int(incident_data.get("severity_score", 0))
        sev_label = str(incident_data.get("severity_label", "Medium"))
        payload_json = json.dumps(incident_data)

        cur = conn.cursor()
        cur.execute("""
            INSERT INTO incidents (incident_id, camera_id, type, severity_score, severity_label, data)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            ON CONFLICT (incident_id) DO UPDATE
                SET camera_id = EXCLUDED.camera_id,
                    type = EXCLUDED.type,
                    severity_score = EXCLUDED.severity_score,
                    severity_label = EXCLUDED.severity_label,
                    data = EXCLUDED.data,
                    created_at = now();
        """, (inc_id, cam_id, inc_type, sev_score, sev_label, payload_json))
        logger.info(f"[FootageStore] Incident {inc_id} persisted to PostgreSQL.")
        return True
    except Exception as exc:
        logger.warning(f"[FootageStore] Could not save incident to DB: {exc}")
        return False


def list_saved_incidents() -> List[Dict[str, Any]]:
    """
    Retrieves all persistent incident reports from PostgreSQL.
    """
    conn = _get_conn()
    if conn is None:
        return []
    try:
        from psycopg2.extras import RealDictCursor
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT data FROM incidents ORDER BY created_at DESC")
        rows = cur.fetchall()
        return [r["data"] for r in rows if "data" in r]
    except Exception as exc:
        logger.warning(f"[FootageStore] list_saved_incidents DB error: {exc}")
        return []


def get_saved_incident(incident_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single persistent incident report by ID from PostgreSQL.
    """
    conn = _get_conn()
    if conn is None:
        return None
    try:
        from psycopg2.extras import RealDictCursor
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT data FROM incidents WHERE incident_id = %s", (incident_id,))
        row = cur.fetchone()
        return row["data"] if row and "data" in row else None
    except Exception as exc:
        logger.warning(f"[FootageStore] get_saved_incident DB error: {exc}")
        return None
