"""Write tests with teardown — create resources via API, assert, delete."""
import json
import pytest
from uuid import UUID
from fastapi.testclient import TestClient

from main import app
from auth import CognitoUser, get_current_user
from test_values import TEST_USER_ID
from conftest import skip_no_db


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
