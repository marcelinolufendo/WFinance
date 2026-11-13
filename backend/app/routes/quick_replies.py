from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.quick_reply import QuickReply

router = APIRouter(prefix="/quick-replies", tags=["quick-replies"])


class QuickReplyBody(BaseModel):
    title: str
    content: str


@router.get("")
async def list_quick_replies(db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(QuickReply).order_by(QuickReply.title))).all()
    return [{"id": r.id, "title": r.title, "content": r.content} for r in rows]


@router.post("")
async def create_quick_reply(body: QuickReplyBody, db: AsyncSession = Depends(get_db)):
    qr = QuickReply(title=body.title, content=body.content)
    db.add(qr)
    await db.commit()
    await db.refresh(qr)
    return {"id": qr.id, "title": qr.title, "content": qr.content}


@router.put("/{qr_id}")
async def update_quick_reply(qr_id: int, body: QuickReplyBody, db: AsyncSession = Depends(get_db)):
    qr = await db.get(QuickReply, qr_id)
    if not qr:
        raise HTTPException(404, "Resposta rápida não encontrada")
    qr.title = body.title
    qr.content = body.content
    await db.commit()
    return {"id": qr.id, "title": qr.title, "content": qr.content}


@router.delete("/{qr_id}")
async def delete_quick_reply(qr_id: int, db: AsyncSession = Depends(get_db)):
    qr = await db.get(QuickReply, qr_id)
    if not qr:
        raise HTTPException(404, "Resposta rápida não encontrada")
    await db.delete(qr)
    await db.commit()
    return {"detail": "Eliminada"}
