import base64
import json
from datetime import datetime

import loguru as logger
from cryptography.fernet import Fernet

from src.config.settings import settings

fernet = Fernet(settings.fernet_key)


class CyrptoService:
    def __init__(self):
        self.fernet = Fernet(settings.fernet_key)

    def encode_cursor(self, created_at: datetime, id: str) -> str:
        """Encode a (created_at, id) pair into an opaque base64 cursor string."""
        try:
            payload = {"created_at": created_at.isoformat(), "id": str(id)}
            return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
        except Exception as e:
            logger.warning(f"encode_cursor failed: {e}")
            return ""

    def decode_cursor(self, cursor: str):
        """Decode a base64 cursor string back into (created_at datetime, id str)."""
        try:
            payload = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
            return datetime.fromisoformat(payload["created_at"]), payload["id"]
        except Exception as e:
            logger.warning(f"decode_cursor failed: {e}")
            return None, None

    def encrypt(self, key: str) -> str:
        return self.fernet.encrypt(key.encode()).decode()

    def decrypt(self, key: str) -> str:
        return self.fernet.decrypt(key.encode()).decode()
