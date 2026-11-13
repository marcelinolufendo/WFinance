from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta

from app.database import get_db
from app.models.conversation import Conversation
from app.models.message import Message, Direction
from app.models.orders import Order, Delivery, OrderStatus, DeliveryStatus
from app.models.contact import Contact
from app.models.catalog import Product, Service

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── Conversas ────────────────────────────────────────────────────────────
    total_conversations = await db.scalar(select(func.count()).select_from(Conversation))
    open_conversations = await db.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.last_client_message_at >= now - timedelta(hours=24))
    )
    new_conversations_today = await db.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.created_at >= today_start)
    )
    new_conversations_week = await db.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.created_at >= week_start)
    )

    # ── Mensagens ─────────────────────────────────────────────────────────────
    messages_today = await db.scalar(
        select(func.count()).select_from(Message).where(Message.created_at >= today_start)
    )
    inbound_today = await db.scalar(
        select(func.count()).select_from(Message)
        .where(Message.created_at >= today_start, Message.direction == Direction.inbound)
    )
    outbound_today = await db.scalar(
        select(func.count()).select_from(Message)
        .where(Message.created_at >= today_start, Message.direction == Direction.outbound)
    )

    # ── Encomendas ────────────────────────────────────────────────────────────
    orders_total = await db.scalar(select(func.count()).select_from(Order))
    orders_pending = await db.scalar(
        select(func.count()).select_from(Order).where(Order.status.in_([OrderStatus.draft, OrderStatus.confirmed, OrderStatus.preparing]))
    )
    orders_delivering = await db.scalar(
        select(func.count()).select_from(Order).where(Order.status == OrderStatus.delivering)
    )
    orders_delivered_month = await db.scalar(
        select(func.count()).select_from(Order)
        .where(Order.status == OrderStatus.delivered, Order.updated_at >= month_start)
    )
    revenue_month = await db.scalar(
        select(func.sum(Order.total_amount))
        .where(Order.status == OrderStatus.delivered, Order.updated_at >= month_start)
    )
    revenue_total = await db.scalar(
        select(func.sum(Order.total_amount)).where(Order.status == OrderStatus.delivered)
    )

    # ── Entregas ──────────────────────────────────────────────────────────────
    deliveries_today = await db.scalar(
        select(func.count()).select_from(Delivery)
        .where(Delivery.scheduled_at >= today_start, Delivery.scheduled_at < today_start + timedelta(days=1))
    )
    deliveries_pending = await db.scalar(
        select(func.count()).select_from(Delivery).where(Delivery.status == DeliveryStatus.pending)
    )
    deliveries_on_way = await db.scalar(
        select(func.count()).select_from(Delivery).where(Delivery.status == DeliveryStatus.on_way)
    )

    # ── Clientes ──────────────────────────────────────────────────────────────
    total_customers = await db.scalar(select(func.count()).select_from(Contact))
    new_customers_month = await db.scalar(
        select(func.count()).select_from(Contact).where(Contact.created_at >= month_start)
    )

    # ── Catálogo ──────────────────────────────────────────────────────────────
    total_products = await db.scalar(select(func.count()).select_from(Product))
    total_services = await db.scalar(select(func.count()).select_from(Service))

    # ── Histórico de encomendas (últimos 7 dias) ─────────────────────────────
    orders_by_day = []
    for i in range(6, -1, -1):
        day = today_start - timedelta(days=i)
        next_day = day + timedelta(days=1)
        count = await db.scalar(
            select(func.count()).select_from(Order).where(Order.created_at >= day, Order.created_at < next_day)
        )
        revenue = await db.scalar(
            select(func.sum(Order.total_amount))
            .where(Order.status == OrderStatus.delivered, Order.updated_at >= day, Order.updated_at < next_day)
        )
        orders_by_day.append({
            "date": day.strftime("%d/%m"),
            "orders": count or 0,
            "revenue": float(revenue) if revenue else 0.0,
        })

    return {
        "conversations": {
            "total": total_conversations or 0,
            "open": open_conversations or 0,
            "new_today": new_conversations_today or 0,
            "new_week": new_conversations_week or 0,
        },
        "messages": {
            "today": messages_today or 0,
            "inbound_today": inbound_today or 0,
            "outbound_today": outbound_today or 0,
        },
        "orders": {
            "total": orders_total or 0,
            "pending": orders_pending or 0,
            "delivering": orders_delivering or 0,
            "delivered_month": orders_delivered_month or 0,
        },
        "revenue": {
            "month": float(revenue_month) if revenue_month else 0.0,
            "total": float(revenue_total) if revenue_total else 0.0,
        },
        "deliveries": {
            "today": deliveries_today or 0,
            "pending": deliveries_pending or 0,
            "on_way": deliveries_on_way or 0,
        },
        "customers": {
            "total": total_customers or 0,
            "new_month": new_customers_month or 0,
        },
        "catalog": {
            "products": total_products or 0,
            "services": total_services or 0,
        },
        "orders_by_day": orders_by_day,
    }
