import logging
import re
import tempfile
import time
from pathlib import Path

from src.models.code_schema import GraphEntity, GraphRelation
from src.models.schema import GitRequest

from ...code.tree_sitter.code_pipeline import CodePipeline
from ..scip.scip_indexer import ScipIndexer, ScipIndexParser

logger = logging.getLogger("scip_pipeline")


def name_from_symbol(symbol: str) -> str:
    s = symbol.rstrip(".#")
    s = re.sub(r"\(\)\.?$", "", s)
    parts = re.split(r"[/#]", s)
    last = parts[-1] if parts else symbol
    return last or symbol


class SCIPPipeline(CodePipeline):
    def __init__(self, req: GitRequest, kb_id: str, branch: str, token: str):
        super().__init__(req, kb_id, branch, token)

    def extract(self):
        # 1. Run the base Tree-sitter extraction
        super().extract()
        # 2. Run the SCIP overlay to replace heuristics with high-precision graph data
        t0 = time.time()
        logger.info("[extract] Starting SCIP combine overlay...")
        self.combine()
        logger.info(f"[extract] SCIP combine complete in {time.time() - t0:.2f}s")

    def combine(self) -> None:
        """Run SCIP CLI, write graph, supplement with Tree-sitter, write SCIP CALLS edges."""

        path = Path(self.tmp_dir)
        index_root = path.resolve()

        # Determine majority language of the repository
        lang_counts = {}
        for f in self.processed_code:
            lang_counts[f.language] = lang_counts.get(f.language, 0) + 1
        lang = max(lang_counts, key=lang_counts.get) if lang_counts else "python"

        try:
            with tempfile.TemporaryDirectory(prefix="out") as tmpdir:
                scip_file = ScipIndexer().run(path, lang, Path(tmpdir))

                if not scip_file:
                    logger.warning(
                        f"SCIP indexer produced no output for {path}. "
                        "Falling back to Tree-sitter."
                    )
                    return

                scip_data = ScipIndexParser().parse(scip_file, path)

            if not scip_data:
                logger.warning("SCIP parse returned empty result")
                return

            files_data = scip_data.get("files", {})

            # Map from absolute path to relative path
            for abs_path_str, file_data in files_data.items():
                abs_path = Path(abs_path_str)
                try:
                    rel_path = abs_path.relative_to(index_root).as_posix()
                except ValueError:
                    rel_path = abs_path.name

                # Find the matching FileParseResult from the tree-sitter extract phase
                target_result = next(
                    (r for r in self.processed_code if r.file_path == rel_path), None
                )
                if not target_result:
                    continue

                # Remove existing Tree-sitter heuristic relations and sub-file entities
                target_result.entities = [
                    e for e in target_result.entities if e.kind == "File"
                ]
                target_result.relations = [
                    r
                    for r in target_result.relations
                    if r.rel_type not in ("CALLS", "CONTAINS")
                ]

                # Process SCIP Classes
                for cls in file_data.classes:
                    node_id = f"{rel_path}:{cls.name}"
                    target_result.entities.append(
                        GraphEntity(
                            node_id=node_id,
                            name=cls.name,
                            kind="Class",
                            parent_id=rel_path,
                        )
                    )
                    target_result.relations.append(
                        GraphRelation(
                            source_id=rel_path, target_id=node_id, rel_type="CONTAINS"
                        )
                    )

                # Process SCIP Structs, Traits, Interfaces, Enums
                for category in ["structs", "traits", "interfaces", "enums"]:
                    items = getattr(file_data, category, [])
                    for item in items:
                        node_id = f"{rel_path}:{item.name}"
                        # Derive kind string: e.g. "structs" -> "Struct"
                        kind_str = (
                            category.capitalize()[:-1]
                            if category.endswith("s")
                            else category.capitalize()
                        )
                        target_result.entities.append(
                            GraphEntity(
                                node_id=node_id,
                                name=item.name,
                                kind=kind_str,
                                parent_id=rel_path,
                            )
                        )
                        target_result.relations.append(
                            GraphRelation(
                                source_id=rel_path,
                                target_id=node_id,
                                rel_type="CONTAINS",
                            )
                        )

                # Process SCIP Functions
                for fn in file_data.functions:
                    node_id = f"{rel_path}:{fn.name}"
                    target_result.entities.append(
                        GraphEntity(
                            node_id=node_id,
                            name=fn.name,
                            kind=fn.kind.capitalize() if fn.kind else "Function",
                            parent_id=rel_path,
                        )
                    )
                    target_result.relations.append(
                        GraphRelation(
                            source_id=rel_path, target_id=node_id, rel_type="CONTAINS"
                        )
                    )

                # Process SCIP CALLS
                all_calls = file_data.functionCalls + file_data.moduleCalls
                for call in all_calls:
                    caller_name = (
                        name_from_symbol(call.caller) if call.caller else "<module>"
                    )
                    callee_name = (
                        name_from_symbol(call.calling) if call.calling else "<unknown>"
                    )

                    caller_file_rel = rel_path
                    if call.caller_file:
                        try:
                            caller_file_rel = (
                                Path(call.caller_file)
                                .relative_to(index_root)
                                .as_posix()
                            )
                        except ValueError:
                            caller_file_rel = Path(call.caller_file).name

                    source_node_id = f"{caller_file_rel}:{caller_name}"
                    target_node_id = callee_name

                    target_result.relations.append(
                        GraphRelation(
                            source_id=source_node_id,
                            target_id=target_node_id,
                            rel_type="CALLS",
                            properties={
                                "type": call.typeCall,
                                "caller_file": caller_file_rel,
                                "callee_line": call.ref_line,
                            },
                        )
                    )

        except Exception as e:
            logger.error(f"Error in SCIPPipeline.combine: {e}")
