from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.database import get_db
from app.core.deps import require_admin
from app.models.lotacao import Lotacao
from app.models.servidor import Servidor
from app.models.usuario import Usuario, PerfilEnum
from app.schemas.lotacao import LotacaoCreate, LotacaoUpdate, LotacaoResponse

router = APIRouter(prefix="/lotacoes", tags=["Lotações"])


def _municipio_escopo(current_user: Usuario, municipio_id: int | None) -> int | None:
    if current_user.perfil == PerfilEnum.SUPER_ADMIN:
        return municipio_id
    return current_user.municipio_id


@router.get("", response_model=List[LotacaoResponse])
async def listar_lotacoes(
    municipio_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    escopo = _municipio_escopo(current_user, municipio_id)
    query = select(Lotacao)
    if escopo is not None:
        query = query.where(Lotacao.municipio_id == escopo)
    result = await db.execute(query.order_by(Lotacao.ordem, Lotacao.nome))
    return result.scalars().all()


@router.post("", response_model=LotacaoResponse, status_code=201)
async def criar_lotacao(
    data: LotacaoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    municipio_id = current_user.municipio_id

    existente = (await db.execute(
        select(Lotacao).where(
            Lotacao.municipio_id == municipio_id,
            func.upper(func.trim(Lotacao.nome)) == data.nome.strip().upper(),
        )
    )).scalar_one_or_none()
    if existente:
        raise HTTPException(status_code=400, detail="Já existe uma lotação com este nome")

    lotacao = Lotacao(
        municipio_id=municipio_id,
        nome=data.nome.strip(),
        descricao=data.descricao,
        ordem=data.ordem,
        ativo=data.ativo,
    )
    db.add(lotacao)
    await db.flush()
    await db.refresh(lotacao)
    return lotacao


@router.put("/{lotacao_id}", response_model=LotacaoResponse)
async def atualizar_lotacao(
    lotacao_id: int,
    data: LotacaoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(Lotacao).where(Lotacao.id == lotacao_id)
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(Lotacao.municipio_id == current_user.municipio_id)
    lotacao = (await db.execute(query)).scalar_one_or_none()
    if not lotacao:
        raise HTTPException(status_code=404, detail="Lotação não encontrada")

    update_data = data.model_dump(exclude_unset=True)
    if "nome" in update_data and update_data["nome"] is not None:
        existente = (await db.execute(
            select(Lotacao).where(
                Lotacao.municipio_id == lotacao.municipio_id,
                func.upper(func.trim(Lotacao.nome)) == update_data["nome"].strip().upper(),
                Lotacao.id != lotacao_id,
            )
        )).scalar_one_or_none()
        if existente:
            raise HTTPException(status_code=400, detail="Já existe uma lotação com este nome")
        lotacao.nome = update_data["nome"].strip()

    for campo in ("descricao", "ordem", "ativo"):
        if campo in update_data:
            setattr(lotacao, campo, update_data[campo])

    await db.flush()
    await db.refresh(lotacao)
    return lotacao


@router.delete("/{lotacao_id}", status_code=200)
async def excluir_lotacao(
    lotacao_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(Lotacao).where(Lotacao.id == lotacao_id)
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(Lotacao.municipio_id == current_user.municipio_id)
    lotacao = (await db.execute(query)).scalar_one_or_none()
    if not lotacao:
        raise HTTPException(status_code=404, detail="Lotação não encontrada")

    em_uso = (await db.execute(
        select(func.count(Servidor.id)).where(Servidor.lotacao_id == lotacao_id)
    )).scalar_one()
    if em_uso:
        raise HTTPException(
            status_code=400,
            detail=f"Lotação '{lotacao.nome}' está em uso por {em_uso} servidor(es) e não pode ser excluída"
        )

    await db.delete(lotacao)
    await db.flush()
    return {"message": f"Lotação '{lotacao.nome}' excluída com sucesso"}
