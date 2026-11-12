from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Conversation, Message, Direction, MessageType, MessageStatus
from app.services import whatsapp

router = APIRouter(prefix="/conversations", tags=["messages"])


class SendTextRequest(BaseModel):
    text: str


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: int,
    body: SendTextRequest,
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    if not conv.window_open:
        raise HTTPException(
            status_code=422,
            detail="Janela de 24h encerrada. Use um template aprovado.",
        )

    contact = await db.get(conv.__class__, conv.contact_id)
    # contact_id aponta para Contact — carregamos pela relação
    from app.models import Contact
    contact = await db.get(Contact, conv.contact_id)

    result = await whatsapp.send_text(contact.phone, body.text)
    wa_id = result.get("messages", [{}])[0].get("id", "")

    message = Message(
        conversation_id=conv.id,
        wa_message_id=wa_id,
        direction=Direction.outbound,
        type=MessageType.text,
        content=body.text,
        status=MessageStatus.sent,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return {"id": message.id, "wa_message_id": wa_id}


@router.get("/{conversation_id}/messages")
async def list_messages(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
):
    rows = await db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = rows.all()
    return [
        {
            "id": m.id,
            "wa_message_id": m.wa_message_id,
            "direction": m.direction.value,
            "type": m.type.value,
            "content": m.content,
            "status": m.status.value,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]
