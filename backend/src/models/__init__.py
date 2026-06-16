# Models module
# Import schema models on demand to avoid circular imports
# Users should: from src.models.schema import User, Message, etc.

from .enums import KBSourceType, KBStatus, SenderRole, ThinkingLevel
from .schema import (
    API_KEY_REQUEST,
    API_KEY_RESPONSE,
    ChatMessage,
    GitRequest,
    GitSpec,
    MCPModel,
    MessageRequest,
    PaginatedMessageResponse,
    PaginatedSessionResponse,
    ProjectNode,
    QdrantClient,
    SessionResponse,
    ThinkingConfig,
    Title,
    TitleResponse,
    TitleUpdateRequest,
    Token,
    UserPayload,
)

# Rebuild models to resolve forward references
ChatMessage.model_rebuild()

__all__ = [
    "schema",
    "SenderRole",
    "KBStatus",
    "KBSourceType",
    "ThinkingLevel",
    "ChatMessage",
    "MessageRequest",
    "QdrantClient",
    "UserPayload",
    "Token",
    "API_KEY_REQUEST",
    "API_KEY_RESPONSE",
    "TitleUpdateRequest",
    "TitleResponse",
    "Title",
    "SessionResponse",
    "GitSpec",
    "GitRequest",
    "ProjectNode",
    "MCPModel",
    "PaginatedSessionResponse",
    "PaginatedMessageResponse",
    "ThinkingConfig",
]
