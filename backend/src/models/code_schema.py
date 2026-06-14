from typing import Any, Dict, List, Literal, Optional, Set

from pydantic import BaseModel, Field, field_validator
from typing_extensions import TypedDict

CommentKind = Literal["line", "block", "doc"]
DiagnosticSeverity = Literal["error", "warning", "info"]
ExportKind = Literal["named", "default", "re_export"]
StructureKind = str
DocstringFormat = str
SymbolKind = str


class Span(BaseModel):
    """Byte and line/column range in source code."""

    start_byte: int = 0
    end_byte: int = 0
    start_line: int = 0
    start_column: int = 0
    end_line: int = 0
    end_column: int = 0


class FileMetrics(BaseModel):
    """Aggregate metrics for a source file."""

    total_lines: int = 0
    code_lines: int = 0
    comment_lines: int = 0
    blank_lines: int = 0
    total_bytes: int = 0
    node_count: int = 0
    error_count: int = 0
    max_depth: int = 0


class StructureItem(BaseModel):
    """A structural item (function, class, struct, etc.) in source code."""

    kind: Optional[StructureKind] = None
    name: Optional[str] = None
    visibility: Optional[str] = None
    span: Optional[Span] = None
    children: List["StructureItem"] = Field(default_factory=list)
    decorators: List[str] = Field(default_factory=list)
    doc_comment: Optional[str] = None
    signature: Optional[str] = None
    body_span: Optional[Span] = None
    bases: List[str] = Field(default_factory=list)


class CommentInfo(BaseModel):
    """A comment extracted from source code."""

    text: str = ""
    kind: Optional[CommentKind] = "line"
    span: Optional[Span] = None
    associated_node: Optional[str] = None

    @field_validator("kind", mode="before")
    @classmethod
    def normalize_kind(cls, v):
        return v.lower() if isinstance(v, str) else v


class DocstringInfo(BaseModel):
    """A docstring extracted from source code."""

    text: str = ""
    format: Optional[DocstringFormat] = None
    span: Optional[Span] = None
    associated_item: Optional[str] = None
    parsed_sections: List["DocSection"] = Field(default_factory=list)


class DocSection(BaseModel):
    """A section within a docstring (e.g., Args, Returns, Raises)."""

    kind: str = ""
    name: Optional[str] = None
    description: str = ""


class ImportInfo(BaseModel):
    """An import statement extracted from source code."""

    source: str = ""
    items: List[str] = Field(default_factory=list)
    alias: Optional[str] = None
    is_wildcard: bool = False
    span: Optional[Span] = None


class ExportInfo(BaseModel):
    """An export statement extracted from source code."""

    name: Optional[str] = None
    kind: Optional[ExportKind] = "named"
    span: Optional[Span] = None

    @field_validator("kind", mode="before")
    @classmethod
    def normalize_kind(cls, v):
        return v.lower() if isinstance(v, str) else v


class SymbolInfo(BaseModel):
    """A symbol (variable, function, type, etc.) extracted from source code."""

    name: str = ""
    kind: Optional[SymbolKind] = None
    span: Optional[Span] = None
    type_annotation: Optional[str] = None
    doc: Optional[str] = None
    file_path: Optional[str] = None
    line: Optional[int] = None
    bases: List[Optional[str]] = []
    rust_info: Optional[Dict[str, Set[str]]] = None


class Diagnostic(BaseModel):
    """A diagnostic (syntax error, missing node, etc.) from parsing."""

    message: str = ""
    severity: Optional[DiagnosticSeverity] = "error"
    span: Optional[Span] = None

    @field_validator("severity", mode="before")
    @classmethod
    def normalize_severity(cls, v):
        return v.lower() if isinstance(v, str) else v


class ChunkContext(BaseModel):
    """Metadata for a single chunk of source code."""

    language: str = ""
    chunk_index: int = 0
    total_chunks: int = 0
    node_types: List[str] = Field(default_factory=list)
    context_path: List[str] = Field(default_factory=list)
    symbols_defined: List[str] = Field(default_factory=list)
    comments: List[CommentInfo] = Field(default_factory=list)
    docstrings: List[DocstringInfo] = Field(default_factory=list)
    has_error_nodes: bool = False


class FunctionDef(StructureItem):
    """A function definition extracted from source code."""

    args: List[Optional[str]] = []
    is_dependency: bool = False
    return_type: Optional[str] = None
    cyclomatic_complexity: Optional[int] = None


class ClassDef(StructureItem):
    """A class definition extracted from source code."""


class Variables(SymbolInfo):
    """A variable definition extracted from source code."""


class FunctionCalls(BaseModel):
    """A function call extracted from source code."""

    caller: str
    calling: str
    args: Optional[List[str]] = []
    return_type: Optional[str] = None
    span: Optional[Span] = None
    caller_file: Optional[str] = None
    calle_file: Optional[str] = None
    ref_line: Optional[int] = None
    typeCall: Literal["Module-level", "Function-Level"] = Field(
        default="Function-Level"
    )


class CodeChunk(BaseModel):
    """A chunk of source code with rich metadata."""

    content: str = ""
    start_byte: int = 0
    end_byte: int = 0
    start_line: int = 0
    end_line: int = 0
    metadata: Optional[ChunkContext] = None


class ProcessResult(BaseModel):
    """Complete analysis result from processing a source file."""

    language: str = ""
    metrics: FileMetrics = Field(default_factory=FileMetrics)
    structure: List[StructureItem] = Field(default_factory=list)
    imports: List[ImportInfo] = Field(default_factory=list)
    exports: List[ExportInfo] = Field(default_factory=list)
    comments: List[CommentInfo] = Field(default_factory=list)
    docstrings: List[DocstringInfo] = Field(default_factory=list)
    symbols: List[SymbolInfo] = Field(default_factory=list)
    diagnostics: List[Diagnostic] = Field(default_factory=list)
    chunks: List[CodeChunk] = Field(default_factory=list)
    functionCalls: List[FunctionCalls] = Field(default_factory=list)


class ScipParseResult(TypedDict):
    files: Dict[str, "ProcessedCode"]
    symbol_table: Dict[str, SymbolInfo]


class ProcessedCode(BaseModel):
    path: str = ""
    language: str = ""
    classes: List[ClassDef] = Field(default_factory=list)
    functions: List[FunctionDef] = Field(default_factory=list)
    variables: List[Variables] = Field(default_factory=list)
    imports: List[ImportInfo] = Field(default_factory=list)
    exports: List[ExportInfo] = Field(default_factory=list)
    comments: List[CommentInfo] = Field(default_factory=list)
    docstrings: List[DocstringInfo] = Field(default_factory=list)
    chunks: List[CodeChunk] = Field(default_factory=list)
    functionCalls: List[FunctionCalls] = Field(default_factory=list)
    moduleCalls: List[FunctionCalls] = Field(default_factory=list)
    interfaces: List[StructureItem] = Field(default_factory=list)
    enums: List[StructureItem] = Field(default_factory=list)
    structs: List[StructureItem] = Field(default_factory=list)
    traits: List[StructureItem] = Field(default_factory=list)


class GraphEntity(BaseModel):
    node_id: str
    name: str
    kind: str  # e.g., "Class", "Function", "Method", "File"
    parent_id: Optional[str] = None


class GraphRelation(BaseModel):
    source_id: str
    target_id: str
    rel_type: str  # e.g., "IMPORTS", "CALLS", "CONTAINS", "HAS_METHOD"
    properties: Dict[str, Any] = Field(default_factory=dict)


class FileParseResult(BaseModel):
    file_path: str
    language: str
    content: str
    chunks: List[Any] = []  # Store your text/code chunks here for Qdrant
    entities: List[GraphEntity] = []
    relations: List[GraphRelation] = []
