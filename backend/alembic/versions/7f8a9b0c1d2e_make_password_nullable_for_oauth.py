"""make_password_nullable_for_oauth

Revision ID: 7f8a9b0c1d2e
Revises: dd8a9775b734
Create Date: 2025-11-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f8a9b0c1d2e'
down_revision: Union[str, None] = 'dd8a9775b734'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make hashed_password nullable for OAuth-only users
    op.alter_column('users', 'hashed_password',
                    existing_type=sa.String(255),
                    nullable=True)


def downgrade() -> None:
    # Revert hashed_password to not nullable
    # Note: This will fail if there are OAuth users without passwords
    op.alter_column('users', 'hashed_password',
                    existing_type=sa.String(255),
                    nullable=False)
