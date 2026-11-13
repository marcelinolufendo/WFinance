from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address TEXT",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS segment VARCHAR(50) NOT NULL DEFAULT 'regular'",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS internal_notes TEXT",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS internal_notes VARCHAR(2000)",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_preview VARCHAR(120)",
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

# ---------------------------------------------------------------------------
# Auth middleware — protege todas as rotas excepto /webhook, /health, /auth, /ws
# ---------------------------------------------------------------------------

_PUBLIC_PREFIXES = ("/webhook", "/health", "/auth", "/ws")


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if any(path.startswith(p) for p in _PUBLIC_PREFIXES):
        return await call_next(request)

    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

    if not token:
        return JSONResponse({"detail": "Não autenticado"}, status_code=401)

    from app.services.auth import decode_token
    username = decode_token(token)
    if not username:
        return JSONResponse({"detail": "Token inválido ou expirado"}, status_code=401)

    return await call_next(request)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

from app.routes import auth, quick_replies, export  # noqa: E402

app.include_router(webhook.router)
app.include_router(auth.router)
app.include_router(messages.router)
app.include_router(ws.router)
app.include_router(media.router)
app.include_router(suggest.router)
app.include_router(catalog.router)
app.include_router(orders.router)
app.include_router(customers.router)
app.include_router(dashboard.router)
app.include_router(knowledge.router)
app.include_router(quick_replies.router)
app.include_router(export.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
