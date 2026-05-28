
echo "celery"
cd backend
source .venv/bin/activate
uv run celery -A src.service.worker.queue worker --loglevel=info 