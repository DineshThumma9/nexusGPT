from enum import Enum


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
