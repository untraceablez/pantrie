"""add_site_role_to_users

Revision ID: 6eff5d1d268f
Revises: cb580eb7c828
Create Date: 2025-11-14 18:22:59.512245

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6eff5d1d268f'
down_revision: Union[str, None] = 'cb580eb7c828'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add site_role column to users table
    op.add_column('users', sa.Column('site_role', sa.String(50), nullable=False, server_default='user'))

    # Update the first user (id=1) to be site_administrator
    op.execute("UPDATE users SET site_role = 'site_administrator' WHERE id = 1")


def downgrade() -> None:
    # Remove site_role column
    op.drop_column('users', 'site_role')
