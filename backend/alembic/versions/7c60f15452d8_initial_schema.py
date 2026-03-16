"""initial_schema

Revision ID: 7c60f15452d8
Revises:
Create Date: 2026-02-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "7c60f15452d8"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # buildings
    op.create_table(
        "buildings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("address_street", sa.String(), nullable=False),
        sa.Column("address_city", sa.String(), nullable=False),
        sa.Column("address_state", sa.String(), nullable=False),
        sa.Column("address_zip", sa.String(), nullable=False),
        sa.Column("address_country", sa.String(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("total_floors", sa.Integer(), nullable=False),
        sa.Column("height_meters", sa.Float(), nullable=False),
        sa.Column("floor_height_meters", sa.Float(), nullable=True),
        sa.Column("gross_square_feet", sa.Float(), nullable=True),
        sa.Column("year_built", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_buildings_address_city"), "buildings", ["address_city"], unique=False)

    # tenants
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("contact_email", sa.String(), nullable=True),
        sa.Column("contact_phone", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tenants_name"), "tenants", ["name"], unique=False)

    # geometries
    op.create_table(
        "geometries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("geometry", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # floors
    op.create_table(
        "floors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("building_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("floor_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("square_feet", sa.Float(), nullable=True),
        sa.Column("geometry_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["geometry_id"], ["geometries.id"]),
        sa.UniqueConstraint("building_id", "floor_number", name="uq_floors_building_floor_number"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_floors_building_id"), "floors", ["building_id"], unique=False)

    # occupancies
    op.create_table(
        "occupancies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("floor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("square_feet", sa.Float(), nullable=True),
        sa.Column("lease_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lease_end", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["floor_id"], ["floors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_occupancies_floor_id"), "occupancies", ["floor_id"], unique=False)
    op.create_index(op.f("ix_occupancies_tenant_id"), "occupancies", ["tenant_id"], unique=False)

    # files
    op.create_table(
        "files",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("building_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # jobs
    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("building_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("message", sa.String(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("jobs")
    op.drop_table("files")
    op.drop_index(op.f("ix_occupancies_tenant_id"), table_name="occupancies")
    op.drop_index(op.f("ix_occupancies_floor_id"), table_name="occupancies")
    op.drop_table("occupancies")
    op.drop_index(op.f("ix_floors_building_id"), table_name="floors")
    op.drop_table("floors")
    op.drop_table("geometries")
    op.drop_index(op.f("ix_tenants_name"), table_name="tenants")
    op.drop_table("tenants")
    op.drop_index(op.f("ix_buildings_address_city"), table_name="buildings")
    op.drop_table("buildings")
