"""Application configuration via pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"
    # Comma-separated list of allowed CORS origins (e.g. "https://app.acme.com,https://staging.acme.com").
    # In dev, http://localhost:3000 is always allowed.
    allowed_origins: str = ""

    # Database
    database_url: str = "postgresql+asyncpg://caos:caospass@localhost:5432/caos"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "caosadmin"
    minio_secret_key: str = "caossecret"
    minio_bucket_docs: str = "caos-documents"
    minio_bucket_models: str = "caos-models"
    minio_bucket_audit: str = "caos-audit-logs"
    minio_secure: bool = False

    # Anthropic
    anthropic_api_key: str
    # `claude-opus-4-6` is not a published model id. Default to the latest
    # publicly available Opus 4 release (Opus 4.8); override via env if needed.
    anthropic_model: str = "claude-opus-4-8"
    anthropic_model_fast: str = "claude-haiku-4-5-20251001"

    # Microsoft Graph (OneDrive webhooks)
    ms_graph_client_id: str = ""
    ms_graph_client_secret: str = ""
    ms_graph_tenant_id: str = ""
    ms_graph_redirect_uri: str = "http://localhost:8000/api/webhooks/msgraph/auth"

    # Vector store
    pinecone_api_key: str = ""
    pinecone_environment: str = ""
    pinecone_index_name: str = "caos-rag"

    # Security
    webhook_secret: str = "changeme"
    jwt_secret: str = "changeme"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    # Compliance
    mnpi_classification_enabled: bool = True

    # Upload limits (MB). Anything larger is rejected at the API boundary.
    max_upload_mb: int = 250

    @model_validator(mode="after")
    def _reject_default_secrets_in_production(self) -> "Settings":
        """Refuse to boot in production with known/default signing secrets."""
        if self.environment == "production":
            insecure = [
                name
                for name, value in (
                    ("jwt_secret", self.jwt_secret),
                    ("webhook_secret", self.webhook_secret),
                )
                if value == "changeme"
            ]
            if insecure:
                raise ValueError(
                    "Refusing to start in production with default secret(s): "
                    f"{', '.join(insecure)}. Set them via environment variables."
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
