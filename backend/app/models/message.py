from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Direction(PyEnum):
    inbound = "inbound"
    outbound = "outbound"


class MessageType(PyEnum):
    text = "text"
    audio = "audio"
    image = "image"
    video = "video"
    document = "document"
    sticker = "sticker"
    template = "template"


class MessageStatus(PyEnum):
    received = "received"
    sent = "sent"
    delivered = "delivered"
    read = "read"
    failed = "failed"


# Ordem para garantir que só avançamos o status, nunca voltamos
STATUS_ORDER = {s: i for i, s in enumerate(MessageStatus)}


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"), index=True)
    wa_message_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    direction: Mapped[Direction] = mapped_column(Enum(Direction))
    type: Mapped[MessageType] = mapped_column(Enum(MessageType), default=MessageType.text)
    content: Mapped[str | None] = mapped_column(Text)
    media_path: Mapped[str | None] = mapped_column(String(512))
    status: Mapped[MessageStatus] = mapped_column(
        Enum(MessageStatus), default=MessageStatus.received
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")

    def advance_status(self, new_status: MessageStatus) -> bool:
        if STATUS_ORDER[new_status] > STATUS_ORDER[self.status]:
            self.status = new_status
            return True
        return False
