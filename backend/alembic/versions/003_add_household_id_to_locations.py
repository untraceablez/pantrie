"""add_household_id_to_locations

Revision ID: 003
Revises: 002
Create Date: 2025-11-12 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the unique index on name
    op.drop_index('ix_locations_name', table_name='locations')

    # Add household_id column (nullable initially to allow existing data)
    op.add_column('locations', sa.Column('household_id', sa.Integer(), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_locations_household_id',
        'locations',
        'households',
        ['household_id'],
        ['id'],
        ondelete='CASCADE'
    )

    # Add index on household_id
    op.create_index('ix_locations_household_id', 'locations', ['household_id'])

    # Add unique constraint on (household_id, name)
    op.create_unique_constraint('uq_household_location_name', 'locations', ['household_id', 'name'])

    # Note: After this migration, you should update existing locations to have a household_id
    # or delete them if you're starting fresh


def downgrade() -> None:
    # Drop unique constraint
    op.drop_constraint('uq_household_location_name', 'locations', type_='unique')

    # Drop index
    op.drop_index('ix_locations_household_id', table_name='locations')

    # Drop foreign key
    op.drop_constraint('fk_locations_household_id', 'locations', type_='foreignkey')

    # Drop household_id column
    op.drop_column('locations', 'household_id')

    # Re-add unique index on name
    op.create_index('ix_locations_name', 'locations', ['name'], unique=True)
