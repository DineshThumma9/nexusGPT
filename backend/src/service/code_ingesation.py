import concurrent
import os
import subprocess
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from time import time
from typing import Dict, List

from dotenv import load_dotenv
from langchain_core.documents import Document
from loguru import logger
from qdrant_client.models import PointStruct
from tenacity import retry, stop_after_attempt, wait_exponential
from tree_sitter_language_pack import ProcessConfig, detect_language_from_path, process

from src.db.neo4j import get_graph
from src.db.qdrant_client import vector_db
from src.models.schema import GitRequest, ProjectNode
from src.service.utils import (
    _extract_chunks,
    _extract_structure,
    _unpack_compiled_object,
)

load_dotenv()


async def fetch_repo(req: GitRequest) -> List[Document]:
    """Fetches the files of a Github repository by cloning it locally."""

    include_ext = req.file_extension_include
    exclude_ext = req.file_extension_exclude

    def file_filter(path: str) -> bool:
        if include_ext and not any(path.endswith(ext) for ext in include_ext):
            return False
        if exclude_ext and any(path.endswith(ext) for ext in exclude_ext):
            return False
        return True

    repo_url = f"https://github.com/{req.owner}/{req.repo}.git"
    # If the user provides a token, use it for private repositories
    access_token = req.token or os.getenv("GITHUB_API_KEY") or os.getenv("GITHUB_TOKEN")
    if access_token:
        repo_url = (
            f"https://oauth2:{access_token}@github.com/{req.owner}/{req.repo}.git"
        )

    documents = []

    with tempfile.TemporaryDirectory() as temp_dir:
        # Clone the repository
        try:
            clone_cmd = ["git", "clone", "--depth", "1"]
            if req.branch:
                clone_cmd.extend(["--branch", req.branch])
            clone_cmd.extend([repo_url, temp_dir])

            subprocess.run(
                clone_cmd,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            print(f"Git clone failed: {e.stderr}")
            raise RuntimeError(f"Failed to clone repository: {e.stderr}")

        # Walk through the directory and load files
        for root, _, files in os.walk(temp_dir):
            if ".git" in root:
                continue
            for file in files:
                file_path = os.path.join(root, file)
                # Calculate relative path as it would appear in GithubFileLoader
                rel_path = os.path.relpath(file_path, temp_dir)

                if not file_filter(rel_path):
                    continue

                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()

                    documents.append(
                        Document(
                            page_content=content,
                            metadata={
                                "source": rel_path,
                                "path": rel_path,
                                "repo": f"{req.owner}/{req.repo}",
                                "branch": req.branch or "default",
                            },
                        )
                    )
                except Exception as e:
                    print(f"Skipping unreadable file {rel_path}: {e}")

    return documents


def build_hierarchy(documents: List[Document]) -> Dict[str, ProjectNode]:
    """Parses raw document objects and builds a scannable directory hierarchy."""
    enriched_docs = dict()

    for doc in documents:
        source = doc.metadata.get("source", "")
        # Normalize file path from source URL/string
        path = source
        if "/blob/" in source:
            parts = source.split("/blob/")
            if len(parts) > 1:
                subparts = parts[1].split("/", 1)
                if len(subparts) > 1:
                    path = subparts[1]

        parts = path.split("/")
        filename = parts[-1]

        # Collect directories in the path
        dirs = []
        for i in range(len(parts) - 1):
            dir_path = "/".join(parts[: i + 1])
            dirs.append(dir_path)

        parent_dir = dirs[-1] if dirs else ""

        enriched_docs[source] = ProjectNode(
            file_path=path,
            content=doc.page_content,
            filename=filename,
            parent_dir=parent_dir,
            dirs=dirs,
        )

    return enriched_docs


def build_relation_and_index(enriched_docs: Dict[str, ProjectNode]):
    """Analyzes AST and imports to prepare relational records for Neo4j and code chunks for Qdrant."""
    ast_docs = []
    batch_directories = set()
    batch_dir_relations = set()
    batch_files = []
    batch_file_dir_relations = []
    batch_imports = []
    batch_symbols = []

    for idx, (path, project_file) in enumerate(enriched_docs.items()):
        print(f"Processing path: {project_file.file_path} (idx: {idx})")

        # 1. Collect Directory Hierarchy
        for i, dir_path in enumerate(project_file.dirs):
            batch_directories.add((dir_path, dir_path.split("/")[-1]))
            if i > 0:
                batch_dir_relations.add((project_file.dirs[i - 1], dir_path))

        # 2. Collect File Node
        batch_files.append(
            {"path": project_file.file_path, "filename": project_file.filename}
        )
        if project_file.parent_dir:
            batch_file_dir_relations.append(
                {"parent": project_file.parent_dir, "child": project_file.file_path}
            )

        # 3. AST & Code Parsing
        lang_name = detect_language_from_path(project_file.file_path)
        if not lang_name:
            continue

        config = ProcessConfig(
            language=lang_name, structure=True, imports=True, chunk_max_size=1000
        )
        try:
            result = process(project_file.content, config)
        except Exception as e:
            print(
                f"Skipping AST parsing for {project_file.file_path} due to error: {e}"
            )
            continue

        raw_bytes = project_file.content.encode("utf-8")

        # 4. Collect Imports
        for imp in result.imports:
            target = (
                imp.get("source")
                if isinstance(imp, dict)
                else getattr(imp, "source", None)
            )
            if target:
                batch_imports.append({"path": project_file.file_path, "target": target})

        # 5. Collect Code Chunks
        for chunk in result.chunks:
            chunkdic = _extract_chunks(chunk)
            content = chunkdic["content"]
            metadata = {
                **chunkdic["metadata"],
                "start_line": chunkdic["start_line"],
                "end_line": chunkdic["end_line"],
                "start_byte": chunkdic["start_byte"],
                "end_byte": chunkdic["end_byte"],
                "source": project_file.file_path,
            }
            ast_docs.append(Document(page_content=content, metadata=metadata))

        # 6. Collect Structure / Symbols
        all_structures = _extract_structure(result.structure)
        for struct in all_structures:
            raw_kind = (
                struct.get("kind")
                if isinstance(struct, dict)
                else getattr(struct, "kind", "symbol")
            )

            if isinstance(raw_kind, dict) and raw_kind:
                kind = list(raw_kind.keys())[0].lower()
            else:
                kind = str(raw_kind).split(".")[-1].lower()
                if "{" in kind:
                    kind = "symbol"

            struct_dict = _unpack_compiled_object(struct, raw_source=raw_bytes)
            name = struct_dict.get("name") or "anonymous"

            if name and name != "anonymous":
                batch_symbols.append(
                    {
                        "path": project_file.file_path,
                        "node_id": f"{project_file.file_path}::{name}",
                        "name": name,
                        "kind": kind,
                    }
                )

    return (
        batch_files,
        batch_file_dir_relations,
        batch_directories,
        batch_dir_relations,
        batch_imports,
        batch_symbols,
        ast_docs,
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=16, min=2))
def _insert_to_vectordb(kb_id, ast_docs):
    ns = str(kb_id)
    print(f"Beginning insertion for namespace: {ns}...")

    if not ast_docs:
        return

    print(f"Fetching cloud embeddings for {len(ast_docs)} chunks...")

    start = time()
    start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    texts = [doc.page_content for doc in ast_docs]
    metadatas = [{**doc.metadata, "kb_id": ns} for doc in ast_docs]

    dense_vectors = vector_db.embeddings.embed_documents(texts)

    points = []
    for i in range(len(texts)):
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=dense_vectors[i],
                payload={"page_content": texts[i], "metadata": metadatas[i]},
            )
        )

    end = time()

    print(
        f"Going to start uplodation parsing done {end - start} started at :{start_time}"
    )

    print("Native upload to Qdrant (wait=False)...")

    start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # 4. Fire-and-forget native upload

    start = time()
    batch_size = 500

    vector_db.client.upload_points(
        collection_name=vector_db.collection_name,
        points=points,
        batch_size=batch_size,
        wait=False,
        max_retries=3,
    )

    end = time()
    print(
        f"Qdrant Vector Insertion Complete! in {end - start} started at :{start_time}"
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=16, min=2))
def _insert_to_graphdb(
    kb_id,
    batch_directories,
    batch_dir_relations,
    batch_files,
    batch_file_dir_relations,
    batch_imports,
    batch_symbols,
):

    ns = str(kb_id)
    graph = get_graph(force_reconnect=True)
    driver = graph._driver

    start = time()
    start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print("Executing Neo4j transactions...")

    with driver.session() as session:
        with session.begin_transaction() as tx:
            if batch_directories:
                tx.run(
                    """
                        UNWIND $data AS row
                        MERGE (d:Directory {id: row.id, ns: $ns})
                        ON CREATE SET d.name = row.name
                        """,
                    {
                        "data": [{"id": d[0], "name": d[1]} for d in batch_directories],
                        "ns": ns,
                    },
                )

            if batch_dir_relations:
                tx.run(
                    """
                        UNWIND $data AS row
                        MERGE (parent:Directory {id: row.parent, ns: $ns})
                        MERGE (child:Directory {id: row.child, ns: $ns})
                        MERGE (parent)-[:CONTAINS]->(child)
                        """,
                    {
                        "data": [
                            {"parent": r[0], "child": r[1]} for r in batch_dir_relations
                        ],
                        "ns": ns,
                    },
                )

            if batch_files:
                tx.run(
                    """
                        UNWIND $files AS f
                        MERGE (file:File {id: f.path, ns: $ns})
                        ON CREATE SET file.name = f.filename
                        """,
                    {"files": batch_files, "ns": ns},
                )

            if batch_file_dir_relations:
                tx.run(
                    """
                        UNWIND $rels AS r
                        MERGE (d:Directory {id: r.parent, ns: $ns})
                        MERGE (f:File {id: r.child, ns: $ns})
                        MERGE (d)-[:CONTAINS]->(f)
                        """,
                    {"rels": batch_file_dir_relations, "ns": ns},
                )

            if batch_imports:
                tx.run(
                    """
                        UNWIND $imports AS i
                        MERGE (f:File {id: i.path, ns: $ns})
                        MERGE (m:Module {id: i.target, name: i.target, ns: $ns})
                        MERGE (f)-[:IMPORTS]->(m)
                        """,
                    {"imports": batch_imports, "ns": ns},
                )

            if batch_symbols:
                tx.run(
                    """
                        UNWIND $symbols AS s
                        MERGE (f:File {id: s.path, ns: $ns})
                        MERGE (sym:Symbol {id: s.node_id, ns: $ns})
                        ON CREATE SET sym.name = s.name, sym.type = s.kind
                        MERGE (f)-[:CONTAINS]->(sym)
                        """,
                    {"symbols": batch_symbols, "ns": ns},
                )

    end = time()
    print(
        f"Neo4j insertion + graph construction = {end - start} seconds started at :{start_time}"
    )


def insert_to_databases(
    kb_id: str,
    batch_directories,
    batch_dir_relations,
    batch_files,
    batch_file_dir_relations,
    batch_imports,
    batch_symbols,
    ast_docs,
):
    """
    Atomically inserts data into Qdrant first, then Neo4j.
    If Neo4j fails, Qdrant insertion is rolled back.
    """
    ns = str(kb_id)
    get_graph(force_reconnect=True)

    with ThreadPoolExecutor(max_workers=2) as executor:
        vectordb_task = executor.submit(_insert_to_vectordb, ns, ast_docs)
        graphdb_task = executor.submit(
            _insert_to_graphdb,
            kb_id,
            batch_directories,
            batch_dir_relations,
            batch_files,
            batch_file_dir_relations,
            batch_imports,
            batch_symbols,
        )

        done, not_done = concurrent.futures.wait(
            [vectordb_task, graphdb_task],
            return_when=concurrent.futures.FIRST_EXCEPTION,
        )

        error_to_raise = None
        for future in done:
            try:
                future.result()
            except Exception as e:
                logger.info(f"Critical Error e :{e}")
                error_to_raise = e

    if error_to_raise:
        if ast_docs:
            print("Rolling back Qdrant insertion...")
            try:
                from qdrant_client.http import models as rest_models

                vector_db.client.delete(
                    collection_name=vector_db.collection_name,
                    points_selector=rest_models.Filter(
                        must=[
                            rest_models.FieldCondition(
                                key="metadata.kb_id",
                                match=rest_models.MatchValue(value=ns),
                            )
                        ]
                    ),
                )
                print("Qdrant data purged successfully.")
            except Exception as qd_err:
                print(f"DANGER: Failed to clear Qdrant records: {qd_err}")

        raise error_to_raise


# ====================================================
# CELERY BACKGROUND TASKS (Redis Broker & Backend)
# ====================================================
