

from pydantic_settings import BaseSettings, SettingsConfigDict




class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    qdrant_url: str
    qdrant_api_key: str
    nomic_api_key: str
    voyage_api_key: str
    vector_dim: int
    collection_code: str
    collection: str
    database_url: str
    neo4j_url: str
    neo4j_user: str
    neo4j_password: str
    neo4j_database: str
    qa_llm:str
    cypher_llm:str
    title_llm:str
    summarization_llm:str
    sentry_dsn:str
    redis_url:str
    qdrant_api_key:str
    qdrant_url:str



    