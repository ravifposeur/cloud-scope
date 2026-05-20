from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # FastAPI & Environment
    APP_ENV: str
    DATABASE_URL: str

    # PostgreSQL
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str

    # MinIO
    MINIO_ROOT_USER: str
    MINIO_ROOT_PASSWORD: str
    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_BUCKET_NAME: str

    # Redis & Celery
    REDIS_URL: str
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    # Security, JWT & Encryption
    JWT_SECRET: str
    JWT_ALGORITHM: str
    ENCRYPTION_KEY: str

    # Konfigurasi pembacaan file .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore" # Mengabaikan variabel ekstra jika ada
    )

# Inisialisasi instance global
settings = Settings()
