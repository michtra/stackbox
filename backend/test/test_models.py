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
