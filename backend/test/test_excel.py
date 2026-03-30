import json
import pytest
from pathlib import Path

from utilities.file_loader import excel_loader, excel_load_to_db
from test_values import TEST_BUILDING_ID
from conftest import skip_no_db

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


@skip_no_db
def test_excel_load_to_db():
    excel_load_to_db(RENT_ROLL, building_id=TEST_BUILDING_ID)
