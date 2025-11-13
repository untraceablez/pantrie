"""add_nutritional_info_to_inventory_items

Revision ID: dba21d223bce
Revises: 44323516db80
Create Date: 2025-11-13 14:58:10.928858

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dba21d223bce'
down_revision: Union[str, None] = '44323516db80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add ingredients column
    op.add_column('inventory_items', sa.Column('ingredients', sa.Text(), nullable=True))

    # Add nutritional_info column (stored as JSON text)
    op.add_column('inventory_items', sa.Column('nutritional_info', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('inventory_items', 'nutritional_info')
    op.drop_column('inventory_items', 'ingredients')
