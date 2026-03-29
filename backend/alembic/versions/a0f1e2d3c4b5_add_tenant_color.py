"""add_tenant_color

Revision ID: a0f1e2d3c4b5
Revises: 7c60f15452d8
Create Date: 2026-03-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a0f1e2d3c4b5"
down_revision: Union[str, None] = "7c60f15452d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("color", sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "color")
