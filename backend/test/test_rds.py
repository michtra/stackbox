import pytest
from sqlalchemy import text

# try if our get_db function works
try:
    from database import get_db
    DB_AVAILABLE = True
except Exception:
    DB_AVAILABLE = False

skip_no_db = pytest.mark.skipif(not DB_AVAILABLE, reason="Cannot get AWS RDS DB")

@skip_no_db
def test_db_connection():
    gen = get_db()
    db = next(gen)
    try:
        res = db.execute(text("SELECT version()"))
        print(res.fetchone())
    except Exception as e:
        print(f"Database error: {e}")
        raise
    finally:
        try:
            next(gen)
        except StopIteration:
            pass