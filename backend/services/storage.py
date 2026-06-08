"""Object storage abstraction.

Default backend is **local disk** (works on any server). Optional Emergent
Object Storage is used when running inside the Emergent platform AND the
``STORAGE_BACKEND`` env var is set to ``emergent``.

Files are stored under ``LOCAL_STORAGE_DIR`` (default ``./uploads`` relative
to the backend working directory, but typically configured via env to
``/var/www/ozoxxexp/uploads`` in production).
"""
import os
import logging
import mimetypes
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# ---------- CONFIG -----------------------------------------------------------
APP_NAME = os.environ.get("APP_NAME", "ozoxx")
STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local").lower()

# Local disk
LOCAL_STORAGE_DIR = Path(os.environ.get("LOCAL_STORAGE_DIR", "uploads")).resolve()

# Emergent (legacy, optional)
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
_storage_key: Optional[str] = None


# ---------- INIT -------------------------------------------------------------
def init_storage() -> Optional[str]:
    """Prepares the storage backend. Always returns a sentinel string when ready."""
    if STORAGE_BACKEND == "emergent":
        global _storage_key
        if _storage_key:
            return _storage_key
        if not EMERGENT_KEY:
            logger.warning("STORAGE_BACKEND=emergent but EMERGENT_LLM_KEY not set; falling back to local disk")
        else:
            try:
                resp = requests.post(
                    f"{STORAGE_URL}/init",
                    json={"emergent_key": EMERGENT_KEY},
                    timeout=30,
                )
                resp.raise_for_status()
                _storage_key = resp.json()["storage_key"]
                logger.info("Emergent Object Storage initialized")
                return _storage_key
            except Exception as e:
                logger.error(f"Emergent storage init failed: {e} — falling back to local disk")

    # Local backend (default and fallback)
    LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Local storage ready at {LOCAL_STORAGE_DIR}")
    return "local"


# ---------- PUT --------------------------------------------------------------
def _local_safe_path(rel_path: str) -> Path:
    """Joins rel_path to LOCAL_STORAGE_DIR and prevents path traversal."""
    base = LOCAL_STORAGE_DIR
    full = (base / rel_path).resolve()
    if base not in full.parents and full != base:
        raise ValueError("Invalid storage path")
    return full


def put_object(path: str, data: bytes, content_type: str) -> dict:
    if STORAGE_BACKEND == "emergent" and EMERGENT_KEY:
        key = init_storage()
        if key and key != "local":
            try:
                return _put_emergent(path, data, content_type, key)
            except Exception as e:
                logger.error(f"Emergent storage upload failed: {e} — falling back to local")

    # Local disk
    if not LOCAL_STORAGE_DIR.exists():
        LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    full = _local_safe_path(path)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(data)
    return {"path": path, "size": len(data)}


def _put_emergent(path: str, data: bytes, content_type: str, key: str) -> dict:
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 403:
        global _storage_key
        _storage_key = None
        init_storage()
        key = _storage_key or ""
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


# ---------- GET --------------------------------------------------------------
def get_object(path: str) -> tuple[bytes, str]:
    if STORAGE_BACKEND == "emergent" and EMERGENT_KEY:
        key = init_storage()
        if key and key != "local":
            try:
                return _get_emergent(path, key)
            except Exception as e:
                logger.warning(f"Emergent storage read failed: {e} — trying local")

    # Local disk
    full = _local_safe_path(path)
    if not full.exists():
        raise FileNotFoundError(f"Object not found: {path}")
    content_type = mimetypes.guess_type(str(full))[0] or "application/octet-stream"
    return full.read_bytes(), content_type


def _get_emergent(path: str, key: str) -> tuple[bytes, str]:
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if resp.status_code == 403:
        global _storage_key
        _storage_key = None
        init_storage()
        key = _storage_key or ""
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
