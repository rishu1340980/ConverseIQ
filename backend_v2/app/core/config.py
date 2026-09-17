from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=[".env", "backend/.env", "backend_v2/.env"], extra="allow")

    PROJECT_NAME: str = "ConverseIQ Backend v2"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    PORT: int = 8001
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./converseiq_v2.db"
    
    # Security
    SECRET_KEY: str = "converseiq_clean_scratch_key_phase2_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "https://*.vercel.app",
        "https://converseiq.vercel.app"
    ]
    
    # AI keys & models (read securely from environment / .env)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"
    ASSEMBLYAI_API_KEY: str = ""
    
    # Uploads
    UPLOAD_DIR: str = "./uploads"

settings = Settings()
