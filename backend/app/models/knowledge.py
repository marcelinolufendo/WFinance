from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class KnowledgeCategory(PyEnum):
    delivery = "delivery"
    payment = "payment"
    schedule = "schedule"
    policy = "policy"
    faq = "faq"
    other = "other"


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[KnowledgeCategory] = mapped_column(
        Enum(KnowledgeCategory), nullable=False, default=KnowledgeCategory.other
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class BotConfig(Base):
    __tablename__ = "bot_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False, default="google/gemini-2.0-flash-001")
    openrouter_api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tone: Mapped[str] = mapped_column(String(50), nullable=False, default="friendly")
    store_name: Mapped[str] = mapped_column(String(255), nullable=False, default="A nossa loja")
    extra_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    auto_create_order: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
