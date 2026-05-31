# NexusGPT (CentralGPT)

NexusGPT is an advanced, agentic RAG (Retrieval-Augmented Generation) platform designed specifically for codebase intelligence. It ingests entire GitHub repositories, parses their Abstract Syntax Trees (AST) using Tree-sitter, and creates a deeply interconnected knowledge graph of files, modules, symbols, and dependencies.

By combining Neo4j (Graph Database) for structural architecture and Qdrant (Vector Database) for semantic search, NexusGPT empowers LLM agents to accurately traverse, understand, and answer complex questions about your code.

---

## 🏗️ Architecture & Tech Stack

### Frontend
- **React (Vite)**: Lightning-fast development environment.
- **Chakra UI**: For premium, accessible, and responsive components.
- **Zustand**: For lightweight state management.
- **Axios**: For robust HTTP requests and API communication.
- **Shiki**: For accurate, high-performance code syntax highlighting.

### Backend
- **FastAPI** (Python 3.12+): High-performance async API framework.
- **LangChain & LangGraph**: For complex agentic workflows and tool orchestration.
- **Celery & Redis**: For asynchronous background ingestion tasks and message brokering.
- **SQLAlchemy**: ORM for structured relational database interactions.
- **Tree-sitter Language Pack**: For multi-language AST parsing and chunking.
- **SlowAPI**: API rate limiting to prevent abuse and ensure stability.
- **Sentry**: For robust application monitoring and error tracking.
- **LangSmith**: For full observability, debugging, and testing of LLM applications.
- **AWS S3**: For scalable and durable file uploads and storage.

### Data Infrastructure & Models
- **PostgreSQL**: Primary transactional database (users, sessions, kb status).
- **Neo4j**: Graph database modeling file hierarchy, imports, and code symbols (`MATCH (f:File)-[:CONTAINS]->(s:Symbol)`).
- **Qdrant**: High-performance vector engine for semantic code chunk retrieval.
- **Voyage AI & Nomic Embeddings**: High-quality embeddings for codebase semantic search.

### Deployment & Infrastructure
- **Docker & Docker Compose**: For containerization and seamless orchestration.
- **AWS EC2**: Primary deployment environment for the full stack.

---

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have the following installed:
- Docker & Docker Compose
- Python 3.12+
- Node.js (v18+) & pnpm/npm

### 2. Environment Setup
Create the necessary environment variables for the backend. Use `.env.dev` for local Docker deployment or `.env` for production EC2 instances.

```bash
# Example backend/.env configuration:
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=nexusgpt
POSTGRES_PORT=5432

REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# External APIs
GITHUB_TOKEN=your_github_pat
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
S3_BUCKET_NAME=your_bucket_name

# Observability & Monitoring
SENTRY_DSN=your_sentry_dsn
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT="nexusgpt"

# Model Providers
GROQ_API_KEY=your_groq_key
VOYAGE_API_KEY=your_voyage_key
NOMIC_API_KEY=your_nomic_key
```

### 3. Start Infrastructure
Run the Docker containers for the databases, or the entire stack if deploying:
```bash
# Start infrastructure locally
cd backend
docker-compose -f docker-compose.dev.yml up -d
```

### 4. Run the Application
The project includes convenient bash scripts at the root to orchestrate local startup sequences:

**Start Backend (FastAPI)**
```bash
./backend.sh
```

**Start Celery Worker (Background Tasks)**
```bash
./celery.sh
```

**Start Frontend (Vite)**
```bash
./frontend.sh
```

*(You can also use `./format.sh` to quickly format your frontend source using Prettier).*

---

## 🧠 Core Capabilities

- **Agentic Tool Execution**: The LangGraph agent is equipped with custom tools (`get_source_code`, `get_file_context`, `ask_architecture`) that allows it to explore the Neo4j graph and Qdrant vector space autonomously.
- **AST-Aware Chunking**: Code isn't blindly split. Tree-sitter extracts functions, classes, and interfaces cleanly based on language grammar (Python, TS, JS, C++, Rust, Go, etc.).
- **Robust Monitoring & Rate Limiting**: SlowAPI ensures the FastAPI endpoints are protected against spam, while Sentry catches exceptions. LangSmith provides a complete trace of every LangChain/LangGraph agent execution.
- **Background Ingestion**: Repositories are cloned and parsed asynchronously via Celery, with real-time SSE (Server-Sent Events) status updates sent back to the React frontend.
- **Cloud-Ready Deployment**: Configured to run on AWS EC2 via Docker Compose, leveraging AWS S3 for object storage to ensure durability and scalability.

---

## 🔒 Security Note
Never commit your `.env`, `.env.dev`, or `.env.local` files. These contain sensitive API keys and database credentials and are explicitly ignored in `.gitignore`.



