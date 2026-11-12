import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Message, MessageType
from app.services.llm import suggest_reply

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/conversations", tags=["suggest"])


@router.post("/{conversation_id}/suggest")
async def suggest(conversation_id: int, db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = rows.all()

    if not messages:
        raise HTTPException(status_code=404, detail="Sem mensagens nesta conversa")

    history = [
        {
            "direction": m.direction.value,
            "type": m.type.value,
            "content": m.content,
        }
        for m in messages
    ]

    try:
        suggestion = await suggest_reply(history)
    except Exception as exc:
        logger.error("Erro ao gerar sugestão: %s", exc)
        raise HTTPException(status_code=502, detail="Erro ao contactar o LLM")

    if not suggestion:
        raise HTTPException(status_code=422, detail="Não foi possível gerar uma sugestão")

    return {"suggestion": suggestion}
