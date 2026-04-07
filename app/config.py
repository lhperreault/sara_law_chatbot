"""
Application configuration loaded from environment variables.
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # AI Provider
    ai_provider: str = "openai"  # "openai" or "claude"

    # OpenAI
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"

    # Anthropic Claude
    anthropic_api_key: Optional[str] = None
    claude_model: str = "claude-sonnet-4-20250514"

    # Airtable
    airtable_api_key: Optional[str] = None
    airtable_base_id: Optional[str] = None
    airtable_clients_table: str = "Clients"
    airtable_conversations_table: str = "Conversations"
    airtable_messages_table: str = "Messages"

    # Practice area
    default_practice_area: str = "roque_law"

    # Server
    port: int = 8080
    cors_origins: str = "*"

    # Memory flush
    flush_threshold: int = 10
    flush_interval_seconds: int = 30

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


# Singleton
settings = Settings()
