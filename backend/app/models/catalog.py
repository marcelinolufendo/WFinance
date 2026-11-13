from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, Text, Numeric, Boolean, DateTime, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ProductStatus(PyEnum):
    active = "active"
    inactive = "inactive"


class CampaignStatus(PyEnum):
    draft = "draft"
    active = "active"
    paused = "paused"
    ended = "ended"


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    stock: Mapped[int | None] = mapped_column(Integer)
    stock_min: Mapped[int | None] = mapped_column(Integer)
    deposit_percent: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[ProductStatus] = mapped_column(Enum(ProductStatus), default=ProductStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[ProductStatus] = mapped_column(Enum(ProductStatus, name="servicestatus"), default=ProductStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    message_template: Mapped[str | None] = mapped_column(Text)
    status: Mapped[CampaignStatus] = mapped_column(Enum(CampaignStatus), default=CampaignStatus.draft)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
