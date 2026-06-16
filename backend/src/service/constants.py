import os

# Always skip — pure noise
ALWAYS_SKIP = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "poetry.lock",
    "Pipfile.lock",
    "Cargo.lock",
    "composer.lock",
    "Gemfile.lock",
    "mix.lock",
    ".DS_Store",
    "Thumbs.db",
}

# Skip these directory prefixes
SKIP_DIRS = {
    "dist",
    "build",
    "out",
    "target",
    "bin",
    "obj",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".expo",
    ".angular",
    "__pycache__",
    "node_modules",
    "vendor",
    ".venv",
    "venv",
    "env",
    ".tox",
    ".git",
    ".idea",
    ".vscode",
    ".gemini",
    ".agents",
    ".claude",
    ".cursor",
    "coverage",
    ".pytest_cache",
    "public",
    "static",
}

# Skip these extensions
SKIP_EXTENSIONS = {
    # Minified / Bundles
    ".min.js",
    ".min.css",
    ".bundle.js",
    ".map",  # sourcemaps
    # Compiled binaries
    ".pyc",
    ".pyo",
    ".class",
    ".o",
    ".so",
    ".dll",
    ".exe",
    ".bin",
    # Media & Assets
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".svg",
    ".webp",
    ".tiff",
    # Fonts
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    # Archives & Databases
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".sqlite",
    ".sqlite3",
    ".db",
    # Audio/Video
    ".mp4",
    ".webm",
    ".avi",
    ".mov",
    ".mp3",
    ".wav",
    # Logs
    ".log",
}

# Parse these as plain text (skip tree-sitter, store as single chunk)
PARSE_AS_TEXT = {
    "package.json",
    "tsconfig.json",
    "tsconfig.base.json",
    "vite.config.ts",
    "vite.config.js",
    "webpack.config.js",
    "rollup.config.js",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
    ".env.example",
    "requirements.txt",
    "pyproject.toml",
    "go.mod",
    "Cargo.toml",
    ".eslintrc.json",  # borderline but small
}


_VALIDATION_URLS: dict[str, str] = {
    "groq": "https://api.groq.com/openai/v1/models",
    "openai": "https://api.openai.com/v1/models",
    "anthropic": "https://api.anthropic.com/v1/models",
    "mistralai": "https://api.mistral.ai/v1/models",
    "openrouter": "https://openrouter.ai/api/v1/models",
    "google_genai": "https://generativelanguage.googleapis.com/v1beta/models",
    "huggingface": "https://router.huggingface.co/v1/models",
}


api_keys = {
    "mistralai": os.getenv("MISTRAL_API_KEY"),
    "openai": os.getenv("OPENAI_API_KEY"),
    "groq": os.getenv("GROQ_API_KEY"),
    "openrouter": os.getenv("OPENROUTER_API_KEY"),
    "huggingface": os.getenv("HF_TOKEN"),
}

VALID_PROVIDERS = list(_VALIDATION_URLS.keys())

CHUNK_SIZE_BY_LANGUAGE = {
    "python": 1500,  # dense, functions self-contained
    "javascript": 1500,  # components self-contained
    "typescript": 1500,
    "java": 2000,  # verbose, needs more context per chunk
    "cpp": 2500,  # large functions, macros need context
    "c": 2500,
    "go": 1200,  # small functions by convention
    "rust": 1800,
}


_IGNORED_CALLS_BY_LANG = {
    "python": {
        "dict",
        "str",
        "int",
        "list",
        "set",
        "len",
        "print",
        "Exception",
        "super",
        "range",
        "enumerate",
        "zip",
        "type",
        "isinstance",
        "getattr",
        "setattr",
    },
    "javascript": {
        "console",
        "require",
        "setTimeout",
        "setInterval",
        "clearTimeout",
        "clearInterval",
        "Error",
        "String",
        "Number",
        "Boolean",
        "Object",
        "Array",
        "Promise",
    },
    "typescript": {
        "console",
        "require",
        "setTimeout",
        "setInterval",
        "clearTimeout",
        "clearInterval",
        "Error",
        "String",
        "Number",
        "Boolean",
        "Object",
        "Array",
        "Promise",
    },
    "go": {
        "make",
        "new",
        "len",
        "cap",
        "append",
        "copy",
        "delete",
        "panic",
        "recover",
        "close",
        "complex",
        "real",
        "imag",
        "print",
        "println",
    },
    "java": {
        "System",
        "String",
        "Integer",
        "Double",
        "Boolean",
        "Object",
        "Math",
        "Exception",
        "RuntimeException",
        "super",
        "this",
    },
    "cpp": {
        "std",
        "printf",
        "cout",
        "cin",
        "endl",
        "sizeof",
        "strlen",
        "malloc",
        "free",
        "new",
        "delete",
    },
    "rust": {
        "Some",
        "None",
        "Ok",
        "Err",
        "println",
        "print",
        "format",
        "panic",
        "vec",
        "String",
        "drop",
        "clone",
        "Into",
        "From",
    },
    "ruby": {
        "puts",
        "print",
        "p",
        "require",
        "include",
        "extend",
        "raise",
        "fail",
        "catch",
        "throw",
        "loop",
        "proc",
        "lambda",
    },
}

# A strict fallback for meaningless single/double-letter node captures that happen across all languages
_UNIVERSAL_IGNORED = {
    "e",
    "t",
    "i",
    "j",
    "k",
    "v",
    "err",
    "val",
    "cb",
    "fn",
    "id",
    "it",
}


_CLASS_DEF_TYPES = {
    "class_definition",  # Python
    "class_declaration",  # JS/TS, Java, C#, C++
    "class",  # Ruby
    "struct_item",  # Rust
    "type_declaration",  # Go
}

# Add common built-ins or garbage names you want to keep out of your graph
_IGNORED_CALLS = {
    "dict",
    "str",
    "int",
    "list",
    "set",
    "len",
    "print",
    "Exception",
    "super",
    "range",
    "enumerate",
    "zip",
    "type",
    "isinstance",
    "getattr",
    "setattr",
}


_INTERMEDIATE_TYPES = {
    "attribute",
    "member_expression",
    "selector_expression",
    "field_expression",
    "field_access",
    "scoped_identifier",
    "qualified_identifier",
}


# Maps file extension → (language name, scip CLI binary name, install hint, docker image)
EXTENSION_TO_SCIP = {
    ".py": (
        "python",
        "scip-python",
        "pip install scip-python",
        "sourcegraph/scip-python",
    ),
    ".ipynb": (
        "python",
        "scip-python",
        "pip install scip-python",
        "sourcegraph/scip-python",
    ),
    ".ts": (
        "typescript",
        "scip-typescript",
        "npm install -g @sourcegraph/scip-typescript",
        "sourcegraph/scip-typescript",
    ),
    ".tsx": (
        "typescript",
        "scip-typescript",
        "npm install -g @sourcegraph/scip-typescript",
        "sourcegraph/scip-typescript",
    ),
    ".js": (
        "javascript",
        "scip-typescript",
        "npm install -g @sourcegraph/scip-typescript",
        "sourcegraph/scip-typescript",
    ),
    ".jsx": (
        "javascript",
        "scip-typescript",
        "npm install -g @sourcegraph/scip-typescript",
        "sourcegraph/scip-typescript",
    ),
    ".mjs": (
        "javascript",
        "scip-typescript",
        "npm install -g @sourcegraph/scip-typescript",
        "sourcegraph/scip-typescript",
    ),
    ".cjs": (
        "javascript",
        "scip-typescript",
        "npm install -g @sourcegraph/scip-typescript",
        "sourcegraph/scip-typescript",
    ),
    ".go": (
        "go",
        "scip-go",
        "go install github.com/sourcegraph/scip-go/...@latest",
        "sourcegraph/scip-go",
    ),
    ".rs": ("rust", "scip-rust", "cargo install scip-rust", "sourcegraph/scip-rust"),
    ".java": (
        "java",
        "scip-java",
        "see https://github.com/sourcegraph/scip-java",
        "sourcegraph/scip-java",
    ),
    ".kt": (
        "kotlin",
        "scip-java",
        "see https://github.com/sourcegraph/scip-java",
        "sourcegraph/scip-java",
    ),
    ".scala": (
        "scala",
        "scip-java",
        "see https://github.com/sourcegraph/scip-java",
        "sourcegraph/scip-java",
    ),
    ".dart": ("dart", "scip_dart", "dart pub global activate scip_dart", "dart:stable"),
    ".cpp": (
        "cpp",
        "scip-clang",
        "brew install llvm",
        "sourcegraph/scip-clang:sha-1704d3d",
    ),
    ".hpp": (
        "cpp",
        "scip-clang",
        "brew install llvm",
        "sourcegraph/scip-clang:sha-1704d3d",
    ),
    ".c": (
        "c",
        "scip-clang",
        "brew install llvm",
        "sourcegraph/scip-clang:sha-1704d3d",
    ),
    ".h": (
        "cpp",
        "scip-clang",
        "brew install llvm",
        "sourcegraph/scip-clang:sha-1704d3d",
    ),
    ".cs": (
        "csharp",
        "scip-dotnet",
        "dotnet tool install -g Microsoft.CodeAnalysis.ScipDotnet",
        "sourcegraph/scip-dotnet",
    ),
    ".php": (
        "php",
        "scip-php",
        "composer global require davidrjenni/scip-php",
        "davidrjenni/scip-php",
    ),
    ".rb": ("ruby", "scip-ruby", "gem install scip-ruby", ""),
    ".swift": ("swift", "scip-swift", "brew install scip-swift", ""),
    ".ex": (
        "elixir",
        "scip-ctags",
        "go install github.com/sourcegraph/scip-ctags/cmd/scip-ctags@latest",
        "sourcegraph/scip-ctags",
    ),
    ".exs": (
        "elixir",
        "scip-ctags",
        "go install github.com/sourcegraph/scip-ctags/cmd/scip-ctags@latest",
        "sourcegraph/scip-ctags",
    ),
    ".hs": (
        "haskell",
        "scip-ctags",
        "go install github.com/sourcegraph/scip-ctags/cmd/scip-ctags@latest",
        "sourcegraph/scip-ctags",
    ),
    ".lua": (
        "lua",
        "scip-ctags",
        "go install github.com/sourcegraph/scip-ctags/cmd/scip-ctags@latest",
        "sourcegraph/scip-ctags",
    ),
    ".pl": (
        "perl",
        "scip-ctags",
        "go install github.com/sourcegraph/scip-ctags/cmd/scip-ctags@latest",
        "sourcegraph/scip-ctags",
    ),
    ".pm": (
        "perl",
        "scip-ctags",
        "go install github.com/sourcegraph/scip-ctags/cmd/scip-ctags@latest",
        "sourcegraph/scip-ctags",
    ),
}


# Capture names that identify the *called function name* node (an identifier).
# Whole-node captures like @call_node / @args are excluded.
_NAME_CAPTURES = {"name", "function_name", "method_name", "scoped_name"}

# Call-site node types across all supported tree-sitter grammars.
_CALL_NODE_TYPES = {
    "call",  # Python, Ruby
    "call_expression",  # JS/TS, Go, C, C++, Rust
    "method_invocation",  # Java, C#, Kotlin
    "object_creation_expression",  # Java
    "new_expression",  # JS/TS
    "invocation_expression",  # C#
    "macro_invocation",  # Rust
}

# Function/method definition node types used to find the enclosing caller.
_FUNCTION_DEF_TYPES = {
    "function_definition",  # Python, C, C++
    "function_declaration",  # JS/TS, Go, Rust
    "method_definition",  # JS/TS
    "method_declaration",  # Java, C#, Kotlin
    "method",  # Ruby
    "constructor_declaration",  # Java, C#
    "arrow_function",  # JS/TS
    "function_item",  # Rust
    "func_literal",  # Go
}
