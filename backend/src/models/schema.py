from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, EmailStr

from src.models.enums import SenderRole


# --- API (Pydantic) ---
class ChatMessage(BaseModel):
    role: SenderRole
    content: str
    timestamp: Optional[datetime] = None


class MessageInfo(BaseModel):
    message_id: str
    session_id: str
    content: str
    sender: str
    timestamp: str


class ToolCall(BaseModel):
    name: str
    arguments: Dict[str, str]


class ChatbotSchema(BaseModel):
    model: str
    messages: List[ChatMessage]
    temperature: float = 0.7
    max_tokens: int = 1024
    stream: bool = False
    extra: Optional[Dict] = None


class ModelInfo(BaseModel):
    modelprovider: str
    modelname: str
    isFunctionCalling: bool
    token_left: float


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


class Notes(BaseModel):
    session_id: str
    context_id: str
    context_type: str


class UserPayload(BaseModel):
    username: str
    email: EmailStr
    password: str


class Token(BaseModel):
    access: str
    refresh: str


class API_KEY_REQUEST(BaseModel):
    api_prov: str
    api_key: str


class TitleUpdateRequest(BaseModel):
    title: str


class TitleResponse(BaseModel):
    title: str


class SessionResponse(BaseModel):
    session_id: str


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
