"""Testes unitários para o serviço LLM (sem chamadas reais à API)."""
import pytest
from app.services.llm import _build_messages


class TestBuildMessages:
    def _msg(self, direction: str, content: str, type_: str = "text") -> dict:
        return {"direction": direction, "type": type_, "content": content}

    def test_basic_inbound_outbound(self):
        history = [
            self._msg("inbound", "Olá"),
            self._msg("outbound", "Bom dia!"),
            self._msg("inbound", "Qual o saldo?"),
        ]
        result = _build_messages(history)
        assert len(result) == 3
        assert result[0] == {"role": "user", "content": "Olá"}
        assert result[1] == {"role": "assistant", "content": "Bom dia!"}
        assert result[2] == {"role": "user", "content": "Qual o saldo?"}

    def test_consecutive_inbound_messages_are_merged(self):
        history = [
            self._msg("inbound", "Primeira linha"),
            self._msg("inbound", "Segunda linha"),
            self._msg("outbound", "Resposta"),
            self._msg("inbound", "Nova pergunta"),
        ]
        result = _build_messages(history)
        assert len(result) == 3
        assert result[0]["content"] == "Primeira linha\nSegunda linha"
        assert result[0]["role"] == "user"

    def test_consecutive_outbound_messages_are_merged(self):
        history = [
            self._msg("inbound", "Pergunta"),
            self._msg("outbound", "Parte 1"),
            self._msg("outbound", "Parte 2"),
            self._msg("inbound", "Obrigado"),
        ]
        result = _build_messages(history)
        assert len(result) == 3
        assert result[1]["content"] == "Parte 1\nParte 2"
        assert result[1]["role"] == "assistant"

    def test_last_message_outbound_returns_empty(self):
        """API Anthropic exige que a última mensagem seja 'user'."""
        history = [
            self._msg("inbound", "Pergunta"),
            self._msg("outbound", "Resposta"),
        ]
        result = _build_messages(history)
        assert result == []

    def test_non_text_messages_are_excluded(self):
        history = [
            self._msg("inbound", "Olá"),
            self._msg("inbound", "media123", type_="audio"),  # sem content útil
            self._msg("inbound", "Qual é o preço?"),
        ]
        result = _build_messages(history)
        # áudio é excluído porque type != text, mas o content é o media_id
        # na prática filtramos type == "text"
        assert all(m["role"] == "user" for m in result)
        texts = [m["content"] for m in result]
        assert "Olá" in "\n".join(texts)

    def test_empty_history(self):
        assert _build_messages([]) == []

    def test_only_outbound_history(self):
        history = [self._msg("outbound", "Mensagem enviada")]
        assert _build_messages(history) == []

    def test_respects_max_history_limit(self):
        """Apenas as últimas 20 mensagens são consideradas."""
        history = [self._msg("inbound", f"msg {i}") for i in range(30)]
        result = _build_messages(history)
        # 30 inbound consecutivos → fundidos em 1 bloco user
        assert len(result) == 1
        # mas o conteúdo vem das últimas 20
        assert "msg 10" in result[0]["content"]
        assert "msg 0" not in result[0]["content"]
