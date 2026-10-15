"""
Application Configuration
=========================
Manages environment variables, database connections, and service endpoints
using Pydantic Settings.
"""

from typing import List, Optional
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Locate project root directory relative to this config file
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Core settings for DPWH Cebu Knowledge Graph FastAPI Backend."""

    # Server Configuration
    APP_NAME: str = "DPWH Cebu Knowledge Graph API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = ["*"]
    API_PREFIX: str = "/api"

    # Neo4j Graph Database
    NEO4J_URI: str = Field(default="", description="Neo4j bolt/neo4j+s connection string")
    NEO4J_USERNAME: str = Field(default="neo4j", description="Neo4j username")
    NEO4J_PASSWORD: str = Field(default="", description="Neo4j password")
    NEO4J_MAX_CONNECTION_LIFETIME: int = 3600
    NEO4J_MAX_CONNECTION_POOL_SIZE: int = 50
    NEO4J_CONNECTION_TIMEOUT: float = 5.0

    # Supabase (Document Lake)
    SUPABASE_URL: Optional[str] = Field(default=None, description="Supabase project URL")
    SUPABASE_SERVICE_KEY: Optional[str] = Field(default=None, description="Supabase service role key")

    # Apify (Web Scraper)
    APIFY_TOKEN: Optional[str] = Field(default=None, description="Apify API Token")

    # LLM Configuration (Xiaomi MiMo-V2-Flash via Hugging Face Inference API / Xiaomi API)
    LLM_BASE_URL: str = Field(default="https://router.huggingface.co/v1", description="LLM Base URL (e.g. Hugging Face Router or Xiaomi API)")
    LLM_NATIVE_OLLAMA_URL: str = Field(default="http://localhost:11434/api/chat", description="Ollama native endpoint (fallback)")
    LLM_MODEL: str = Field(default="XiaomiMiMo/MiMo-V2-Flash", description="Model name (e.g. XiaomiMiMo/MiMo-V2-Flash)")
    LLM_API_KEY: str = Field(default="", description="API Token (e.g. Hugging Face HF_TOKEN or Xiaomi MiMo API key)")
    LLM_MAX_TOKENS: int = 2048
    LLM_TIMEOUT: float = 60.0

    # Embedding Settings (Optional)
    EMBEDDING_BASE_URL: Optional[str] = Field(default="http://localhost:11434/v1")
    EMBEDDING_API_KEY: Optional[str] = Field(default="ollama")
    EMBEDDING_MODEL: Optional[str] = Field(default="nomic-embed-text")
    EMBEDDING_DIM: int = 768

    model_config = SettingsConfigDict(
        env_file=(
            str(PROJECT_ROOT / ".env"),
            str(BACKEND_DIR / ".env"),
            ".env"
        ),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
