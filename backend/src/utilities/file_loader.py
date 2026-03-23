import io
import json
from typing import Union
from uuid import uuid4, UUID
from datetime import datetime, timezone
from fastapi import Depends
import pandas as pd
from colorsys import yiq_to_rgb
import math
from sqlalchemy.orm import Session
import distinctipy

from utilities.floor_plan import FloorGenerator
from utilities.file_storage import save_processed_json
from db_models import TenantModel, FloorModel, OccupancyModel
from database import get_db

def excel_loader(filepath: Union[str, io.BytesIO], isBuildingOnly=False) -> dict:
    """(Deprecated) Parse a stacking plan Excel file and convert to the StackingPlan JSON schema.

    Expects an Excel file with two sheets:
      - 'Summary': building metadata (address, floor count, SF per floor)
      - 'Rent Roll': tenant occupancy data (floor, tenant, SF, lease dates)

    Args:
        filepath: Path to the .xlsx file or a BytesIO object.

    Returns:
        Dict matching the StackingPlan schema with building, tenants, floors, geometries.
    """
    xls = pd.ExcelFile(filepath)

    # --- Parse Summary sheet ---
    summary = pd.read_excel(xls, sheet_name="Summary", header=None)

    # Building metadata from fixed positions in the Summary sheet
    num_units = int(summary.iloc[1, 1])
    total_floors = int(summary.iloc[2, 1])
    street_address = str(summary.iloc[3, 1])
    city_state_zip = str(summary.iloc[4, 1])

    # Parse "Houston, Texas, 77002" into components
    parts = [p.strip() for p in city_state_zip.split(",")]
    city = parts[0] if len(parts) > 0 else ""
    state = parts[1] if len(parts) > 1 else ""
    zip_code = parts[2] if len(parts) > 2 else ""

    # Floor details from Summary: rows 2..2+total_floors, columns 3 (floor #) and 4 (SF)
    floor_sf_map = {}
    for i in range(total_floors):
        row_idx = 2 + i  # starts at row index 2
        floor_num = int(summary.iloc[row_idx, 3])
        net_rentable_sf = float(summary.iloc[row_idx, 4])
        floor_sf_map[floor_num] = net_rentable_sf

    now = datetime.now(timezone.utc).isoformat()
    building_id = str(uuid4())

    building = {
        "id": building_id,
        "name": street_address,
        "address": {
            "street": street_address,
            "city": city,
            "state": state,
            "zip": zip_code,
            "country": "US",
        },
        "location": {
            "latitude": 0.0,
            "longitude": 0.0,
        },
        "metadata": {
            "totalFloors": total_floors,
            "heightMeters": 0.0,
            "grossSquareFeet": sum(floor_sf_map.values()),
        },
        "createdAt": now,
        "updatedAt": now,
    }
    
    # Return building data only if requested
    if isBuildingOnly:
        stacking_plan = {
            "building": building
        }
        return stacking_plan

    # --- Parse Rent Roll sheet ---
    rent_roll = pd.read_excel(xls, sheet_name="Rent Roll", header=None)

    # Data rows start at index 3 (rows 0-2 are headers)
    data_rows = rent_roll.iloc[3:].reset_index(drop=True)

    # Build unique tenants and collect occupancy rows
    tenant_map: dict[str, str] = {}  # tenant_name -> tenant_id
    occupancy_rows = []

    for _, row in data_rows.iterrows():
        floor_num = int(row.iloc[0])
        room_num = int(row.iloc[1])
        tenant_name = str(row.iloc[2]).strip()
        sf = float(row.iloc[3]) if pd.notna(row.iloc[3]) else None
        lease_type = str(row.iloc[5]).strip()
        lease_start = row.iloc[6]
        lease_end = row.iloc[7]

        # Create tenant if not seen before
        if tenant_name not in tenant_map:
            tenant_map[tenant_name] = str(uuid4())

        # Normalize dates
        lease_start_str = None
        lease_end_str = None
        if pd.notna(lease_start):
            lease_start_str = pd.Timestamp(lease_start).isoformat()
        if pd.notna(lease_end):
            lease_end_str = pd.Timestamp(lease_end).isoformat()

        occupancy_rows.append({
            "floorNumber": floor_num,
            "roomNumber": room_num,
            "tenantId": tenant_map[tenant_name],
            "squareFeet": sf,
            "leaseType": lease_type,
            "leaseStart": lease_start_str,
            "leaseStart": lease_start_str,
            "leaseEnd": lease_end_str,
        })

    # Build tenants list
    tenants = [
        {
            "id": tid,
            "name": name,
            "contact": {},
            "createdAt": now,
            "updatedAt": now,
        }
        for name, tid in tenant_map.items()
    ]

    # Group occupancies by floor number
    floor_occupancies: dict[int, list[dict]] = {}
    for occ in occupancy_rows:
        fn = occ["floorNumber"]
        floor_occupancies.setdefault(fn, []).append({
            "tenantId": occ["tenantId"],
            "roomNumber": occ["roomNumber"],
            "squareFeet": occ["squareFeet"],
            "leaseType": occ["leaseType"],
            "leaseStart": occ["leaseStart"],
            "leaseEnd": occ["leaseEnd"],
        })

    # Build floors list — one entry per floor from Summary, attach occupancies from Rent Roll
    floors = []
    for floor_num in range(1, total_floors + 1):
        floors.append({
            "floorNumber": floor_num,
            "label": f"Floor {floor_num}",
            "squareFeet": floor_sf_map.get(floor_num),
            "geometry": None,
            "occupancies": floor_occupancies.get(floor_num, []),
        })

    stacking_plan = {
        "building": building,
        "tenants": tenants,
        "floors": floors,
        "geometries": [],
    }

    return stacking_plan

def excel_load_to_db(filepath: Union[str, io.BytesIO], building_id: UUID) -> dict:
    """Parse a stacking plan Excel file and load data into DB.

    Expects an Excel file with two sheets:
      - 'Summary': building metadata (address, floor count, SF per floor)
      - 'Rent Roll': tenant occupancy data (floor, tenant, SF, lease dates)

    Args:
        filepath: Path to the .xlsx file or a BytesIO object.
        building_id: Building UUID.

    Returns:
        Dict matching the StackingPlan schema with building, tenants, floors, geometries.
    """
    gen = get_db()
    db = next(gen)

    xls = pd.ExcelFile(filepath)

    # --- Parse Summary sheet ---
    summary = pd.read_excel(xls, sheet_name="Summary", header=None)

    # Building metadata from fixed positions in the Summary sheet
    total_floors = int(summary.iloc[2, 1])

    # Floor details from Summary: rows 2..2+total_floors, columns 3 (floor #) and 4 (SF)
    db_floor_map: dict[int, FloorModel] = {}
    for i in range(total_floors):
        row_idx = 2 + i  # starts at row index 2
        floor_num = int(summary.iloc[row_idx, 3])
        net_rentable_sf = float(summary.iloc[row_idx, 4])

        db_floor_map[floor_num] = FloorModel(
            building_id=building_id,
            floor_number=floor_num,
            label=f"Floor {floor_num}",
            square_feet=net_rentable_sf,
        )

    db.add_all(db_floor_map.values())
    db.flush()

    now_dt = datetime.now(timezone.utc)

    # --- Parse Rent Roll sheet ---
    rent_roll = pd.read_excel(xls, sheet_name="Rent Roll", header=None)

    # Data rows start at index 3 (rows 0-2 are headers)
    data_rows = rent_roll.iloc[3:].reset_index(drop=True)

    # Build unique tenants and collect occupancy rows
    tenant_set: set[str] = set()
    db_occupancy_rows: list[tuple[OccupancyModel, str]] = []

    for _, row in data_rows.iterrows():
        floor_num = int(row.iloc[0])
        room_num = str(row.iloc[1]).strip()
        tenant_name = str(row.iloc[2]).strip()
        sf = float(row.iloc[3]) if pd.notna(row.iloc[3]) else None
        lease_type = str(row.iloc[5]).strip()
        lease_start = row.iloc[6]
        lease_end = row.iloc[7]

        # Create tenant if not seen before
        tenant_set.add(tenant_name)

        # Normalize dates
        lease_start = None
        lease_end = None
        if pd.notna(lease_start):
            lease_start = pd.Timestamp(lease_start).to_pydatetime()
        if pd.notna(lease_end):
            lease_end = pd.Timestamp(lease_end).to_pydatetime()
        
        db_occupancy_rows.append((
            OccupancyModel(
                floor_id=db_floor_map[floor_num].id,
                room_num=room_num,
                square_feet=sf,
                lease_type=lease_type,
                lease_start=lease_start,
                lease_end=lease_end,
            ),
            tenant_name
        ))
    
    colors = distinctipy.get_colors(len(tenant_set))
    colors = ["#{:02X}{:02X}{:02X}".format(*[int(val * 255) for val in color]) for color in colors]
    
    # Just so that I can add tenants in bulk
    db_tenant_map: dict[str, TenantModel] = {}  # tenant_name -> TenantModel
    
    for i, tenant_name in enumerate(tenant_set):
        db_tenant_map[tenant_name] = TenantModel(
            name=tenant_name,
            color=colors[i],
            created_at=now_dt,
            updated_at=now_dt,
        )
    
    db.add_all(db_tenant_map.values())
    db.flush()
    
    # Converting list of OccupancyModel and tenant_name tuples to list of OccupancyModels
    for db_occupancy, tenant_name in db_occupancy_rows:
        db_occupancy.tenant_id = db_tenant_map[tenant_name].id
    db_occupancy_rows: list[OccupancyModel] = [db_occupancy for db_occupancy, _ in db_occupancy_rows]
    
    db.add_all(db_occupancy_rows)
    db.flush()
    
    db.commit()

def stackplan_loader(filepath, floors, building_id: UUID):
    """(Deprecated) Processes a 3D model file and saves extracted floor coordinates as JSON.

    Args:
        filepath: Path to the 3D model file.
        floors: Number of floors the building has.
        building_id: UUID of the building for organized storage.
    """
    stackingplan = FloorGenerator(filepath, floors)
    stackingplan.generateFloors()
    data = json.dumps(stackingplan.getCoords())
    save_processed_json(building_id, data)
