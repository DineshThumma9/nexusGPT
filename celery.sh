#!/bin/bash

echo "Starting Celery worker"
cd backend
set -a && source .env.dev && set +a
uv run celery -A src.service.background.worker.queue worker --loglevel=info