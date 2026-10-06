"""Add InvestigationDocument

Revision ID: 4399f5268914
Revises: 17da8177d588
Create Date: 2026-10-06 14:07:46.879051

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '4399f5268914'
down_revision: Union[str, Sequence[str], None] = '17da8177d588'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('investigation_documents',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('case_id', sa.Integer(), nullable=False),
    sa.Column('investigator_id', sa.Integer(), nullable=False),
    sa.Column('original_filename', sa.String(length=255), nullable=False),
    sa.Column('stored_path', sa.String(length=500), nullable=False),
    sa.Column('mime_type', sa.String(length=100), nullable=False),
    sa.Column('file_size', sa.Integer(), nullable=False),
    sa.Column('sha256_hash', sa.String(length=64), nullable=True),
    sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['case_id'], ['investigation_cases.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['investigator_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_investigation_documents_case_id'), 'investigation_documents', ['case_id'], unique=False)
    op.create_index(op.f('ix_investigation_documents_id'), 'investigation_documents', ['id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_investigation_documents_id'), table_name='investigation_documents')
    op.drop_index(op.f('ix_investigation_documents_case_id'), table_name='investigation_documents')
    op.drop_table('investigation_documents')

