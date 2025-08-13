from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:123@localhost:5432/TaskFlow"
    secret_key: str = "abhi123"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30  # ← This should match what auth.py expects

    # SuperAdmin credentials from environment variables
    static_superadmin_email: str
    static_superadmin_password: str

    model_config = {"env_file": ".env"}  # Updated for Pydantic v2

settings = Settings()
