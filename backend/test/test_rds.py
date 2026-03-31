import pytest
from sqlalchemy import text, select, and_, or_
from collections import Counter

from db_models import *
from test_values import TEST_USER_ID, TEST_BUILDING_ID
from conftest import skip_no_db, DB_AVAILABLE

if DB_AVAILABLE:
    from database import get_db
    gen = get_db()
    db = next(gen)

@skip_no_db
def test_db_connection():
    try:
        res = db.execute(text("SELECT version()"))
        print(res.first())
    except Exception as e:
        print(f"Database error: {e}")
        raise
    finally:
        try:
            next(gen)
        except StopIteration:
            pass

@skip_no_db
@pytest.mark.parametrize("label, model, query_text, query_stmt, isAll", [
    (
        f"Get property listing for user ID {str(TEST_USER_ID)}",
        BuildingModel,
        f"""
        SELECT buildings.*
        FROM buildings
        INNER JOIN property_managers
            ON buildings.id = property_managers.building_id
            WHERE property_managers.user_id = '{str(TEST_USER_ID)}'
        """,
        select(BuildingModel) \
        .join(PropertyManagerModel, BuildingModel.id == PropertyManagerModel.building_id) \
        .where(PropertyManagerModel.user_id == str(TEST_USER_ID)),
        True
    ),
    (
        f"Get processed json for building ID {str(TEST_BUILDING_ID)}",
        FileModel,
        f"""
        SELECT *
        FROM files
        WHERE
            building_id='{str(TEST_BUILDING_ID)}'
            AND file_type='processed_json'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        select(FileModel) \
        .where(
            and_(
                FileModel.building_id == str(TEST_BUILDING_ID),
                FileModel.file_type == "processed_json"
            )
        ) \
        .order_by(FileModel.created_at.desc()),
        False
    ),
    (
        f"Get metadata for building ID {str(TEST_BUILDING_ID)}",
        BuildingModel,
        f"""
        SELECT *
        FROM buildings
        WHERE id='{str(TEST_BUILDING_ID)}'
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        select(BuildingModel) \
        .where(BuildingModel.id == str(TEST_BUILDING_ID)) \
        .order_by(BuildingModel.updated_at.desc()),
        False
    ),
    (
        f"Get floors for building ID {str(TEST_BUILDING_ID)}",
        FloorModel,
        f"""
        SELECT *
        FROM floors
        WHERE building_id='{str(TEST_BUILDING_ID)}'
        ORDER BY floor_number ASC
        """,
        select(FloorModel) \
        .where(FloorModel.building_id == str(TEST_BUILDING_ID)) \
        .order_by(FloorModel.floor_number.asc()),
        True
    ),
    (
        f"Get tenants for building ID {str(TEST_BUILDING_ID)}",
        TenantModel,
        f"""
        SELECT DISTINCT tenants.*
        FROM tenants
        INNER JOIN occupancies
            ON tenants.id = occupancies.tenant_id
        INNER JOIN floors
            ON floors.id = occupancies.floor_id
        WHERE floors.building_id = '{str(TEST_BUILDING_ID)}'
        """,
        select(TenantModel).distinct() \
        .join(OccupancyModel, OccupancyModel.tenant_id == TenantModel.id) \
        .join(FloorModel, FloorModel.id == OccupancyModel.floor_id) \
        .where(FloorModel.building_id == str(TEST_BUILDING_ID)),
        True
    ),
    (
        f"Get occupancies for building ID {str(TEST_BUILDING_ID)}",
        OccupancyModel,
        f"""
        SELECT occupancies.*
        FROM occupancies
        INNER JOIN floors
            ON floors.id = occupancies.floor_id
            WHERE floors.building_id='{str(TEST_BUILDING_ID)}'
        """,
        select(OccupancyModel) \
        .join(FloorModel, FloorModel.id == OccupancyModel.floor_id) \
        .where(FloorModel.building_id == str(TEST_BUILDING_ID)),
        True
    )
])
def test_db_query(label, model, query_text, query_stmt, isAll):
    try:
        cols = list(model.__table__.columns.keys())
        print(f"Test: {label}.")
        print(f"Columns:\n{cols}\n")
        if isAll:
            res_text_rows = db.execute(text(query_text)).all()
            res_stmt_rows = db.execute(query_stmt).scalars().all()
            res_stmt_rows = [tuple(getattr(row, col) for col in cols) for row in res_stmt_rows]
        else:
            res_text_rows = db.execute(text(query_text)).first()
            res_stmt_rows = db.execute(query_stmt).scalars().first()
            res_stmt_rows = [getattr(res_stmt_rows, col) for col in cols]
        print(f"PostgreSQL query:")
        for row in res_text_rows:
            print(f"{row}")
        print(f"\nSQLAlchemy query:")
        for row in res_stmt_rows:
            print(f"{row}")
        assert Counter(res_text_rows) == Counter(res_stmt_rows)
        print("\n✓ SQLAlchemy query matches PostgreSQL query.\n")
    except Exception as e:
        print(f"Database error: {e}\n")
        raise
    finally:
        try:
            next(gen)
        except StopIteration:
            pass