import shutil
from fastapi import APIRouter, File, UploadFile, HTTPException

from utilities.fileloader import excelLoader, stackplanLoader

router = APIRouter()

@router.post("/uploadfile")
async def upload_context_file(type: str, file: UploadFile, floors: int | None = None):
    """File uploader influenced by a different personal project of a team member (https://github.com/330i/llm-sandbox).
    
        file (UploadFile): Locally uploaded file. TODO: Change this to a S3 Bucket link.
    """
    with open(f'./resources/{file.filename}', 'wb') as buffer:
        shutil.copyfileobj(file.file, buffer)
    file.file.close()
    if type == "stl":
        stackplanLoader(f'./resources/{file.filename}', floors)
    elif type == "xlsx":
        return excelLoader(f'./resources/{file.filename}')
    else:
        raise HTTPException(500, detail=f'{file.filename} of {type} is not supported.')
    raise HTTPException(200, detail=f'{file.filename} of size {file.size} uploaded.')