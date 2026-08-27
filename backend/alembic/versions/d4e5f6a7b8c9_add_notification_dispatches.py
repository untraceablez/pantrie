"""add_notification_dispatches

Revision ID: d4e5f6a7b8c9
Revises: f1a2b3c4d5e6
Create Date: 2026-08-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notification_dispatches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('household_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('dispatch_date', sa.Date(), nullable=False),
        sa.Column('item_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('emails_sent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('webhooks_sent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'household_id', 'event_type', 'dispatch_date',
            name='uq_notification_dispatch_per_day'
        ),
    )
    op.create_index(op.f('ix_notification_dispatches_id'), 'notification_dispatches', ['id'], unique=False)
    op.create_index(
        op.f('ix_notification_dispatches_household_id'),
        'notification_dispatches', ['household_id'], unique=False
    )
    op.create_index(
        op.f('ix_notification_dispatches_event_type'),
        'notification_dispatches', ['event_type'], unique=False
    )
    op.create_index(
        op.f('ix_notification_dispatches_dispatch_date'),
        'notification_dispatches', ['dispatch_date'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_notification_dispatches_dispatch_date'), table_name='notification_dispatches')
    op.drop_index(op.f('ix_notification_dispatches_event_type'), table_name='notification_dispatches')
    op.drop_index(op.f('ix_notification_dispatches_household_id'), table_name='notification_dispatches')
    op.drop_index(op.f('ix_notification_dispatches_id'), table_name='notification_dispatches')
    op.drop_table('notification_dispatches')
