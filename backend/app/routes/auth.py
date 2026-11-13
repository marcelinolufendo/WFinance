from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.auth import verify_password, create_token

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.username == body.username))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    return {"token": create_token(user.username), "username": user.username, "is_admin": user.is_admin}


@router.get("/status")
async def auth_status(db: AsyncSession = Depends(get_db)):
    """Diagnóstico: verifica se o admin existe (não requer autenticação)."""
    from app.config import settings
    users = await db.scalars(select(User))
    all_users = users.all()
    return {
        "users_count": len(all_users),
        "admin_username_config": settings.admin_username,
        "users": [{"id": u.id, "username": u.username, "is_admin": u.is_admin} for u in all_users],
    }


@router.post("/change-password")
async def change_password(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    username = body.get("username")
    old_password = body.get("old_password")
    new_password = body.get("new_password")
    if not username or not old_password or not new_password:
        raise HTTPException(400, "Campos obrigatórios em falta")

    user = await db.scalar(select(User).where(User.username == username))
    if not user or not verify_password(old_password, user.hashed_password):
        raise HTTPException(401, "Credenciais inválidas")

    from app.services.auth import hash_password
    user.hashed_password = hash_password(new_password)
    await db.commit()
    return {"detail": "Palavra-passe alterada com sucesso"}
