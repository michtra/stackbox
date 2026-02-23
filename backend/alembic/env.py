import os
import sys
from logging.config import fileConfig
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import create_engine, pool

from alembic import context
from dotenv import load_dotenv

# Add backend/src to path so we can import our models
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Load .env from backend directory
load_dotenv(Path(__file__).parent.parent / ".env")

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Inject DATABASE_URL from environment into alembic config
database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise ValueError("DATABASE_URL environment variable is not set")
config.set_main_option("sqlalchemy.url", database_url)

# Import Base and all models so autogenerate can detect the schema
from database import Base  # noqa: E402
import db_models  # noqa: E402, F401 — registers all ORM models with Base.metadata

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generate SQL without connecting)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (apply directly to DB)."""
    url = config.get_main_option("sqlalchemy.url")
    host = urlparse(url).hostname or ""
    connect_args = {} if host in ("localhost", "127.0.0.1") else {"sslmode": "require"}
    connectable = create_engine(url, poolclass=pool.NullPool, connect_args=connect_args)

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
