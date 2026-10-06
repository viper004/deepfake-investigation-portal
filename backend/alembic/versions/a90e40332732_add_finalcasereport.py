"""Add FinalCaseReport

Revision ID: a90e40332732
Revises: 4399f5268914
Create Date: 2026-10-06 14:23:33.470773

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a90e40332732'
down_revision: Union[str, Sequence[str], None] = '4399f5268914'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('final_case_reports',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('case_id', sa.Integer(), nullable=False),
    sa.Column('investigator_id', sa.Integer(), nullable=False),
    sa.Column('original_filename', sa.String(length=255), nullable=False),
    sa.Column('stored_path', sa.String(length=500), nullable=False),
    sa.Column('mime_type', sa.String(length=100), nullable=False),
    sa.Column('file_size', sa.Integer(), nullable=False),
    sa.Column('sha256_hash', sa.String(length=64), nullable=True),
    sa.Column('version', sa.Integer(), server_default='1', nullable=True),
    sa.Column('is_submitted', sa.Boolean(), server_default='0', nullable=True),
    sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['case_id'], ['investigation_cases.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['investigator_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('case_id')
    )
    op.create_index(op.f('ix_final_case_reports_id'), 'final_case_reports', ['id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_final_case_reports_id'), table_name='final_case_reports')
    op.drop_table('final_case_reports')
