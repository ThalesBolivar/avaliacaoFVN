from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.database import get_db
from app.core.deps import require_admin, require_super_admin
from app.models.nivel_cargo import NivelCargo
from app.models.cargo import Cargo
from app.schemas.nivel_cargo import NivelCargoCreate, NivelCargoUpdate, NivelCargoResponse

router = APIRouter(prefix="/niveis-cargo", tags=["Níveis de Cargo"])


@router.get("", response_model=List[NivelCargoResponse])
async def listar_niveis(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
):
    result = await db.execute(select(NivelCargo).order_by(NivelCargo.ordem, NivelCargo.label))
    return result.scalars().all()


@router.post("", response_model=NivelCargoResponse, status_code=201)
async def criar_nivel(
    data: NivelCargoCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    nome_upper = data.nome.strip().upper()
    existente = (await db.execute(
        select(NivelCargo).where(func.upper(NivelCargo.nome) == nome_upper)
    )).scalar_one_or_none()
    if existente:
        raise HTTPException(status_code=400, detail="Já existe um nível com este nome")

    nivel = NivelCargo(
        nome=nome_upper,
        label=data.label.strip(),
        descricao=data.descricao,
        ordem=data.ordem,
        ativo=data.ativo,
    )
    db.add(nivel)
    await db.flush()
    await db.refresh(nivel)
    return nivel


@router.put("/{nivel_id}", response_model=NivelCargoResponse)
async def atualizar_nivel(
    nivel_id: int,
    data: NivelCargoUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    nivel = (await db.execute(
        select(NivelCargo).where(NivelCargo.id == nivel_id)
    )).scalar_one_or_none()
    if not nivel:
        raise HTTPException(status_code=404, detail="Nível não encontrado")

    update_data = data.model_dump(exclude_unset=True)
    for campo, valor in update_data.items():
        setattr(nivel, campo, valor)

    await db.flush()
    await db.refresh(nivel)
    return nivel


@router.delete("/{nivel_id}", status_code=200)
async def excluir_nivel(
    nivel_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    nivel = (await db.execute(
        select(NivelCargo).where(NivelCargo.id == nivel_id)
    )).scalar_one_or_none()
    if not nivel:
        raise HTTPException(status_code=404, detail="Nível não encontrado")

    em_uso = (await db.execute(
        select(func.count(Cargo.id)).where(Cargo.nivel == nivel.nome)
    )).scalar_one()
    if em_uso:
        raise HTTPException(
            status_code=400,
            detail=f"Nível '{nivel.label}' está em uso por {em_uso} cargo(s) e não pode ser excluído"
        )

    await db.delete(nivel)
    await db.flush()
    return {"message": f"Nível '{nivel.label}' excluído com sucesso"}
