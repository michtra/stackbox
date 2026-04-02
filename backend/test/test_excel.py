import json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from main import app
from auth import CognitoUser, get_current_user
from utilities.file_loader import excel_loader, excel_load_to_db
from db_models import FloorModel, OccupancyModel, TenantModel
from test_values import TEST_USER_ID
from conftest import skip_no_db, DB_AVAILABLE

if DB_AVAILABLE:
    from database import get_db

RENT_ROLL = "test/input/Rent Roll Example.xlsx"


def test_excel_json_structure():
    result = excel_loader(RENT_ROLL)
    assert isinstance(result, dict), "excel_loader should return a dict"
    assert "floors" in result, "result should have floors"
    assert "tenants" in result, "result should have tenants"
    assert len(result["floors"]) > 0, "should parse at least one floor"
    assert len(result["tenants"]) > 0, "should parse at least one tenant"


def test_excel_tenant_fields():
    result = excel_loader(RENT_ROLL)
    for tenant in result["tenants"]:
        assert "id" in tenant
        assert "name" in tenant


def test_excel_floor_occupancies():
    result = excel_loader(RENT_ROLL)
    for floor in result["floors"]:
        assert "floorNumber" in floor or "floor_number" in floor
        assert "occupancies" in floor
        for occ in floor["occupancies"]:
            assert "tenantId" in occ or "tenant_id" in occ
            assert "squareFeet" in occ or "square_feet" in occ


def test_excel_json_output():
    result = excel_loader(RENT_ROLL)
    Path("test/output").mkdir(exist_ok=True)
    Path("test/output/test_excel_out.json").write_text(json.dumps(result, indent=2))


def _test_user():
    return CognitoUser(
        id=TEST_USER_ID,
        sub="test-sub-excel",
        email="excel@test.com",
        name="Excel Test User",
    )


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = _test_user
    yield TestClient(app)
    app.dependency_overrides.clear()


@skip_no_db
def test_excel_load_to_db(client):
    """Loads rent roll into a temp building, verifies data landed, then cleans up."""
    building_json = json.dumps({
        "name": "__stackbox_excel_load_test__",
        "address": {
            "street": "1 Excel Blvd",
            "city": "LoadCity",
            "state": "TX",
            "zip": "77001",
            "country": "US",
        },
        "location": {"latitude": 29.76, "longitude": -95.37},
        "metadata": {"totalFloors": 10, "heightMeters": 40.0},
    })
    create_resp = client.post("/api/buildings", data={"building": building_json})
    assert create_resp.status_code == 201, f"Could not create temp building: {create_resp.json()}"
    from uuid import UUID
    building_id = UUID(create_resp.json()["data"]["id"])

    tenant_ids: set = set()
    try:
        excel_load_to_db(RENT_ROLL, building_id=building_id)

        # Fresh session — sees the committed data from excel_load_to_db
        gen = get_db()
        db = next(gen)
        try:
            floors = db.query(FloorModel).filter(FloorModel.building_id == building_id).all()

            occupancies = (
                db.query(OccupancyModel)
                .join(FloorModel, FloorModel.id == OccupancyModel.floor_id)
                .filter(FloorModel.building_id == building_id)
                .all()
            )

            # Collect tenant IDs before any assertion so cleanup runs even if assertions fail
            for occ in occupancies:
                tenant_ids.add(occ.tenant_id)

            tenants = db.query(TenantModel).filter(TenantModel.id.in_(tenant_ids)).all()

            assert len(floors) > 0, "excel_load_to_db created no floors"
            assert len(occupancies) > 0, "excel_load_to_db created no occupancies"
            assert len(tenants) == len(tenant_ids), "Some tenants from occupancies are missing"
        finally:
            try:
                next(gen)
            except StopIteration:
                pass
    finally:
        # Delete building — cascades floors and occupancies
        del_resp = client.delete(f"/api/buildings/{building_id}")
        assert del_resp.status_code == 204, f"Failed to delete temp building: {del_resp.status_code}"

        # Clean up orphaned tenants created by the load
        if tenant_ids:
            gen2 = get_db()
            db2 = next(gen2)
            try:
                for tid in tenant_ids:
                    t = db2.query(TenantModel).filter(TenantModel.id == tid).first()
                    if t:
                        db2.delete(t)
                db2.commit()
            except Exception:
                db2.rollback()
            finally:
                try:
                    next(gen2)
                except StopIteration:
                    pass
