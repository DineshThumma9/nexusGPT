FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    gcc \
    curl \
    libc6-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Force uv to use the system Python (never download a new interpreter)
ENV UV_SYSTEM_PYTHON=1
ENV UV_PYTHON_PREFERENCE=only-system
ENV PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev

COPY . .

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
