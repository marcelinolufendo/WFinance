from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"
EXPIRE_MINUTES = 60 * 24 * 7  # 7 dias


def hash_password(password: str) -> str:
    return pwd_context.hash(password.encode()[:72].decode("utf-8", errors="ignore"))


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain.encode()[:72].decode("utf-8", errors="ignore"), hashed)


def create_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": expire}, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> str | None:
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return data.get("sub")
    except JWTError:
        return None
