from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings
import redis.asyncio as aioredis
import json

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


async def store_refresh_token(user_id: int, token: str) -> None:
    redis = await get_redis()
    key = f"refresh_token:{user_id}:{token[-16:]}"
    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    await redis.setex(key, ttl, token)


async def verify_refresh_token_stored(user_id: int, token: str) -> bool:
    redis = await get_redis()
    key = f"refresh_token:{user_id}:{token[-16:]}"
    stored = await redis.get(key)
    return stored == token


async def revoke_refresh_token(user_id: int, token: str) -> None:
    redis = await get_redis()
    key = f"refresh_token:{user_id}:{token[-16:]}"
    await redis.delete(key)


async def increment_login_attempts(email: str, municipio_id: int) -> int:
    redis = await get_redis()
    key = f"login_attempts:{municipio_id}:{email}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 900)
    return count


async def reset_login_attempts(email: str, municipio_id: int) -> None:
    redis = await get_redis()
    key = f"login_attempts:{municipio_id}:{email}"
    await redis.delete(key)


async def get_login_attempts(email: str, municipio_id: int) -> int:
    redis = await get_redis()
    key = f"login_attempts:{municipio_id}:{email}"
    val = await redis.get(key)
    return int(val) if val else 0
