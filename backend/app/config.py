from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    whatsapp_token: str
    whatsapp_phone_number_id: str
    whatsapp_app_secret: str
    whatsapp_verify_token: str
    media_storage_path: str = "./media"
    anthropic_api_key: str

    class Config:
        env_file = ".env"


settings = Settings()
