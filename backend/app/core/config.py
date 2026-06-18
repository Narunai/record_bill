from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./record_bil.db"
    SECRET_KEY: str = "yoursecretkeyhere"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 52560000  # 100 years in minutes
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    CORS_ORIGINS: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "https://narunai.github.io"
    )

    class Config:
        env_file = ".env"

settings = Settings()


def get_cors_origins() -> List[str]:
    return [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
