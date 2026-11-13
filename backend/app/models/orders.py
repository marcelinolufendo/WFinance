from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, Text, Numeric, DateTime, ForeignKey, Enum, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class OrderStatus(PyEnum):
    draft = "draft"
    confirmed = "confirmed"
    preparing = "preparing"
    delivering = "delivering"
    delivered = "delivered"
    cancelled = "cancelled"


class PaymentMethod(PyEnum):
    cash = "cash"
    transfer = "transfer"
    mobile_money = "mobile_money"
    pending = "pending"


class PaymentStatus(PyEnum):
    unpaid = "unpaid"
    paid = "paid"
    partial = "partial"


class ReturnStatus(PyEnum):
    none = "none"
    requested = "requested"
    approved = "approved"
    refunded = "refunded"
    rejected = "rejected"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("contacts.id"), index=True)
    conversation_id: Mapped[int | None] = mapped_column(ForeignKey("conversations.id"), index=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.draft)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), default=PaymentMethod.pending)
    payment_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.unpaid)
    # items: list of {name, quantity, unit_price, product_id?}
    items: Mapped[list] = mapped_column(JSON, default=list)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    return_status: Mapped[ReturnStatus] = mapped_column(Enum(ReturnStatus), default=ReturnStatus.none)
    return_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contact: Mapped["Contact"] = relationship()
    delivery: Mapped["Delivery | None"] = relationship(back_populates="order", uselist=False)


class DeliveryStatus(PyEnum):
    pending = "pending"
    on_way = "on_way"
    delivered = "delivered"
    failed = "failed"


class Delivery(Base):
    __tablename__ = "deliveries"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), unique=True, index=True)
    status: Mapped[DeliveryStatus] = mapped_column(Enum(DeliveryStatus), default=DeliveryStatus.pending)
    address: Mapped[str | None] = mapped_column(Text)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime)
    driver_name: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order: Mapped["Order"] = relationship(back_populates="delivery")
