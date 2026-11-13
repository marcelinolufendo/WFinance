import asyncio
import hashlib
import hmac
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import Contact, Conversation, Message, Direction, MessageType, MessageStatus
from app.services.media import download_media

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["webhook"])


# ---------------------------------------------------------------------------
# Verificação de assinatura
# ---------------------------------------------------------------------------

def _verify_signature(body: bytes, signature_header: str | None) -> None:
    if not signature_header or not signature_header.startswith("sha256="):
        raise HTTPException(status_code=403, detail="Missing signature")
    expected = hmac.new(
        settings.whatsapp_app_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature_header[7:]):
        raise HTTPException(status_code=403, detail="Invalid signature")


# ---------------------------------------------------------------------------
# GET — verificação do webhook pela Meta
# ---------------------------------------------------------------------------

@router.get("")
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
):
    if hub_mode != "subscribe" or hub_verify_token != settings.whatsapp_verify_token:
        raise HTTPException(status_code=403, detail="Verification failed")
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(content=hub_challenge)


# ---------------------------------------------------------------------------
# POST — eventos da Meta (mensagens, status, erros)
# ---------------------------------------------------------------------------

@router.post("")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    body = await request.body()
    _verify_signature(body, request.headers.get("X-Hub-Signature-256"))

    payload: dict[str, Any] = await request.json()
    background_tasks.add_task(_process_payload, payload)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Processamento em background
# ---------------------------------------------------------------------------

async def _process_payload(payload: dict) -> None:
    async with AsyncSessionLocal() as db:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                await _handle_messages(value.get("messages", []), value.get("contacts", []), db)
                await _handle_statuses(value.get("statuses", []), db)


async def _handle_messages(
    messages: list[dict], contacts: list[dict], db: AsyncSession
) -> None:
    contact_names = {c["wa_id"]: c.get("profile", {}).get("name") for c in contacts}

    for msg in messages:
        phone = msg["from"]
        wa_id = msg["id"]

        # Idempotência: ignorar duplicados
        existing = await db.scalar(select(Message).where(Message.wa_message_id == wa_id))
        if existing:
            continue

        contact, is_new_contact = await _get_or_create_contact(db, phone, contact_names.get(phone))
        conversation = await _get_or_create_conversation(db, contact.id)

        # Actualiza janela de 24h
        from datetime import datetime
        conversation.last_client_message_at = datetime.utcnow()

        msg_type = _resolve_type(msg.get("type", "text"))
        content = _extract_content(msg)
        mime_type = _extract_mime(msg)

        message = Message(
            conversation_id=conversation.id,
            wa_message_id=wa_id,
            direction=Direction.inbound,
            type=msg_type,
            content=content,
            status=MessageStatus.received,
        )
        db.add(message)
        conversation.last_message_preview = (content or "")[:120]
        await db.commit()
        await db.refresh(message)
        logger.info("Mensagem recebida: %s de %s", wa_id, phone)

        # Notifica clientes globais (lista de conversas em tempo real)
        from app.websocket.manager import manager
        await manager.broadcast_global({
            "type": "new_message",
            "conversation_id": conversation.id,
            "contact": {"id": contact.id, "phone": contact.phone, "name": contact.name},
            "controlled_by": conversation.controlled_by.value,
            "preview": (content or "")[:60],
            "direction": "inbound",
            "last_message_preview": (content or "")[:120],
        })

        # Mensagem de boas-vindas para novo contacto
        if is_new_contact and conversation.controlled_by.value == "bot":
            asyncio.create_task(_send_welcome(contact.phone))

        # Dispara download assíncrono para tipos de média
        if msg_type != MessageType.text and content and mime_type:
            asyncio.create_task(_download_and_store(
                message.id, content, mime_type,
                conversation.id, contact.id,
                conversation.controlled_by.value == "bot",
            ))

        # Verificar confirmação de recebimento de entrega
        if msg_type == MessageType.text and content:
            asyncio.create_task(_check_delivery_confirmation(contact.id, content, conversation.id))

        # Bot de resposta automática (apenas mensagens de texto)
        if msg_type == MessageType.text and conversation.controlled_by.value == "bot":
            asyncio.create_task(_bot_auto_reply(conversation.id, contact.id))


async def _handle_statuses(statuses: list[dict], db: AsyncSession) -> None:
    status_map = {
        "sent": MessageStatus.sent,
        "delivered": MessageStatus.delivered,
        "read": MessageStatus.read,
        "failed": MessageStatus.failed,
    }
    for status_obj in statuses:
        wa_id = status_obj["id"]
        new_status = status_map.get(status_obj.get("status"))
        if not new_status:
            continue
        message = await db.scalar(select(Message).where(Message.wa_message_id == wa_id))
        if message and message.advance_status(new_status):
            await db.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_or_create_contact(db: AsyncSession, phone: str, name: str | None) -> tuple["Contact", bool]:
    contact = await db.scalar(select(Contact).where(Contact.phone == phone))
    if not contact:
        contact = Contact(phone=phone, name=name)
        db.add(contact)
        await db.flush()
        return contact, True
    if name and not contact.name:
        contact.name = name
    return contact, False


async def _get_or_create_conversation(db: AsyncSession, contact_id: int) -> Conversation:
    conv = await db.scalar(
        select(Conversation).where(Conversation.contact_id == contact_id)
    )
    if not conv:
        conv = Conversation(contact_id=contact_id)
        db.add(conv)
        await db.flush()
    return conv


def _resolve_type(raw: str) -> MessageType:
    try:
        return MessageType[raw]
    except KeyError:
        return MessageType.text


def _extract_content(msg: dict) -> str | None:
    t = msg.get("type", "text")
    if t == "text":
        return msg.get("text", {}).get("body")
    if t == "audio":
        return msg.get("audio", {}).get("id")
    if t == "image":
        return msg.get("image", {}).get("id")
    if t == "document":
        return msg.get("document", {}).get("id")
    return None


def _extract_mime(msg: dict) -> str | None:
    t = msg.get("type", "text")
    block = msg.get(t, {})
    return block.get("mime_type")


async def _send_welcome(phone: str) -> None:
    try:
        async with AsyncSessionLocal() as session:
            from app.models.knowledge import BotConfig
            config = await session.scalar(select(BotConfig).where(BotConfig.id == 1))
            if not config or not config.enabled:
                return
            store = config.store_name or "a nossa loja"
        from app.services.whatsapp import send_text
        await send_text(phone, f"Olá! 👋 Bem-vindo(a) a *{store}*! Como posso ajudar-te hoje? 😊")
    except Exception as exc:
        logger.error("Erro na mensagem de boas-vindas: %s", exc)


async def _bot_auto_reply(conversation_id: int, contact_id: int) -> None:
    """Chama o bot e envia a resposta automática via WhatsApp."""
    from app.database import AsyncSessionLocal
    from app.services.bot import bot_reply, get_bot_config
    from app.services.whatsapp import send_text
    from app.models import Order, OrderStatus, PaymentMethod, PaymentStatus, Contact

    try:
        async with AsyncSessionLocal() as session:
            msgs = (await session.scalars(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at)
            )).all()

            history = [
                {"direction": m.direction.value, "type": m.type.value, "content": m.content}
                for m in msgs
            ]

            from app.websocket.manager import manager
            await manager.broadcast(conversation_id, {"type": "typing", "value": True})
            result = await bot_reply(conversation_id, contact_id, history, session)
            await manager.broadcast(conversation_id, {"type": "typing", "value": False})
            if not result:
                return

            reply_text = result["reply"]
            contact = await session.get(Contact, contact_id)
            if not contact:
                return

            wa_resp = await send_text(contact.phone, reply_text)
            wa_msg_id = wa_resp.get("messages", [{}])[0].get("id")

            out_msg = Message(
                conversation_id=conversation_id,
                wa_message_id=wa_msg_id or f"bot_{conversation_id}_{len(msgs)}",
                direction=Direction.outbound,
                type=MessageType.text,
                content=reply_text,
                status=MessageStatus.sent,
            )
            session.add(out_msg)

            if result.get("action") == "create_order" and result.get("items"):
                config = await get_bot_config(session)
                if config and config.auto_create_order:
                    items = result["items"]
                    total = sum(i.get("unit_price", 0) * i.get("quantity", 1) for i in items)
                    order = Order(
                        contact_id=contact_id,
                        conversation_id=conversation_id,
                        status=OrderStatus.draft,
                        payment_method=PaymentMethod.pending,
                        payment_status=PaymentStatus.unpaid,
                        items=items,
                        total_amount=total,
                        notes="Criada automaticamente pelo bot",
                    )
                    session.add(order)
                    await session.flush()
                    # Guardar dados de entrega se o bot os recolheu
                    delivery_data = result.get("delivery") or {}
                    if delivery_data.get("address") or delivery_data.get("contact_name"):
                        from app.models.orders import Delivery, DeliveryStatus
                        d = Delivery(
                            order_id=order.id,
                            address=delivery_data.get("address"),
                            contact_name=delivery_data.get("contact_name"),
                            contact_phone=delivery_data.get("contact_phone"),
                            status=DeliveryStatus.pending,
                        )
                        session.add(d)

            await session.commit()

    except Exception as exc:
        logger.error("Erro no bot auto-reply: %s", exc)


_CONFIRM_KEYWORDS = {
    "recebi", "confirmado", "confirmei", "sim", "ok", "entregue",
    "chegou", "recebido", "tá bom", "ta bom", "perfeito", "obrigado",
    "obrigada", "chegou sim", "recebi sim", "já recebi",
}

async def _check_delivery_confirmation(contact_id: int, text: str, conversation_id: int) -> None:
    """Se o cliente confirmar o recebimento, conclui a encomenda e envia a fatura."""
    normalized = text.strip().lower()
    if not any(kw in normalized for kw in _CONFIRM_KEYWORDS):
        return

    try:
        async with AsyncSessionLocal() as session:
            from app.models.orders import Order, OrderStatus
            from sqlalchemy.orm import selectinload

            pending = await session.scalar(
                select(Order)
                .where(Order.contact_id == contact_id, Order.status == OrderStatus.delivered)
                .options(selectinload(Order.contact))
                .order_by(Order.created_at.desc())
            )
            if not pending:
                return

            pending.status = OrderStatus.completed
            await session.commit()
            logger.info("Encomenda #%d concluída por confirmação do cliente", pending.id)

            # Enviar fatura via WhatsApp
            contact = pending.contact
            if contact and contact.phone:
                items = pending.items or []
                lines = [f"🧾 *FACTURA #{pending.id}*"]
                if contact.name:
                    lines.append(f"Cliente: {contact.name}")
                lines.append(f"Data: {pending.created_at.strftime('%d/%m/%Y')}")
                lines.append("")
                lines.append("*Artigos:*")
                for item in items:
                    name = item.get("name", "")
                    qty = item.get("quantity", 1)
                    price = float(item.get("unit_price", 0))
                    lines.append(f"  • {name} x{qty} — {price * qty:,.0f} AOA")
                lines.append("")
                total = float(pending.total_amount) if pending.total_amount else sum(
                    float(i.get("unit_price", 0)) * float(i.get("quantity", 1)) for i in items
                )
                lines.append(f"*TOTAL: {total:,.0f} AOA*")
                lines.append(f"Pagamento: {pending.payment_method.value}")
                lines.append("")
                lines.append("✅ Obrigado pela tua compra! Esperamos vê-lo em breve. 😊")

                from app.services.whatsapp import send_text
                await send_text(contact.phone, "\n".join(lines))

                # Notificar agentes via WebSocket
                from app.websocket.manager import manager
                await manager.broadcast_global({
                    "type": "order_completed",
                    "order_id": pending.id,
                    "contact_id": contact_id,
                    "conversation_id": conversation_id,
                })
    except Exception as exc:
        logger.error("Erro ao verificar confirmação de entrega: %s", exc)


async def _download_and_store(
    message_id: int,
    media_id: str,
    mime_type: str,
    conversation_id: int = 0,
    contact_id: int = 0,
    bot_mode: bool = False,
) -> None:
    """Baixa a mídia, transcreve áudio (Groq) e actualiza a mensagem."""
    try:
        relative_path = await download_media(media_id, mime_type)

        transcription: str | None = None
        if mime_type.startswith("audio/") and conversation_id:
            from pathlib import Path
            from app.config import settings
            from app.services.transcribe import transcribe_audio
            full_path = Path(settings.media_storage_path) / relative_path
            transcription = await transcribe_audio(str(full_path))

        async with AsyncSessionLocal() as session:
            msg = await session.get(Message, message_id)
            if msg:
                msg.media_path = relative_path
                if transcription:
                    msg.content = transcription
                await session.commit()
                logger.info("media_path actualizado: %s", relative_path)

        if transcription and bot_mode and conversation_id and contact_id:
            asyncio.create_task(_bot_auto_reply(conversation_id, contact_id))
    except Exception as exc:
        logger.error("Erro ao baixar média %s: %s", media_id, exc)
