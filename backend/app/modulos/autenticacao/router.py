from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone
from jose import JWTError

from app.database import get_db
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    decode_token, store_refresh_token, verify_refresh_token_stored,
    revoke_refresh_token,
)
from app.core.deps import get_current_user, get_client_ip
from app.core.audit import log_event, Acoes
from app.models.usuario import Usuario, PerfilEnum
from app.models.municipio import Municipio
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, MeResponse

router = APIRouter(prefix="/auth", tags=["Autenticação"])


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)

    result = await db.execute(
        select(Usuario).where(
            Usuario.email == data.email,
            Usuario.municipio_id == data.municipio_id,
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.senha, user.senha_hash):
        await log_event(
            db, data.municipio_id, Acoes.LOGIN_INVALIDO, "usuario",
            descricao=f"Login inválido para {data.email}", endereco_ip=ip,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )

    if not user.ativo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário inativo")

    token_data = {
        "sub": str(user.id),
        "municipio_id": user.municipio_id,
        "perfil": user.perfil.value,
        "nome": user.nome,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    await store_refresh_token(user.id, refresh_token)

    await db.execute(
        update(Usuario).where(Usuario.id == user.id).values(ultimo_login_em=datetime.now(timezone.utc))
    )

    await log_event(
        db, user.municipio_id, Acoes.LOGIN_REALIZADO, "usuario",
        usuario=user, entidade_id=str(user.id), endereco_ip=ip,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        perfil=user.perfil,
        nome=user.nome,
        municipio_id=user.municipio_id,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token inválido ou expirado",
    )
    try:
        payload = decode_token(data.refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise credentials_exception

    if not await verify_refresh_token_stored(user_id, data.refresh_token):
        raise credentials_exception

    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.ativo:
        raise credentials_exception

    await revoke_refresh_token(user_id, data.refresh_token)

    token_data = {
        "sub": str(user.id),
        "municipio_id": user.municipio_id,
        "perfil": user.perfil.value,
        "nome": user.nome,
    }
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)
    await store_refresh_token(user.id, new_refresh)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        perfil=user.perfil,
        nome=user.nome,
        municipio_id=user.municipio_id,
    )


@router.post("/logout")
async def logout(
    data: RefreshRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = decode_token(data.refresh_token)
        user_id = int(payload.get("sub", 0))
        await revoke_refresh_token(user_id, data.refresh_token)
    except Exception:
        pass

    await log_event(
        db, current_user.municipio_id, Acoes.LOGOUT_REALIZADO, "usuario",
        usuario=current_user, entidade_id=str(current_user.id),
    )
    return {"message": "Logout realizado com sucesso"}


@router.get("/me", response_model=MeResponse)
async def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user
