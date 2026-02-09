"""
Pydantic models for Stackbox API
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr


class Address(BaseModel):
    """Building address model"""
    street: str
    city: str
    state: str
    zip: str
    country: str


class Location(BaseModel):
    """Geographic coordinates for map rendering"""
    latitude: float
    longitude: float


class BuildingMetadata(BaseModel):
    """Building attributes and specifications"""
    totalFloors: int
    heightMeters: float
    floorHeightMeters: Optional[float] = None
    grossSquareFeet: Optional[float] = None
    yearBuilt: Optional[int] = None


class Building(BaseModel):
    """Building model with location and metadata"""
    id: UUID
    name: str
    address: Address
    location: Location
    metadata: BuildingMetadata
    createdAt: datetime
    updatedAt: datetime


class BuildingCreate(BaseModel):
    """Model for creating a new building (without id and timestamps)"""
    name: str
    address: Address
    location: Location
    metadata: BuildingMetadata


class BuildingUpdate(BaseModel):
    """Model for updating a building (partial update allowed)"""
    name: Optional[str] = None
    address: Optional[Address] = None
    location: Optional[Location] = None
    metadata: Optional[BuildingMetadata] = None


class Contact(BaseModel):
    """Tenant contact information"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


class Tenant(BaseModel):
    """Tenant model"""
    id: UUID
    name: str
    contact: Contact
    createdAt: datetime
    updatedAt: datetime


class TenantCreate(BaseModel):
    """Model for creating a new tenant (without id and timestamps)"""
    name: str
    contact: Contact


class TenantUpdate(BaseModel):
    """Model for updating a tenant (partial update allowed)"""
    name: Optional[str] = None
    contact: Optional[Contact] = None


class GeoJSONGeometry(BaseModel):
    """GeoJSON Polygon geometry (RFC 7946)

    Note: Coordinates use [longitude, latitude] order per RFC 7946
    """
    type: str = Field(default="Polygon", const=True)
    coordinates: List[List[List[float]]]


class GeoJSONFeature(BaseModel):
    """GeoJSON Feature"""
    type: str = Field(default="Feature", const=True)
    properties: dict
    geometry: GeoJSONGeometry


class GeoJSONFeatureCollection(BaseModel):
    """GeoJSON FeatureCollection for floor geometry"""
    type: str = Field(default="FeatureCollection", const=True)
    features: List[GeoJSONFeature]


class Geometry(BaseModel):
    """Geometry model with UUID reference"""
    id: UUID
    geometry: GeoJSONFeatureCollection


class Occupancy(BaseModel):
    """Tenant occupancy on a floor"""
    tenantId: UUID
    squareFeet: Optional[float] = None
    leaseStart: Optional[datetime] = None
    leaseEnd: Optional[datetime] = None


class OccupancyCreate(BaseModel):
    """Model for creating a new occupancy"""
    tenantId: UUID
    squareFeet: Optional[float] = None
    leaseStart: Optional[datetime] = None
    leaseEnd: Optional[datetime] = None


class OccupancyUpdate(BaseModel):
    """Model for updating an occupancy (partial update allowed)"""
    squareFeet: Optional[float] = None
    leaseStart: Optional[datetime] = None
    leaseEnd: Optional[datetime] = None


class Floor(BaseModel):
    """Floor model with geometry and occupancies

    Note: floorNumber 0 represents ground floor
    """
    floorNumber: int
    label: Optional[str] = None
    squareFeet: Optional[float] = None
    geometry: Optional[UUID] = None
    occupancies: List[Occupancy] = Field(default_factory=list)


class FloorUpdate(BaseModel):
    """Model for updating a floor (partial update allowed)"""
    label: Optional[str] = None
    squareFeet: Optional[float] = None


class StackingPlan(BaseModel):
    """Complete stacking plan for a building"""
    building: Building
    tenants: List[Tenant]
    floors: List[Floor]
    geometries: List[Geometry]


class TenantOccupancyInfo(BaseModel):
    """Tenant occupancy information across buildings"""
    buildingId: UUID
    buildingName: str
    floorNumber: int
    squareFeet: float
    leaseStart: datetime
    leaseEnd: datetime


class PaginationMeta(BaseModel):
    """Pagination metadata for breaking large lists into smaller chunks

    Pagination divides large datasets into pages to improve performance and usability.
    For example, if there are 250 buildings with limit=20, the API returns 20 buildings
    per page across 13 pages.

    Note: Page numbers are 1-indexed (first page is page 1, not 0). Makes it easier for
    the frontend.

    Attributes:
        page: Current page number (1-indexed, starts at 1)
        limit: Number of items per page
        total: Total number of items in the dataset
        totalPages: Total number of pages available (calculated as ceil(total/limit))
    """
    page: int
    limit: int
    total: int
    totalPages: int


class BuildingListResponse(BaseModel):
    """Response model for building list endpoint"""
    data: List[Building]
    pagination: PaginationMeta


class BuildingResponse(BaseModel):
    """Response model for single building endpoint"""
    data: Building


class TenantListResponse(BaseModel):
    """Response model for tenant list endpoint"""
    data: List[Tenant]


class TenantResponse(BaseModel):
    """Response model for single tenant endpoint"""
    data: Tenant


class TenantOccupanciesResponse(BaseModel):
    """Response model for tenant occupancies endpoint"""
    data: List[TenantOccupancyInfo]


class FloorListResponse(BaseModel):
    """Response model for floor list endpoint"""
    data: List[Floor]


class FloorResponse(BaseModel):
    """Response model for single floor endpoint"""
    data: Floor


class StackingPlanResponse(BaseModel):
    """Response model for stacking plan endpoint"""
    data: StackingPlan


class UploadJobResponse(BaseModel):
    """Response model for file upload endpoints"""
    data: dict  # jobId, status, message


class STLUploadRequest(BaseModel):
    """Request model for file upload"""
    floorHeight: float = Field(description="Floor height in meters")
    baseElevation: float = Field(description="Base elevation in meters")


# FUTURE: Models below are for S3 upload flow (not currently active)

class PresignedUrlRequest(BaseModel):
    """Request model for generating a temporary presigned S3 upload URL.

    Presigned URLs allow uploading files directly to S3 without exposing
    AWS credentials and routing large files.
    """
    buildingId: UUID
    fileName: str
    contentType: str = "model/stl"


class PresignedUrlResponse(BaseModel):
    """Response containing presigned S3 URL for direct upload.

    The client should receive this response from POST /presigned-url,
    use uploadUrl to PUT the file directly to S3, and call POST /process-stl
    (with the s3Key) after upload completes.

    Expiration time assumes STL files are small (few MB).
    """
    uploadUrl: str = Field(description="Presigned URL for PUT request to S3")
    s3Key: str = Field(description="S3 object key where file will be stored")
    expiresIn: int = Field(default=300, description="URL expiration time in seconds")


class ProcessSTLRequest(BaseModel):
    """Request to start asynchronous STL processing job

    After uploading STL file to S3 using presigned URL, call this endpoint
    to start processing. The job runs asynchronously. Poll GET /jobs/{job_id}
    for current status/results.
    """
    buildingId: UUID
    s3Key: str = Field(description="S3 key from PresignedUrlResponse")
    floors: int = Field(description="Number of floors to split the building into")


class Job(BaseModel):
    """Async job model for long-running operations like STL processing.

    Statuses:
    - pending: Job created, waiting for worker to pick up
    - processing: Worker is processing the STL file
    - completed: Processing finished successfully. Check result field
    - failed: Processing failed. Check message field for error details

    S3 upload -> SQS queue -> Worker picks up job -> Updates status
    """
    id: UUID
    buildingId: UUID
    status: str = Field(description="pending | processing | completed | failed")
    message: Optional[str] = Field(default=None, description="Status message or error")
    result: Optional[dict] = Field(default=None, description="Processing results (floor polygons as GeoJSON)")
    createdAt: datetime
    updatedAt: datetime


class JobResponse(BaseModel):
    """Response model for job endpoints"""
    data: Job
