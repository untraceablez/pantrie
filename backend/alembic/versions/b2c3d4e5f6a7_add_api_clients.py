"""add_api_clients

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'api_clients',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('household_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('client_id', sa.String(length=64), nullable=False),
        sa.Column('client_secret_hash', sa.String(length=255), nullable=False),
        sa.Column(
            'permissions',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text('\'{"read": true, "write": false, "delete": false}\'::jsonb'),
        ),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_api_clients_id'), 'api_clients', ['id'], unique=False)
    op.create_index(op.f('ix_api_clients_household_id'), 'api_clients', ['household_id'], unique=False)
    op.create_index(op.f('ix_api_clients_client_id'), 'api_clients', ['client_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_api_clients_client_id'), table_name='api_clients')
    op.drop_index(op.f('ix_api_clients_household_id'), table_name='api_clients')
    op.drop_index(op.f('ix_api_clients_id'), table_name='api_clients')
    op.drop_table('api_clients')
