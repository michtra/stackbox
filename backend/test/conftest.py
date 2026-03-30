import sys
import os
import pytest

# Make src/ importable from tests
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

# Probe DB reachability at collection time (5s timeout) so DB-dependent
# tests skip instead of hanging when RDS isn't accessible.
DB_AVAILABLE = False
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

    from sqlalchemy import create_engine, text
    _url = os.getenv("DATABASE_URL")
    if _url:
        _engine = create_engine(
            _url,
            connect_args={"connect_timeout": 5, "sslmode": "require"},
        )
        with _engine.connect() as _conn:
            _conn.execute(text("SELECT 1"))
        DB_AVAILABLE = True
except Exception:
    DB_AVAILABLE = False

skip_no_db = pytest.mark.skipif(not DB_AVAILABLE, reason="Cannot reach AWS RDS DB")
