
echo "celery"
cd backend
source .venv/bin/activate
uv run celery -A src.db.redis_client.queue worker --loglevel=info 