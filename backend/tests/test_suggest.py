"""Testes para a rota de sugestão LLM."""
import pytest
from unittest.mock import AsyncMock, patch

from app.models import Message, Direction, MessageType, MessageStatus


class TestSuggestRoute:
    async def test_suggest_ok(self, client, sample_conversation, db_session):
        # Adiciona mensagem inbound para ter contexto
        msg = Message(
            conversation_id=sample_conversation.id,
            wa_message_id="wamid.sug001",
            direction=Direction.inbound,
            type=MessageType.text,
            content="Qual é o prazo para transferência?",
            status=MessageStatus.received,
        )
        db_session.add(msg)
        await db_session.commit()

        with patch("app.routes.suggest.suggest_reply", new=AsyncMock(return_value="O prazo habitual é de 24h úteis.")):
            resp = await client.post(f"/conversations/{sample_conversation.id}/suggest")

        assert resp.status_code == 200
        assert resp.json()["suggestion"] == "O prazo habitual é de 24h úteis."

    async def test_suggest_no_messages_returns_404(self, client, sample_conversation):
        resp = await client.post(f"/conversations/{sample_conversation.id}/suggest")
        assert resp.status_code == 404

    async def test_suggest_llm_error_returns_502(self, client, sample_conversation, db_session):
        msg = Message(
            conversation_id=sample_conversation.id,
            wa_message_id="wamid.sug002",
            direction=Direction.inbound,
            type=MessageType.text,
            content="Alguma pergunta",
            status=MessageStatus.received,
        )
        db_session.add(msg)
        await db_session.commit()

        with patch("app.routes.suggest.suggest_reply", new=AsyncMock(side_effect=Exception("API down"))):
            resp = await client.post(f"/conversations/{sample_conversation.id}/suggest")

        assert resp.status_code == 502
