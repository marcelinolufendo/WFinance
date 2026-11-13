from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import KnowledgeBase, BotConfig, KnowledgeCategory
from app.services.bot import get_bot_config

router = APIRouter(tags=["bot"])


# ── Knowledge Base ─────────────────────────────────────────────────────────────

class KnowledgeIn(BaseModel):
    title: str
    content: str
    category: str = "other"
    active: bool = True


def _kb_dict(k: KnowledgeBase) -> dict:
    return {
        "id": k.id,
        "title": k.title,
        "content": k.content,
        "category": k.category.value,
        "active": k.active,
        "created_at": k.created_at.isoformat() if k.created_at else None,
        "updated_at": k.updated_at.isoformat() if k.updated_at else None,
    }


@router.get("/knowledge-base")
async def list_knowledge(db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(KnowledgeBase).order_by(KnowledgeBase.category, KnowledgeBase.id))).all()
    return [_kb_dict(r) for r in rows]


@router.post("/knowledge-base")
async def create_knowledge(body: KnowledgeIn, db: AsyncSession = Depends(get_db)):
    try:
        cat = KnowledgeCategory(body.category)
    except ValueError:
        cat = KnowledgeCategory.other
    k = KnowledgeBase(title=body.title, content=body.content, category=cat, active=body.active)
    db.add(k)
    await db.commit()
    await db.refresh(k)
    return _kb_dict(k)


@router.put("/knowledge-base/{kb_id}")
async def update_knowledge(kb_id: int, body: KnowledgeIn, db: AsyncSession = Depends(get_db)):
    k = await db.get(KnowledgeBase, kb_id)
    if not k:
        raise HTTPException(status_code=404, detail="Não encontrado")
    try:
        cat = KnowledgeCategory(body.category)
    except ValueError:
        cat = KnowledgeCategory.other
    k.title = body.title
    k.content = body.content
    k.category = cat
    k.active = body.active
    k.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(k)
    return _kb_dict(k)


@router.delete("/knowledge-base/{kb_id}")
async def delete_knowledge(kb_id: int, db: AsyncSession = Depends(get_db)):
    k = await db.get(KnowledgeBase, kb_id)
    if not k:
        raise HTTPException(status_code=404, detail="Não encontrado")
    await db.delete(k)
    await db.commit()
    return {"ok": True}


# ── Bot Config ─────────────────────────────────────────────────────────────────

class BotConfigIn(BaseModel):
    enabled: bool = False
    model: str = "google/gemini-2.0-flash-001"
    openrouter_api_key: str | None = None
    tone: str = "friendly"
    store_name: str = "A nossa loja"
    extra_instructions: str | None = None
    auto_create_order: bool = False


def _config_dict(c: BotConfig) -> dict:
    return {
        "id": c.id,
        "enabled": c.enabled,
        "model": c.model,
        "openrouter_api_key": "***" if c.openrouter_api_key else None,
        "tone": c.tone,
        "store_name": c.store_name,
        "extra_instructions": c.extra_instructions,
        "auto_create_order": c.auto_create_order,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/bot/config")
async def get_config(db: AsyncSession = Depends(get_db)):
    config = await get_bot_config(db)
    if not config:
        return {"enabled": False, "model": "google/gemini-2.0-flash-001", "tone": "friendly",
                "store_name": "A nossa loja", "extra_instructions": None, "auto_create_order": False,
                "openrouter_api_key": None}
    return _config_dict(config)


@router.put("/bot/config")
async def save_config(body: BotConfigIn, db: AsyncSession = Depends(get_db)):
    config = await get_bot_config(db)
    if not config:
        config = BotConfig(id=1)
        db.add(config)

    config.enabled = body.enabled
    config.model = body.model
    config.tone = body.tone
    config.store_name = body.store_name
    config.extra_instructions = body.extra_instructions or None
    config.auto_create_order = body.auto_create_order
    config.updated_at = datetime.utcnow()

    if body.openrouter_api_key and body.openrouter_api_key != "***":
        config.openrouter_api_key = body.openrouter_api_key

    await db.commit()
    await db.refresh(config)
    return _config_dict(config)
