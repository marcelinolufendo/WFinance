import os
import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)
GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


async def transcribe_audio(file_path: str) -> str | None:
    api_key = settings.groq_api_key
    if not api_key:
        logger.warning("GROQ_API_KEY não configurado — transcrição ignorada")
        return None
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            with open(file_path, "rb") as f:
                resp = await client.post(
                    GROQ_URL,
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"file": (os.path.basename(file_path), f, "audio/mpeg")},
                    data={"model": "whisper-large-v3-turbo", "language": "pt", "response_format": "text"},
                )
                resp.raise_for_status()
                return resp.text.strip()
    except Exception as exc:
        logger.error("Erro na transcrição Groq: %s", exc)
        return None
