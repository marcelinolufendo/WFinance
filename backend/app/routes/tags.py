from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tag import Tag, conversation_tags
from app.models.conversation import Conversation

router = APIRouter(prefix="/tags", tags=["tags"])


class TagBody(BaseModel):
    name: str
    color: str = "#6366f1"


@router.get("")
async def list_tags(db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Tag).order_by(Tag.name))).all()
    return [{"id": t.id, "name": t.name, "color": t.color} for t in rows]


@router.post("", status_code=201)
async def create_tag(body: TagBody, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(Tag).where(Tag.name == body.name))
    if existing:
        raise HTTPException(400, "Etiqueta já existe")
    tag = Tag(name=body.name, color=body.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return {"id": tag.id, "name": tag.name, "color": tag.color}


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: int, db: AsyncSession = Depends(get_db)):
    tag = await db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Etiqueta não encontrada")
    await db.delete(tag)
    await db.commit()


@router.get("/conversation/{conversation_id}")
async def get_conversation_tags(conversation_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tag).join(conversation_tags, Tag.id == conversation_tags.c.tag_id)
        .where(conversation_tags.c.conversation_id == conversation_id)
    )
    tags = result.scalars().all()
    return [{"id": t.id, "name": t.name, "color": t.color} for t in tags]


@router.post("/conversation/{conversation_id}/{tag_id}", status_code=201)
async def add_tag_to_conversation(conversation_id: int, tag_id: int, db: AsyncSession = Depends(get_db)):
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    tag = await db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Etiqueta não encontrada")
    # check if already assigned
    existing = await db.execute(
        select(conversation_tags).where(
            conversation_tags.c.conversation_id == conversation_id,
            conversation_tags.c.tag_id == tag_id,
        )
    )
    if existing.first():
        return {"detail": "já atribuída"}
    await db.execute(conversation_tags.insert().values(conversation_id=conversation_id, tag_id=tag_id))
    await db.commit()
    return {"detail": "ok"}


@router.delete("/conversation/{conversation_id}/{tag_id}", status_code=204)
async def remove_tag_from_conversation(conversation_id: int, tag_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(conversation_tags).where(
            conversation_tags.c.conversation_id == conversation_id,
            conversation_tags.c.tag_id == tag_id,
        )
    )
    await db.commit()
