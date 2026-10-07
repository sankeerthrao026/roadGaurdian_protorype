"""
db/storage_backend.py
---------------------
Resolves a footage storage_key to an absolute local file path
that the existing VideoManager / CameraWorker can open with cv2.

STORAGE_BACKEND=LOCAL  (default)
    storage_key is either:
      - an absolute path already   → returned as-is
      - a filename only            → resolved under VIDEOS_DIR
      - a relative path            → resolved under BASE_DIR

STORAGE_BACKEND=S3 / MINIO  (cloud storage extension)
    Downloads the object to a local cache directory and returns the cached file path.
"""

import hashlib
import os
import logging
from pathlib import Path
from threading import Lock

logger = logging.getLogger(__name__)
_download_lock = Lock()


def resolve_storage_key(storage_key: str) -> str:
    """
    Given a storage_key from cctv_footage.storage_key, return the absolute
    local filesystem path to the actual .mp4 file.
    """
    backend = os.getenv("STORAGE_BACKEND", "LOCAL").upper()

    if backend == "LOCAL":
        return _resolve_local(storage_key)

    if backend in ("S3", "MINIO"):
        return _resolve_object_storage(storage_key, backend)

    raise ValueError(f"Unknown STORAGE_BACKEND: {backend!r}")


def _resolve_local(storage_key: str) -> str:
    candidate = Path(storage_key)

    if candidate.is_absolute() and candidate.exists():
        return str(candidate.resolve())

    from config.settings import BASE_DIR, VIDEOS_DIR
    
    # Candidate search roots
    search_dirs = [
        VIDEOS_DIR,
        BASE_DIR / "car_accidents",
        BASE_DIR.parent / "car_accidents",
        Path.cwd() / "car_accidents",
        BASE_DIR,
    ]

    # 1. Direct relative check
    rel_to_base = BASE_DIR / storage_key
    if rel_to_base.exists() and rel_to_base.is_file():
        return str(rel_to_base.resolve())

    # 2. Check candidate name in search dirs
    filename = candidate.name
    variations = [
        filename,
        filename.replace(" ", "_"),
        filename.replace("_", " "),
    ]

    for sdir in search_dirs:
        if not sdir.exists():
            continue
        for var in variations:
            target = sdir / var
            if target.exists() and target.is_file():
                return str(target.resolve())
        # Fuzzy case-insensitive check
        for f in sdir.iterdir():
            if f.is_file() and f.name.lower() in [v.lower() for v in variations]:
                return str(f.resolve())

    raise FileNotFoundError(
        f"[StorageBackend] LOCAL: could not find '{storage_key}' "
        f"as absolute path, relative to BASE_DIR, or under VIDEOS_DIR."
    )


def _resolve_object_storage(storage_key: str, backend: str) -> str:
    bucket      = os.getenv("STORAGE_BUCKET", "roadguardian-footage")
    access_key  = os.getenv("STORAGE_ACCESS_KEY", "")
    secret_key  = os.getenv("STORAGE_SECRET_KEY", "")
    endpoint    = os.getenv("STORAGE_ENDPOINT", "")

    if not bucket:
        raise EnvironmentError(
            f"[StorageBackend] {backend} selected but STORAGE_BUCKET is not set."
        )

    object_bucket, object_key = _parse_storage_location(storage_key, bucket)
    suffix = Path(object_key).suffix or ".mp4"
    cache_dir = Path(os.getenv("STORAGE_CACHE_DIR", ".roadguardian-cache"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{hashlib.sha256(f'{object_bucket}/{object_key}'.encode()).hexdigest()}{suffix}"

    if cache_path.is_file() and cache_path.stat().st_size > 0:
        return str(cache_path.resolve())

    with _download_lock:
        if cache_path.is_file() and cache_path.stat().st_size > 0:
            return str(cache_path.resolve())
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("boto3 is required for S3 or MinIO footage storage.") from exc

        client_args = {}
        if endpoint:
            client_args["endpoint_url"] = endpoint
        if access_key:
            client_args["aws_access_key_id"] = access_key
        if secret_key:
            client_args["aws_secret_access_key"] = secret_key
        client = boto3.client("s3", **client_args)
        partial_path = cache_path.with_suffix(cache_path.suffix + ".part")
        try:
            client.download_file(object_bucket, object_key, str(partial_path))
            partial_path.replace(cache_path)
        except Exception:
            partial_path.unlink(missing_ok=True)
            raise

    logger.info("[StorageBackend] Downloaded s3://%s/%s", object_bucket, object_key)
    return str(cache_path.resolve())


def _parse_storage_location(storage_key: str, default_bucket: str) -> tuple[str, str]:
    if storage_key.startswith("s3://"):
        location = storage_key[5:]
        bucket, separator, object_key = location.partition("/")
        if not bucket or not separator or not object_key:
            raise ValueError("S3 storage_key must be in the form s3://bucket/object-key")
        return bucket, object_key
    if not storage_key or storage_key.startswith("/") or ".." in Path(storage_key).parts:
        raise ValueError("storage_key must be a non-empty object key")
    return default_bucket, storage_key
