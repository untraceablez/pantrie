"""add_household_staples

Revision ID: f1a2b3c4d5e6
Revises: c3d4e5f6a7b8
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'household_staples',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('household_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_household_staples_id'), 'household_staples', ['id'], unique=False)
    op.create_index(op.f('ix_household_staples_household_id'), 'household_staples', ['household_id'], unique=False)

    # Backfill: every existing household gets "water" (skip any that already have it).
    op.execute(
        """
        INSERT INTO household_staples (household_id, name)
        SELECT h.id, 'water' FROM households h
        WHERE NOT EXISTS (
            SELECT 1 FROM household_staples s
            WHERE s.household_id = h.id AND s.name = 'water'
        )
        """
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_household_staples_household_id'), table_name='household_staples')
    op.drop_index(op.f('ix_household_staples_id'), table_name='household_staples')
    op.drop_table('household_staples')
