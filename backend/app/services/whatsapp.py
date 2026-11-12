import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_BASE_URL = "https://graph.facebook.com/v21.0"
_TIMEOUT = httpx.Timeout(10.0)


async def send_text(to: str, body: str) -> dict[str, Any]:
    return await _post_message({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body, "preview_url": False},
    })


async def send_template(to: str, template_name: str, language_code: str = "pt_BR") -> dict[str, Any]:
    return await _post_message({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
        },
    })


async def send_media(to: str, media_type: str, media_id: str, caption: str = "") -> dict[str, Any]:
    payload: dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": media_type,
        media_type: {"id": media_id},
    }
    if caption and media_type in ("image", "video", "document"):
        payload[media_type]["caption"] = caption
    return await _post_message(payload)


async def _post_message(payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{_BASE_URL}/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_token}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()
