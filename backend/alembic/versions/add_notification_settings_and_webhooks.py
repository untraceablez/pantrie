"""add_notification_settings_and_webhooks

Revision ID: a1b2c3d4e5f6
Revises: dd8a9775b734
Create Date: 2025-12-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'dd8a9775b734'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add email notification settings to system_settings table
    op.add_column('system_settings', sa.Column(
        'email_notifications_enabled', sa.Boolean(), nullable=False, server_default='false'
    ))
    op.add_column('system_settings', sa.Column(
        'notify_expiring_items', sa.Boolean(), nullable=False, server_default='true'
    ))
    op.add_column('system_settings', sa.Column(
        'notify_low_stock', sa.Boolean(), nullable=False, server_default='true'
    ))
    op.add_column('system_settings', sa.Column(
        'notify_new_member', sa.Boolean(), nullable=False, server_default='true'
    ))
    op.add_column('system_settings', sa.Column(
        'expiry_warning_days', sa.Integer(), nullable=False, server_default='7'
    ))

    # Create webhooks table
    op.create_table(
        'webhooks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('secret', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('event_types', sa.String(length=255), nullable=False,
                  server_default='expiring_items,low_stock,new_member'),
        sa.Column('household_id', sa.Integer(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_webhooks_id'), 'webhooks', ['id'], unique=False)
    op.create_index(op.f('ix_webhooks_household_id'), 'webhooks', ['household_id'], unique=False)
    op.create_index(op.f('ix_webhooks_created_by_id'), 'webhooks', ['created_by_id'], unique=False)


def downgrade() -> None:
    # Drop webhooks table
    op.drop_index(op.f('ix_webhooks_created_by_id'), table_name='webhooks')
    op.drop_index(op.f('ix_webhooks_household_id'), table_name='webhooks')
    op.drop_index(op.f('ix_webhooks_id'), table_name='webhooks')
    op.drop_table('webhooks')

    # Remove email notification settings from system_settings
    op.drop_column('system_settings', 'expiry_warning_days')
    op.drop_column('system_settings', 'notify_new_member')
    op.drop_column('system_settings', 'notify_low_stock')
    op.drop_column('system_settings', 'notify_expiring_items')
    op.drop_column('system_settings', 'email_notifications_enabled')
