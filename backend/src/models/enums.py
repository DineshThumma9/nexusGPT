from enum import Enum

from src.models.schema import ThinkingConfig


class SenderRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class KBStatus(str, Enum):
    PENDING = "pending"
    INDEXING = "indexing"
    READY = "ready"
    FAILED = "failed"
    REJECTED = "rejected"
    STALE = "stale"


class KBSourceType(str, Enum):
    GITHUB = "github"
    PDF = "pdf"
    URL = "url"
    NOTES = "notes"


class ThinkingLevel(Enum):
    HIGH = ThinkingConfig(
        tool_run_limit=20,
        tool_thread_limit=50,
        model_run_limit=20,
        model_thread_limit=50,
        token_limit=16000,
        keep_message_limit=15,
        message_limit=30,
    )
    MEDIUM = ThinkingConfig(
        tool_run_limit=15,
        tool_thread_limit=50,
        model_run_limit=15,
        model_thread_limit=50,
        token_limit=8000,
        keep_message_limit=10,
        message_limit=20,
    )
    LOW = ThinkingConfig(
        tool_run_limit=10,
        tool_thread_limit=50,
        model_run_limit=10,
        model_thread_limit=50,
        token_limit=6000,
        keep_message_limit=8,
        message_limit=10,
    )
