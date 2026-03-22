import pytest
from sqlalchemy import text, select, inspect, and_, or_

from db_models import *

# try if our get_db function works
try:
    from database import get_db
    gen = get_db()
    db = next(gen)
    DB_AVAILABLE = True
except Exception:
    DB_AVAILABLE = False

skip_no_db = pytest.mark.skipif(not DB_AVAILABLE, reason="Cannot get AWS RDS DB")

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
@pytest.mark.parametrize("model, query_text, query_stmt, isAll", [
    (
        BuildingModel,
        """
        SELECT buildings.*
        FROM buildings
        INNER JOIN property_managers ON buildings.id = property_managers.building_id
        WHERE property_managers.user_id = '2de1ab28-d689-4009-a5b9-4ff74b5d834c'
        """,
        select(BuildingModel) \
        .join(PropertyManagerModel, BuildingModel.id == PropertyManagerModel.building_id) \
        .where(PropertyManagerModel.user_id == "2de1ab28-d689-4009-a5b9-4ff74b5d834c"),
        True
    ),
    (
        FileModel,
        """
        SELECT *
        FROM files
        WHERE
            building_id='bd1971c3-2216-49ee-a235-720b4df08bf0'
            AND file_type='processed_json'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        select(FileModel) \
        .where(
            and_(
                FileModel.building_id == "bd1971c3-2216-49ee-a235-720b4df08bf0",
                FileModel.file_type == "processed_json"
            )
        ) \
        .order_by(FileModel.created_at.desc()),
        False
    )
])
def test_db_query(model, query_text, query_stmt, isAll):
    try:
        cols = list(model.__table__.columns.keys())
        print(f"Columns:\n{cols}\n")
        if all:
            res_text_rows = db.execute(text(query_text)).all()
            res_stmt_rows = db.execute(query_stmt).scalars().all()
            res_stmt_rows = [tuple(getattr(row, col) for col in cols) for row in res_stmt_rows]
        else:
            res_text_rows = db.execute(text(query_text)).first()
            res_stmt_rows = db.execute(query_stmt).scalars().first()
            res_stmt_rows = [getattr(res_stmt_rows, col) for col in cols]
        print(f"PostgreSQL query:\n{res_text_rows}\n")
        print(f"SQLAlchemy query:\n{res_stmt_rows}\n")
        assert set(res_text_rows) == set(res_stmt_rows)
        print("✓ SQLAlchemy query matches PostgreSQL query.\n")
    except Exception as e:
        print(f"Database error: {e}\n")
        raise
    finally:
        try:
            next(gen)
        except StopIteration:
            pass