import json
from datetime import datetime

from cryptography.fernet import Fernet
from loguru import logger

from src.config.settings import settings


class CyrptoService:
    def __init__(self):
        self.fernet = Fernet(settings.fernet_key)

    def encode_cursor(self, created_at: datetime, id: str) -> str:
        """Encode a (created_at, id) pair into an encrypted cursor string."""
        try:
            payload = {"created_at": created_at.isoformat(), "id": str(id)}
            return self.encrypt(json.dumps(payload))
        except Exception as e:
            logger.warning(f"encode_cursor failed: {e}")
            return ""

    def decode_cursor(self, cursor: str):
        """Decode an encrypted cursor string back into (created_at datetime, id str)."""
        try:
            payload = json.loads(self.decrypt(cursor))
            return datetime.fromisoformat(payload["created_at"]), payload["id"]
        except Exception as e:
            logger.warning(f"decode_cursor failed: {e}")
            return None, None

    def encrypt(self, key: str) -> str:
        return self.fernet.encrypt(key.encode()).decode()

    def decrypt(self, key: str) -> str:
        return self.fernet.decrypt(key.encode()).decode()
