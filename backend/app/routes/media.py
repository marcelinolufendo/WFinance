from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services.media import media_path

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/{subdir}/{filename}")
async def serve_media(subdir: str, filename: str):
    # Protege contra path traversal
    if ".." in subdir or ".." in filename:
        raise HTTPException(status_code=400, detail="Caminho inválido")

    path: Path = media_path(f"{subdir}/{filename}")
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")

    return FileResponse(path)
