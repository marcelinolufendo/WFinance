"""
Seeders iniciais — executa uma vez no arranque se as tabelas estiverem vazias.
Popula knowledge_base e bot_config com dados de exemplo.
"""
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import KnowledgeBase, BotConfig, KnowledgeCategory

logger = logging.getLogger(__name__)

KNOWLEDGE_SEEDS = [
    # Entregas
    {"title": "Zonas de entrega", "content": "Entregamos em Luanda (todos os municípios), Viana e Cacuaco. Para outras províncias, consultar disponibilidade.", "category": "delivery"},
    {"title": "Prazo de entrega", "content": "Dentro de Luanda: 24 a 48 horas após confirmação. Encomendas confirmadas até às 12h são entregues no dia seguinte.", "category": "delivery"},
    {"title": "Taxa de entrega", "content": "Entrega gratuita para encomendas acima de 15.000 AOA. Abaixo desse valor, taxa de 1.500 AOA.", "category": "delivery"},
    {"title": "Rastreio de entrega", "content": "Após a saída para entrega, o cliente recebe o contacto do estafeta via WhatsApp.", "category": "delivery"},

    # Pagamentos
    {"title": "Métodos de pagamento aceites", "content": "Aceitamos: dinheiro na entrega, transferência bancária (BFA, BIC, Millennium Atlântico) e Multicaixa Express.", "category": "payment"},
    {"title": "Pagamento por transferência", "content": "Enviar comprovativo de transferência para este WhatsApp antes da entrega. A encomenda só é confirmada após validação.", "category": "payment"},
    {"title": "Multicaixa Express", "content": "Pagamento via Multicaixa Express aceite. Número disponibilizado após confirmação da encomenda.", "category": "payment"},

    # Horários
    {"title": "Horário de atendimento", "content": "Segunda a Sexta: 8h às 18h. Sábado: 9h às 14h. Domingo e feriados: encerrado.", "category": "schedule"},
    {"title": "Horário de entregas", "content": "Entregas realizadas de segunda a sábado, das 9h às 17h.", "category": "schedule"},

    # Políticas
    {"title": "Política de devoluções", "content": "Devoluções aceites em até 7 dias após a entrega, produto em perfeito estado e embalagem original. Contactar o suporte para iniciar o processo.", "category": "policy"},
    {"title": "Garantia dos produtos", "content": "Todos os produtos têm garantia mínima de 30 dias contra defeitos de fabrico.", "category": "policy"},
    {"title": "Cancelamento de encomenda", "content": "O cliente pode cancelar até 2 horas após a confirmação, sem qualquer custo. Após esse prazo, pode ser cobrada taxa de 10%.", "category": "policy"},

    # FAQ
    {"title": "Como fazer uma encomenda", "content": "Pode encomendar directamente por este WhatsApp, indicando os produtos desejados e a quantidade. Iremos confirmar disponibilidade e preço.", "category": "faq"},
    {"title": "O produto está em stock?", "content": "Para verificar disponibilidade em tempo real, basta perguntar pelo produto específico neste chat.", "category": "faq"},
    {"title": "Descontos e promoções", "content": "Clientes VIP têm desconto de 10% em todos os produtos. Promoções sazonais são anunciadas neste canal.", "category": "faq"},
]


async def run_seeds(db: AsyncSession) -> None:
    try:
        kb_count = await db.scalar(select(func.count()).select_from(KnowledgeBase))
        if kb_count == 0:
            for seed in KNOWLEDGE_SEEDS:
                try:
                    cat = KnowledgeCategory(seed["category"])
                except ValueError:
                    cat = KnowledgeCategory.other
                db.add(KnowledgeBase(title=seed["title"], content=seed["content"], category=cat, active=True))
            logger.info("Knowledge base populada com %d entradas.", len(KNOWLEDGE_SEEDS))

        config_count = await db.scalar(select(func.count()).select_from(BotConfig))
        if config_count == 0:
            db.add(BotConfig(
                id=1,
                enabled=False,
                model="google/gemini-2.0-flash-001",
                tone="friendly",
                store_name="A nossa loja",
                extra_instructions="Quando o cliente perguntar por descontos, verifica sempre o segmento dele antes de confirmar.",
                auto_create_order=False,
            ))
            logger.info("BotConfig inicial criado.")

        await db.commit()
    except Exception as exc:
        logger.error("Erro nos seeders: %s", exc)
