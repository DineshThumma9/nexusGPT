from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from pydantic import EmailStr
from sqlalchemy import Column
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.sql import func
from sqlmodel import Field, Relationship, SQLModel

from src.models.enums import KBSourceType, KBStatus, SenderRole


# --- DB (SQLModel) ---
class User(SQLModel, table=True):
    __tablename__ = "users"
    userid: UUID = Field(default_factory=uuid4, primary_key=True)
    username: str = Field(index=True)
    email: EmailStr = Field(index=True, unique=True)
    hpassword: str
    created_at: datetime = Field(sa_column_kwargs={"server_default": func.now()})

    sessions: List["Session"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    knowledge_bases: List["KnowledgeBase"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class Session(SQLModel, table=True):
    __tablename__ = "sessions"
    session_id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.userid", ondelete="CASCADE", index=True)
    kb_id: Optional[UUID] = Field(
        default=None,
        foreign_key="knowledge_bases.kb_id",
        ondelete="SET NULL",
        index=True,
    )
    title: str = Field(default="New Chat")
    model: str
    created_at: datetime = Field(sa_column_kwargs={"server_default": func.now()})
    updated_at: datetime = Field(
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()}
    )

    user: Optional["User"] = Relationship(back_populates="sessions")
    knowledge_base: Optional["KnowledgeBase"] = Relationship(back_populates="sessions")

    messages: List["Message"] = Relationship(
        back_populates="session",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Message(SQLModel, table=True):
    __tablename__ = "messages"
    message_id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(
        foreign_key="sessions.session_id", ondelete="CASCADE", index=True
    )
    sender: SenderRole = Field(sa_column=SQLEnum(SenderRole))
    content: str
    timestamp: datetime = Field(sa_column_kwargs={"server_default": func.now()})
    files: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    model_response_time_ms: Optional[float] = None
    session: Optional["Session"] = Relationship(back_populates="messages")


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refreshtoken"
    token: str = Field(primary_key=True)
    email: EmailStr
    expiry_date: datetime


class APIKEYS(SQLModel, table=True):
    __tablename__ = "api_keys"
    user_id: UUID = Field(
        foreign_key="users.userid", ondelete="CASCADE", primary_key=True
    )
    provider: str = Field(primary_key=True, index=True)
    encrypted_key: str


class UserLLMConfig(SQLModel, table=True):
    __tablename__ = "config"
    user_id: UUID = Field(
        foreign_key="users.userid", ondelete="CASCADE", primary_key=True
    )
    provider: str = Field(index=True)
    model: str


class KnowledgeBase(SQLModel, table=True):
    __tablename__ = "knowledge_bases"
    kb_id: UUID = Field(primary_key=True)
    user_id: UUID = Field(foreign_key="users.userid", ondelete="CASCADE", index=True)
    source_type: KBSourceType
    source_ref: str
    status: KBStatus = Field(default=KBStatus.PENDING)
    created_at: datetime = Field(sa_column_kwargs={"server_default": func.now()})
    indexed_at: Optional[datetime] = None
    source_sha: Optional[str] = None
    user: Optional["User"] = Relationship(back_populates="knowledge_bases")
    sessions: List["Session"] = Relationship(back_populates="knowledge_base")


class UserMCPConfig(SQLModel, table=True):
    __tablename__ = "mcp_config"
    user_id: UUID = Field(
        foreign_key="users.userid", ondelete="CASCADE", primary_key=True
    )
    server_url: str = Field(primary_key=True)
    type: str
    auth_header: Optional[str] = None
    gallery: Optional[str] = None
    version: Optional[str] = None
    api_key: Optional[str] = None
