import dataclasses
import enum
import json
from typing import Any, Optional, Set

try:
    from loguru import logger
except ImportError:
    import logging

    logger = logging.getLogger(__name__)


class CompiledObjectProcessor:
    def __init__(self, raw_source: Optional[bytes] = None):
        self.raw_source = raw_source

    def unpack(self, items: Any, visited: Optional[Set[int]] = None) -> Any:
        if visited is None:
            visited = set()

        if not items:
            return items

        if isinstance(items, enum.Enum) or type(items).__name__.endswith("Kind"):
            return str(items)

        if isinstance(items, (str, int, float, bool, type(None), bytes)):
            return items

        obj_id = id(items)
        if obj_id in visited:
            return None

        visited.add(obj_id)

        try:
            if isinstance(items, (set, tuple, list)):
                return [self.unpack(item, visited) for item in items]

            if isinstance(items, dict):
                return {k: self.unpack(v, visited) for k, v in items.items()}

            unpack_dict = {}

            if dataclasses.is_dataclass(items):
                for f in dataclasses.fields(items):
                    unpack_dict[f.name] = self.unpack(getattr(items, f.name), visited)
            else:
                for attr in dir(items):
                    if not attr.startswith("_"):
                        try:
                            val = getattr(items, attr, None)
                            if not callable(val):
                                if attr == "kind" and isinstance(val, dict):
                                    unpack_dict[attr] = (
                                        str(list(val.keys())[0]) if val else "UNKNOWN"
                                    )
                                else:
                                    unpack_dict[attr] = self.unpack(val, visited)
                        except Exception as e:
                            logger.debug(f"Could not parse attribute {attr}: {e}")
                            continue

            if self.raw_source is not None:
                self._extract_spans(items, unpack_dict)

            return unpack_dict

        finally:
            visited.remove(obj_id)

    def _extract_spans(self, items: Any, unpacked: dict) -> None:
        def get_span_bytes(span_obj):
            if not span_obj:
                return None, None
            if isinstance(span_obj, dict):
                return span_obj.get("start_byte"), span_obj.get("end_byte")
            return getattr(span_obj, "start_byte", None), getattr(
                span_obj, "end_byte", None
            )

        for field, key in [("body_span", "body_code"), ("span", "code")]:
            span = (
                unpacked.get(field)
                if isinstance(items, dict)
                else getattr(items, field, None)
            )
            start, end = get_span_bytes(span)
            if start is not None and end is not None and start != end:
                unpacked[key] = self.raw_source[start:end].decode(
                    "utf-8", errors="replace"
                )

    @staticmethod
    def clean_metadata(metadata: dict) -> dict:
        """Adapted from your _clean_metadata"""
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

    @staticmethod
    def flatten_structures(structures: list) -> list:
        """Adapted from your _extract_structure"""
        structures_list = []
        for struct in structures:
            structures_list.append(struct)
            childs = (
                struct.get("children", [])
                if isinstance(struct, dict)
                else getattr(struct, "children", None)
            )
            if childs:
                structures_list.extend(
                    CompiledObjectProcessor.flatten_structures(childs)
                )
        return structures_list
