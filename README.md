<div align="center">

# 🧠 NexusGPT

**An Agentic RAG Platform for Codebase Intelligence**

*Ingest entire repositories. Traverse their architecture. Ask anything.*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Caddy](https://img.shields.io/badge/Caddy-Reverse%20Proxy-1F88C0?style=flat-square&logo=caddy&logoColor=white)](https://caddyserver.com/)
[![AWS EC2](https://img.shields.io/badge/AWS-EC2-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/ec2/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## 📖 Overview

NexusGPT is a full-stack, production-grade agentic RAG (Retrieval-Augmented Generation) platform built for deep codebase understanding. It ingests entire GitHub repositories, parses their Abstract Syntax Trees (AST) using **Tree-sitter**, builds a knowledge graph in **Neo4j**, indexes semantic chunks in **Qdrant**, and exposes an intelligent LangGraph agent that can traverse, reason, and answer complex questions about your code.

Unlike generic chatbots, NexusGPT understands *structure* — it knows which functions call which, which modules depend on what, and how data flows through your system.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔍 **Dual RAG** | Combines graph-traversal (Neo4j) and semantic similarity (Qdrant) for grounded, precise answers |
| 🌐 **Web Search** | Real-time web augmentation for questions that go beyond the indexed codebase |
| 🤖 **Multi LLM Provider** | Switch between OpenAI, Anthropic, Groq, and other providers at runtime |
| 🔌 **MCP Support** | Connect Model Context Protocol (MCP) servers via SSE for extensible, plugin-style tool access |
| ⚡ **Streaming Responses** | Server-Sent Events (SSE) deliver token-by-token streaming directly to the UI |
| 🌳 **SCIP Indexing** | Uses SCIP for high-fidelity symbol resolution and accurate cross-references |
| 📊 **Full Observability** | Sentry error tracking + LangSmith agent traces for complete production insight |
| 🔒 **Rate Limiting** | SlowAPI protects all endpoints from abuse |
| 🚀 **Background Ingestion** | Celery workers handle repo cloning and parsing asynchronously |

---

## 🏗️ Architecture


![AWS EC2 Deployment Pipeline](./AWS%20EC2%20Deployment%20Pipeline.svg)


All services orchestrated via **Docker Compose**, deployed on **AWS EC2**. Load testing was conducted using **Locust** to ensure system stability and performance under heavy traffic.

---

## 🛠️ Tech Stack

### Frontend

| Technology | Role |
|---|---|
| **React 18** (Vite) | UI framework — fast HMR, lightning builds |
| **Shadcn UI** | Component library — accessible, customizable, and beautifully designed |
| **Zustand** | Lightweight global state management |
| **Axios** | HTTP client — interceptors, auth headers, error handling |
| **Shiki** | Accurate, theme-aware syntax highlighting via Shiki + CodeBlock |

### Backend

| Technology | Role |
|---|---|
| **FastAPI** | Async web framework — OpenAPI docs, dependency injection, SSE |
| **LangChain** | LLM abstraction layer — chains, prompts, tool calling |
| **LangGraph** | Stateful agentic workflows — cycles, conditional edges, checkpoints |
| **Celery** | Distributed background task queue for repo ingestion |
| **httpx** | Async HTTP client for external API calls (GitHub, LLM providers) |
| **Pydantic v2** | Schema validation, serialization, and settings management |
| **SQLModel** | Pydantic-native ORM models — unifies schema and table definition |
| **SQLAlchemy** | Async ORM engine — `AsyncSession`, connection pooling, migrations |
| **SlowAPI** | Rate limiting middleware for FastAPI endpoints |
| **Sentry SDK** | Error tracking, performance monitoring, and alerting |
| **LangSmith** | LLM observability — traces every chain and agent execution |

### AI & Embeddings

| Technology | Role |
|---|---|
| **SCIP** | High-fidelity AST parsing and code intelligence indexing (Python, TS, Go, Rust, C++, Java, ...) |
| **voyage-code-3** | High-fidelity code embeddings for Qdrant code chunk ingestion |
| **nomic-embed-text** | Document-style embeddings for README, markdown, and prose chunks |

### Data Infrastructure

| Technology | Role |
|---|---|
| **PostgreSQL** | Primary persistence — users, sessions, knowledge base metadata |
| **Qdrant** | Vector database for semantic similarity search over code chunks |
| **Neo4j** | Graph database modelling files, symbols, imports, and call relationships |
| **Redis** | Celery message broker + response/session caching layer |
| **AWS S3** | Object storage for uploaded files and repository archives |

### Deployment & Infrastructure

| Technology | Role |
|---|---|
| **Docker** | Containerisation of every service |
| **Docker Compose** | Full-stack orchestration — networks, volumes, health checks |
| **Caddy** | Reverse proxy — automatic HTTPS, TLS termination, SSE passthrough, HTTP→HTTPS redirect |
| **AWS EC2** | Primary production host |

---

## 📂 Project Structure

```
nexusgpt/
├── backend/
│   ├── src/
│   │   ├── router/          # FastAPI route handlers
│   │   ├── service/         # Business logic & LangGraph agent
│   │   ├── models/          # SQLModel table definitions
│   │   ├── schema/          # Pydantic request/response schemas
│   │   ├── db/              # Async SQLAlchemy engine & sessions
│   │   ├── ingestion/       # SCIP parsing + Qdrant/Neo4j indexing
│   │   └── celery_app/      # Celery tasks & worker config
│   ├── docker-compose.dev.yml
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Chakra UI components (dialogs, chat, editor)
│   │   ├── pages/           # Route-level page components
│   │   ├── store/           # Zustand stores
│   │   ├── api/             # Axios API client modules
│   │   └── hooks/           # Custom React hooks (SSE, auth, etc.)
│   ├── index.html
│   └── vite.config.ts
│
├── backend.sh               # Starts FastAPI dev server
├── celery.sh                # Starts Celery worker
├── frontend.sh              # Starts Vite dev server
├── format.sh                # Prettier formatter
├── Caddyfile                # Caddy reverse proxy config
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.12+
- Node.js 18+ & npm

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/nexusgpt.git
cd nexusgpt
```

### 2. Configure Environment

Create `backend/.env` (production) or `backend/.env.dev` (local Docker):

```bash
# ── Database ───────────────────────────────────────────
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=nexusgpt
POSTGRES_PORT=5432

REDIS_URL=redis://localhost:6379/0

QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=                         # leave empty for local

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# ── AWS ────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=ap-south-1
S3_BUCKET_NAME=nexusgpt-uploads

# ── GitHub ─────────────────────────────────────────────
GITHUB_TOKEN=your_github_pat

# ── LLM Providers ──────────────────────────────────────
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GROQ_API_KEY=

# ── Embeddings ─────────────────────────────────────────
VOYAGE_API_KEY=your_voyage_key
NOMIC_API_KEY=your_nomic_key

# ── Observability ──────────────────────────────────────
SENTRY_DSN=your_sentry_dsn
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT=nexusgpt
```

### 3. Start Infrastructure (Databases)

```bash
cd backend
docker compose -f docker-compose.dev.yml up -d
```

This spins up PostgreSQL, Redis, Qdrant, and Neo4j with persistent volumes.

### 4. Run the Application

Three convenience scripts at the root handle local startup:

```bash
# Terminal 1 — FastAPI backend
./backend.sh

# Terminal 2 — Celery background worker
./celery.sh

# Terminal 3 — Vite frontend
./frontend.sh
```

Visit **`http://localhost:5173`** to open the UI.

---

## 🧠 Core Capabilities

### Dual RAG Pipeline

NexusGPT uses two complementary retrieval strategies on every query:

1. **Graph RAG** — LangGraph agent tools (`get_file_context`, `ask_architecture`) issue Cypher queries against Neo4j to retrieve exact structural context: which file defines a symbol, which modules it imports, and how deeply it is depended upon.
2. **Semantic RAG** — Qdrant performs approximate nearest-neighbour search over `voyage-code-3` (code) and `nomic-embed-text` (docs) embeddings to surface the most semantically similar chunks even when the exact symbol name is unknown.

The agent synthesises both signals before generating a response.

### SCIP-Based Code Intelligence

Code is indexed using the **Source Code Indexing Protocol (SCIP)** before chunking or graph insertion occurs. Instead of heuristic AST-walking, SCIP provides high-fidelity symbol resolution, precise cross-references, and deep relationship mapping. This dramatically improves retrieval relevance and prevents context bleed between unrelated code blocks.

Supported languages include: **Python, TypeScript, JavaScript, Rust, Go, C, C++, Java, Ruby, PHP**, and more.

### MCP Integration

NexusGPT supports the **Model Context Protocol (MCP)** via SSE transport. Configure remote MCP servers (e.g. Brave Search, database tools) in the in-app MCP config dialog. The backend connects at runtime and exposes the server's tools to the LangGraph agent automatically.

### Multi-LLM Provider

Switch between providers from the chat interface without restarting anything. The backend maintains per-provider client factories and the agent's tool-calling layer is provider-agnostic.

### Background Ingestion via Celery

Submitting a GitHub repository kicks off a Celery task that:
1. Clones the repo (or fetches a tarball via httpx from the GitHub API)
2. Runs SCIP indexing to extract precise symbols, relationships, and cross-references
3. Embeds chunks with `voyage-code-3` or `nomic-embed-text` and upserts into Qdrant
4. Writes file/symbol/import nodes and edges into Neo4j
5. Streams real-time progress back to the frontend via SSE

### Streaming Responses

All chat completions are streamed token-by-token over SSE. The frontend hook differentiates `<think>` reasoning blocks from final output, rendering them in separate UI regions for transparency.

---

## 🌐 Caddy — Reverse Proxy & HTTPS

In production on EC2, **Caddy** sits in front of all services and handles everything the internet touches:

| Responsibility | Detail |
|---|---|
| **Automatic HTTPS** | Obtains and renews TLS certificates from Let's Encrypt with zero configuration — just point your domain at the EC2 IP |
| **HTTP → HTTPS redirect** | All plain HTTP traffic is permanently redirected to HTTPS automatically |
| **TLS termination** | Caddy decrypts inbound TLS so backend services communicate over plain HTTP inside the Docker network |
| **Reverse proxy routing** | `/api/*` and `/docs` → FastAPI on `:8000`; everything else → the Vite static build on `:5173` |
| **SSE / Streaming passthrough** | Configured with `flush_interval -1` to pass Server-Sent Events through in real-time without buffering |
| **WebSocket support** | Transparent proxying of WebSocket upgrade requests (for future real-time features) |
| **Compression** | Brotli and Gzip response encoding for static assets |
| **Security headers** | `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` added automatically |

### Caddyfile

```caddy
your-domain.com {
    # Static frontend
    handle {
        reverse_proxy frontend:5173
        encode gzip zstd
    }

    # Backend API — flush immediately for SSE streaming
    handle /api/* {
        reverse_proxy backend:8000 {
            flush_interval -1
        }
    }

    # FastAPI auto-docs (optional, lock down in production)
    handle /docs* {
        reverse_proxy backend:8000
    }

    handle /openapi.json {
        reverse_proxy backend:8000
    }
}
```

> **Why Caddy over Nginx?** Caddy's automatic HTTPS requires zero certificate management — no `certbot` cron jobs, no manual renewal. It reads a single `Caddyfile` and handles everything else. On a solo-operator EC2 deployment this saves significant operational overhead.

---

## 📊 Observability

| Tool | What It Covers |
|---|---|
| **Sentry** | Unhandled exceptions, performance spans, request traces across the entire FastAPI app and Celery workers |
| **LangSmith** | Every LangChain chain and LangGraph agent step — inputs, outputs, token counts, latency, tool calls |

---

## 🔒 Security

- All API endpoints are rate-limited via **SlowAPI** (per-IP, configurable).
- Auth is enforced via JWT middleware on protected routes.
- Never commit `.env`, `.env.dev`, or `.env.local` — they are listed in `.gitignore`.
- AWS credentials follow the principle of least privilege (S3 read/write only on the target bucket).

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push and open a Pull Request

Please run `./format.sh` (Prettier) and `ruff check` before submitting.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
