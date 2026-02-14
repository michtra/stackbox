"""
Application configuration using environment variables
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # AWS Configuration
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "stackbox-uploads"
    aws_endpoint_url: str | None = None  # For LocalStack, set AWS_ENDPOINT_URL=http://localhost:4566 in .env

    # Upload Configuration
    presigned_url_expiration: int = 300  # 5 minutes, assumes STL files are small (few MB)

    # Local Storage Configuration
    upload_directory: str = "uploads"
    max_file_size_mb: int = 100
    allowed_file_extensions: list[str] = [".stl", ".glb", ".xlsx"]

    # Application Configuration
    environment: str = "development"  # development, staging, production

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Cross-Origin Resource Sharing (CORS) settings
    cors_origins: list[str] = [
        "http://localhost:3000",  # Next.js development server
    ]


# Global settings instance
settings = Settings()
