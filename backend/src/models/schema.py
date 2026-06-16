from datetime import datetime
from typing import TYPE_CHECKING, Dict, List, Optional
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field

if TYPE_CHECKING:
    from src.models.enums import SenderRole


# --- API (Pydantic) ---
class ChatMessage(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID = Field(validation_alias=AliasChoices("id", "message_id"))
    sender: "SenderRole"
    content: str
    timestamp: Optional[datetime] = None


class MessageRequest(BaseModel):
    session_id: str
    isFirst: bool = False
    msg: str
    files: Optional[List[str]] = None
    mcp_enabled: bool = True
    thinking_level: Optional[str] = None


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
    token_type: str = "bearer"


class API_KEY_REQUEST(BaseModel):
    api_provider: str
    api_key: str


class API_KEY_RESPONSE(BaseModel):
    provider: str
    encrypted_key: str


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
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cached_input_tokens: int = 0
    reasoning_tokens: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GitSpec(BaseModel):
    owner: str
    repo: str
    branch: Optional[str] = None
    commit: Optional[str] = None
    tree_sha: Optional[str] = None
    token: Optional[str] = None


class GitRequest(BaseModel):
    owner: str
    repo: str
    commit: Optional[str] = None
    branch: Optional[str] = None
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
    is_active: bool = False


class PaginatedSessionResponse(BaseModel):
    sessions: List[SessionResponse] = []
    has_more: bool
    next_cursor: Optional[str] = None


class PaginatedMessageResponse(BaseModel):
    messages: List[ChatMessage]
    has_more: bool
    next_cursor: Optional[str] = None


class ThinkingConfig(BaseModel):
    tool_run_limit: int
    tool_thread_limit: int
    model_thread_limit: int
    model_run_limit: int
    token_limit: int
    keep_message_limit: int
    message_limit: int

    # model_run_limit: int = 15
    # model_thread_limit: int = 50
    # model_exit_behavior: str = "end"
    # tool_run_limit: int = 15
    # tool_thread_limit: int = 50
    # tool_exit_behaviour: str = "continue"
