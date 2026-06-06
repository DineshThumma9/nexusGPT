"""add_performance_indexes

Revision ID: 6f5e2a3b4c8d
Revises: 5404bd4bcab9
Create Date: 2026-06-05 18:40:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6f5e2a3b4c8d"
down_revision: Union[str, Sequence[str], None] = "4f79c59ec267"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add critical performance indexes."""
    # Index on session.user_id (used in every session query)
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_user_id 
        ON sessions(user_id);
    """)
    
    # Index on message.session_id (used in history/context queries)
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_session_id 
        ON messages(session_id);
    """)
    
    # Index on apikeys(user_id, provider) for API key lookups
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apikeys_user_provider 
        ON api_keys(user_id, provider);
    """)
    
    # Index on refreshtoken.token for token validation
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_token_token 
        ON refresh_token(token);
    """)
    
    # Index on user.username for username lookups
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_username 
        ON users(username);
    """)
    
    # Index on mcp_config.user_id for user config lookups
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mcp_config_user_id 
        ON mcp_config(user_id);
    """)


def downgrade() -> None:
    """Remove performance indexes."""
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_session_user_id;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_message_session_id;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_apikeys_user_provider;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_refresh_token_token;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_user_username;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_mcp_config_user_id;")
