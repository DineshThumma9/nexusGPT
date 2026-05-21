import asyncio
import os
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from dotenv import load_dotenv
from langchain_community.document_loaders import GithubFileLoader, PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from tree_sitter_language_pack import ProcessConfig, detect_language_from_path, process

from src.db.dbs import get_db
from src.db.neo4j import get_graph
from src.db.qdrant_client import vector_db
from src.db.redis_client import queue, redis
from src.models.enums import KBStatus
from src.models.models import KnowledgeBase
from src.models.schema import GitRequest, ProjectNode
from src.service.utils import (
    _extract_chunks,
    _extract_structure,
    _unpack_compiled_object,
)

load_dotenv()


async def fetch_repo(req: GitRequest) -> List[Document]:
    """Fetches the files of a Github repository by cloning it locally."""
    import os
    import subprocess
    import tempfile

    include_ext = req.file_extension_include
    exclude_ext = req.file_extension_exclude

    def file_filter(path: str) -> bool:
        if include_ext and not any(path.endswith(ext) for ext in include_ext):
            return False
        if exclude_ext and any(path.endswith(ext) for ext in exclude_ext):
            return False
        return True

    repo_url = f"https://github.com/{req.owner}/{req.repo}.git"
    branch = req.branch or "main"

    # If the user provides a token, use it for private repositories
    access_token = os.getenv("GITHUB_API_KEY") or os.getenv("GITHUB_TOKEN")
    if access_token:
        repo_url = (
            f"https://oauth2:{access_token}@github.com/{req.owner}/{req.repo}.git"
        )

    documents = []

    with tempfile.TemporaryDirectory() as temp_dir:
        # Clone the repository
        try:
            subprocess.run(
                [
                    "git",
                    "clone",
                    "--depth",
                    "1",
                    "--branch",
                    branch,
                    repo_url,
                    temp_dir,
                ],
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
                                "branch": branch,
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
    Atomically inserts data into Neo4j and Qdrant. 
    If either database write fails, both are rolled back entirely.
    """
    ns = str(kb_id)
    graph = get_graph(force_reconnect=True)
    driver = graph._driver  # Access underlying neo4j driver object

    neo4j_success = False
    qdrant_success = False

    print(f"Beginning atomic insertion for namespace: {ns}...")

    # Use an explicit Neo4j session to handle multi-statement atomic transactions
    with driver.session() as session:
        # Start a formal transaction block
        tx = session.begin_transaction()
        try:
            # ====================================================
            # 1. NEO4J TRANSACTION (Staged in memory)
            # ====================================================
            print("Staging Neo4j transactions...")

            if batch_directories:
                tx.run(
                    """
                    UNWIND $data AS row
                    MERGE (d:Directory {id: row.id, ns: $ns})
                    ON CREATE SET d.name = row.name
                    """,
                    {"data": [{"id": d[0], "name": d[1]} for d in batch_directories], "ns": ns},
                )

            if batch_dir_relations:
                tx.run(
                    """
                    UNWIND $data AS row
                    MERGE (parent:Directory {id: row.parent, ns: $ns})
                    MERGE (child:Directory {id: row.child, ns: $ns})
                    MERGE (parent)-[:CONTAINS]->(child)
                    """,
                    {"data": [{"parent": r[0], "child": r[1]} for r in batch_dir_relations], "ns": ns},
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

            # Commit the Neo4j staging data. If this fails, code falls to the except block
            tx.commit()
            neo4j_success = True
            print("Neo4j Commit Successful.")

            # ====================================================
            # 2. QDRANT VECTOR INSERTION (With rollback defense)
            # ====================================================
            if ast_docs:
                print(f"Upserting {len(ast_docs)} code chunks into Qdrant for namespace {ns}...")
                
                for doc in ast_docs:
                    doc.metadata["kb_id"] = ns

                batch_size = 175
                for i in range(0, len(ast_docs), batch_size):
                    batch = ast_docs[i : i + batch_size]
                    vector_db.add_documents(batch)
                    print(f"Indexed batch {i // batch_size + 1}...")

            qdrant_success = True
            print("Qdrant Vector Insertion Complete! Transaction finished cleanly.")

        except Exception as e:
            print(f"CRITICAL: Atomic insertion failed due to error: {e}")
            
            # --- ROLLBACK HANDLING ---
            if not neo4j_success:
                print("Rolling back Neo4j transaction...")
                try:
                    tx.rollback()
                except Exception as tx_err:
                    print(f"Failed rolling back Neo4j active transaction: {tx_err}")
            else:
                # If Neo4j succeeded but Qdrant failed, we must purge what Neo4j committed
                print("Neo4j committed, but Qdrant failed. Purging Neo4j data for namespace...")
                try:
                    with driver.session() as rollback_session:
                        rollback_session.run(
                            "MATCH (n {ns: $ns}) DETACH DELETE n", 
                            {"ns": ns}
                        )
                    print("Neo4j data purged successfully.")
                except Exception as purge_err:
                    print(f"DANGER: Failed to purge Neo4j data after Qdrant crash: {purge_err}")

            if not qdrant_success and ast_docs:
                print("Purging partial vectors uploaded to Qdrant...")
                try:
                    from qdrant_client.http import models as rest_models
                    
                    # Target only the points belonging to this knowledge base ID payload
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
                    print("Qdrant partial data purged successfully.")
                except Exception as qd_err:
                    print(f"DANGER: Failed to clear partial Qdrant records: {qd_err}")

            # Reraise exception to inform upstream worker/orchestrator of pipeline failure
            raise e
            
# ====================================================
# CELERY BACKGROUND TASKS (Redis Broker & Backend)
# ====================================================
