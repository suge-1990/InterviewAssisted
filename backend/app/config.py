from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # ASR
    ASR_PROVIDER: str = "funasr"
    ASR_MODEL: str = "iic/SenseVoiceSmall"
    ASR_DEVICE: str = "cpu"

    # LLM (OpenAI compatible)
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.deepseek.com"
    LLM_MODEL: str = "deepseek-chat"
    LLM_MAX_TOKENS: int = 2048
    LLM_TEMPERATURE: float = 0.7

    # Dual answer mode: "speed" | "precise" | "dual"
    DUAL_ANSWER_MODE: str = "dual"

    # Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    model_config = {"env_file": ".env"}


settings = Settings()
