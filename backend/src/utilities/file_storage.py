"""Standardized local filesystem storage for file uploads."""

import os
import time
from pathlib import Path
from uuid import UUID

from config import settings


def _get_base_dir() -> Path:
    """Get absolute path to the upload base directory."""
    base = Path(settings.upload_directory)
    if not base.is_absolute():
        base = Path(os.getcwd()) / base
    return base


def _ensure_dir(path: Path) -> None:
    """Create directory and parents if they don't exist."""
    path.mkdir(parents=True, exist_ok=True)


def get_building_dir(building_id: UUID, subdir: str) -> Path:
    """Get the storage directory for a building's files.

    Args:
        building_id: UUID of the building.
        subdir: Subdirectory name, e.g. 'stl', 'excel', 'processed'.
    """
    path = _get_base_dir() / "buildings" / str(building_id) / subdir
    _ensure_dir(path)
    return path


def save_upload(building_id: UUID, file_type: str, filename: str, content: bytes) -> dict:
    """Save an uploaded file with timestamped naming to prevent overwrites.

    Args:
        building_id: UUID of the building this file belongs to.
        file_type: Category of file ('stl', 'excel').
        filename: Original filename from the upload.
        content: Raw file bytes.

    Returns:
        Dict with path, original_filename, file_size, and timestamp.
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.allowed_file_extensions:
        raise ValueError(f"File extension '{ext}' is not allowed. Allowed: {settings.allowed_file_extensions}")

    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.max_file_size_mb:
        raise ValueError(f"File size {size_mb:.1f}MB exceeds limit of {settings.max_file_size_mb}MB")

    timestamp = time.time_ns()
    safe_name = f"{timestamp}_{filename}"
    directory = get_building_dir(building_id, file_type)
    file_path = directory / safe_name

    file_path.write_bytes(content)

    return {
        "path": str(file_path),
        "original_filename": filename,
        "file_size": len(content),
        "timestamp": timestamp,
    }


def save_processed_json(building_id: UUID, data: str) -> str:
    """Save processed JSON output for a building.

    Args:
        building_id: UUID of the building.
        data: JSON string to write.

    Returns:
        Absolute path to the saved file.
    """
    timestamp = time.time_ns()
    directory = get_building_dir(building_id, "processed")
    file_path = directory / f"{timestamp}_floors.json"

    file_path.write_text(data)
    return str(file_path)


def list_files(building_id: UUID, file_type: str) -> list[dict]:
    """List files stored for a building under a given type.

    Args:
        building_id: UUID of the building.
        file_type: Category of file ('stl', 'excel', 'processed').

    Returns:
        List of dicts with name, path, and size for each file.
    """
    directory = _get_base_dir() / "buildings" / str(building_id) / file_type
    if not directory.exists():
        return []

    results = []
    for entry in sorted(directory.iterdir()):
        if entry.is_file():
            results.append({
                "name": entry.name,
                "path": str(entry),
                "size": entry.stat().st_size,
            })
    return results
