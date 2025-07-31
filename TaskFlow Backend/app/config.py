from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:123@localhost:5432/TaskFlow"
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30  # ← This should match what auth.py expects
    
    model_config = {"env_file": ".env"}  # Updated for Pydantic v2

settings = Settings()

