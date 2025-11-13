"""add_household_allergens

Revision ID: e7f8g9h0i1j2
Revises: dba21d223bce
Create Date: 2025-11-13 15:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f8g9h0i1j2'
down_revision: Union[str, None] = 'dba21d223bce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create household_allergens table
    op.create_table(
        'household_allergens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('household_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_household_allergens_id'), 'household_allergens', ['id'], unique=False)
    op.create_index(op.f('ix_household_allergens_household_id'), 'household_allergens', ['household_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_household_allergens_household_id'), table_name='household_allergens')
    op.drop_index(op.f('ix_household_allergens_id'), table_name='household_allergens')
    op.drop_table('household_allergens')
