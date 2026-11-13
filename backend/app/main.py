from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routes import webhook, messages, ws, media, suggest, catalog, orders, customers, dashboard, knowledge


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _run_migrations(conn)
    from app.database import AsyncSessionLocal
    from app.seeds import run_seeds
    async with AsyncSessionLocal() as session:
        await run_seeds(session)
    yield


async def _run_migrations(conn) -> None:
    """Aplica colunas novas em tabelas existentes (idempotente)."""
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address TEXT",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS segment VARCHAR(50) NOT NULL DEFAULT 'regular'",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS internal_notes TEXT",
    ]
    for sql in migrations:
        await conn.execute(text(sql))


app = FastAPI(title="WFinance WhatsApp API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook.router)
app.include_router(messages.router)
app.include_router(ws.router)
app.include_router(media.router)
app.include_router(suggest.router)
app.include_router(catalog.router)
app.include_router(orders.router)
app.include_router(customers.router)
app.include_router(dashboard.router)
app.include_router(knowledge.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
