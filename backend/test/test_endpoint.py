import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from main import app
from pathlib import Path
import json

from models import *
from auth import CognitoUser, get_current_user
from test_values import TEST_BUILDING_ID

@pytest.fixture(scope="module")
def client():
    # Overriding authentication for testing purposes, please delete this in prod
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

def test_stacking_plan(client):
    response = client.get(
        f"/api/buildings/{TEST_BUILDING_ID}/stacking-plan",
        headers={
            "Authorization": ""
        }
    )
    data = json.dumps(response.json(), indent=4)
    Path("test/output").mkdir(exist_ok=True)
    Path(f'test/output/test_stacking_plan_out.json').write_text(data)
    assert response.status_code == 200