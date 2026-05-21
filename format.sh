#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Formatting Frontend (Prettier) ==="
npm --prefix frontend run format

echo ""
echo "=== Formatting Backend (Ruff) ==="
(cd backend && uv run ruff format . && uv run ruff check --select I --fix .)

echo ""
echo "✨ All code formatted successfully! ✨"
