from urllib.parse import urlparse
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Use SSL for non-local connections (e.g. AWS RDS)
_host = urlparse(DATABASE_URL).hostname or ""
_is_local = _host in ("localhost", "127.0.0.1")
# sslmode=require encrypts the connection but does not verify the server certificate.
# For a private VPC this is an acceptable tradeoff; for public endpoints consider
# sslmode=verify-full with the RDS CA bundle (sslrootcert=/path/to/rds-ca.pem).
_connect_args = {} if _is_local else {"sslmode": "require"}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,   # drop stale connections (important for RDS idle timeouts)
    pool_size=5,
    max_overflow=10,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
