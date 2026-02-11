from typing import Optional, List, Union, cast
from uuid import UUID, uuid4
from fastapi import Depends, FastAPI, HTTPException, Query, Path, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
import math

from models import (
    Building, BuildingCreate, BuildingUpdate, BuildingListResponse, BuildingResponse,
    Tenant, TenantCreate, TenantUpdate, TenantListResponse, TenantResponse, TenantOccupanciesResponse, TenantOccupancyInfo,
    Floor, FloorUpdate, FloorListResponse, FloorResponse,
    Occupancy, OccupancyCreate, OccupancyUpdate,
    StackingPlanResponse, StackingPlan,
    UploadJobResponse,
    Geometry, Address, BuildingMetadata, Location, PaginationMeta, Contact,
    # FUTURE: S3 models - kept for when S3 upload flow is implemented
    PresignedUrlRequest, PresignedUrlResponse, ProcessSTLRequest, JobResponse, Job
)
from utilities.file_storage import save_upload
from database import get_db
from db_models import BuildingModel, TenantModel, FloorModel, OccupancyModel, GeometryModel
from config import settings
from routers import loaders

app = FastAPI(title="Stackbox API")

def db_building_to_pydantic(db_building: BuildingModel) -> Building:
    """Converting database building model to Pydantic model"""
    return Building(
        id = cast(UUID, db_building.id),
        name = cast(str, db_building.name),
        address = Address(
            street = cast(str, db_building.address_street),
            city = cast(str, db_building.address_city),
            state = cast(str, db_building.address_state),
            zip = cast(str, db_building.address_zip),
            country = cast(str, db_building.address_country)
        ),
        location = Location(
            latitude = cast(float, db_building.latitude),
            longitude = cast(float, db_building.longitude)
        ),
        metadata = BuildingMetadata(
            totalFloors = cast(int, db_building.total_floors),
            heightMeters = cast(float, db_building.height_meters),
            floorHeightMeters = cast(float, db_building.floor_height_meters) if db_building.floor_height_meters is not None else None,
            grossSquareFeet = cast(float, db_building.gross_square_feet) if db_building.gross_square_feet is not None else None,
            yearBuilt = cast(int, db_building.year_built) if db_building.year_built is not None else None
        ),
        createdAt = cast(datetime, db_building.created_at),
        updatedAt = cast(datetime, db_building.updated_at)
    )

def db_tenant_to_pydantic(db_tenant: TenantModel) -> Tenant:
    """Converting database tenant model to Pydantic model"""
    return Tenant(
        id = cast(UUID, db_tenant.id),
        name = cast(str, db_tenant.name),
        contact = Contact(
            email = cast(str, db_tenant.contact_email),
            phone = cast(str, db_tenant.contact_phone)
        ),
        createdAt = cast(datetime, db_tenant.created_at),
        updatedAt = cast(datetime, db_tenant.updated_at)
    )

def db_floor_to_pydantic(db_floor: FloorModel) -> Floor:
    """Converting database floor model to Pydantic model"""
    return Floor(
        floorNumber = cast(int, db_floor.floor_number),
        label = cast(str, db_floor.label),
        squareFeet = cast(float, db_floor.square_feet) if db_floor.square_feet is not None else None,
        geometry = cast(UUID, db_floor.geometry_id),
        occupancies = [
            Occupancy(
                tenantId = cast(UUID, occ.tenant_id),
                squareFeet = occ.square_feet,
                leaseStart = cast(datetime, occ.lease_start) if occ.lease_start else None,
                leaseEnd = cast(datetime, occ.lease_end) if occ.lease_end else None
            ) for occ in db_floor.occupancies
        ]
    )

@app.get("/")
def read_root():
    return {"message": "Welcome to the Stackbox API"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}

# FUTURE: S3 Upload Endpoints
# These endpoints are placeholders for a future S3-based upload flow.
# Currently all file uploads use local filesystem storage via /uploadfile
# and /api/buildings/{id}/upload/* endpoints.
# When S3 is implemented, add boto3 to requirements.txt and uncomment these.

# @app.post("/api/v1/presigned-url", response_model=PresignedUrlResponse)
# @app.post("/api/v1/process-stl", response_model=JobResponse)
# @app.get("/api/v1/jobs/{job_id}", response_model=JobResponse)

# Buildings
@app.get("/api/buildings", response_model=BuildingListResponse)
async def list_buildings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    city: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all buildings with pagination"""
    query = db.query(BuildingModel)
    if city:
        query = query.filter(BuildingModel.address_city == city)

    total_buildings = query.count()
    total_pages = math.ceil(total_buildings / limit)
    offset = (page - 1) * limit
    buildings = query.offset(offset).limit(limit).all()

    return BuildingListResponse(
        data = [db_building_to_pydantic(b) for b in buildings],
        pagination = PaginationMeta(
            page = page,
            limit = limit,
            total = total_buildings,
            totalPages = total_pages
        )
    )

@app.post("/api/buildings", status_code=201, response_model=BuildingResponse)
async def create_building(building: BuildingCreate, db: Session = Depends(get_db)):
    """Create a new building"""
    existing = db.query(BuildingModel).filter(
        BuildingModel.name == building.name,
        BuildingModel.address_city == building.address.city
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Building with this name already exists in this city"
        )

    # Create building record
    db_building = BuildingModel(
        name=building.name,
        address_street=building.address.street,
        address_city=building.address.city,
        address_state=building.address.state,
        address_zip=building.address.zip,
        address_country=building.address.country,
        latitude=building.location.latitude,
        longitude=building.location.longitude,
        total_floors=building.metadata.totalFloors,
        height_meters=building.metadata.heightMeters,
        floor_height_meters=building.metadata.floorHeightMeters,
        gross_square_feet=building.metadata.grossSquareFeet,
        year_built=building.metadata.yearBuilt
    )
    try:
        db.add(db_building)
        db.commit()
        db.refresh(db_building)

        for floor_num in range(building.metadata.totalFloors):
            db_floor = FloorModel(
                building_id=db_building.id,
                floor_number=floor_num
            )
            db.add(db_floor)
        db.commit()
        db.refresh(db_building)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create building: {str(e)}"
        )
    return BuildingResponse(data=db_building_to_pydantic(db_building))

@app.get("/api/buildings/{id}", response_model=BuildingResponse)
async def get_building(id: UUID, db: Session = Depends(get_db)):
    """Get a specific building by ID"""
    building = db.query(BuildingModel).filter(BuildingModel.id == id).first()
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )
    return BuildingResponse(data=db_building_to_pydantic(building))

@app.put("/api/buildings/{id}", response_model=BuildingResponse)
async def update_building(id: UUID, building: BuildingUpdate, db: Session = Depends(get_db)):
    """Update a building"""
    db_building = db.query(BuildingModel).filter(BuildingModel.id == id).first()
    if not db_building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )
    # Update fields
    if building.name is not None:
        db_building.name = building.name
    if building.address is not None:
        db_building.address_street = building.address.street
        db_building.address_city = building.address.city
        db_building.address_state = building.address.state
        db_building.address_zip = building.address.zip
        db_building.address_country = building.address.country
    if building.location is not None:
        db_building.latitude = building.location.latitude
        db_building.longitude = building.location.longitude
    if building.metadata is not None:
        db_building.total_floors = building.metadata.totalFloors
        db_building.height_meters = building.metadata.heightMeters
        db_building.floor_height_meters = building.metadata.floorHeightMeters
        db_building.gross_square_feet = building.metadata.grossSquareFeet
        db_building.year_built = building.metadata.yearBuilt
    setattr(db_building, 'updated_at', datetime.utcnow())
    try:
        db.commit()
        db.refresh(db_building)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update building: {str(e)}"
        )
    return BuildingResponse(data=db_building_to_pydantic(db_building))

@app.delete("/api/buildings/{id}", status_code=204)
async def delete_building(id: UUID, db: Session = Depends(get_db)):
    """Delete a building"""
    db_building = db.query(BuildingModel).filter(BuildingModel.id == id).first()

    if not db_building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )
    try:
        db.delete(db_building)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete building: {str(e)}"
        )
    return None

@app.get("/api/buildings/{id}/stacking-plan", response_model=StackingPlanResponse)
async def get_stacking_plan(id: UUID, db: Session = Depends(get_db)):
    """Get the complete stacking plan for a building"""
    building = db.query(BuildingModel).filter(BuildingModel.id == id).first()

    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )

    floors = db.query(FloorModel).filter(FloorModel.building_id == id).order_by(FloorModel.floor_number).all()

    tenant_ids = set()
    for floor in floors:
        for occ in floor.occupancies:
            tenant_ids.add(occ.tenant_id)

    tenants = db.query(TenantModel).filter(TenantModel.id.in_(tenant_ids)).all() if tenant_ids else []

    geometry_ids = [f.geometry_id for f in floors if cast(bool, f.geometry_id)]
    geometries = db.query(GeometryModel).filter(GeometryModel.id.in_(geometry_ids)).all() if geometry_ids else []

    stacking_plan = StackingPlan(
        building=db_building_to_pydantic(building),
        tenants=[db_tenant_to_pydantic(t) for t in tenants],
        floors=[db_floor_to_pydantic(f) for f in floors],
        geometries=[Geometry(id = cast(UUID, g.id), geometry = g.geometry) for g in geometries] # type: ignore
    )

    return StackingPlanResponse(data=stacking_plan)

# Tenants
@app.get("/api/tenants", response_model = TenantListResponse)
async def list_tenants(search: Optional[str] = None, db: Session = Depends(get_db)):
    """List all tenants with optional name search"""
    query = db.query(TenantModel)
    if search:
        query = query.filter(TenantModel.name.ilike(f"%{search}%"))
    tenants = query.all()
    return TenantListResponse(data = [db_tenant_to_pydantic(t) for t in tenants])

@app.post("/api/tenants", status_code=201, response_model = TenantResponse)
async def create_tenant(tenant: TenantCreate, db: Session = Depends(get_db)):
    """Create a new tenant"""
    db_tenant = TenantModel(
        name = tenant.name,
        contact_email = tenant.contact.email,
        contact_phone = tenant.contact.phone
    )
    try:
        db.add(db_tenant)
        db.commit()
        db.refresh(db_tenant)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail = f"Failed to create tenant: {str(e)}"
        )
    return TenantResponse(data=db_tenant_to_pydantic(db_tenant))

@app.get("/api/tenants/{id}", response_model=TenantResponse)
async def get_tenant(id: UUID, db: Session = Depends(get_db)):
    """Get a specific tenant by ID"""
    db_tenant = db.query(TenantModel).filter(TenantModel.id == id).first()
    if not db_tenant:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Tenant not found"
        )
    return TenantResponse(data = db_tenant_to_pydantic(db_tenant))

@app.put("/api/tenants/{id}", response_model=TenantResponse)
async def update_tenant(id: UUID, tenant: TenantUpdate, db: Session = Depends(get_db)):
    """Update a tenant (partial updates allowed)"""
    db_tenant = db.query(TenantModel).filter(TenantModel.id == id).first()
    if not db_tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    if tenant.name is not None:
        db_tenant.name = tenant.name
    if tenant.contact is not None:
        if tenant.contact.email is not None:
            db_tenant.contact_email = tenant.contact.email
        if tenant.contact.phone is not None:
            db_tenant.contact_phone = tenant.contact.phone

    setattr(db_tenant, 'updated_at', datetime.utcnow())
    try:
        db.commit()
        db.refresh(db_tenant)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update tenant: {str(e)}"
        )
    return TenantResponse(data=db_tenant_to_pydantic(db_tenant))

@app.delete("/api/tenants/{id}", status_code=204)
async def delete_tenant(id: UUID, db: Session = Depends(get_db)):
    """Delete a tenant"""
    db_tenant = db.query(TenantModel).filter(TenantModel.id == id).first()
    if not db_tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    try:
        db.delete(db_tenant)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete tenant: {str(e)}"
        )
    return None

@app.get("/api/tenants/{id}/occupancies", response_model=TenantOccupanciesResponse)
async def get_tenant_occupancies(id: UUID, db: Session = Depends(get_db)):
    """Get all occupancies for a tenant across buildings"""
    db_tenant = db.query(TenantModel).filter(TenantModel.id == id).first()
    if not db_tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    occupancies = db.query(OccupancyModel, FloorModel, BuildingModel).join(
        FloorModel, OccupancyModel.floor_id == FloorModel.id
    ).join(
        BuildingModel, FloorModel.building_id == BuildingModel.id
    ).filter(OccupancyModel.tenant_id == id).all()

    occupancy_info = [
        TenantOccupancyInfo(
            buildingId = cast(UUID, building.id),
            buildingName = building.name,
            floorNumber = floor.floor_number,
            squareFeet = occ.square_feet or 0.0,
            leaseStart = cast(datetime, occ.lease_start) if occ.lease_start else datetime.utcnow(),
            leaseEnd = cast(datetime, occ.lease_end) if occ.lease_end else datetime.utcnow()
        ) for occ, floor, building in occupancies
    ]
    return TenantOccupanciesResponse(data=occupancy_info)

# Floorplans
@app.get("/api/buildings/{id}/floors", response_model=FloorListResponse)
async def list_floors(id: UUID, db: Session = Depends(get_db)):
    """List all floors for a building"""
    db_building = db.query(BuildingModel).filter(BuildingModel.id == id).first()

    if not db_building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )

    db_floors = db.query(FloorModel).filter(
        FloorModel.building_id == id
    ).order_by(FloorModel.floor_number).all()

    return FloorListResponse(data = [db_floor_to_pydantic(f) for f in db_floors])

@app.put("/api/buildings/{id}/floors/{floorNumber}", response_model=FloorResponse)
async def update_floor(id: UUID, floorNumber: int, floor_data: FloorUpdate, db: Session = Depends(get_db)):
    """Update floor information (partial update)"""
    db_floor = db.query(FloorModel).filter(
        FloorModel.building_id == id,
        FloorModel.floor_number == floorNumber
    ).first()

    if not db_floor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Floor not found"
        )

    if floor_data.label is not None:
        db_floor.label = floor_data.label
    if floor_data.squareFeet is not None:
        db_floor.square_feet = floor_data.squareFeet

    try:
        db.commit()
        db.refresh(db_floor)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update floor: {str(e)}"
        )

    return FloorResponse(data = db_floor_to_pydantic(db_floor))

@app.post("/api/buildings/{id}/floors/{floorNumber}/occupancies", status_code=201, response_model=FloorResponse)
async def add_occupancy(id: UUID, floorNumber: int, occupancy: OccupancyCreate, db: Session = Depends(get_db)):
    """Add a tenant to a floor"""
    db_floor = db.query(FloorModel).filter(
        FloorModel.building_id == id,
        FloorModel.floor_number == floorNumber
    ).first()

    if not db_floor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail = "Floor not found"
        )

    db_tenant = db.query(TenantModel).filter(TenantModel.id == occupancy.tenantId).first()
    if not db_tenant:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Tenant not found"
        )

    if occupancy.leaseStart and occupancy.leaseEnd:
        if occupancy.leaseEnd <= occupancy.leaseStart:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lease end date must be after lease start date"
            )

    existing = db.query(OccupancyModel).filter(
        OccupancyModel.floor_id == db_floor.id,
        OccupancyModel.tenant_id == occupancy.tenantId
    ).first()

    if existing:
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "Tenant already occupies this floor"
        )

    db_occupancy = OccupancyModel(
        floor_id = db_floor.id,
        tenant_id = occupancy.tenantId,
        square_feet = occupancy.squareFeet,
        lease_start = occupancy.leaseStart,
        lease_end = occupancy.leaseEnd
    )

    try:
        db.add(db_occupancy)
        db.commit()
        db.refresh(db_occupancy)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail = f"Failed to add occupancy: {str(e)}"
        )

    return FloorResponse(data = db_floor_to_pydantic(db_floor))

@app.put("/api/buildings/{id}/floors/{floorNumber}/occupancies/{tenantId}", response_model=FloorResponse)
async def update_occupancy(id: UUID, floorNumber: int, tenantId: UUID, occupancy_data: OccupancyUpdate, db: Session = Depends(get_db)):
    """Update tenant occupancy information"""
    db_floor = db.query(FloorModel).filter(
        FloorModel.building_id == id,
        FloorModel.floor_number == floorNumber
    ).first()

    if not db_floor:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Floor not found"
        )

    db_occupancy = db.query(OccupancyModel).filter(
        OccupancyModel.floor_id == db_floor.id,
        OccupancyModel.tenant_id == tenantId
    ).first()

    if not db_occupancy:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Occupancy record not found"
        )

    if occupancy_data.squareFeet is not None:
        setattr(db_occupancy, "square_feet", occupancy_data.squareFeet)
    if occupancy_data.leaseStart is not None:
        setattr(db_occupancy, "lease_start", occupancy_data.leaseStart)
    if occupancy_data.leaseEnd is not None:
        setattr(db_occupancy, "lease_end", occupancy_data.leaseEnd)

    if db_occupancy.lease_start is not None and db_occupancy.lease_end is not None:
        lease_end = cast(datetime, db_occupancy.lease_end)
        lease_start = cast(datetime, db_occupancy.lease_start)
        if lease_end <= lease_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lease end date must be after lease start date"
            )

    try:
        db.commit()
        db.refresh(db_occupancy)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail = f"Failed to update occupancy: {str(e)}"
        )

    return FloorResponse(data=db_floor_to_pydantic(db_floor))

@app.delete("/api/buildings/{id}/floors/{floorNumber}/occupancies/{tenantId}", status_code=204)
async def remove_occupancy(id: UUID, floorNumber: int, tenantId: UUID, db: Session = Depends(get_db)):
    """Remove a tenant from a floor"""
    db_floor = db.query(FloorModel).filter(
        FloorModel.building_id == id,
        FloorModel.floor_number == floorNumber
    ).first()

    if not db_floor:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Floor not found"
        )

    db_occupancy = db.query(OccupancyModel).filter(
        OccupancyModel.floor_id == db_floor.id,
        OccupancyModel.tenant_id == tenantId
    ).first()

    if not db_occupancy:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Occupancy record not found"
        )

    try:
        db.delete(db_occupancy)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail = f"Failed to remove occupancy: {str(e)}"
        )
    return None

# File Uploads
@app.post("/api/buildings/{id}/upload/stl", response_model=UploadJobResponse)
async def upload_stl(
    id: UUID,
    file: UploadFile = File(...),
    floorHeight: float = Form(...),
    baseElevation: float = Form(...),
    db: Session = Depends(get_db)
):
    """Upload 3D building model for floor geometry extraction"""
    db_building = db.query(BuildingModel).filter(BuildingModel.id == id).first()

    if not db_building:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Building not found"
        )

    if not file.filename or not file.filename.endswith(('.stl', '.glb')):
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid file type. Only STL and GLB files are accepted"
        )

    content = await file.read()
    file.file.close()

    try:
        metadata = save_upload(id, "stl", file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    import uuid
    job_id = str(uuid.uuid4())

    return UploadJobResponse(data={
        "jobId": job_id,
        "status": "processing",
        "message": f"Processing STL file for building {db_building.name}...",
        "filePath": metadata["path"],
    })

@app.post("/api/buildings/{id}/upload/excel", response_model=UploadJobResponse)
async def upload_excel(id: UUID, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload Excel file with stacking plan data"""
    db_building = db.query(BuildingModel).filter(BuildingModel.id == id).first()

    if not db_building:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Building not found"
        )

    if not file.filename or not file.filename.endswith('.xlsx'):
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid file type. Only Excel (.xlsx) files are accepted"
        )

    content = await file.read()
    file.file.close()

    try:
        metadata = save_upload(id, "excel", file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    import uuid
    job_id = str(uuid.uuid4())

    return UploadJobResponse(data={
        "jobId": job_id,
        "status": "processing",
        "message": f"Processing Excel file for building {db_building.name}...",
        "filePath": metadata["path"],
    })

@app.get("/api/buildings/{id}/processing-status")
async def get_processing_status(id: UUID, db: Session = Depends(get_db)):
    """Check processing status for file uploads"""
    db_building = db.query(BuildingModel).filter(BuildingModel.id == id).first()

    if not db_building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )

    # TODO: Implement actual job status tracking
    # This would query a jobs table or cache to get real status

    return {
        "data": {
            "status": "completed",
            "message": "All processing jobs completed",
            "jobs": []
        }
    }

app.include_router(loaders.router)
