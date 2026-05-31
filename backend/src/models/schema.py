from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field

from src.models.enums import SenderRole


# --- API (Pydantic) ---
class ChatMessage(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID = Field(validation_alias=AliasChoices("id", "message_id"))
    sender: SenderRole
    content: str
    timestamp: Optional[datetime] = None


class MessageRequest(BaseModel):
    session_id: str
    isFirst: bool = False
    msg: str
    files: Optional[List[str]] = None


class QdrantClient(BaseModel):
    point_id: str
    vector: List[float]
    payload: Dict
    collection_name: str


class UserPayload(BaseModel):
    username: str
    email: EmailStr
    password: str


class Token(BaseModel):
    access: str
    refresh: str


class API_KEY_REQUEST(BaseModel):
    api_provider: str
    api_key: str


class API_KEY_RESPONSE(BaseModel):
    provider:str
    encrypted_key:str

class TitleUpdateRequest(BaseModel):
    title: str


class TitleResponse(BaseModel):
    title: str


class Title(BaseModel):
    title: str = Field(description="Title of the session .Be Consise and Precise.")


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID = Field(validation_alias=AliasChoices("id", "session_id"))
    session_id: UUID
    title: str = Field(default="New Chat")
    kb_id: UUID | None = None 
    source_type: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GitSpec(BaseModel):
    owner: str
    repo: str
    branch: Optional[str] = "main"
    commit: Optional[str] = None
    tree_sha: Optional[str] = None
    token: Optional[str] = None


class GitRequest(BaseModel):
    owner: str
    repo: str
    commit: Optional[str] = None
    branch: Optional[str] = "main"
    dir_include: Optional[List[str]] = None
    dir_exclude: Optional[List[str]] = None
    file_extension_include: Optional[List[str]] = None
    file_extension_exclude: Optional[List[str]] = None
    files: Optional[List[str]] = None
    token: Optional[str] = None


class ProjectNode(BaseModel):
    file_path: str
    content: str
    filename: str
    parent_dir: str
    dirs: List[str]


class MCPModel(BaseModel):
    type: str
    server_url: str
    auth_header: Optional[str] = None
    gallery: Optional[str] = None
    version: Optional[str] = None
    api_key: Optional[str] = None


class PaginatedSessionResponse(BaseModel):
    sessions: List[SessionResponse] = []
    has_more: bool
    next_cursor: Optional[str] = None


class PaginatedMessageResponse(BaseModel):
    messages: List[ChatMessage]
    has_more: bool
    next_cursor: Optional[str] = None
