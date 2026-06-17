from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError
from app.database import get_db
from app.core.security import decode_token
from app.models.usuario import Usuario, PerfilEnum
from typing import Optional

security = HTTPBearer()


class TokenData:
    def __init__(self, user_id: int, municipio_id: int, perfil: PerfilEnum, nome: str):
        self.user_id = user_id
        self.municipio_id = municipio_id
        self.perfil = perfil
        self.nome = nome


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id: int = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise credentials_exception

    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.ativo:
        raise credentials_exception

    return user


async def get_current_token_data(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise credentials_exception
        return TokenData(
            user_id=int(payload["sub"]),
            municipio_id=int(payload["municipio_id"]),
            perfil=PerfilEnum(payload["perfil"]),
            nome=payload.get("nome", ""),
        )
    except (JWTError, TypeError, ValueError, KeyError):
        raise credentials_exception


def require_perfis(*perfis: PerfilEnum):
    async def checker(current_user: Usuario = Depends(get_current_user)) -> Usuario:
        if current_user.perfil not in perfis:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para acessar este recurso",
            )
        return current_user
    return checker


require_admin = require_perfis(PerfilEnum.SUPER_ADMIN, PerfilEnum.ADMINISTRADOR)
require_super_admin = require_perfis(PerfilEnum.SUPER_ADMIN)
require_any = require_perfis(*list(PerfilEnum))


def get_municipio_id_from_token(current_user: Usuario = Depends(get_current_user)) -> int:
    return current_user.municipio_id


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
