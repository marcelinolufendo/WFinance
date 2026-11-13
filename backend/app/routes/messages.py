from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Conversation, Message, Direction, MessageType, MessageStatus, ControlledBy
from app.models.contact import Contact
from app.services import whatsapp

router = APIRouter(prefix="/conversations", tags=["messages"])


class SendTextRequest(BaseModel):
    text: str


class NotesRequest(BaseModel):
    internal_notes: str


@router.get("")
async def list_conversations(
    status: Optional[str] = Query(None),  # open | resolved | all
    mode: Optional[str] = Query(None),    # bot | human
    db: AsyncSession = Depends(get_db),
):
    q = select(Conversation).options(selectinload(Conversation.contact)).order_by(Conversation.updated_at.desc())

    if status == "resolved":
        q = q.where(Conversation.resolved_at.isnot(None))
    elif status == "open" or status is None:
        q = q.where(Conversation.resolved_at.is_(None))
    # status == "all" → no filter

    if mode == "bot":
        q = q.where(Conversation.controlled_by == ControlledBy.bot)
    elif mode == "human":
        q = q.where(Conversation.controlled_by == ControlledBy.human)

    rows = await db.scalars(q)
    convs = rows.all()
    return [
        {
            "id": c.id,
            "contact": {
                "id": c.contact.id,
                "name": c.contact.name,
                "phone": c.contact.phone,
            },
            "window_open": c.window_open,
            "controlled_by": c.controlled_by.value,
            "last_client_message_at": c.last_client_message_at.isoformat() if c.last_client_message_at else None,
            "last_message_preview": c.last_message_preview,
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
            "internal_notes": c.internal_notes,
            "updated_at": c.updated_at.isoformat(),
        }
        for c in convs
    ]


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

    conv.last_message_preview = body.text[:120]
    await db.commit()
    await db.refresh(message)

    from app.websocket.manager import manager
    await manager.broadcast_global({
        "type": "new_message",
        "conversation_id": conv.id,
        "contact": {"id": contact.id, "phone": contact.phone, "name": contact.name},
        "controlled_by": conv.controlled_by.value,
        "preview": body.text[:60],
        "direction": "outbound",
    })

    return {"id": message.id, "wa_message_id": wa_id}


@router.patch("/{conversation_id}/mode")
async def set_mode(conversation_id: int, db: AsyncSession = Depends(get_db)):
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    conv.controlled_by = ControlledBy.bot if conv.controlled_by == ControlledBy.human else ControlledBy.human
    await db.commit()
    return {"controlled_by": conv.controlled_by.value}


@router.patch("/{conversation_id}/resolve")
async def resolve_conversation(conversation_id: int, db: AsyncSession = Depends(get_db)):
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    conv.resolved_at = datetime.utcnow() if not conv.resolved_at else None
    await db.commit()
    return {"resolved_at": conv.resolved_at.isoformat() if conv.resolved_at else None}


@router.patch("/{conversation_id}/notes")
async def update_notes(conversation_id: int, body: NotesRequest, db: AsyncSession = Depends(get_db)):
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    conv.internal_notes = body.internal_notes
    await db.commit()
    return {"internal_notes": conv.internal_notes}


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
            "media_path": m.media_path,
            "status": m.status.value,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]
