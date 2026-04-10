import json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from uuid import UUID

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


def test_excel_occupancy_sqft_non_negative():
    result = excel_loader(RENT_ROLL)
    for floor in result["floors"]:
        for occ in floor["occupancies"]:
            sqft = occ.get("squareFeet") or occ.get("square_feet")
            if sqft is not None:
                assert sqft >= 0, f"Negative squareFeet on floor {floor.get('floorNumber')}: {sqft}"


def test_excel_tenant_names_unique():
    result = excel_loader(RENT_ROLL)
    names = [t["name"] for t in result["tenants"]]
    assert len(names) == len(set(names)), f"Duplicate tenant names: {[n for n in names if names.count(n) > 1]}"


def test_excel_lease_dates_ordered():
    """Where both lease dates are present, start must precede end."""
    result = excel_loader(RENT_ROLL)
    for floor in result["floors"]:
        for occ in floor["occupancies"]:
            start = occ.get("leaseStart") or occ.get("lease_start")
            end = occ.get("leaseEnd") or occ.get("lease_end")
            if start and end:
                assert start < end, f"Lease start {start} >= end {end} on floor {floor.get('floorNumber')}"


def test_excel_every_occupancy_has_tenant_id():
    result = excel_loader(RENT_ROLL)
    for floor in result["floors"]:
        for occ in floor["occupancies"]:
            tid = occ.get("tenantId") or occ.get("tenant_id")
            assert tid, f"Occupancy on floor {floor.get('floorNumber')} missing tenantId"


def test_excel_all_tenant_ids_referenced():
    """Every tenantId in occupancies must appear in the top-level tenants list."""
    result = excel_loader(RENT_ROLL)
    tenant_ids = {t["id"] for t in result["tenants"]}
    for floor in result["floors"]:
        for occ in floor["occupancies"]:
            tid = occ.get("tenantId") or occ.get("tenant_id")
            assert str(tid) in tenant_ids or tid in tenant_ids, \
                f"tenantId {tid} on floor {floor.get('floorNumber')} not in tenants list"


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


def _cleanup_building_and_tenants(client, building_id: UUID, tenant_ids: set):
    """Delete building (cascade) then orphaned tenants."""
    client.delete(f"/api/buildings/{building_id}")
    if not tenant_ids:
        return
    gen = get_db()
    db = next(gen)
    try:
        for tid in tenant_ids:
            t = db.query(TenantModel).filter(TenantModel.id == tid).first()
            if t:
                db.delete(t)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        try:
            next(gen)
        except StopIteration:
            pass


@skip_no_db
def test_excel_upload_endpoint(client):
    """POST /api/buildings/{id}/upload/excel — verifies file upload, DB population, and response shape."""
    building_json = json.dumps({
        "name": "__stackbox_excel_endpoint_test__",
        "address": {
            "street": "2 Upload St",
            "city": "UploadCity",
            "state": "TX",
            "zip": "77002",
            "country": "US",
        },
        "location": {"latitude": 29.76, "longitude": -95.37},
        "metadata": {"totalFloors": 10, "heightMeters": 40.0},
    })
    create_resp = client.post("/api/buildings", data={"building": building_json})
    assert create_resp.status_code == 201, f"Could not create temp building: {create_resp.json()}"
    building_id = UUID(create_resp.json()["data"]["id"])

    tenant_ids: set = set()
    try:
        with open(RENT_ROLL, "rb") as f:
            upload_resp = client.post(
                f"/api/buildings/{building_id}/upload/excel",
                files={"file": ("Rent Roll Example.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )

        assert upload_resp.status_code == 200
        body = upload_resp.json()
        assert "data" in body
        data = body["data"]
        assert "jobId" in data
        assert "status" in data
        assert "message" in data

        # Verify DB was populated
        gen = get_db()
        db = next(gen)
        try:
            floors = db.query(FloorModel).filter(FloorModel.building_id == building_id).all()
            assert len(floors) > 0, "upload/excel created no floors in DB"

            occupancies = (
                db.query(OccupancyModel)
                .join(FloorModel, FloorModel.id == OccupancyModel.floor_id)
                .filter(FloorModel.building_id == building_id)
                .all()
            )
            assert len(occupancies) > 0, "upload/excel created no occupancies in DB"

            for occ in occupancies:
                tenant_ids.add(occ.tenant_id)
        finally:
            try:
                next(gen)
            except StopIteration:
                pass
    finally:
        _cleanup_building_and_tenants(client, building_id, tenant_ids)


@skip_no_db
def test_excel_upload_rejects_non_xlsx(client):
    """POST /api/buildings/{id}/upload/excel returns 400 for non-.xlsx files."""
    building_json = json.dumps({
        "name": "__stackbox_excel_reject_test__",
        "address": {"street": "3 Reject Ave", "city": "RejectCity", "state": "TX", "zip": "00003", "country": "US"},
        "location": {"latitude": 30.0, "longitude": -97.0},
        "metadata": {"totalFloors": 1, "heightMeters": 4.0},
    })
    create_resp = client.post("/api/buildings", data={"building": building_json})
    assert create_resp.status_code == 201
    building_id = create_resp.json()["data"]["id"]

    try:
        resp = client.post(
            f"/api/buildings/{building_id}/upload/excel",
            files={"file": ("data.csv", b"col1,col2\n1,2", "text/csv")},
        )
        assert resp.status_code == 400
        assert "Only Excel" in resp.json()["detail"] or "xlsx" in resp.json()["detail"].lower()
    finally:
        client.delete(f"/api/buildings/{building_id}")
