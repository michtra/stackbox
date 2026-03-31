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
    data = response.json()
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
