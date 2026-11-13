from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database import get_db
from app.models.contact import Contact, ContactSegment
from app.models.conversation import Conversation
from app.models.orders import Order, OrderStatus

router = APIRouter(tags=["customers"])


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    segment: ContactSegment = ContactSegment.regular
    internal_notes: Optional[str] = None


@router.get("/customers")
async def list_customers(db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(
        select(Contact).order_by(Contact.created_at.desc())
    )
    contacts = rows.all()
    result = []
    for c in contacts:
        conv_count = await db.scalar(select(func.count()).where(Conversation.contact_id == c.id))
        order_count = await db.scalar(select(func.count()).where(Order.contact_id == c.id))
        total_spent = await db.scalar(
            select(func.sum(Order.total_amount))
            .where(Order.contact_id == c.id, Order.status == OrderStatus.delivered)
        )
        result.append({
            "id": c.id,
            "phone": c.phone,
            "name": c.name,
            "email": c.email,
            "address": c.address,
            "segment": c.segment.value,
            "internal_notes": c.internal_notes,
            "conversation_count": conv_count or 0,
            "order_count": order_count or 0,
            "total_spent": float(total_spent) if total_spent else 0.0,
            "created_at": c.created_at.isoformat(),
        })
    return result


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(Contact, customer_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    orders = await db.scalars(select(Order).where(Order.contact_id == customer_id).order_by(Order.created_at.desc()))
    return {
        "id": c.id,
        "phone": c.phone,
        "name": c.name,
        "email": c.email,
        "address": c.address,
        "segment": c.segment.value,
        "internal_notes": c.internal_notes,
        "created_at": c.created_at.isoformat(),
        "orders": [
            {
                "id": o.id,
                "status": o.status.value,
                "total_amount": float(o.total_amount) if o.total_amount is not None else None,
                "created_at": o.created_at.isoformat(),
            }
            for o in orders.all()
        ],
    }


@router.put("/customers/{customer_id}")
async def update_customer(customer_id: int, body: ContactUpdate, db: AsyncSession = Depends(get_db)):
    c = await db.get(Contact, customer_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return {"id": c.id, "phone": c.phone, "name": c.name, "email": c.email,
            "address": c.address, "segment": c.segment.value, "internal_notes": c.internal_notes}
