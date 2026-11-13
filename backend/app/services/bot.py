"""
Bot de atendimento automático via OpenRouter.
Suporta tool calling para consultar encomendas do cliente em tempo real.
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

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "consultar_pedidos",
            "description": (
                "Consulta as encomendas do cliente actual na base de dados. "
                "Usa SEMPRE esta ferramenta quando o cliente perguntar sobre encomendas, "
                "pedidos, estado de entrega, histórico de compras ou qualquer informação "
                "relacionada com as suas compras. "
                "Nunca peças ao cliente o nome ou número de encomenda — já sabes quem é."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "estado": {
                        "type": "string",
                        "enum": ["todos", "activos", "entregues", "cancelados"],
                        "description": (
                            "'activos' para encomendas em curso, "
                            "'entregues' para concluídas, "
                            "'cancelados', ou 'todos' para ver tudo."
                        ),
                    }
                },
                "required": [],
            },
        },
    }
]


async def get_bot_config(db: AsyncSession) -> BotConfig | None:
    return await db.scalar(select(BotConfig).where(BotConfig.id == 1))


async def bot_reply(
    conversation_id: int,
    contact_id: int,
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

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://wfinance.app",
        "X-Title": "WFinance Bot",
    }

    payload: dict[str, Any] = {
        "model": config.model,
        "messages": [{"role": "system", "content": system_prompt}, *messages],
        "max_tokens": 512,
        "temperature": 0.7,
        "tools": _TOOLS,
        "tool_choice": "auto",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]
        msg = choice["message"]

        # Modelo quer chamar uma ferramenta
        if msg.get("tool_calls"):
            tool_messages: list[dict] = [msg]

            for tc in msg["tool_calls"]:
                fn_name = tc["function"]["name"]
                try:
                    fn_args = json.loads(tc["function"].get("arguments", "{}"))
                except json.JSONDecodeError:
                    fn_args = {}

                if fn_name == "consultar_pedidos":
                    tool_result = await _run_consultar_pedidos(
                        contact_id, fn_args.get("estado", "todos"), db
                    )
                else:
                    tool_result = json.dumps({"error": "ferramenta desconhecida"})

                logger.info("Tool %s → %s", fn_name, tool_result[:200])
                tool_messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": tool_result,
                })

            # Segunda chamada: modelo formula resposta final com os dados reais
            payload2: dict[str, Any] = {
                "model": config.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    *messages,
                    *tool_messages,
                ],
                "max_tokens": 512,
                "temperature": 0.7,
            }
            async with httpx.AsyncClient(timeout=30) as client:
                resp2 = await client.post(OPENROUTER_URL, headers=headers, json=payload2)
                resp2.raise_for_status()
                data2 = resp2.json()

            raw = (data2["choices"][0]["message"].get("content") or "").strip()
            return _parse_response(raw)

        # Resposta normal sem tool call
        raw = (msg.get("content") or "").strip()
        return _parse_response(raw)

    except httpx.HTTPStatusError as exc:
        body = exc.response.text[:500] if exc.response else ""
        logger.error("Erro ao chamar OpenRouter [%s]: %s | body: %s", exc.response.status_code, exc, body)
        return None
    except Exception as exc:
        logger.error("Erro ao chamar OpenRouter: %s", exc)
        return None


async def _run_consultar_pedidos(contact_id: int, estado: str, db: AsyncSession) -> str:
    """Executa a tool: devolve encomendas do cliente em JSON."""
    from app.models.orders import Order, OrderStatus

    active_statuses = {
        OrderStatus.draft, OrderStatus.confirmed,
        OrderStatus.preparing, OrderStatus.delivering,
    }

    orders = (await db.scalars(
        select(Order)
        .where(Order.contact_id == contact_id)
        .order_by(Order.created_at.desc())
        .limit(20)
    )).all()

    if estado == "activos":
        orders = [o for o in orders if o.status in active_statuses]
    elif estado == "entregues":
        orders = [o for o in orders if o.status == OrderStatus.delivered]
    elif estado == "cancelados":
        orders = [o for o in orders if o.status == OrderStatus.cancelled]

    if not orders:
        return json.dumps({"message": "Nenhuma encomenda encontrada.", "encomendas": []}, ensure_ascii=False)

    STATUS_PT = {
        "draft": "rascunho",
        "confirmed": "confirmada",
        "awaiting_deposit": "aguarda depósito",
        "preparing": "em preparação",
        "delivering": "a caminho / em entrega",
        "delivered": "entregue — aguarda confirmação",
        "completed": "concluída",
        "cancelled": "cancelada",
    }

    result = []
    for o in orders:
        items_str = ", ".join(
            f"{i.get('name', '?')} x{i.get('quantity', 1)}"
            for i in (o.items or [])
        )
        result.append({
            "id": o.id,
            "estado": STATUS_PT.get(o.status.value, o.status.value),
            "itens": items_str or "—",
            "total": f"{o.total_amount:,.0f} AOA" if o.total_amount else "—",
            "data": o.created_at.strftime("%d/%m/%Y"),
        })

    return json.dumps({"encomendas": result, "total": len(result)}, ensure_ascii=False)


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
- Quando o cliente perguntar sobre encomendas ou pedidos, usa SEMPRE a ferramenta consultar_pedidos — nunca peças o nome ou número de encomenda ao cliente.

## Quando o cliente quer fazer uma encomenda
1. Confirma os artigos e preços com o cliente.
2. Pede a *morada de entrega* (rua, bairro, município).
3. Pede o *nome da pessoa que vai receber* (pode ser diferente do cliente).
4. Pede um *número de telefone de contacto* para o estafeta.
5. Só depois de teres TODOS estes dados, responde com JSON puro (sem markdown, sem ```):
{{"reply": "mensagem para o cliente", "action": "create_order", "items": [{{"name": "...", "quantity": 1, "unit_price": 0}}], "delivery": {{"address": "...", "contact_name": "...", "contact_phone": "..."}}}}

## Produtos com depósito antecipado
Alguns produtos requerem pagamento de uma percentagem antes da entrega (indicado no catálogo como "depósito X%"). Quando um cliente encomendar esses produtos, informa-o do valor do depósito e que a encomenda só avança após o pagamento.

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
            deposit = f" [depósito {p.deposit_percent}%]" if p.deposit_percent else ""
            desc = f" — {p.description}" if p.description else ""
            lines.append(f"- {p.name}: {price} {stock}{deposit}{desc}")

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
    def _usable(m: dict) -> bool:
        content = m.get("content") or ""
        if not content:
            return False
        if m.get("type") == "text":
            return True
        if m.get("type") == "audio":
            return not content.strip().isdigit()
        return False

    tail = [m for m in history[-_MAX_HISTORY:] if _usable(m)]
    merged: list[dict] = []
    for msg in tail:
        role = "user" if msg["direction"] == "inbound" else "assistant"
        content = msg["content"]
        if msg.get("type") == "audio":
            content = f"[áudio transcrito] {content}"
        if merged and merged[-1]["role"] == role:
            merged[-1]["content"] += "\n" + content
        else:
            merged.append({"role": role, "content": content})
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
