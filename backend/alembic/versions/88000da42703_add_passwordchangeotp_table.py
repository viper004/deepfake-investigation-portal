"""Add PasswordChangeOTP table

Revision ID: 88000da42703
Revises: a90e40332732
Create Date: 2026-10-07 10:14:53.215972

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '88000da42703'
down_revision: Union[str, Sequence[str], None] = 'a90e40332732'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('password_change_otps',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('otp_hash', sa.String(length=255), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('attempt_count', sa.Integer(), nullable=False),
    sa.Column('verified', sa.Boolean(), nullable=False),
    sa.Column('used', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_password_change_otps_id'), 'password_change_otps', ['id'], unique=False)
    op.create_index(op.f('ix_password_change_otps_user_id'), 'password_change_otps', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_password_change_otps_user_id'), table_name='password_change_otps')
    op.drop_index(op.f('ix_password_change_otps_id'), table_name='password_change_otps')
    op.drop_table('password_change_otps')
