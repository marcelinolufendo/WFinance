import asyncio
import logging
import mimetypes
import os
import uuid
from pathlib import Path

import aiofiles
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_BASE_URL = "https://graph.facebook.com/v21.0"
_TIMEOUT = httpx.Timeout(30.0)

STORAGE_PATH = Path(settings.media_storage_path)
STORAGE_PATH.mkdir(parents=True, exist_ok=True)

# Extensões canónicas por MIME
_MIME_EXT: dict[str, str] = {
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "application/pdf": ".pdf",
}


async def download_media(media_id: str, mime_type: str) -> str:
    """
    Faz o download de um media em dois passos:
      1. GET /{media_id} → obtém a URL temporária
      2. GET na URL → faz download do binário

    Devolve o caminho relativo do ficheiro guardado (ex: "audio/abc123.ogg").
    Se o MIME for OGG, converte para MP3 e devolve o caminho do MP3.
    """
    headers = {"Authorization": f"Bearer {settings.whatsapp_token}"}

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        # Passo 1 — obter URL temporária
        meta = await client.get(f"{_BASE_URL}/{media_id}", headers=headers)
        meta.raise_for_status()
        url = meta.json().get("url")
        if not url:
            raise ValueError(f"Sem URL na resposta para media_id={media_id}")

        # Passo 2 — download do binário
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    ext = _MIME_EXT.get(mime_type.split(";")[0].strip(), mimetypes.guess_extension(mime_type) or ".bin")
    subdir = _subdir(mime_type)
    dest_dir = STORAGE_PATH / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = dest_dir / filename

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(response.content)

    logger.info("Media guardado: %s", file_path)

    # Converte áudio OGG/Opus para MP3 (compatibilidade com browsers)
    if mime_type.startswith("audio/ogg") or ext == ".ogg":
        mp3_path = await _convert_to_mp3(file_path)
        return f"{subdir}/{mp3_path.name}"

    return f"{subdir}/{filename}"


async def _convert_to_mp3(ogg_path: Path) -> Path:
    mp3_path = ogg_path.with_suffix(".mp3")
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-i", str(ogg_path), "-codec:a", "libmp3lame", "-q:a", "4", str(mp3_path),
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()
    if proc.returncode == 0:
        ogg_path.unlink(missing_ok=True)
        logger.info("Convertido para MP3: %s", mp3_path)
        return mp3_path
    # ffmpeg não está disponível — mantém OGG sem falhar
    logger.warning("ffmpeg não encontrado ou falhou; a manter OGG em %s", ogg_path)
    return ogg_path


def _subdir(mime_type: str) -> str:
    if mime_type.startswith("audio"):
        return "audio"
    if mime_type.startswith("image"):
        return "images"
    if mime_type.startswith("video"):
        return "video"
    return "documents"


def media_path(relative: str) -> Path:
    return STORAGE_PATH / relative
