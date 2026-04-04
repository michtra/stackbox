from sqlalchemy import create_engine
import os
from dotenv import load_dotenv

from database import Base
from db_models import *

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
TEST_MODE = os.getenv("TEST_MODE", "false").lower() == "true"

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

engine = create_engine(
    DATABASE_URL,
    connect_args={"sslmode": "require" if not TEST_MODE else "prefer"},  # fall back to non-SSL for local testing
    pool_pre_ping=True,   # drop stale connections (important for RDS idle timeouts)
    pool_size=5,
    max_overflow=10,
)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)