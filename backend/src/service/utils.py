import base64
import dataclasses
import json
import os
from datetime import datetime
from typing import Any

import loguru as logger
from cryptography.fernet import Fernet
import httpx


def _unpack_compiled_object(items, raw_source: bytes = None):

    if isinstance(items, list):
        return [_unpack_compiled_object(i, raw_source) for i in items]
    elif isinstance(items, (str, int, float, bool, type(None))):
        return items

    unpack = dict()

    if isinstance(items, dict):
        return {k: _unpack_compiled_object(v, raw_source) for k, v in items.items()}
    elif dataclasses.is_dataclass(items):
        return {
            k: _unpack_compiled_object(v, raw_source)
            for k, v in dataclasses.asdict(items).items()
        }
    else:
        for attr in dir(items):
            if not attr.startswith("__") and not callable(getattr(items, attr)):
                unpack[attr] = _unpack_compiled_object(getattr(items, attr), raw_source)

    if raw_source is not None:

        def get_span_bytes(span_obj):
            if not span_obj:
                return None, None

            if isinstance(span_obj, dict):
                return span_obj.get("start_byte"), span_obj.get("end_byte")
            return getattr(span_obj, "start_byte", None), getattr(
                span_obj, "end_byte", None
            )

        body_span = (
            unpack.get("body_span")
            if isinstance(items, dict)
            else getattr(items, "body_span", None)
        )
        start, end = get_span_bytes(body_span)
        if start is not None and end is not None and start != end:
            unpack["body_code"] = raw_source[start:end].decode(
                "utf-8", errors="replace"
            )

        full_span = (
            unpack.get("span")
            if isinstance(items, dict)
            else getattr(items, "span", None)
        )
        start, end = get_span_bytes(full_span)
        if start is not None and end is not None and start != end:
            unpack["code"] = raw_source[start:end].decode("utf-8", errors="replace")

    return unpack


def _clean_metadata(metadata: dict):

    cleaned = {}
    for key, val in metadata.items():
        if val is None:
            continue

        if isinstance(val, (str, int, float, bool)):
            cleaned[key] = val
        elif isinstance(val, list):
            if all(isinstance(i, (str, int, float, bool)) for i in val):
                cleaned[key] = val
            else:
                cleaned[key] = json.dumps([str(v) for v in val])
        else:
            try:
                cleaned[key] = json.dumps(str(val))
            except Exception:
                cleaned[key] = str(val)

    return cleaned


def _extract_chunks(items: Any, visited: set = None):

    if not visited:
        visited = set()

    if not items:
        return items

    obj_id = id(items)

    if obj_id in visited:
        return

    visited.add(obj_id)

    if isinstance(items, (str, int, float, bool, type(None), bytes)):
        return items

    if isinstance(items, (set, tuple, list)):
        return [_extract_chunks(item, visited) for item in items]

    if isinstance(items, dict):
        return {k: _extract_chunks(v) for k, v in items.items()}

    if dataclasses.is_dataclass(items):
        return {
            f.name: _extract_chunks(getattr(items, f.name), visited)
            for f in dataclasses.fields(items)
        }

    unpack = dict()

    for attr in dir(items):
        if not attr.startswith("_"):
            try:
                val = getattr(items, attr, None)
                if not callable(val):
                    unpack[attr] = _extract_chunks(val, visited)
            except Exception as e:
                logger.debug(f"Could not parse attribute {attr}: {e}")
                continue

    visited.remove(obj_id)

    return unpack


def _extract_structure(structures):

    structures_list = []

    for struct in structures:
        structures_list.append(struct)

        childs = (
            struct.get("children", [])
            if isinstance(struct, dict)
            else getattr(struct, "children", None)
        )

        if childs:
            structures_list.extend(_extract_structure(childs))

    return structures_list


def encode_cursor(created_at: datetime, id: str) -> str:
    """Encode a (created_at, id) pair into an opaque base64 cursor string."""
    try:
        payload = {"created_at": created_at.isoformat(), "id": str(id)}
        return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    except Exception as e:
        logger.warning(f"encode_cursor failed: {e}")
        return ""


def decode_cursor(cursor: str):
    """Decode a base64 cursor string back into (created_at datetime, id str)."""
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
        return datetime.fromisoformat(payload["created_at"]), payload["id"]
    except Exception as e:
        logger.warning(f"decode_cursor failed: {e}")
        return None, None


fernet_key = os.getenv("FERNET_KEY")
fernet = Fernet(fernet_key) if fernet_key else None


def encrypt(key: str) -> str:
    if not fernet:
        raise ValueError("FERNET_KEY environment variable is not set")
    return fernet.encrypt(key.encode()).decode()


def decrypt(key: str) -> str:
    if not fernet:
        raise ValueError("FERNET_KEY environment variable is not set")
    return fernet.decrypt(key.encode()).decode()


def build_tree(tree_lis):
    root = {"name": "/", "type": "tree", "children": []}
    path_map = {"/": root}

    for item in tree_lis:
        parts = item["path"].split("/")
        for i in range(1, len(parts) + 1):
            sub_path = "/".join(parts[:i])
            if sub_path not in path_map:
                parent_path = "/".join(parts[: i - 1]) or "/"
                parent = path_map[parent_path]
                node_type = "tree" if i < len(parts) else item["type"]
                node = {
                    "name": parts[i - 1],
                    "path": sub_path,
                    "type": node_type,
                    "children": [] if node_type == "tree" else None,
                }

                if node_type == "blob":  # file
                    node["sha"] = item.get("sha")
                    node["size"] = item.get("size")

                parent["children"].append(node)
                path_map[sub_path] = node

    return root["children"]


async def get_dir_struct(req):
    headers = {"Authorization": f"token {req.token}"} if req.token else {}

    async with httpx.AsyncClient() as client:
        # One call: repo metadata gives us default_branch for free
        meta = await client.get(
            f"https://api.github.com/repos/{req.owner}/{req.repo}",
            headers=headers,
        )
        meta.raise_for_status()
        default_branch = meta.json()["default_branch"]

        tree_resp = await client.get(
            f"https://api.github.com/repos/{req.owner}/{req.repo}/git/trees/{default_branch}",
            headers=headers,
            params={"recursive": "1"},
        )
        tree_resp.raise_for_status()

    lis = [
        {"type": item["type"], "path": item["path"], "size": item.get("size"), "sha": item["sha"]}
        for item in tree_resp.json().get("tree", [])
    ]
    return build_tree(lis)
