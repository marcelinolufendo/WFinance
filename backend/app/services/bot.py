"""
Bot de atendimento automático via OpenRouter.
Constrói o system prompt dinamicamente com produtos, serviços e knowledge base.
"""
import json
import logging
import os
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Product, Service, KnowledgeBase, BotConfig, ProductStatus

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_MAX_HISTORY = 15


async def get_bot_config(db: AsyncSession) -> BotConfig | None:
    return await db.scalar(select(BotConfig).where(BotConfig.id == 1))


async def bot_reply(
    conversation_id: int,
    history: list[dict],
    db: AsyncSession,
) -> dict[str, Any] | None:
    """
    Chama o bot e devolve um dict:
      { "reply": str, "action": str | None, "items": list | None }
    Devolve None se o bot está desactivado ou falha.
    """
    config = await get_bot_config(db)
    if not config or not config.enabled:
        return None

    api_key = config.openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        logger.warning("OPENROUTER_API_KEY não configurado")
        return None

    system_prompt = await _build_system_prompt(config, db)
    messages = _build_messages(history)
    if not messages:
        return None

    payload = {
        "model": config.model,
        "messages": [{"role": "system", "content": system_prompt}, *messages],
        "max_tokens": 512,
        "temperature": 0.7,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://wfinance.app",
                    "X-Title": "WFinance Bot",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        raw = data["choices"][0]["message"]["content"].strip()
        return _parse_response(raw)

    except httpx.HTTPStatusError as exc:
        body = exc.response.text[:500] if exc.response else ""
        logger.error("Erro ao chamar OpenRouter [%s]: %s | body: %s", exc.response.status_code, exc, body)
        return None
    except Exception as exc:
        logger.error("Erro ao chamar OpenRouter: %s", exc)
        return None


async def _build_system_prompt(config: BotConfig, db: AsyncSession) -> str:
    tone_map = {
        "friendly": "amigável e próximo, usa linguagem informal mas respeitosa",
        "formal": "formal e profissional",
        "casual": "descontraído e jovial",
    }
    tone_desc = tone_map.get(config.tone, "amigável")

    products_text = await _products_text(db)
    knowledge_text = await _knowledge_text(db)

    prompt = f"""És o assistente virtual de "{config.store_name}". Atende clientes via WhatsApp em português de Angola.

Tom: {tone_desc}.

{products_text}

{knowledge_text}

## Regras importantes
- Responde SEMPRE em português de Angola.
- Sê conciso (1-4 frases). Não uses bullet points longos no WhatsApp.
- Se o cliente perguntar por um produto que não existe, diz honestamente que não tens.
- Nunca inventes preços, prazos ou informações que não estão aqui.
- Para saudações iniciais, apresenta-te e pergunta como podes ajudar.

## Quando o cliente quer fazer uma encomenda
Se o cliente confirmar que quer encomendar algo, responde com JSON puro (sem markdown, sem ```):
{{"reply": "mensagem para o cliente", "action": "create_order", "items": [{{"name": "...", "quantity": 1, "unit_price": 0}}]}}

Para qualquer outra resposta, envia apenas o texto simples, sem JSON."""

    if config.extra_instructions:
        prompt += f"\n\n## Instruções adicionais\n{config.extra_instructions}"

    return prompt


async def _products_text(db: AsyncSession) -> str:
    products = (await db.scalars(
        select(Product).where(Product.status == ProductStatus.active)
    )).all()
    services = (await db.scalars(
        select(Service).where(Service.status == ProductStatus.active)
    )).all()

    lines = ["## Catálogo"]
    if products:
        lines.append("**Produtos:**")
        for p in products:
            stock = f"(stock: {p.stock})" if p.stock is not None else "(stock não definido)"
            price = f"{p.price:,.0f} AOA" if p.price else "preço a consultar"
            desc = f" — {p.description}" if p.description else ""
            lines.append(f"- {p.name}: {price} {stock}{desc}")

    if services:
        lines.append("**Serviços:**")
        for s in services:
            price = f"{s.price:,.0f} AOA" if s.price else "preço a consultar"
            duration = f" ({s.duration_minutes} min)" if s.duration_minutes else ""
            desc = f" — {s.description}" if s.description else ""
            lines.append(f"- {s.name}: {price}{duration}{desc}")

    if not products and not services:
        lines.append("Nenhum produto ou serviço disponível de momento.")

    return "\n".join(lines)


async def _knowledge_text(db: AsyncSession) -> str:
    entries = (await db.scalars(
        select(KnowledgeBase).where(KnowledgeBase.active == True).order_by(KnowledgeBase.category)
    )).all()

    if not entries:
        return ""

    lines = ["## Informações da loja"]
    current_cat = None
    cat_labels = {
        "delivery": "Entregas",
        "payment": "Pagamentos",
        "schedule": "Horários",
        "policy": "Políticas",
        "faq": "Perguntas frequentes",
        "other": "Outras informações",
    }
    for e in entries:
        cat = e.category.value
        if cat != current_cat:
            lines.append(f"\n**{cat_labels.get(cat, cat)}:**")
            current_cat = cat
        lines.append(f"- {e.title}: {e.content}")

    return "\n".join(lines)


def _build_messages(history: list[dict]) -> list[dict]:
    tail = [m for m in history[-_MAX_HISTORY:] if m.get("type") == "text" and m.get("content")]
    merged: list[dict] = []
    for msg in tail:
        role = "user" if msg["direction"] == "inbound" else "assistant"
        if merged and merged[-1]["role"] == role:
            merged[-1]["content"] += "\n" + msg["content"]
        else:
            merged.append({"role": role, "content": msg["content"]})
    if not merged or merged[-1]["role"] != "user":
        return []
    return merged


def _parse_response(raw: str) -> dict[str, Any]:
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "reply" in data:
            return {
                "reply": data["reply"],
                "action": data.get("action"),
                "items": data.get("items"),
            }
    except (json.JSONDecodeError, ValueError):
        pass
    return {"reply": raw, "action": None, "items": None}
