from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    data_root: Path = Path("/data")
    host: str = "0.0.0.0"
    port: int = 8080
    static_dir: Path | None = None
    search_result_limit: int = 200


settings = Settings()
