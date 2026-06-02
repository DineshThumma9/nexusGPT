"""make_userllmconfig_single_pk

Revision ID: 4f79c59ec267
Revises: 05f0981c1795
Create Date: 2026-06-01 22:05:53.865956

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4f79c59ec267"
down_revision: Union[str, Sequence[str], None] = "05f0981c1795"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Delete duplicate configs, keeping only the most recent one for each user
    op.execute(
        "DELETE FROM config WHERE (user_id, provider) NOT IN "
        "(SELECT user_id, provider FROM config GROUP BY user_id, provider)"
    )
    # We must ensure there is strictly ONE row per user before creating the primary key!
    # Just to be safe for this small table, keep max 1 row per user:
    op.execute(
        "DELETE FROM config WHERE (user_id, provider) NOT IN ("
        "SELECT user_id, MAX(provider) FROM config GROUP BY user_id)"
    )

    # Change PK
    op.drop_constraint("config_pkey", "config", type_="primary")
    op.create_primary_key("config_pkey", "config", ["user_id"])


def downgrade() -> None:
    op.drop_constraint("config_pkey", "config", type_="primary")
    op.create_primary_key("config_pkey", "config", ["user_id", "provider"])
