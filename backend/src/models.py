"""
Pydantic models for Stackbox API
"""

from datetime import datetime
from typing import Optional, List, Literal, Annotated
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr

HexColor = Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]


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
    color: Optional[HexColor] = None
    createdAt: datetime
    updatedAt: datetime


class TenantCreate(BaseModel):
    """Model for creating a new tenant (without id and timestamps)"""
    name: str
    contact: Contact
    color: Optional[HexColor] = None


class TenantUpdate(BaseModel):
    """Model for updating a tenant (partial update allowed)"""
    name: Optional[str] = None
    contact: Optional[Contact] = None
    color: Optional[HexColor] = None


class GeoJSONGeometry(BaseModel):
    """GeoJSON Polygon geometry (RFC 7946)

    Note: Coordinates use [longitude, latitude] order per RFC 7946
    """
    type: str = Literal["Polygon"]
    coordinates: List[List[List[float]]]


class GeoJSONFeature(BaseModel):
    """GeoJSON Feature"""
    type: str = Literal["Feature"]
    properties: dict
    geometry: GeoJSONGeometry


class GeoJSONFeatureCollection(BaseModel):
    """GeoJSON FeatureCollection for floor geometry"""
    type: str = Literal["FeatureCollection"]
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
    geometries: List[List[List[List[float]]]]


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
