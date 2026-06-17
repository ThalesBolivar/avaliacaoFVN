from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone
from typing import List

from app.database import get_db
from app.core.deps import get_current_user
from app.models.notificacao import Notificacao
from app.models.usuario import Usuario
from app.schemas.notificacao import NotificacaoResponse

router = APIRouter(prefix="/notificacoes", tags=["Notificações"])


@router.get("", response_model=List[NotificacaoResponse])
async def listar_notificacoes(
    apenas_nao_lidas: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    query = select(Notificacao).where(
        Notificacao.municipio_id == current_user.municipio_id,
        Notificacao.usuario_id == current_user.id,
    )
    if apenas_nao_lidas:
        query = query.where(Notificacao.lida == False)

    result = await db.execute(query.order_by(Notificacao.criado_em.desc()).limit(50))
    return result.scalars().all()


@router.patch("/{notificacao_id}/lida", response_model=NotificacaoResponse)
async def marcar_lida(
    notificacao_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    result = await db.execute(
        select(Notificacao).where(
            Notificacao.id == notificacao_id,
            Notificacao.usuario_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")

    notif.lida = True
    notif.lida_em = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(notif)
    return notif


@router.patch("/marcar-todas-lidas")
async def marcar_todas_lidas(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    await db.execute(
        update(Notificacao)
        .where(
            Notificacao.usuario_id == current_user.id,
            Notificacao.lida == False,
        )
        .values(lida=True, lida_em=datetime.now(timezone.utc))
    )
    return {"message": "Todas as notificações foram marcadas como lidas"}
