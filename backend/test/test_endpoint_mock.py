"""Endpoint tests using mocked DB — no live database or AWS needed."""
import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from datetime import datetime
from fastapi.testclient import TestClient

from main import app
from auth import CognitoUser, get_current_user
from database import get_db
from db_models import BuildingModel, FloorModel, TenantModel, OccupancyModel


def _mock_user():
    return CognitoUser(
        id=str(uuid4()),
        sub="test-sub-123",
        email="test@test.com",
        name="Test User",
    )


def _mock_building(name="Test Building", city="Austin"):
    b = MagicMock(spec=BuildingModel)
    b.id = str(uuid4())
    b.name = name
    b.address_street = "123 Main St"
    b.address_city = city
    b.address_state = "TX"
    b.address_zip = "78701"
    b.address_country = "US"
    b.latitude = 30.2672
    b.longitude = -97.7431
    b.total_floors = 10
    b.height_meters = 50.0
    b.floor_height_meters = None
    b.gross_square_feet = None
    b.year_built = None
    b.created_at = datetime.utcnow()
    b.updated_at = datetime.utcnow()
    return b


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = _mock_user
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client_with_db(client):
    """Client fixture that also injects a mock DB session."""
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    yield client, db
    app.dependency_overrides.clear()


class TestBuildingEndpoints:
    def test_duplicate_building_returns_409(self, client_with_db):
        import json
        client, db = client_with_db
        # DB returns an existing building with the same name+city
        db.query.return_value.filter.return_value.first.return_value = _mock_building()

        # create_building takes form data with a JSON string field
        building_json = json.dumps({
            "name": "Test Building",
            "address": {"street": "123 Main", "city": "Austin", "state": "TX", "zip": "78701", "country": "US"},
            "location": {"latitude": 30.26, "longitude": -97.74},
            "metadata": {"totalFloors": 10, "heightMeters": 50.0},
        })
        response = client.post("/api/buildings", data={"building": building_json})
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    def test_get_building_not_found_returns_404(self, client_with_db):
        client, db = client_with_db
        db.query.return_value.filter.return_value.first.return_value = None

        response = client.get(f"/api/buildings/{uuid4()}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Building not found"

    def test_delete_building_not_found_returns_404(self, client_with_db):
        client, db = client_with_db
        db.query.return_value.filter.return_value.first.return_value = None

        response = client.delete(f"/api/buildings/{uuid4()}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Building not found"

    def test_metadata_rejects_non_xlsx(self, client):
        response = client.post(
            "/api/buildings/metadata",
            files={"file": ("data.csv", b"col1,col2\n1,2", "text/csv")},
        )
        assert response.status_code == 400
        assert "Only Excel" in response.json()["detail"]

    def test_metadata_rejects_pdf(self, client):
        response = client.post(
            "/api/buildings/metadata",
            files={"file": ("report.pdf", b"%PDF-1.4", "application/pdf")},
        )
        assert response.status_code == 400
        assert "Only Excel" in response.json()["detail"]


class TestFloorEndpoints:
    def test_update_floor_not_found_returns_404(self, client_with_db):
        client, db = client_with_db
        db.query.return_value.filter.return_value.first.return_value = None

        response = client.put(
            f"/api/buildings/{uuid4()}/floors/99",
            json={"label": "Penthouse"},
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Floor not found"


class TestOccupancyEndpoints:
    def _setup_floor_and_tenant(self, db, floor_id=None, has_existing_occupancy=False):
        floor = MagicMock(spec=FloorModel)
        floor.id = str(floor_id or uuid4())
        tenant = MagicMock(spec=TenantModel)

        def query_side_effect(model):
            m = MagicMock()
            if model == FloorModel:
                m.filter.return_value.first.return_value = floor
            elif model == TenantModel:
                m.filter.return_value.first.return_value = tenant
            elif model == OccupancyModel:
                existing = MagicMock() if has_existing_occupancy else None
                m.filter.return_value.first.return_value = existing
            return m

        db.query.side_effect = query_side_effect
        return floor, tenant

    def test_add_occupancy_lease_end_before_start_returns_400(self, client_with_db):
        client, db = client_with_db
        self._setup_floor_and_tenant(db)

        payload = {
            "tenantId": str(uuid4()),
            "squareFeet": 5000.0,
            "leaseStart": "2025-06-01T00:00:00",
            "leaseEnd": "2025-01-01T00:00:00",  # before start
        }
        response = client.post(
            f"/api/buildings/{uuid4()}/floors/3/occupancies",
            json=payload,
        )
        assert response.status_code == 400
        assert "after lease start" in response.json()["detail"]

    def test_add_occupancy_same_start_end_returns_400(self, client_with_db):
        client, db = client_with_db
        self._setup_floor_and_tenant(db)

        payload = {
            "tenantId": str(uuid4()),
            "squareFeet": 5000.0,
            "leaseStart": "2025-06-01T00:00:00",
            "leaseEnd": "2025-06-01T00:00:00",  # equal to start
        }
        response = client.post(
            f"/api/buildings/{uuid4()}/floors/3/occupancies",
            json=payload,
        )
        assert response.status_code == 400

    def test_add_occupancy_duplicate_tenant_returns_409(self, client_with_db):
        client, db = client_with_db
        self._setup_floor_and_tenant(db, has_existing_occupancy=True)

        payload = {
            "tenantId": str(uuid4()),
            "squareFeet": 3000.0,
        }
        response = client.post(
            f"/api/buildings/{uuid4()}/floors/2/occupancies",
            json=payload,
        )
        assert response.status_code == 409
        assert "already occupies" in response.json()["detail"]

    def test_add_occupancy_floor_not_found_returns_404(self, client_with_db):
        client, db = client_with_db
        db.query.return_value.filter.return_value.first.return_value = None

        payload = {
            "tenantId": str(uuid4()),
            "squareFeet": 3000.0,
        }
        response = client.post(
            f"/api/buildings/{uuid4()}/floors/999/occupancies",
            json=payload,
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Floor not found"
