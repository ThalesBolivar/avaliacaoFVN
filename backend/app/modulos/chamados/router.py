from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from typing import List

from app.database import get_db
from app.core.deps import require_admin, require_super_admin
from app.models.chamado import Chamado, ChamadoStatus
from app.models.usuario import Usuario, PerfilEnum
from app.schemas.chamado import ChamadoCreate, ChamadoResolver, ChamadoResponse

router = APIRouter(prefix="/chamados", tags=["Chamados"])


@router.post("", response_model=ChamadoResponse, status_code=201)
async def criar_chamado(
    data: ChamadoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    """Abre uma solicitação de cadastro (ex.: cargo/lotação inexistente).
    Fica vinculada ao município e ao usuário que solicitou."""
    if current_user.perfil == PerfilEnum.SUPER_ADMIN and not current_user.municipio_id:
        raise HTTPException(status_code=400, detail="Selecione um município para abrir um chamado")

    valor = data.valor_solicitado.strip()
    if not valor:
        raise HTTPException(status_code=400, detail="Informe o que deseja solicitar")

    chamado = Chamado(
        municipio_id=current_user.municipio_id,
        usuario_id=current_user.id,
        tipo=data.tipo,
        valor_solicitado=valor,
        descricao=(data.descricao or None),
        lote_importacao_id=data.lote_importacao_id,
        status=ChamadoStatus.ABERTO,
    )
    db.add(chamado)
    await db.flush()
    await db.refresh(chamado)
    return chamado


@router.get("", response_model=List[ChamadoResponse])
async def listar_chamados(
    status: ChamadoStatus | None = Query(default=None),
    municipio_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    """Lista chamados. Admin de município vê apenas os do seu município;
    super admin vê todos (opcionalmente filtrando por município)."""
    query = select(Chamado)
    if current_user.perfil == PerfilEnum.SUPER_ADMIN:
        if municipio_id is not None:
            query = query.where(Chamado.municipio_id == municipio_id)
    else:
        query = query.where(Chamado.municipio_id == current_user.municipio_id)

    if status is not None:
        query = query.where(Chamado.status == status)

    result = await db.execute(query.order_by(Chamado.criado_em.desc()))
    return result.scalars().all()


@router.patch("/{chamado_id}", response_model=ChamadoResponse)
async def resolver_chamado(
    chamado_id: int,
    data: ChamadoResolver,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_super_admin),
):
    """Atualiza o status de um chamado (resolver/rejeitar). Apenas super admin."""
    chamado = await db.get(Chamado, chamado_id)
    if not chamado:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")

    chamado.status = data.status
    chamado.resolvido_em = (
        datetime.now(timezone.utc) if data.status != ChamadoStatus.ABERTO else None
    )
    await db.flush()
    await db.refresh(chamado)
    return chamado
