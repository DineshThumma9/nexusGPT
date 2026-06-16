FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    gcc \
    curl \
    libc6-dev \
    libpq-dev \
    docker.io \
    docker-cli \
    && rm -rf /var/lib/apt/lists/*

# Force Linux to prefer IPv4 over IPv6 in DNS resolution to prevent Neon DB connection issues
RUN echo "precedence ::ffff:0:0/96  100" >> /etc/gai.conf

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

ENV UV_SYSTEM_PYTHON=1
ENV UV_PYTHON_PREFERENCE=only-system
ENV PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev

COPY . .

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

CMD ["gunicorn", "src.main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "120"]
