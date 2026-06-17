from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from app.database import get_db
from app.core.deps import require_admin
from app.models.log import LogSistema
from app.models.usuario import PerfilEnum, Usuario
from app.schemas.log import LogResponse

router = APIRouter(prefix="/logs", tags=["Logs de Auditoria"])


@router.get("", response_model=List[LogResponse])
async def listar_logs(
    acao: Optional[str] = None,
    entidade: Optional[str] = None,
    usuario_id: Optional[int] = None,
    municipio_id: Optional[int] = None,
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(LogSistema)

    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(LogSistema.municipio_id == current_user.municipio_id)
    elif municipio_id is not None:
        query = query.where(LogSistema.municipio_id == municipio_id)

    if acao:
        query = query.where(LogSistema.acao == acao)
    if entidade:
        query = query.where(LogSistema.entidade == entidade)
    if usuario_id:
        query = query.where(LogSistema.usuario_id == usuario_id)

    query = query.order_by(LogSistema.criado_em.desc())
    query = query.offset((pagina - 1) * por_pagina).limit(por_pagina)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{log_id}", response_model=LogResponse)
async def detalhar_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(LogSistema).where(LogSistema.id == log_id)
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(LogSistema.municipio_id == current_user.municipio_id)

    result = await db.execute(query)
    log = result.scalar_one_or_none()
    if not log:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Log não encontrado")
    return log
