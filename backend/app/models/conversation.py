from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ControlledBy(PyEnum):
    human = "human"
    bot = "bot"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("contacts.id"), index=True)
    # última mensagem do cliente — controla a janela de 24h
    last_client_message_at: Mapped[datetime | None] = mapped_column(DateTime)
    controlled_by: Mapped[ControlledBy] = mapped_column(
        Enum(ControlledBy), default=ControlledBy.human
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    contact: Mapped["Contact"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation")

    @property
    def window_open(self) -> bool:
        if not self.last_client_message_at:
            return False
        delta = datetime.utcnow() - self.last_client_message_at
        return delta.total_seconds() < 86400  # 24h
