import os

# Always skip — pure noise
ALWAYS_SKIP = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "Cargo.lock",
    "composer.lock",
    "Gemfile.lock",
    ".DS_Store",
    "Thumbs.db",
}

# Skip these directory prefixes
SKIP_DIRS = {
    "dist/",
    "build/",
    "out/",
    ".next/",
    ".nuxt/",
    "__pycache__/",
    "node_modules/",
    ".git/",
    ".idea/",
    ".vscode/",
    "coverage/",
    ".pytest_cache/",
    "src/assets",
    "public/"
    
}

# Skip these extensions
SKIP_EXTENSIONS = {
    ".min.js",
    ".min.css",
    ".bundle.js",
    ".pyc",
    ".pyo",
    ".class",
    ".o",
    ".so",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".svg",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".mp4",
    ".mp3",
    ".wav",
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


links = {
    "mistralai": "https://api.mistral.ai/v1/models",
    "openai": "https://api.openai.com/v1/models",
    "groq": "https://api.groq.com/openai/v1/models",
    "openrouter": "https://openrouter.ai/api/v1/models",
    "anthropic": "https://api.anthropic.com/v1/models",
    "huggingface": "https://router.huggingface.co/v1/models",
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
