from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("")
async def get_reports(db: AsyncSession = Depends(get_db)):
    # Tempo médio de resposta (minutos) - entre mensagem inbound e próxima outbound
    avg_resp = await db.execute(text("""
        SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at)) / 60) as avg_minutes
        FROM messages m1
        JOIN LATERAL (
            SELECT created_at FROM messages m2
            WHERE m2.conversation_id = m1.conversation_id
              AND m2.direction = 'outbound'
              AND m2.created_at > m1.created_at
            ORDER BY m2.created_at
            LIMIT 1
        ) m2 ON true
        WHERE m1.direction = 'inbound'
          AND m1.type = 'text'
    """))
    avg_minutes_row = avg_resp.fetchone()
    avg_response_minutes = round(float(avg_minutes_row[0]), 1) if avg_minutes_row and avg_minutes_row[0] else None

    # Taxa de conversão: conversas com pelo menos 1 encomenda / total conversas
    conv_total = await db.execute(text("SELECT COUNT(*) FROM conversations"))
    conv_with_order = await db.execute(text(
        "SELECT COUNT(DISTINCT conversation_id) FROM orders WHERE conversation_id IS NOT NULL"
    ))
    total_convs = conv_total.scalar() or 0
    convs_with_orders = conv_with_order.scalar() or 0
    conversion_rate = round(convs_with_orders / total_convs * 100, 1) if total_convs > 0 else 0

    # Perguntas mais frequentes - palavras mais comuns em mensagens inbound
    words_result = await db.execute(text("""
        SELECT content FROM messages
        WHERE direction = 'inbound' AND type = 'text' AND content IS NOT NULL
        ORDER BY created_at DESC LIMIT 500
    """))
    stop_words = {
        "o", "a", "os", "as", "um", "uma", "uns", "umas", "e", "é", "de", "do", "da", "dos", "das",
        "em", "no", "na", "nos", "nas", "com", "por", "para", "que", "se", "não", "sim", "me",
        "te", "lhe", "nos", "vos", "lhes", "eu", "tu", "ele", "ela", "nós", "eles", "elas",
        "este", "esse", "aquele", "isto", "isso", "aquilo", "meu", "teu", "seu", "como", "mas",
        "ou", "nem", "pois", "logo", "porque", "quando", "muito", "mais", "já", "só", "ainda",
        "bem", "mal", "olá", "ola", "bom", "dia", "boa", "tarde", "noite", "obrigado", "obrigada",
        "por", "favor", "queria", "quero", "preciso", "gostaria",
    }
    word_count: dict[str, int] = {}
    for row in words_result.fetchall():
        content = row[0] or ""
        for word in content.lower().split():
            word = word.strip(".,!?;:\"'()")
            if len(word) >= 4 and word not in stop_words and word.isalpha():
                word_count[word] = word_count.get(word, 0) + 1
    top_questions = sorted(word_count.items(), key=lambda x: -x[1])[:15]

    # Conversas por dia (últimos 30 dias)
    daily_convs = await db.execute(text("""
        SELECT DATE(created_at) as day, COUNT(*) as total
        FROM conversations
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
    """))
    conversations_by_day = [
        {"date": str(r[0]), "conversations": r[1]}
        for r in daily_convs.fetchall()
    ]

    # Encomendas e receita por dia (últimos 30 dias)
    daily_orders = await db.execute(text("""
        SELECT DATE(created_at) as day, COUNT(*) as orders,
               COALESCE(SUM(total_amount), 0) as revenue
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
    """))
    orders_by_day = [
        {"date": str(r[0]), "orders": r[1], "revenue": float(r[2])}
        for r in daily_orders.fetchall()
    ]

    # Alertas de stock baixo
    low_stock = await db.execute(text("""
        SELECT id, name, stock, stock_min FROM products
        WHERE stock_min IS NOT NULL AND stock IS NOT NULL AND stock <= stock_min AND status = 'active'
        ORDER BY stock ASC
    """))
    stock_alerts = [
        {"id": r[0], "name": r[1], "stock": r[2], "stock_min": r[3]}
        for r in low_stock.fetchall()
    ]

    # Totais gerais
    totals = await db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM conversations) as total_conversations,
            (SELECT COUNT(*) FROM conversations WHERE resolved_at IS NOT NULL) as resolved,
            (SELECT COUNT(*) FROM orders WHERE status = 'delivered') as delivered_orders,
            (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status = 'delivered') as total_revenue,
            (SELECT COUNT(*) FROM contacts) as total_customers,
            (SELECT COUNT(*) FROM messages WHERE direction = 'inbound') as inbound_messages,
            (SELECT COUNT(*) FROM messages WHERE direction = 'outbound') as outbound_messages
    """))
    t = totals.fetchone()

    return {
        "avg_response_minutes": avg_response_minutes,
        "conversion_rate": conversion_rate,
        "top_words": [{"word": w, "count": c} for w, c in top_questions],
        "conversations_by_day": conversations_by_day,
        "orders_by_day": orders_by_day,
        "stock_alerts": stock_alerts,
        "totals": {
            "conversations": t[0], "resolved": t[1], "delivered_orders": t[2],
            "total_revenue": float(t[3]), "customers": t[4],
            "inbound_messages": t[5], "outbound_messages": t[6],
        },
    }
