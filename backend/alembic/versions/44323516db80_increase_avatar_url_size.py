"""increase_avatar_url_size

Revision ID: 44323516db80
Revises: 004
Create Date: 2025-11-13 09:11:38.393926

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '44323516db80'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Change avatar_url from VARCHAR(500) to TEXT to support base64 encoded images
    op.alter_column('users', 'avatar_url',
                    existing_type=sa.VARCHAR(length=500),
                    type_=sa.Text(),
                    existing_nullable=True)


def downgrade() -> None:
    # Revert avatar_url back to VARCHAR(500)
    op.alter_column('users', 'avatar_url',
                    existing_type=sa.Text(),
                    type_=sa.VARCHAR(length=500),
                    existing_nullable=True)
