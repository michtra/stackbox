"""Write tests with teardown — create resources via API, assert, delete."""
import json
import pytest
from uuid import UUID
from fastapi.testclient import TestClient

from main import app
from auth import CognitoUser, get_current_user
from db_models import FloorModel
from test_values import TEST_USER_ID
from conftest import skip_no_db, DB_AVAILABLE

if DB_AVAILABLE:
    from database import get_db


def _test_user():
    return CognitoUser(
        id=TEST_USER_ID,
        sub="test-sub-write",
        email="write@test.com",
        name="Write Test User",
    )


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = _test_user
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def created_building(client):
    """Creates a building, yields its UUID string, deletes in finally."""
    building_json = json.dumps({
        "name": "__stackbox_test_write__",
        "address": {
            "street": "1 Test Plaza",
            "city": "TestCity",
            "state": "TX",
            "zip": "00001",
            "country": "US",
        },
        "location": {"latitude": 30.0, "longitude": -97.0},
        "metadata": {"totalFloors": 3, "heightMeters": 12.0},
    })
    resp = client.post("/api/buildings", data={"building": building_json})
    assert resp.status_code == 201, f"Failed to create building: {resp.json()}"
    building_id = resp.json()["data"]["id"]
    try:
        yield building_id
    finally:
        client.delete(f"/api/buildings/{building_id}")


@pytest.fixture
def created_tenant(client):
    """Creates a tenant, yields its UUID string, deletes in finally."""
    resp = client.post(
        "/api/tenants",
        json={
            "name": "__stackbox_test_tenant__",
            "contact": {"email": "tenant@test.com", "phone": "555-0001"},
            "color": "#ABCDEF",
        },
    )
    assert resp.status_code == 201, f"Failed to create tenant: {resp.json()}"
    tenant_id = resp.json()["data"]["id"]
    try:
        yield tenant_id
    finally:
        client.delete(f"/api/tenants/{tenant_id}")


# --- Building write tests ---

@skip_no_db
def test_create_building_roundtrip(client, created_building):
    resp = client.get(f"/api/buildings/{created_building}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "__stackbox_test_write__"
    assert data["address"]["city"] == "TestCity"


@skip_no_db
def test_create_building_duplicate_returns_409(client, created_building):
    building_json = json.dumps({
        "name": "__stackbox_test_write__",
        "address": {
            "street": "2 Other St",
            "city": "TestCity",
            "state": "TX",
            "zip": "00001",
            "country": "US",
        },
        "location": {"latitude": 30.1, "longitude": -97.1},
        "metadata": {"totalFloors": 5, "heightMeters": 20.0},
    })
    resp = client.post("/api/buildings", data={"building": building_json})
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


@skip_no_db
def test_update_building(client, created_building):
    resp = client.put(
        f"/api/buildings/{created_building}",
        json={"name": "__stackbox_test_write_updated__"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["name"] == "__stackbox_test_write_updated__"


@skip_no_db
def test_delete_building_removes_it(client):
    building_json = json.dumps({
        "name": "__stackbox_test_delete__",
        "address": {
            "street": "9 Delete Ave",
            "city": "DeleteCity",
            "state": "TX",
            "zip": "99999",
            "country": "US",
        },
        "location": {"latitude": 29.0, "longitude": -96.0},
        "metadata": {"totalFloors": 1, "heightMeters": 4.0},
    })
    create_resp = client.post("/api/buildings", data={"building": building_json})
    assert create_resp.status_code == 201
    bid = create_resp.json()["data"]["id"]

    del_resp = client.delete(f"/api/buildings/{bid}")
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/buildings/{bid}")
    assert get_resp.status_code == 404


# --- Tenant write tests ---

@skip_no_db
def test_create_tenant_roundtrip(client, created_tenant):
    resp = client.get(f"/api/tenants/{created_tenant}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "__stackbox_test_tenant__"
    assert data["color"] == "#ABCDEF"


@skip_no_db
def test_update_tenant(client, created_tenant):
    resp = client.put(
        f"/api/tenants/{created_tenant}",
        json={"name": "__stackbox_test_tenant_updated__", "contact": {"email": "new@test.com"}},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "__stackbox_test_tenant_updated__"


@skip_no_db
def test_delete_tenant_removes_it(client):
    create_resp = client.post(
        "/api/tenants",
        json={
            "name": "__stackbox_test_tenant_delete__",
            "contact": {"email": "del@test.com", "phone": "555-0002"},
        },
    )
    assert create_resp.status_code == 201
    tid = create_resp.json()["data"]["id"]

    del_resp = client.delete(f"/api/tenants/{tid}")
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/tenants/{tid}")
    assert get_resp.status_code == 404


# --- Occupancy write tests ---

@pytest.fixture
def building_with_floor(client):
    """Creates a building and inserts a floor directly via DB. Yields (building_id, floor_number)."""
    building_json = json.dumps({
        "name": "__stackbox_test_occ_building__",
        "address": {
            "street": "5 Occupancy Lane",
            "city": "OccCity",
            "state": "TX",
            "zip": "00002",
            "country": "US",
        },
        "location": {"latitude": 31.0, "longitude": -98.0},
        "metadata": {"totalFloors": 1, "heightMeters": 4.0},
    })
    create_resp = client.post("/api/buildings", data={"building": building_json})
    assert create_resp.status_code == 201, f"Failed to create building: {create_resp.json()}"
    building_id = UUID(create_resp.json()["data"]["id"])

    gen = get_db()
    db = next(gen)
    try:
        db.add(FloorModel(building_id=building_id, floor_number=1, label="Floor 1", square_feet=5000.0))
        db.commit()
    finally:
        try:
            next(gen)
        except StopIteration:
            pass

    try:
        yield building_id, 1
    finally:
        client.delete(f"/api/buildings/{building_id}")


@skip_no_db
def test_add_occupancy_roundtrip(client, building_with_floor, created_tenant):
    building_id, floor_number = building_with_floor
    tenant_id = created_tenant

    add_resp = client.post(
        f"/api/buildings/{building_id}/floors/{floor_number}/occupancies",
        json={"tenantId": tenant_id, "squareFeet": 2000.0},
    )
    assert add_resp.status_code == 201
    floor_data = add_resp.json()["data"]
    assert "occupancies" in floor_data
    assert any(occ["tenantId"] == tenant_id for occ in floor_data["occupancies"])


@skip_no_db
def test_remove_occupancy(client, building_with_floor, created_tenant):
    building_id, floor_number = building_with_floor
    tenant_id = created_tenant

    # Add first
    add_resp = client.post(
        f"/api/buildings/{building_id}/floors/{floor_number}/occupancies",
        json={"tenantId": tenant_id, "squareFeet": 1500.0},
    )
    assert add_resp.status_code == 201

    # Remove
    del_resp = client.delete(
        f"/api/buildings/{building_id}/floors/{floor_number}/occupancies/{tenant_id}"
    )
    assert del_resp.status_code == 204

    # Verify gone
    floors_resp = client.get(f"/api/buildings/{building_id}/floors")
    assert floors_resp.status_code == 200
    floor = next(f for f in floors_resp.json()["data"] if f["floorNumber"] == floor_number)
    assert not any(occ["tenantId"] == tenant_id for occ in floor["occupancies"])


@skip_no_db
def test_remove_occupancy_not_found_returns_404(client, building_with_floor, created_tenant):
    building_id, floor_number = building_with_floor
    tenant_id = created_tenant
    # Tenant not on floor — no occupancy was added
    resp = client.delete(
        f"/api/buildings/{building_id}/floors/{floor_number}/occupancies/{tenant_id}"
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Occupancy record not found"


# --- Query param filter tests ---

@skip_no_db
def test_tenant_search_filter(client, created_tenant):
    resp = client.get("/api/tenants", params={"search": "__stackbox_test_tenant__"})
    assert resp.status_code == 200
    results = resp.json()["data"]
    assert len(results) >= 1
    assert all("__stackbox_test_tenant__" in t["name"] for t in results)


@skip_no_db
def test_building_city_filter(client, created_building):
    resp = client.get("/api/buildings", params={"city": "TestCity"})
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    assert "pagination" in body
    buildings = body["data"]
    assert len(buildings) >= 1
    assert all(b["address"]["city"] == "TestCity" for b in buildings)
