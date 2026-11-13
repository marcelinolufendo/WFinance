from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    whatsapp_token: str
    whatsapp_phone_number_id: str
    whatsapp_app_secret: str
    whatsapp_verify_token: str
    media_storage_path: str = "./media"
    anthropic_api_key: str
    groq_api_key: str = ""
    secret_key: str = "CHANGE_ME_IN_PRODUCTION"
    admin_username: str = "admin"
    admin_password: str = "admin123"

    class Config:
        env_file = ".env"


settings = Settings()
