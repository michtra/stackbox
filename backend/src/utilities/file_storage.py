"""S3-backed file storage for uploads and processed data."""

import os
import time
from uuid import UUID

from config import settings
from s3 import upload_file, generate_presigned_url, list_objects


def save_upload(building_id: UUID, file_type: str, filename: str, content: bytes) -> dict:
    """Upload a file to S3 under buildings/{building_id}/{file_type}/.

    Returns dict with s3_key, original_filename, file_size, and timestamp.
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.allowed_file_extensions:
        raise ValueError(f"File extension '{ext}' is not allowed. Allowed: {settings.allowed_file_extensions}")

    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.max_file_size_mb:
        raise ValueError(f"File size {size_mb:.1f}MB exceeds limit of {settings.max_file_size_mb}MB")

    timestamp = time.time_ns()
    safe_name = f"{timestamp}_{filename}"
    s3_key = f"buildings/{building_id}/{file_type}/{safe_name}"

    content_type = _guess_content_type(ext)
    upload_file(s3_key, content, content_type)

    return {
        "s3_key": s3_key,
        "original_filename": filename,
        "file_size": len(content),
        "timestamp": timestamp,
    }


def save_processed_json(building_id: UUID, data: str) -> str:
    """Upload processed JSON to S3. Returns the S3 key."""
    timestamp = time.time_ns()
    s3_key = f"buildings/{building_id}/processed/{timestamp}_floors.json"
    upload_file(s3_key, data.encode("utf-8"), "application/json")
    return s3_key


def list_files(building_id: UUID, file_type: str) -> list[dict]:
    """List objects in S3 under buildings/{building_id}/{file_type}/."""
    prefix = f"buildings/{building_id}/{file_type}/"
    return list_objects(prefix)


def get_file_url(s3_key: str) -> str:
    """Generate a presigned download URL for the given S3 key."""
    return generate_presigned_url(s3_key)


def _guess_content_type(ext: str) -> str:
    types = {
        ".stl": "application/octet-stream",
        ".glb": "model/gltf-binary",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".json": "application/json",
    }
    return types.get(ext, "application/octet-stream")
