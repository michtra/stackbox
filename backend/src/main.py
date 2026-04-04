from typing import Optional, List, Union, cast, Annotated
from uuid import UUID, uuid4
from fastapi import Depends, FastAPI, HTTPException, Query, Path, Request, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sqlalchemy import func, select, and_, or_
from datetime import datetime, timezone
import math
import json

from models import (
    Building, BuildingCreate, BuildingUpdate, BuildingListResponse, BuildingResponse,
    Tenant, TenantCreate, TenantUpdate, TenantListResponse, TenantResponse, TenantOccupanciesResponse, TenantOccupancyInfo,
    Floor, FloorUpdate, FloorListResponse, FloorResponse,
    Occupancy, OccupancyCreate, OccupancyUpdate,
    StackingPlanResponse, StackingPlan,
    UploadJobResponse,
    Geometry, Address, BuildingMetadata, Location, PaginationMeta, Contact,
)
from utilities.file_storage import save_upload, delete_upload
from database import get_db
from db_models import BuildingModel, TenantModel, FloorModel, OccupancyModel, FileModel, UserModel, PropertyManagerModel
from config import settings
from routers import loaders
from utilities.floor_plan import FloorGenerator
from auth import get_current_user, get_optional_user, CognitoUser, _build_cognito_user
from utilities.file_loader import excel_loader, excel_load_to_db
from s3 import download_file
import tempfile
import os
import io
import logging

logger = logging.getLogger(__name__)


def _rate_limit_key(request: Request) -> str:
    """Key function: use Cognito sub if authenticated, otherwise fall back to IP."""
    user: Optional[CognitoUser] = getattr(request.state, "rate_limit_user", None)
    if user:
        return user.sub
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key, storage_uri=settings.rate_limit_storage_uri)

app = FastAPI(title="Stackbox API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def attach_user_to_request(request: Request, call_next):
    """Resolve optional auth token early so _rate_limit_key can use the Cognito sub."""
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
    from auth import _validate_token
    request.state.rate_limit_user = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            claims = _validate_token(token)
            request.state.rate_limit_user = _build_cognito_user(claims)
        except Exception as e:
            # Invalid/expired token or auth not configured — fall back to IP keying.
            # The endpoint's own auth dependency will reject the request with a proper 401.
            logger.debug("Rate limit middleware: could not resolve user from token: %s", e)
    return await call_next(request)


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
        color = cast(str, db_tenant.color) if db_tenant.color is not None else None,
        createdAt = cast(datetime, db_tenant.created_at),
        updatedAt = cast(datetime, db_tenant.updated_at)
    )

def db_floor_to_pydantic(db_floor: FloorModel) -> Floor:
    """Converting database floor model to Pydantic model"""
    return Floor(
        floorNumber = cast(int, db_floor.floor_number),
        label = cast(str, db_floor.label),
        squareFeet = cast(float, db_floor.square_feet) if db_floor.square_feet is not None else None,
        occupancies = [
            Occupancy(
                id = cast(UUID, occ.id),
                tenantId = cast(UUID, occ.tenant_id),
                roomNumber = occ.room_num,
                squareFeet = occ.square_feet,
                baseRent = occ.base_rent,
                leaseType = occ.lease_type,
                leaseStart = cast(datetime, occ.lease_start) if occ.lease_start else None,
                leaseEnd = cast(datetime, occ.lease_end) if occ.lease_end else None
            ) for occ in db_floor.occupancies
        ]
    )

@app.get("/api/me")
async def get_me(user: CognitoUser = Depends(get_current_user)):
    """
    Get current authenticated user info.
    Use `id_token` instead of `access_token` to access user info.
    """
    return {"data": {"sub": user.sub, "email": user.email, "name": user.name}}


@app.get("/")
def read_root():
    return {"message": "Welcome to the Stackbox API"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}

# Buildings
@app.get("/api/buildings", response_model=BuildingListResponse)
async def list_buildings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    city: Optional[str] = None,
    db: Session = Depends(get_db),
    user: CognitoUser = Depends(get_current_user)
):
    """List all buildings with pagination"""
    building_query = select(BuildingModel) \
                        .join(PropertyManagerModel, BuildingModel.id == PropertyManagerModel.building_id) \
                        .where(PropertyManagerModel.user_id == user.id)
    if city:
        building_query = building_query.where(BuildingModel.address_city == city)

    total_buildings_query = select(func.count(BuildingModel.id)) \
                            .join(PropertyManagerModel, BuildingModel.id == PropertyManagerModel.building_id) \
                            .where(PropertyManagerModel.user_id == user.id)
    
    total_buildings = db.execute(total_buildings_query).scalar()
    total_pages = math.ceil(total_buildings / limit)
    
    offset = (page - 1) * limit
    building_query = building_query.offset(offset).limit(limit)

    buildings = db.execute(building_query).scalars().all()

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
@limiter.limit(settings.rate_limit_buildings)
async def create_building(request: Request, building: Annotated[str, Form()], db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
    """Create a new building"""
    building = BuildingCreate.model_validate_json(building)
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
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create building: {str(e)}"
        )
    
    # Add current user as property manager
    db_property_manager = PropertyManagerModel(
        user_id=user.id,
        building_id=db_building.id,
    )
    
    try:
        db.add(db_property_manager)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign property manager: {str(e)}"
        )
    
    return BuildingResponse(data=db_building_to_pydantic(db_building))

@app.get("/api/buildings/{id}", response_model=BuildingResponse)
async def get_building(id: UUID, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
    """Get a specific building by ID"""
    building = db.query(BuildingModel).filter(BuildingModel.id == id).first()
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )
    return BuildingResponse(data=db_building_to_pydantic(building))

@app.post("/api/buildings/metadata", status_code=status.HTTP_200_OK)
async def get_building_metadata(file: UploadFile = File(...)):
    """Gets building metadata (building data only) for setup and adjustments."""
    
    if not file.filename or not file.filename.endswith('.xlsx'):
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid file type. Only Excel (.xlsx) files are accepted"
        )

    content = await file.read()
    file.file.close()
    
    result = excel_loader(io.BytesIO(content), isBuildingOnly=True)
    return {
        "detail": f"{file.filename} metadata parsed successfully.",
        "data": result,
    }

@app.put("/api/buildings/{id}", response_model=BuildingResponse)
async def update_building(id: UUID, building: BuildingUpdate, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
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
async def delete_building(id: UUID, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
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
async def get_stacking_plan(id: UUID, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
    """Get the complete stacking plan for a building"""
    building_query = select(BuildingModel) \
                        .where(BuildingModel.id == id) \
                        .order_by(BuildingModel.updated_at.desc())
    building: BuildingModel = db.execute(building_query).scalars().first()

    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )

    floors_query = select(FloorModel) \
                    .where(FloorModel.building_id == id) \
                    .order_by(FloorModel.floor_number.asc())
    floors: list[FloorModel] = db.execute(floors_query).scalars().all()

    tenants_query = select(TenantModel).distinct() \
                    .join(OccupancyModel, OccupancyModel.tenant_id == TenantModel.id) \
                    .join(FloorModel, FloorModel.id == OccupancyModel.floor_id) \
                    .where(FloorModel.building_id == id)
    tenants: list[TenantModel] = db.execute(tenants_query).scalars().all()
    tenants_map: dict[UUID, TenantModel] = {}
    for tenant in tenants:
        tenants_map[tenant.id] = tenant

    occupancies_query = select(OccupancyModel) \
                        .join(FloorModel, FloorModel.id == OccupancyModel.floor_id) \
                        .where(FloorModel.building_id == id)
    occupancies: list[OccupancyModel] = db.execute(occupancies_query).scalars().all()
    for occupancy in occupancies:
        tenants_map[occupancy.tenant_id].occupancies.append(occupancy)

    geometry_query = select(FileModel.file_path) \
                        .where(
                            and_(
                                FileModel.building_id == id,
                                FileModel.file_type == "processed_json"
                            )
                        ) \
                        .order_by(FileModel.created_at.desc())
    geometry = db.execute(geometry_query).first()
    geometry_s3_key = geometry.file_path if geometry != None else None
    
    if not geometry_s3_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Geometry does not exist for building: {e}"
        )

    try:
        geometry_json = json.loads(download_file(geometry_s3_key))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cannot download geometry: {e}"
        )

    stacking_plan = StackingPlan(
        building=db_building_to_pydantic(building),
        tenants=[db_tenant_to_pydantic(t) for t in tenants],
        floors=[db_floor_to_pydantic(f) for f in floors],
        geometries=geometry_json
    )

    return StackingPlanResponse(data=stacking_plan)

# Tenants
@app.get("/api/tenants", response_model = TenantListResponse)
async def list_tenants(search: Optional[str] = None, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
    """List all tenants with optional name search"""
    query = db.query(TenantModel)
    if search:
        query = query.filter(TenantModel.name.ilike(f"%{search}%"))
    tenants = query.all()
    return TenantListResponse(data = [db_tenant_to_pydantic(t) for t in tenants])

@app.post("/api/tenants", status_code=201, response_model = TenantResponse)
async def create_tenant(tenant: TenantCreate, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
    """Create a new tenant"""
    db_tenant = TenantModel(
        name = tenant.name,
        contact_email = tenant.contact.email,
        contact_phone = tenant.contact.phone,
        color = tenant.color
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
async def get_tenant(id: UUID, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
    """Get a specific tenant by ID"""
    db_tenant = db.query(TenantModel).filter(TenantModel.id == id).first()
    if not db_tenant:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Tenant not found"
        )
    return TenantResponse(data = db_tenant_to_pydantic(db_tenant))

@app.put("/api/buildings/{id}/tenants", response_model=TenantListResponse)
async def update_building_tenants(id: UUID, tenants: List[TenantUpdate], db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
    """Update tenants for a specific building"""
    building_query = select(BuildingModel) \
                        .where(BuildingModel.id == id) \
                        .order_by(BuildingModel.updated_at.desc())
    building: BuildingModel = db.execute(building_query).scalars().first()

    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )

    db_tenants_query = select(TenantModel).distinct() \
                    .join(OccupancyModel, OccupancyModel.tenant_id == TenantModel.id) \
                    .join(FloorModel, FloorModel.id == OccupancyModel.floor_id) \
                    .where(FloorModel.building_id == id)
    db_tenants: list[TenantModel] = db.execute(db_tenants_query).scalars().all()
    db_tenants_map: dict[UUID, TenantModel] = {}
    for tenant in db_tenants:
        db_tenants_map[tenant.id] = tenant

    updated_tenants = []
    for tenant in tenants:
        if tenant.id is not None and tenant.id in db_tenants_map:
            db_tenant = db_tenants_map[tenant.id]
            if tenant.name is not None:
                db_tenant.name = tenant.name
            if tenant.contact is not None:
                if tenant.contact.email is not None:
                    db_tenant.contact_email = tenant.contact.email
                if tenant.contact.phone is not None:
                    db_tenant.contact_phone = tenant.contact.phone
            if tenant.color is not None:
                db_tenant.color = tenant.color
            setattr(db_tenant, 'updated_at', datetime.now(timezone.utc))
            updated_tenants.append(db_tenant)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tenant with ID {tenant.id} does not exist"
            )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update tenants: {str(e)}"
        )

    return TenantListResponse(data=[db_tenant_to_pydantic(t) for t in updated_tenants])

@app.put("/api/tenants/{id}", response_model=TenantResponse)
async def update_tenant(id: UUID, tenant: TenantUpdate, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
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
    if tenant.color is not None:
        db_tenant.color = tenant.color

    setattr(db_tenant, 'updated_at', datetime.now(timezone.utc))
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
async def delete_tenant(id: UUID, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
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
async def get_tenant_occupancies(id: UUID, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
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
async def list_floors(id: UUID, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
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
async def update_floor(id: UUID, floorNumber: int, floor_data: FloorUpdate, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
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
async def add_occupancy(id: UUID, floorNumber: int, occupancy: OccupancyCreate, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
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

@app.put("/api/buildings/{id}/occupancies", response_model=FloorListResponse)
async def update_building_occupancies(id: UUID, occupancies: List[OccupancyUpdate], db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
    """Bulk update occupancies for a building (add/update/remove)"""
    building_query = select(BuildingModel) \
                        .where(BuildingModel.id == id) \
                        .order_by(BuildingModel.updated_at.desc())
    building: BuildingModel = db.execute(building_query).scalars().first()

    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )

    try:
        updated_floors: set[FloorModel] = set()
        for occupancy in occupancies:
            if occupancy.id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Occupancy ID is required for update"
                )
            db_occupancy = db.query(OccupancyModel).filter(
                OccupancyModel.id == occupancy.id
            ).first()
            if not db_occupancy:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Occupancy with ID {occupancy.id} not found"
                )
            if occupancy.tenantId is not None:
                db_tenant = db.query(TenantModel).filter(TenantModel.id == occupancy.tenantId).first()
                if not db_tenant:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Tenant with ID {occupancy.tenantId} not found"
                    )
                db_occupancy.tenant_id = occupancy.tenantId
            if occupancy.floorNumber is not None:
                db_floor = db.query(FloorModel).filter(
                    FloorModel.building_id == id,
                    FloorModel.floor_number == occupancy.floorNumber
                ).first()
                if not db_floor:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Floor {occupancy.floorNumber} not found"
                    )
                db_occupancy.floor_id = db_floor.id
                updated_floors.add(db_floor)
            
            if occupancy.squareFeet is not None:
                db_occupancy.square_feet = occupancy.squareFeet
            if occupancy.baseRent is not None:
                db_occupancy.base_rent = occupancy.baseRent
            if occupancy.leaseStart is not None:
                db_occupancy.lease_start = occupancy.leaseStart
            if occupancy.leaseEnd is not None:
                db_occupancy.lease_end = occupancy.leaseEnd
            if occupancy.leaseType is not None:
                db_occupancy.lease_type = occupancy.leaseType

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update occupancies: {str(e)}"
        )

    return FloorListResponse(data=[db_floor_to_pydantic(f) for f in updated_floors])

@app.put("/api/buildings/{id}/floors/{floorNumber}/occupancies/{tenantId}", response_model=FloorResponse)
async def update_occupancy(id: UUID, floorNumber: int, tenantId: UUID, occupancy_data: OccupancyUpdate, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
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
async def remove_occupancy(id: UUID, floorNumber: int, tenantId: UUID, db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
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
@limiter.limit(settings.rate_limit_uploads)
async def upload_stl(
    request: Request,
    id: UUID,
    file: UploadFile = File(...),
    baseElevation: float = Form(...),
    centerX: Optional[float] = Form(None),
    centerY: Optional[float] = Form(None),
    scaleX: float = Form(1.0),
    scaleY: float = Form(1.0),
    scaleZ: float = Form(1.0),
    rotation: float = Form(0.0),
    db: Session = Depends(get_db),
    user: CognitoUser = Depends(get_current_user)
):
    """Upload 3D building model for floor geometry extraction"""
    # TODO: Implement job queue (currently looking into Redis Queue). Will use backend to process in the meantime.

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
        model_file_metadata = save_upload(id, "stl", file.filename, content)
        db_model_file = FileModel(
            building_id=id,
            file_type="stl",
            file_path=model_file_metadata["s3_key"],
            original_filename=model_file_metadata["original_filename"],
            file_size=model_file_metadata["file_size"],
            status="uploaded",
            created_at=datetime.fromtimestamp(model_file_metadata["timestamp"] / 1e9),
            processed_at=datetime.fromtimestamp(model_file_metadata["timestamp"] / 1e9),
        )
        db.add(db_model_file)
        db.commit()
        db.refresh(db_model_file)

        # FloorGenerator needs a file path for trimesh.load_mesh()
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            center = (centerX, centerY) if centerX is not None and centerY is not None else None
            scale = (scaleX, scaleY, scaleZ) if scaleX is not None and scaleY is not None and scaleZ is not None else None

            # TODO move to queue if we implement it
            generator = FloorGenerator(
                model=tmp_path,
                floors=db_building.total_floors,
                base_elevation=baseElevation,
                center=center,
                scale=scale,
                rotation=rotation
            )
            generator.generateFloors()
            process_metadata = save_upload(id, "processed", "floors.json", json.dumps(generator.getCoords(), indent=4))
            db_model_file = FileModel(
                building_id=id,
                file_type="processed_json",
                file_path=process_metadata["s3_key"],
                original_filename=process_metadata["original_filename"],
                file_size=process_metadata["file_size"],
                status="uploaded",
                created_at=datetime.fromtimestamp(model_file_metadata["timestamp"] / 1e9),
                processed_at=datetime.fromtimestamp(model_file_metadata["timestamp"] / 1e9),
            )
            model_metadata = generator.getMetadata()
            # ------------------------------------------------------

            db.add(db_model_file)
            
            db_building.height_meters = float(model_metadata["total_height"])
            
            db.commit()
            db.refresh(db_model_file)
        except Exception:
            delete_upload(model_file_metadata["s3_key"])
            raise
        finally:
            os.unlink(tmp_path)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="File storage unavailable.")

    import uuid
    job_id = str(uuid.uuid4())

    return UploadJobResponse(data={
        "jobId": job_id,
        "status": "processing",
        "message": f"Processing STL file for building {db_building.name}...",
        "modelFileS3Key": model_file_metadata["s3_key"],
        "processS3Key": process_metadata["s3_key"],
    })

@app.post("/api/buildings/{id}/upload/excel", response_model=UploadJobResponse)
@limiter.limit(settings.rate_limit_uploads)
async def upload_excel(request: Request, id: UUID, file: UploadFile = File(...), db: Session = Depends(get_db), user: CognitoUser = Depends(get_current_user)):
    """Upload Excel file with stacking plan data"""
    # TODO: Implement job queue (currently looking into Redis Queue). Will use backend to process in the meantime.
    
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
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="File storage unavailable.")

    import uuid
    job_id = str(uuid.uuid4())
    
    # TODO move to queue if we implement it
    try:
        excel_load_to_db(io.BytesIO(content), id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    # ------------------------------------------------------

    return UploadJobResponse(data={
        "jobId": job_id,
        "status": "processing",
        "message": f"Processing Excel file for building {db_building.name}...",
        "s3Key": metadata["s3_key"],
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
