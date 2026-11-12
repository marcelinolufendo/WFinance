"""Testes para as rotas de mensagens."""
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import select

from app.models import Message, MessageType, Direction, MessageStatus


class TestListMessages:
    async def test_list_empty(self, client, sample_conversation):
        resp = await client.get(f"/conversations/{sample_conversation.id}/messages")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_with_messages(self, client, sample_conversation, db_session):
        msg = Message(
            conversation_id=sample_conversation.id,
            wa_message_id="wamid.list001",
            direction=Direction.inbound,
            type=MessageType.text,
            content="Olá, preciso de ajuda",
            status=MessageStatus.received,
        )
        db_session.add(msg)
        await db_session.commit()

        resp = await client.get(f"/conversations/{sample_conversation.id}/messages")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["content"] == "Olá, preciso de ajuda"
        assert data[0]["direction"] == "inbound"
        assert "media_path" in data[0]


class TestSendMessage:
    async def test_send_ok(self, client, sample_conversation):
        mock_result = {"messages": [{"id": "wamid.sent001"}]}
        with patch("app.routes.messages.whatsapp.send_text", new=AsyncMock(return_value=mock_result)):
            resp = await client.post(
                f"/conversations/{sample_conversation.id}/messages",
                json={"text": "Bom dia, em que posso ajudar?"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["wa_message_id"] == "wamid.sent001"

    async def test_send_window_closed(self, client, db_session):
        """Conversa com janela encerrada (last_client_message_at = None)."""
        from app.models import Contact, Conversation
        contact = Contact(phone="244900000099")
        db_session.add(contact)
        await db_session.flush()

        conv = Conversation(contact_id=contact.id, last_client_message_at=None)
        db_session.add(conv)
        await db_session.commit()
        await db_session.refresh(conv)

        resp = await client.post(
            f"/conversations/{conv.id}/messages",
            json={"text": "Mensagem fora da janela"},
        )
        assert resp.status_code == 422
        assert "janela" in resp.json()["detail"].lower()

    async def test_send_conversation_not_found(self, client):
        resp = await client.post("/conversations/9999/messages", json={"text": "teste"})
        assert resp.status_code == 404
