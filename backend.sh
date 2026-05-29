#!/bin/bash

# Start frontend

echo "Starting backend"
cd backend
set -a && source .env.dev && set +a
uv run uvicorn src.main:app --reload

