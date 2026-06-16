import concurrent
import concurrent.futures
import os
import subprocess
import tempfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import tree_sitter_language_pack as tlsp
from loguru import logger
from qdrant_client.models import PointStruct
from tree_sitter import Parser, Query, QueryCursor
from tree_sitter_language_pack import ProcessConfig, detect_language_from_path, process

from src.db.graphdb import get_async_graph, get_graph
from src.db.vectordb import vector_db
from src.models.code_schema import (
    FileParseResult,
    GraphEntity,
    GraphRelation,
    ProcessResult,
    StructureItem,
)
from src.models.schema import GitRequest, ProjectNode
from src.service.constants import (
    _CALL_NODE_TYPES,
    _CLASS_DEF_TYPES,
    _FUNCTION_DEF_TYPES,
    _IGNORED_CALLS_BY_LANG,
    _INTERMEDIATE_TYPES,
    _NAME_CAPTURES,
    _UNIVERSAL_IGNORED,
    ALWAYS_SKIP,
    CHUNK_SIZE_BY_LANGUAGE,
    PARSE_AS_TEXT,
    SKIP_DIRS,
    SKIP_EXTENSIONS,
)

from ..languages.grammer import LANUGUAGE_GRAMMERS
from .complied_object import CompiledObjectProcessor


class CodePipeline:
    def __init__(self, req: GitRequest, kb_id: str, branch: str, token: str):

        self.repo_url: str = f"https://github.com/{req.owner}/{req.repo}.git"
        self.kb_id: str = kb_id
        self.branch = branch

        self.graph = get_graph()
        self.driver = self.graph._driver
        self.vector_db = vector_db
        self.async_neo4j = get_async_graph()

        self.project_files = []
        self.processed_code = []
        self.tmp_dir_obj = None
        self.tmp_dir = None
        self.complied_obj = CompiledObjectProcessor()

    def clone(self):
        t0 = time.time()
        logger.info(f"[clone] Starting git clone: {self.repo_url}")
        self.tmp_dir_obj = tempfile.TemporaryDirectory()
        self.tmp_dir = self.tmp_dir_obj.name
        try:
            clone_cmd = ["git", "clone", "--depth", "1"]
            if self.branch:
                clone_cmd.extend(["--branch", self.branch])
            clone_cmd.extend([self.repo_url, self.tmp_dir])

            subprocess.run(
                clone_cmd,
                check=True,
                capture_output=True,
                text=True,
            )
            logger.info(f"[clone] Done in {time.time() - t0:.2f}s")
        except subprocess.CalledProcessError as e:
            logger.error(
                f"[clone] Git clone failed after {time.time() - t0:.2f}s: {e.stderr}"
            )
            raise RuntimeError(f"Failed to clone repository: {e.stderr}")

    def build(self):
        t0 = time.time()
        logger.info("[build] Scanning repository files...")
        temp_path = Path(self.tmp_dir)
        for file_path in temp_path.rglob("*"):
            if file_path.is_dir() or ".git" in file_path.parts:
                continue

            rel_path = str(file_path.relative_to(self.tmp_dir))

            if self.classify_file(rel_path) == "skip":
                continue

            try:
                content = file_path.read_text(encoding="utf-8")

                dirs = [
                    str(parent)
                    for parent in reversed(file_path.parents)
                    if str(parent) != "."
                ]
                parent_dir = (
                    str(file_path.parent) if str(file_path.parent) != "." else ""
                )

                self.project_files.append(
                    ProjectNode(
                        file_path=rel_path,
                        content=content,
                        filename=file_path.name,
                        parent_dir=parent_dir,
                        dirs=dirs,
                    )
                )
            except Exception as e:
                logger.warning(f"[build] Skipping unreadable file {rel_path}: {e}")

        logger.info(
            f"[build] Found {len(self.project_files)} processable files in {time.time() - t0:.2f}s"
        )

    @staticmethod
    def classify_file(path: str) -> str:
        """Returns 'skip', 'text', or 'parse'"""
        p = Path(path)
        filename = p.name

        if filename in ALWAYS_SKIP:
            return "skip"

        # Check if any part of the path matches SKIP_DIRS
        if any(d in p.parts for d in SKIP_DIRS):
            return "skip"

        if any(filename.endswith(ext) for ext in SKIP_EXTENSIONS):
            return "skip"

        if filename in PARSE_AS_TEXT:
            return "text"

        # markdown and plain text → text chunks
        if p.suffix in [".md", ".txt"]:
            return "text"

        return "parse"

    def _process_single_file(self, project_file: ProjectNode):

        take = self.classify_file(project_file.file_path)

        if take == "skip":
            return

        file_id = project_file.file_path
        result = FileParseResult(
            file_path=file_id,
            language="text",
            content=project_file.content,
        )

        lang_name = detect_language_from_path(file_id)

        if not lang_name:
            return

        result.language = lang_name

        config = ProcessConfig(
            language=lang_name,
            structure=True,
            imports=True,
            symbols=True,
            exports=True,
            chunk_max_size=CHUNK_SIZE_BY_LANGUAGE.get(lang_name, 2000),
        )

        raw_result = process(project_file.content, config)
        tree_dict = self.complied_obj.unpack(raw_result)
        parsed = ProcessResult.model_validate(tree_dict)
        structs = self.complied_obj.flatten_structures(parsed.structure)
        result.chunks = parsed.chunks
        result.entities.append(
            GraphEntity(
                node_id=file_id,
                name=file_id,
                kind="File",
            )
        )
        for struct in structs:
            name = (
                struct.name if isinstance(struct, StructureItem) else struct.get("name")
            )
            kind_raw = (
                struct.kind if isinstance(struct, StructureItem) else struct.get("kind")
            )

            if not name or not kind_raw:
                continue

            kind = (
                kind_raw.lower() if isinstance(kind_raw, str) else str(kind_raw).lower()
            )

            if kind == "class":
                class_id = f"{file_id}:{name}"
                result.entities.append(
                    GraphEntity(
                        node_id=class_id, name=name, kind="Class", parent_id=file_id
                    )
                )
                result.relations.append(
                    GraphRelation(
                        source_id=file_id, target_id=class_id, rel_type="CONTAINS"
                    )
                )
            elif kind in ("function", "method"):
                func_id = f"{file_id}:{name}"
                result.entities.append(
                    GraphEntity(
                        node_id=func_id, name=name, kind="Function", parent_id=file_id
                    )
                )
                result.relations.append(
                    GraphRelation(
                        source_id=file_id, target_id=func_id, rel_type="CONTAINS"
                    )
                )

        call_rels = self.process_function_calls(
            source_code=project_file.content, lang_name=lang_name, file_id=file_id
        )
        result.relations.extend(call_rels)
        return result

    def process_function_calls(self, source_code: str, lang_name: str, file_id: str):
        grammar = LANUGUAGE_GRAMMERS.get(lang_name)
        if not grammar or "calls" not in grammar:
            return []

        lang_obj = tlsp.get_language(lang_name)
        parser = Parser(lang_obj)
        query = Query(lang_obj, grammar["calls"])
        tree = parser.parse(source_code.encode("utf-8"))

        cursor = QueryCursor(query)
        raw = cursor.captures(tree.root_node)

        if isinstance(raw, dict):
            captures = sorted(
                [(node, name) for name, nodes in raw.items() for node in nodes],
                key=lambda x: x[0].start_byte,
            )
        else:
            captures = sorted(raw, key=lambda x: x[0].start_byte)

        # Dynamically fetch the ignore list for this specific language, merging it with universal garbage
        ignored_calls = (
            _IGNORED_CALLS_BY_LANG.get(lang_name, set()) | _UNIVERSAL_IGNORED
        )

        relations = []
        for node, capture_name in captures:
            if capture_name not in _NAME_CAPTURES:
                continue

            called_name = node.text.decode("utf-8")

            # Use the language-specific ignore list
            if called_name in ignored_calls or len(called_name) < 2:
                continue

            call_node = node.parent
            while call_node and call_node.type in _INTERMEDIATE_TYPES:
                call_node = call_node.parent

            if not call_node or call_node.type not in _CALL_NODE_TYPES:
                continue

            curr = call_node.parent
            caller_parts = []

            while curr:
                if curr.type in _FUNCTION_DEF_TYPES or curr.type in _CLASS_DEF_TYPES:
                    name_node = curr.child_by_field_name("name")
                    if name_node:
                        caller_parts.append(name_node.text.decode("utf-8"))
                curr = curr.parent

            caller_name = (
                ":".join(reversed(caller_parts)) if caller_parts else "<module>"
            )

            args = []
            argument_node = call_node.child_by_field_name(
                "arguments"
            ) or call_node.child_by_field_name("argument_list")

            if argument_node:
                for arg in argument_node.children:
                    if arg.is_named:
                        args.append(arg.text.decode("utf-8"))

            source_node_id = f"{file_id}:{caller_name}"

            relations.append(
                GraphRelation(
                    source_id=source_node_id,
                    target_id=called_name,
                    rel_type="CALLS",
                    properties={"args": args},
                )
            )

        return relations

    def extract(self):
        t0 = time.time()
        logger.info(
            f"[extract] Parsing {len(self.project_files)} files with ThreadPoolExecutor..."
        )
        max_workers = min(32, os.cpu_count() * 2 + 1)
        errors = 0
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(self._process_single_file, file_node)
                for file_node in self.project_files
            ]

            for future in concurrent.futures.as_completed(futures):
                try:
                    result = future.result()
                    if result:
                        self.processed_code.append(result)
                except Exception as exc:
                    errors += 1
                    logger.warning(f"[extract] File processing exception: {exc}")

        total_chunks = sum(len(f.chunks) for f in self.processed_code)
        total_entities = sum(len(f.entities) for f in self.processed_code)
        total_relations = sum(len(f.relations) for f in self.processed_code)
        logger.info(
            f"[extract] Done in {time.time() - t0:.2f}s — "
            f"{len(self.processed_code)} files parsed, {errors} errors | "
            f"chunks={total_chunks}, entities={total_entities}, relations={total_relations}"
        )

    def build_vectordb(self):
        t0 = time.time()
        texts = []
        metadatas = []

        for fl in self.processed_code:
            for chunk in fl.chunks:
                metadatas.append(
                    {
                        "kb_id": self.kb_id,
                        "file_path": fl.file_path,
                        "language": fl.language,
                        "start_byte": chunk.start_byte,
                        "end_byte": chunk.end_byte,
                    }
                )
                texts.append(chunk.content)

        if not texts:
            logger.warning("[vectordb] No chunks to embed — skipping Qdrant upload")
            return

        logger.info(f"[vectordb] Embedding {len(texts)} chunks...")
        vectors = self.vector_db.embeddings.embed_documents(texts)

        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vectors[j],
                payload={"page_content": texts[j], "metadata": metadatas[j]},
            )
            for j in range(len(texts))
        ]

        logger.info(f"[vectordb] Uploading {len(points)} points to Qdrant...")
        self.vector_db.client.upload_points(
            collection_name=self.vector_db.collection_name,
            points=points,
            batch_size=500,
            max_retries=3,
            wait=False,
        )

        logger.info(
            f"[vectordb] Uploaded all {len(points)} points in {time.time() - t0:.2f}s"
        )

    def build_graph(self):
        t0 = time.time()
        all_entites = []
        all_relations = []

        for code in self.processed_code:
            all_entites.extend([e.model_dump() for e in code.entities])
            all_relations.extend([r.model_dump() for r in code.relations])

        if not all_entites or not all_relations:
            logger.warning("[graph] No entities or relations to write — skipping Neo4j")
            return

        logger.info(
            f"[graph] Writing {len(all_entites)} entities and {len(all_relations)} relations to Neo4j..."
        )

        with self.driver.session() as session:
            session.run(
                "CREATE INDEX node_id_index IF NOT EXISTS FOR (n:CodeNode) ON (n.id)"
            )
            session.run(
                "CREATE INDEX node_ns_index IF NOT EXISTS FOR (n:CodeNode) ON (n.ns)"
            )
            session.run(
                "CREATE INDEX node_id_ns_index IF NOT EXISTS FOR (n:CodeNode) ON (n.id, n.ns)"
            )

            with session.begin_transaction() as tx:
                tx.run(
                    """
                        UNWIND $batch as entity
                        MERGE (n:CodeNode {id:entity.node_id, ns:$ns})
                        ON CREATE SET
                         n.name = entity.name,
                         n.kind = entity.kind
                    """,
                    batch=all_entites,
                    ns=self.kb_id,
                )

                # Insert all relations grouped by type
                for rel_type in ["CONTAINS", "CALLS", "IMPORTS", "HAS_METHOD"]:
                    specific_rel = [
                        r for r in all_relations if r["rel_type"] == rel_type
                    ]
                    if specific_rel:
                        tx.run(
                            f"""
                           UNWIND $batch as rel
                           MERGE (source:CodeNode {{id:rel.source_id, ns:$ns}})
                           MERGE (target:CodeNode {{id:rel.target_id, ns:$ns}})
                           MERGE (source)-[r:{rel_type}]->(target)
                           SET r += rel.properties
                           """,
                            batch=specific_rel,
                            ns=self.kb_id,
                        )

        logger.info(f"[graph] Neo4j write complete in {time.time() - t0:.2f}s")

    def build_kb(self):
        """
        Clones, parses, and writes all code data to Qdrant + Neo4j in parallel.
        """
        total_start = time.time()
        logger.info(
            f"[build_kb] Starting ingestion for KB: {self.kb_id} | Repo: {self.repo_url}"
        )

        t = time.time()
        self.clone()
        logger.info(f"[build_kb] clone: {time.time() - t:.2f}s")

        t = time.time()
        self.build()
        logger.info(f"[build_kb] build: {time.time() - t:.2f}s")

        t = time.time()
        self.extract()
        logger.info(f"[build_kb] extract: {time.time() - t:.2f}s")

        t = time.time()
        with ThreadPoolExecutor(max_workers=2) as executor:
            vectordb_task = executor.submit(self.build_vectordb)
            graphdb_task = executor.submit(self.build_graph)

            concurrent.futures.wait([vectordb_task, graphdb_task])

            for task in [vectordb_task, graphdb_task]:
                if task.exception():
                    exc = task.exception()
                    logger.error(f"[build_kb] Critical error in parallel write: {exc}")
                    raise exc

        logger.info(
            f"[build_kb] vectordb + graph parallel write: {time.time() - t:.2f}s"
        )
        logger.info(
            f"[build_kb] ✅ Total ingestion time: {time.time() - total_start:.2f}s"
        )
