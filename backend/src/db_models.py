from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional
from database import Base
import uuid
from datetime import datetime, timezone

class UserModel(Base):
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sub: Mapped[str] = mapped_column(String, nullable=False) # Basic stuff like name and email can be handled by Cognito service.
    # TODO: Maybe add a corporate group field.
    
    property_managers: Mapped[list["PropertyManagerModel"]] = relationship("PropertyManagerModel", back_populates="user", cascade="all, delete-orphan")

class PropertyManagerModel(Base):
    __tablename__ = "property_managers"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    building_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("buildings.id"), nullable=False)
    
    user: Mapped["UserModel"] = relationship("UserModel", back_populates="property_managers")
    building: Mapped["BuildingModel"] = relationship("BuildingModel", back_populates="property_managers")

class BuildingModel(Base):
    __tablename__ = "buildings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    address_street: Mapped[str] = mapped_column(String, nullable=False)
    address_city: Mapped[str] = mapped_column(String, nullable=False, index=True)
    address_state: Mapped[str] = mapped_column(String, nullable=False)
    address_zip: Mapped[str] = mapped_column(String, nullable=False)
    address_country: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    total_floors: Mapped[int] = mapped_column(Integer, nullable=False)
    height_meters: Mapped[float] = mapped_column(Float, nullable=False)
    floor_height_meters: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    gross_square_feet: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    year_built: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    floors: Mapped[list["FloorModel"]] = relationship("FloorModel", back_populates="building", cascade="all, delete-orphan")
    property_managers: Mapped[list["PropertyManagerModel"]] = relationship("PropertyManagerModel", back_populates="building", cascade="all, delete-orphan")
    files: Mapped[list["FileModel"]] = relationship("FileModel", back_populates="building", cascade="all, delete-orphan")

class TenantModel(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    occupancies: Mapped[list["OccupancyModel"]] = relationship("OccupancyModel", back_populates="tenant", cascade="all, delete-orphan")

class FloorModel(Base):
    __tablename__ = "floors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    building_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("buildings.id"), nullable=False)
    floor_number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    square_feet: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    building: Mapped["BuildingModel"] = relationship("BuildingModel", back_populates="floors")
    occupancies: Mapped[list["OccupancyModel"]] = relationship("OccupancyModel", back_populates="floor", cascade="all, delete-orphan")

class OccupancyModel(Base):
    __tablename__ = "occupancies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    floor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("floors.id"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    room_num: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    square_feet: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    base_rent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lease_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    lease_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    lease_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    floor: Mapped["FloorModel"] = relationship("FloorModel", back_populates="occupancies")
    tenant: Mapped["TenantModel"] = relationship("TenantModel", back_populates="occupancies")

class FileModel(Base):
    __tablename__ = "files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    building_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("buildings.id"), nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)  # 'stl', 'excel', 'processed_json'
    file_path: Mapped[str] = mapped_column(String, nullable=False)  # stores S3 object key
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="uploaded")  # 'uploaded', 'processing', 'completed', 'failed'
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    building: Mapped["BuildingModel"] = relationship("BuildingModel", back_populates="files")


class JobModel(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    building_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("buildings.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    message: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    building: Mapped["BuildingModel"] = relationship("BuildingModel")