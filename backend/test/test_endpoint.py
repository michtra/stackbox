import pytest
from fastapi.testclient import TestClient
from pathlib import Path
import json

from main import app
from models import *
from auth import CognitoUser, get_current_user
from test_values import TEST_BUILDING_ID
from conftest import skip_no_db


@pytest.fixture(scope="module")
def client():
    def override_get_current_user():
        return CognitoUser(
            id="2de1ab28-d689-4009-a5b9-4ff74b5d834c",
            sub="94c8d468-e041-70c2-4c12-fa3e7b8595f5",
            email="test@test.com",
            name="Johnny Appleseed",
        )

    app.dependency_overrides[get_current_user] = override_get_current_user
    client = TestClient(app)
    yield client
    del app.dependency_overrides[get_current_user]


@skip_no_db
def test_stacking_plan(client):
    response = client.get(f"/api/buildings/{TEST_BUILDING_ID}/stacking-plan")
    Path("test/output").mkdir(exist_ok=True)
    Path("test/output/test_stacking_plan_out.json").write_text(
        json.dumps(response.json(), indent=4)
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "building" in data
    assert "floors" in data
    assert "tenants" in data


@skip_no_db
@pytest.mark.parametrize("page, limit", [
    (1, 20),
    (1, 2),
    (2, 2),
])
def test_building_listing(client, page, limit):
    response = client.get("/api/buildings", params={"page": page, "limit": limit})
    Path("test/output").mkdir(exist_ok=True)
    Path("test/output/test_building_listing.json").write_text(
        json.dumps(response.json(), indent=4)
    )
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "pagination" in data
    assert len(data["data"]) <= limit


@skip_no_db
def test_list_tenants(client):
    response = client.get("/api/tenants")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert isinstance(body["data"], list)


@skip_no_db
def test_list_floors(client):
    response = client.get(f"/api/buildings/{TEST_BUILDING_ID}/floors")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    floors = body["data"]
    assert isinstance(floors, list)
    assert len(floors) > 0
    for floor in floors:
        assert "floorNumber" in floor
        assert "occupancies" in floor


@skip_no_db
def test_get_tenant_occupancies(client):
    # Grab the first tenant from the global list and check its occupancies endpoint.
    tenants_resp = client.get("/api/tenants")
    assert tenants_resp.status_code == 200
    tenants = tenants_resp.json()["data"]
    assert len(tenants) > 0, "No tenants in DB — cannot test occupancies endpoint"

    tenant_id = tenants[0]["id"]
    response = client.get(f"/api/tenants/{tenant_id}/occupancies")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert isinstance(body["data"], list)
    # Validate schema of each item if any are returned.
    for item in body["data"]:
        assert "buildingId" in item
        assert "buildingName" in item
        assert "floorNumber" in item
        assert "squareFeet" in item
