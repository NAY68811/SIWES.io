"""Emergent-managed object storage service."""
import os
import logging
import uuid
import requests

logger = logging.getLogger("siwes.storage")

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = os.environ.get("APP_NAME", "siwes")

_storage_key: str | None = None


def init_storage() -> str | None:
    """Initialize the storage session key. Safe to call multiple times."""
    global _storage_key
    if _storage_key:
        return _storage_key
    llm_key = os.environ.get("EMERGENT_LLM_KEY")
    if not llm_key:
        logger.warning("EMERGENT_LLM_KEY not set — object storage disabled")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init",
                             json={"emergent_key": llm_key}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        logger.info("Object storage initialized")
        return _storage_key
    except Exception as e:
        logger.error("Storage init failed: %s", e)
        return None


def is_available() -> bool:
    return init_storage() is not None


MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
        "gif": "image/gif", "webp": "image/webp"}


def build_path(scope: str, user_id: str, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    return f"{APP_NAME}/{scope}/{user_id}/{uuid.uuid4()}.{ext}"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise RuntimeError("Object storage not available")
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    if not key:
        raise RuntimeError("Object storage not available")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
