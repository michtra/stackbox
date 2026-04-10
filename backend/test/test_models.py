"""Tests for Pydantic model validation — no DB, no AWS needed."""
import pytest
from pydantic import ValidationError

from models import (
    HexColor,
    Contact,
    TenantCreate,
    TenantUpdate,
    Address,
    BuildingCreate,
    BuildingMetadata,
    Location,
    OccupancyCreate,
    OccupancyUpdate,
    FloorUpdate,
)


class TestHexColor:
    def test_valid_uppercase(self):
        t = TenantCreate(name="Acme", contact=Contact(), color="#FF00FF")
        assert t.color == "#FF00FF"

    def test_valid_lowercase(self):
        t = TenantCreate(name="Acme", contact=Contact(), color="#aabbcc")
        assert t.color == "#aabbcc"

    def test_valid_mixed_case(self):
        t = TenantCreate(name="Acme", contact=Contact(), color="#Ab12Cd")
        assert t.color == "#Ab12Cd"

    def test_valid_black_and_white(self):
        for color in ["#000000", "#FFFFFF"]:
            t = TenantCreate(name="Acme", contact=Contact(), color=color)
            assert t.color == color

    def test_invalid_no_hash(self):
        with pytest.raises(ValidationError):
            TenantCreate(name="Acme", contact=Contact(), color="FF00FF")

    def test_invalid_short(self):
        with pytest.raises(ValidationError):
            TenantCreate(name="Acme", contact=Contact(), color="#FFF")

    def test_invalid_long(self):
        with pytest.raises(ValidationError):
            TenantCreate(name="Acme", contact=Contact(), color="#FF00FF00")

    def test_invalid_non_hex_chars(self):
        with pytest.raises(ValidationError):
            TenantCreate(name="Acme", contact=Contact(), color="#GGGGGG")

    def test_invalid_color_name(self):
        with pytest.raises(ValidationError):
            TenantCreate(name="Acme", contact=Contact(), color="white")

    def test_none_is_allowed(self):
        t = TenantCreate(name="Acme", contact=Contact(), color=None)
        assert t.color is None


class TestContactEmail:
    def test_valid_email(self):
        c = Contact(email="user@example.com")
        assert c.email is not None

    def test_valid_subdomain_email(self):
        c = Contact(email="user@mail.example.co.uk")
        assert c.email is not None

    def test_invalid_email_no_at(self):
        with pytest.raises(ValidationError):
            Contact(email="notanemail")

    def test_invalid_email_no_domain(self):
        with pytest.raises(ValidationError):
            Contact(email="user@")

    def test_email_optional(self):
        c = Contact()
        assert c.email is None

    def test_phone_only(self):
        c = Contact(phone="555-1234")
        assert c.phone == "555-1234"
        assert c.email is None


class TestOccupancyCreate:
    def test_valid_with_dates(self):
        from datetime import datetime
        occ = OccupancyCreate(
            tenantId="00000000-0000-0000-0000-000000000001",
            squareFeet=5000.0,
            leaseStart=datetime(2024, 1, 1),
            leaseEnd=datetime(2025, 1, 1),
        )
        assert occ.squareFeet == 5000.0

    def test_valid_without_dates(self):
        occ = OccupancyCreate(
            tenantId="00000000-0000-0000-0000-000000000001",
            squareFeet=2500.0,
        )
        assert occ.leaseStart is None
        assert occ.leaseEnd is None

    def test_missing_tenant_id_raises(self):
        with pytest.raises(ValidationError):
            OccupancyCreate(squareFeet=1000.0)


class TestOccupancyUpdate:
    def test_all_none_is_valid(self):
        upd = OccupancyUpdate()
        assert upd.squareFeet is None
        assert upd.leaseStart is None
        assert upd.leaseEnd is None

    def test_partial_sqft_only(self):
        upd = OccupancyUpdate(squareFeet=3000.0)
        assert upd.squareFeet == 3000.0
        assert upd.leaseStart is None

    def test_partial_dates_only(self):
        from datetime import datetime
        upd = OccupancyUpdate(
            leaseStart=datetime(2024, 1, 1),
            leaseEnd=datetime(2025, 1, 1),
        )
        assert upd.squareFeet is None
        assert upd.leaseStart is not None


class TestBuildingMetadata:
    def test_valid_minimal(self):
        m = BuildingMetadata(totalFloors=10, heightMeters=50.0)
        assert m.totalFloors == 10
        assert m.heightMeters == 50.0

    def test_optional_fields_default_none(self):
        m = BuildingMetadata(totalFloors=5, heightMeters=20.0)
        assert m.floorHeightMeters is None
        assert m.grossSquareFeet is None
        assert m.yearBuilt is None

    def test_with_all_optional_fields(self):
        m = BuildingMetadata(
            totalFloors=10,
            heightMeters=50.0,
            floorHeightMeters=5.0,
            grossSquareFeet=50000.0,
            yearBuilt=2005,
        )
        assert m.yearBuilt == 2005
        assert m.grossSquareFeet == 50000.0

    def test_missing_required_field_raises(self):
        with pytest.raises(ValidationError):
            BuildingMetadata(totalFloors=5)


class TestBuildingCreate:
    def _valid_address(self):
        return Address(street="1 Main St", city="Austin", state="TX", zip="78701", country="US")

    def _valid_location(self):
        return Location(latitude=30.0, longitude=-97.0)

    def _valid_metadata(self):
        return BuildingMetadata(totalFloors=5, heightMeters=20.0)

    def test_valid_building_create(self):
        b = BuildingCreate(
            name="Test Tower",
            address=self._valid_address(),
            location=self._valid_location(),
            metadata=self._valid_metadata(),
        )
        assert b.name == "Test Tower"

    def test_missing_name_raises(self):
        with pytest.raises(ValidationError):
            BuildingCreate(
                address=self._valid_address(),
                location=self._valid_location(),
                metadata=self._valid_metadata(),
            )

    def test_missing_address_raises(self):
        with pytest.raises(ValidationError):
            BuildingCreate(
                name="Test Tower",
                location=self._valid_location(),
                metadata=self._valid_metadata(),
            )

    def test_missing_location_raises(self):
        with pytest.raises(ValidationError):
            BuildingCreate(
                name="Test Tower",
                address=self._valid_address(),
                metadata=self._valid_metadata(),
            )

    def test_missing_metadata_raises(self):
        with pytest.raises(ValidationError):
            BuildingCreate(
                name="Test Tower",
                address=self._valid_address(),
                location=self._valid_location(),
            )


class TestFloorUpdate:
    def test_all_none_is_valid(self):
        upd = FloorUpdate()
        assert upd.label is None
        assert upd.squareFeet is None

    def test_label_only(self):
        upd = FloorUpdate(label="Penthouse")
        assert upd.label == "Penthouse"
        assert upd.squareFeet is None
