from typing import Union
from uuid import UUID, uuid4
from datetime import datetime

from fastapi import FastAPI, HTTPException
from models import (
    PresignedUrlRequest,
    PresignedUrlResponse,
    ProcessSTLRequest,
    JobResponse,
    Job
)
from config import settings

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}


@app.post("/api/v1/presigned-url", response_model=PresignedUrlResponse)
def get_presigned_url(request: PresignedUrlRequest):
    """Generate presigned S3 URL for direct client upload

    - Client calls the endpoint with buildingId and fileName
    - Backend generates temporary presigned URL
    - Client uploads file directly to S3 using the presigned URL (PUT)
    - Client calls POST /process-stl with s3Key for processing
    """
    # TODO: Implement S3 presigned URL generation
    s3_key = f"uploads/{request.buildingId}/{request.fileName}"

    # Construct S3 URL based on configuration
    if settings.aws_endpoint_url:
        # LocalStack or custom endpoint
        base_url = f"{settings.aws_endpoint_url}/{settings.s3_bucket_name}"
    else:
        # Real AWS S3
        base_url = f"https://{settings.s3_bucket_name}.s3.{settings.aws_region}.amazonaws.com"

    return PresignedUrlResponse(
        uploadUrl=f"{base_url}/{s3_key}?presigned",
        s3Key=s3_key,
        expiresIn=settings.presigned_url_expiration
    )


@app.post("/api/v1/process-stl", response_model=JobResponse)
def process_stl(request: ProcessSTLRequest):
    """Start async STL processing job

    After uploading STL file to S3 via presigned URL, call this endpoint
    to start processing. Returns job ID for status polling.

    - This endpoint creates job record with status='pending'
    - S3 event notification automatically sends message to SQS queue
    - Worker polls SQS, picks up job, processes STL file
    - Worker updates job status to 'completed' or 'failed'
    - Client polls GET /jobs/{job_id} to check status
    """
    job_id = uuid4()

    # TODO: Create job record in database
    job = Job(
        id=job_id,
        buildingId=request.buildingId,
        status="pending",
        message="Job queued for processing",
        result=None,
        createdAt=datetime.utcnow(),
        updatedAt=datetime.utcnow()
    )
    return JobResponse(data=job)


@app.get("/api/v1/jobs/{job_id}", response_model=JobResponse)
def get_job_status(job_id: UUID):
    """Get job status and results

    Poll this endpoint to check processing status:
    - pending: Job waiting for worker
    - processing: Worker is processing STL
    - completed: Done. Check result field for floor polygons
    - failed: Error occurred, check message field

    Client should poll every 2-3 seconds until status is completed or failed.
    """
    # TODO: Fetch job from database
    raise HTTPException(status_code=404, detail="Job not found")  # TODO