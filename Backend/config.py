from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_url: str = "mongodb://localhost:27017"
    jwt_secret_key: str
    cohere_key: str
    huggingface_token: str | None = None

    embedding_model: str = "embeddinggemma:300m"
    generation_model: str = "llama3.2:1b"
    ollama_rewrite_model: str = "llama3.2:1b"
    eval_model: str | None = None

    chroma_persist_dir: Path = BACKEND_DIR / "chromadb"
    documents_dir: Path = BACKEND_DIR / "documents"

    access_token_expire_minutes: int = 60
    frontend_origin: str = "http://localhost:5173"

    @property
    def resolved_eval_model(self) -> str:
        return self.eval_model or self.ollama_rewrite_model


@lru_cache
def get_settings() -> Settings:
    return Settings()
