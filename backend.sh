#!/bin/bash

# Start frontend

echo "Starting celery and backend"
cd backend
source .venv/bin/activate
uv run uvicorn src.main:app --reload

