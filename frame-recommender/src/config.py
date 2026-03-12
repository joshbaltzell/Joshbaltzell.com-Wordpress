from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    adobe_commerce_base_url: str = "https://example.com/rest/V1"
    adobe_commerce_token: str = ""
    database_url: str = "sqlite:///data/frames.db"
    model_dir: str = "./models"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
