import os
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.getenv("ENV_FILE", ".env.dev"),
        env_file_encoding="utf-8",
        extra="ignore",
    )
    qdrant_url: str
    qdrant_api_key: str
    nomic_api_key: str
    voyage_api_key: str
    vector_dim: int = 768
    database_url: str

    
    
    


    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_db_url(cls, v: str) -> str:
        return v.replace("postgres://", "postgresql://", 1)
    neo4j_url: str
    neo4j_user: str
    neo4j_password: str
    neo4j_database: str
    qa_llm: str
    cypher_llm: str
    title_llm: str
    summarization_llm: str
    sentry_dsn: str
    redis_url: str
    fernet_key: str
    secret_key: str
    algorithm: str
    nomic_embedding_model: str
    voyage_embedding_model: str
    access_token_expiry_min: int = 30
    refresh_token_expiry_days: int = 7
    aws_region: str
    aws_bucket: str
    groq_api_key: str
    github_token: str

    max_files_raw: int = 5000
    max_size_raw_mb: int = 50
    max_files_processable: int = 250
    max_size_processable_mb: int = 8
    model_run_limit: int = 5
    model_thread_limit: int = 50
    model_exit_behavior: str = "end"
    tool_run_limit: int = 5
    tool_thread_limit: int = 50
    tool_exit_behaviour: str = "continue"
    message_limit: int = 10
    token_limit: int = 6000
    keep_message_limit: int = 8

    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout: int = 5
    db_pool_recycle: int = 300
    db_checkpointer_pool_size: int = 5


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
