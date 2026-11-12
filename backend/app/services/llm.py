import anthropic

from app.config import settings

_SYSTEM = """\
És um assistente de atendimento ao cliente de uma empresa financeira angolana.
O teu papel é sugerir respostas curtas, profissionais e em português para o atendente humano responder ao cliente via WhatsApp.

Regras:
- Responde APENAS com o texto da mensagem sugerida, sem prefixos nem explicações.
- Usa um tom cordial, directo e profissional.
- Mantém a resposta breve (1-3 frases no máximo).
- Se o cliente fizer uma pergunta técnica ou específica que não consegues responder, sugere que o atendente recolha mais informações ou transfira para um especialista.
- Nunca inventes informações financeiras (saldos, taxas, prazos).
"""

_MAX_HISTORY = 20  # últimas N mensagens para contexto


async def suggest_reply(history: list[dict]) -> str:
    """
    Recebe o histórico de mensagens e devolve uma sugestão de resposta.

    history: lista de dicts com keys direction ("inbound"|"outbound"),
             type, content.
    """
    api_messages = _build_messages(history)
    if not api_messages:
        return ""

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    response = await client.messages.create(
        model="claude-opus-5-5",
        max_tokens=512,
        system=_SYSTEM,
        messages=api_messages,
    )

    return response.content[0].text.strip()


def _build_messages(history: list[dict]) -> list[dict]:
    """
    Converte o histórico de mensagens no formato da API Anthropic.
    Mensagens consecutivas do mesmo lado são fundidas numa só.
    Apenas mensagens de texto com conteúdo são incluídas.
    O último bloco deve sempre ser do papel "user".
    """
    tail = [m for m in history[-_MAX_HISTORY:] if m.get("type") == "text" and m.get("content")]

    merged: list[dict] = []
    for msg in tail:
        role = "user" if msg["direction"] == "inbound" else "assistant"
        if merged and merged[-1]["role"] == role:
            merged[-1]["content"] += "\n" + msg["content"]
        else:
            merged.append({"role": role, "content": msg["content"]})

    # A API exige que o último bloco seja "user"
    if not merged or merged[-1]["role"] != "user":
        return []

    return merged
