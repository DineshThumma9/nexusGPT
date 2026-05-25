from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from pydantic import EmailStr
from sqlalchemy import Column
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSON
from sqlmodel import Field, SQLModel

from src.models.enums import KBSourceType, KBStatus, SenderRole


# --- DB (SQLModel) ---
class User(SQLModel, table=True):
    __tablename__ = "users"
    userid: UUID = Field(default_factory=uuid4, primary_key=True)
    username: str = Field(index=True)
    email: EmailStr = Field(index=True)
    hpassword: str
    created_at: datetime = Field(default_factory=datetime.now)


class Session(SQLModel, table=True):
    __tablename__ = "sessions"
    session_id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.userid", index=True)
    # NULL = vanilla chat (no RAG). Set after user attaches a knowledge base.
    kb_id: Optional[UUID] = Field(
        default=None, foreign_key="knowledge_bases.kb_id", index=True
    )
    title: str
    model: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class Message(SQLModel, table=True):
    __tablename__ = "messages"
    message_id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="sessions.session_id", index=True)
    sender: SenderRole = Field(sa_column=SQLEnum(SenderRole))
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)
    files: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    model_response_time_ms: Optional[float] = None


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refreshtoken"
    token: str = Field(primary_key=True)
    email: EmailStr
    expiry_date: datetime


class APIKEYS(SQLModel, table=True):
    __tablename__ = "api_keys"
    user_id: UUID = Field(foreign_key="users.userid", primary_key=True)
    provider: str = Field(primary_key=True, index=True)
    encrypted_key: str


class UserLLMConfig(SQLModel, table=True):
    __tablename__ = "config"
    user_id: UUID = Field(foreign_key="users.userid", primary_key=True)
    provider: str = Field(primary_key=True, index=True)
    model: str


class KnowledgeBase(SQLModel, table=True):
    __tablename__ = "knowledge_bases"

    kb_id: UUID = Field(primary_key=True)
    user_id: UUID = Field(foreign_key="users.userid", index=True)
    source_type: KBSourceType
    # For GitHub: "owner/repo@branch" or "owner/repo@sha"
    # For PDF/URL: filename or URL string
    source_ref: str
    status: KBStatus = Field(default=KBStatus.PENDING)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    indexed_at: Optional[datetime] = None

    # The commit SHA of what's indexed — used for cache invalidation
    source_sha: Optional[str] = None


class UserMCPConfig(SQLModel, table=True):
    __tablename__ = "mcp_config"
    user_id: UUID = Field(foreign_key="users.userid", primary_key=True)
    server_url: str = Field(primary_key=True)
    type: str
    auth_header: Optional[str] = None
    gallery: Optional[str] = None
    version: Optional[str] = None
    api_key: Optional[str] = None
