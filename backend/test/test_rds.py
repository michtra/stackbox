import pytest
from sqlalchemy import text, select, inspect

from db_models import PropertyManagerModel, BuildingModel

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
@pytest.mark.parametrize("user_id", [
    ("2de1ab28-d689-4009-a5b9-4ff74b5d834c")
])
def test_db_get_property_listing(user_id):
    query_text = f"""
    SELECT buildings.*
    FROM buildings
    INNER JOIN property_managers ON buildings.id = property_managers.building_id
    WHERE property_managers.user_id = '{user_id}'
    """
    query_stmt = select(BuildingModel).join(PropertyManagerModel, BuildingModel.id == PropertyManagerModel.building_id).where(PropertyManagerModel.user_id == user_id)
    try:
        res_text_rows = db.execute(text(query_text)).all()
        res_stmt_rows = db.execute(query_stmt).scalars().all()
        cols = list(BuildingModel.__table__.columns.keys())
        res_stmt_rows = [tuple(getattr(row, col) for col in cols) for row in res_stmt_rows]
        print(f"PostgreSQL query:\n{res_text_rows}\n")
        print(f"SQLAlchemy query:\n{res_stmt_rows}")
        assert set(res_text_rows) == set(res_stmt_rows)
        print("✓ SQLAlchemy query matches PostgreSQL query.")
    except Exception as e:
        print(f"Database error: {e}")
        raise
    finally:
        try:
            next(gen)
        except StopIteration:
            pass