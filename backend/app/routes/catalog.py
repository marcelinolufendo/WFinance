from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import Optional

from app.database import get_db
from app.models.catalog import Product, Service, Campaign, ProductStatus, CampaignStatus

router = APIRouter(tags=["catalog"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ProductIn(BaseModel):
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    status: ProductStatus = ProductStatus.active


class ServiceIn(BaseModel):
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    status: ProductStatus = ProductStatus.active


class CampaignIn(BaseModel):
    name: str
    description: Optional[str] = None
    message_template: Optional[str] = None
    status: CampaignStatus = CampaignStatus.draft
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


# ── Products ─────────────────────────────────────────────────────────────────

@router.get("/products")
async def list_products(db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(select(Product).order_by(Product.created_at.desc()))
    return [_product_dict(p) for p in rows.all()]


@router.post("/products", status_code=201)
async def create_product(body: ProductIn, db: AsyncSession = Depends(get_db)):
    p = Product(**body.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _product_dict(p)


@router.get("/products/{product_id}")
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    return _product_dict(p)


@router.put("/products/{product_id}")
async def update_product(product_id: int, body: ProductIn, db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return _product_dict(p)


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    await db.delete(p)
    await db.commit()


# ── Services ─────────────────────────────────────────────────────────────────

@router.get("/services")
async def list_services(db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(select(Service).order_by(Service.created_at.desc()))
    return [_service_dict(s) for s in rows.all()]


@router.post("/services", status_code=201)
async def create_service(body: ServiceIn, db: AsyncSession = Depends(get_db)):
    s = Service(**body.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _service_dict(s)


@router.get("/services/{service_id}")
async def get_service(service_id: int, db: AsyncSession = Depends(get_db)):
    s = await db.get(Service, service_id)
    if not s:
        raise HTTPException(404, "Serviço não encontrado")
    return _service_dict(s)


@router.put("/services/{service_id}")
async def update_service(service_id: int, body: ServiceIn, db: AsyncSession = Depends(get_db)):
    s = await db.get(Service, service_id)
    if not s:
        raise HTTPException(404, "Serviço não encontrado")
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    await db.commit()
    await db.refresh(s)
    return _service_dict(s)


@router.delete("/services/{service_id}", status_code=204)
async def delete_service(service_id: int, db: AsyncSession = Depends(get_db)):
    s = await db.get(Service, service_id)
    if not s:
        raise HTTPException(404, "Serviço não encontrado")
    await db.delete(s)
    await db.commit()


# ── Campaigns ────────────────────────────────────────────────────────────────

@router.get("/campaigns")
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(select(Campaign).order_by(Campaign.created_at.desc()))
    return [_campaign_dict(c) for c in rows.all()]


@router.post("/campaigns", status_code=201)
async def create_campaign(body: CampaignIn, db: AsyncSession = Depends(get_db)):
    c = Campaign(**body.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _campaign_dict(c)


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404, "Campanha não encontrada")
    return _campaign_dict(c)


@router.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: int, body: CampaignIn, db: AsyncSession = Depends(get_db)):
    c = await db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404, "Campanha não encontrada")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return _campaign_dict(c)


@router.delete("/campaigns/{campaign_id}", status_code=204)
async def delete_campaign(campaign_id: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404, "Campanha não encontrada")
    await db.delete(c)
    await db.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _product_dict(p: Product) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": float(p.price) if p.price is not None else None,
        "stock": p.stock,
        "status": p.status.value,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }


def _service_dict(s: Service) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "price": float(s.price) if s.price is not None else None,
        "duration_minutes": s.duration_minutes,
        "status": s.status.value,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


def _campaign_dict(c: Campaign) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "message_template": c.message_template,
        "status": c.status.value,
        "starts_at": c.starts_at.isoformat() if c.starts_at else None,
        "ends_at": c.ends_at.isoformat() if c.ends_at else None,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }
