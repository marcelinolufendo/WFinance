from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import Optional, List

from app.database import get_db
from app.models.orders import Order, Delivery, OrderStatus, PaymentMethod, PaymentStatus, DeliveryStatus, ReturnStatus
from app.models.contact import Contact

router = APIRouter(tags=["orders"])


class OrderItemSchema(BaseModel):
    name: str
    quantity: float
    unit_price: float
    product_id: Optional[int] = None


class OrderIn(BaseModel):
    contact_id: int
    conversation_id: Optional[int] = None
    status: OrderStatus = OrderStatus.draft
    payment_method: PaymentMethod = PaymentMethod.pending
    payment_status: PaymentStatus = PaymentStatus.unpaid
    items: List[OrderItemSchema] = []
    total_amount: Optional[float] = None
    notes: Optional[str] = None


class DeliveryIn(BaseModel):
    address: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    driver_name: Optional[str] = None
    notes: Optional[str] = None
    status: DeliveryStatus = DeliveryStatus.pending


# ── Orders ────────────────────────────────────────────────────────────────────

@router.get("/orders")
async def list_orders(db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(
        select(Order)
        .options(selectinload(Order.contact), selectinload(Order.delivery))
        .order_by(Order.created_at.desc())
    )
    return [_order_dict(o) for o in rows.all()]


@router.post("/orders", status_code=201)
async def create_order(body: OrderIn, db: AsyncSession = Depends(get_db)):
    items = [i.model_dump() for i in body.items]
    total = body.total_amount
    if total is None and items:
        total = sum(i["quantity"] * i["unit_price"] for i in items)
    o = Order(
        contact_id=body.contact_id,
        conversation_id=body.conversation_id,
        status=body.status,
        payment_method=body.payment_method,
        payment_status=body.payment_status,
        items=items,
        total_amount=total,
        notes=body.notes,
    )
    db.add(o)
    await db.commit()
    await db.refresh(o)
    contact = await db.get(Contact, o.contact_id)
    o.contact = contact
    return _order_dict(o)


@router.get("/orders/{order_id}")
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    o = await db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.contact), selectinload(Order.delivery))
    )
    if not o:
        raise HTTPException(404, "Encomenda não encontrada")
    return _order_dict(o)


@router.put("/orders/{order_id}")
async def update_order(order_id: int, body: OrderIn, db: AsyncSession = Depends(get_db)):
    o = await db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.contact), selectinload(Order.delivery))
    )
    if not o:
        raise HTTPException(404, "Encomenda não encontrada")
    items = [i.model_dump() for i in body.items]
    total = body.total_amount
    if total is None and items:
        total = sum(i["quantity"] * i["unit_price"] for i in items)
    o.contact_id = body.contact_id
    o.conversation_id = body.conversation_id
    o.status = body.status
    o.payment_method = body.payment_method
    o.payment_status = body.payment_status
    o.items = items
    o.total_amount = total
    o.notes = body.notes
    await db.commit()
    await db.refresh(o)
    return _order_dict(o)


_STATUS_MSGS = {
    "confirmed": "✅ A tua encomenda #{id} foi *confirmada*! Em breve entraremos em contacto para agendar a entrega.",
    "awaiting_deposit": "💳 A tua encomenda #{id} aguarda o pagamento do depósito inicial. Por favor efectua o pagamento para avançarmos com a preparação.",
    "preparing": "👨‍🍳 A tua encomenda #{id} está a ser *preparada*.",
    "delivering": "🚚 A tua encomenda #{id} está *a caminho*! O nosso estafeta está a dirigir-se até ti.",
    "cancelled": "❌ A tua encomenda #{id} foi *cancelada*. Contacta-nos para mais informações.",
}


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: int, status: OrderStatus, db: AsyncSession = Depends(get_db)):
    o = await db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.contact), selectinload(Order.delivery))
    )
    if not o:
        raise HTTPException(404, "Encomenda não encontrada")
    o.status = status
    await db.commit()
    await db.refresh(o)

    # Notificação automática via WhatsApp
    if o.contact and o.contact.phone:
        import asyncio
        from app.services.whatsapp import send_text
        if status == OrderStatus.delivered:
            total = float(o.total_amount) if o.total_amount else 0
            paid_partial = o.payment_status == PaymentStatus.partial
            remaining = total / 2 if paid_partial else total
            paid_label = f" (já pagou {total/2:,.0f} AOA)" if paid_partial else ""
            msg = (
                f"🎉 A tua encomenda *#{o.id}* foi entregue!{paid_label}\n\n"
                f"Valor a pagar: *{remaining:,.0f} AOA*\n\n"
                f"Por favor confirma o recebimento respondendo *'Recebi'*. Obrigado! 🙏"
            )
            asyncio.create_task(send_text(o.contact.phone, msg))
        elif status.value in _STATUS_MSGS:
            msg = _STATUS_MSGS[status.value].replace("{id}", str(o.id))
            asyncio.create_task(send_text(o.contact.phone, msg))

    return _order_dict(o)


@router.patch("/orders/{order_id}/return")
async def update_return_status(
    order_id: int,
    return_status: ReturnStatus,
    return_notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    o = await db.scalar(
        select(Order).where(Order.id == order_id).options(selectinload(Order.contact), selectinload(Order.delivery))
    )
    if not o:
        raise HTTPException(404, "Encomenda não encontrada")
    o.return_status = return_status
    if return_notes is not None:
        o.return_notes = return_notes
    await db.commit()
    await db.refresh(o)

    # Notificação ao cliente
    if o.contact and o.contact.phone and return_status == ReturnStatus.refunded:
        import asyncio
        from app.services.whatsapp import send_text
        asyncio.create_task(send_text(
            o.contact.phone,
            f"💰 O reembolso da tua encomenda #{o.id} foi processado com sucesso. Obrigado pela compreensão!"
        ))

    return _order_dict(o)


@router.delete("/orders/{order_id}", status_code=204)
async def delete_order(order_id: int, db: AsyncSession = Depends(get_db)):
    o = await db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "Encomenda não encontrada")
    await db.delete(o)
    await db.commit()


# ── Deliveries ────────────────────────────────────────────────────────────────

@router.get("/deliveries")
async def list_deliveries(db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(
        select(Delivery)
        .options(selectinload(Delivery.order).selectinload(Order.contact))
        .order_by(Delivery.scheduled_at)
    )
    return [_delivery_dict(d) for d in rows.all()]


@router.post("/orders/{order_id}/delivery", status_code=201)
async def create_delivery(order_id: int, body: DeliveryIn, db: AsyncSession = Depends(get_db)):
    o = await db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "Encomenda não encontrada")
    d = Delivery(order_id=order_id, **body.model_dump())
    db.add(d)
    o.status = OrderStatus.delivering
    await db.commit()
    await db.refresh(d)
    return _delivery_dict(d)


@router.put("/deliveries/{delivery_id}")
async def update_delivery(delivery_id: int, body: DeliveryIn, db: AsyncSession = Depends(get_db)):
    d = await db.scalar(
        select(Delivery)
        .where(Delivery.id == delivery_id)
        .options(selectinload(Delivery.order).selectinload(Order.contact))
    )
    if not d:
        raise HTTPException(404, "Entrega não encontrada")
    for k, v in body.model_dump().items():
        setattr(d, k, v)
    if body.status == DeliveryStatus.delivered:
        d.delivered_at = datetime.utcnow()
        d.order.status = OrderStatus.delivered
    await db.commit()
    await db.refresh(d)
    return _delivery_dict(d)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _order_dict(o: Order) -> dict:
    return {
        "id": o.id,
        "contact": {"id": o.contact.id, "name": o.contact.name, "phone": o.contact.phone} if o.contact else None,
        "conversation_id": o.conversation_id,
        "status": o.status.value,
        "payment_method": o.payment_method.value,
        "payment_status": o.payment_status.value,
        "items": o.items or [],
        "total_amount": float(o.total_amount) if o.total_amount is not None else None,
        "notes": o.notes,
        "return_status": o.return_status.value if o.return_status else "none",
        "return_notes": o.return_notes,
        "delivery": _delivery_dict(o.delivery) if o.delivery else None,
        "created_at": o.created_at.isoformat(),
        "updated_at": o.updated_at.isoformat(),
    }


def _delivery_dict(d: Delivery) -> dict:
    return {
        "id": d.id,
        "order_id": d.order_id,
        "status": d.status.value,
        "address": d.address,
        "contact_name": d.contact_name,
        "contact_phone": d.contact_phone,
        "scheduled_at": d.scheduled_at.isoformat() if d.scheduled_at else None,
        "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None,
        "driver_name": d.driver_name,
        "notes": d.notes,
        "order": {
            "id": d.order.id,
            "contact": {"id": d.order.contact.id, "name": d.order.contact.name, "phone": d.order.contact.phone},
            "total_amount": float(d.order.total_amount) if d.order.total_amount is not None else None,
            "status": d.order.status.value,
        } if d.order else None,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }
