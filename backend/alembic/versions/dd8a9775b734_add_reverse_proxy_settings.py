"""add_reverse_proxy_settings

Revision ID: dd8a9775b734
Revises: 6eff5d1d268f
Create Date: 2025-11-14 19:41:44.305437

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd8a9775b734'
down_revision: Union[str, None] = '6eff5d1d268f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add reverse proxy configuration columns to system_settings table
    op.add_column('system_settings', sa.Column('proxy_mode', sa.String(length=50), nullable=True, server_default='none'))
    op.add_column('system_settings', sa.Column('external_proxy_url', sa.String(length=255), nullable=True))
    op.add_column('system_settings', sa.Column('custom_domain', sa.String(length=255), nullable=True))
    op.add_column('system_settings', sa.Column('use_https', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    # Remove reverse proxy configuration columns
    op.drop_column('system_settings', 'use_https')
    op.drop_column('system_settings', 'custom_domain')
    op.drop_column('system_settings', 'external_proxy_url')
    op.drop_column('system_settings', 'proxy_mode')
