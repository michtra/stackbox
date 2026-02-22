import io
import os
import tempfile
from uuid import UUID

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, status

from utilities.file_storage import save_upload
from utilities.fileloader import excelLoader, stackplanLoader

router = APIRouter()

@router.post("/uploadfile", status_code=status.HTTP_201_CREATED)
async def upload_context_file(
    type: str,
    file: UploadFile,
    building_id: UUID = Query(..., alias="buildingId"),
    floors: int | None = None,
):
    """Upload a file for processing and store it in S3.

    Args:
        type: File type, either 'stl' or 'xlsx'.
        file: The uploaded file.
        building_id: UUID of the building this file belongs to.
        floors: Number of floors (required for STL files).
    """
    if not file.filename:
        raise HTTPException(400, detail="No filename provided.")

    content = await file.read()
    file.file.close()

    try:
        metadata = save_upload(building_id, type, file.filename, content)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))

    if type == "stl":
        if floors is None:
            raise HTTPException(400, detail="floors parameter is required for STL uploads.")

        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            stackplanLoader(tmp_path, floors, building_id)
        finally:
            os.unlink(tmp_path)
    elif type == "xlsx":
        result = excelLoader(io.BytesIO(content))
        return {
            "detail": f"{file.filename} uploaded and parsed successfully.",
            "file": metadata,
            "data": result,
        }
    else:
        raise HTTPException(400, detail=f"File type '{type}' is not supported. Use 'stl' or 'xlsx'.")

    return {
        "detail": f"{file.filename} uploaded successfully.",
        "file": metadata,
    }
