"""
Configura variáveis de ambiente ANTES de qualquer import da app,
depois cria uma DB SQLite em memória e sobrepõe a dependência get_db.
"""
import os
import hashlib
import hmac

# --- env vars para a app não crashar ao importar settings ---
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///file:testdb?mode=memory&cache=shared&uri=true")
os.environ.setdefault("WHATSAPP_TOKEN", "test-token")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "111111")
os.environ.setdefault("WHATSAPP_APP_SECRET", "test-secret")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "test-verify-token")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("MEDIA_STORAGE_PATH", "/tmp/wfinance-test-media")

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models import Contact, Conversation, Message, Direction, MessageType, MessageStatus

_TEST_DB = "sqlite+aiosqlite:///file:testdb?mode=memory&cache=shared&uri=true"
_engine = create_async_engine(_TEST_DB, echo=False)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


async def _override_db():
    async with _Session() as session:
        yield session


app.dependency_overrides[get_db] = _override_db


@pytest_asyncio.fixture(autouse=True)
async def reset_db():
    """Recria as tabelas antes de cada teste."""
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def db_session():
    async with _Session() as session:
        yield session


@pytest_asyncio.fixture
async def sample_conversation(db_session):
    """Cria contact + conversation com janela aberta."""
    from datetime import datetime
    contact = Contact(phone="244900000001", name="Teste Cliente")
    db_session.add(contact)
    await db_session.flush()

    conv = Conversation(
        contact_id=contact.id,
        last_client_message_at=datetime.utcnow(),
    )
    db_session.add(conv)
    await db_session.commit()
    await db_session.refresh(conv)
    return conv


def make_signature(body: bytes, secret: str = "test-secret") -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
