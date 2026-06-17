from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.core.deps import get_current_user, require_super_admin
from app.models.municipio import Municipio
from app.models.usuario import Usuario
from app.schemas.municipio import MunicipioCreate, MunicipioUpdate, MunicipioResponse, MunicipioPublic

router = APIRouter(prefix="/municipios", tags=["Municípios"])


@router.get("", response_model=List[MunicipioPublic])
async def listar_municipios(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Municipio).where(Municipio.ativo == True).order_by(Municipio.nome))
    return result.scalars().all()


@router.get("/admin/lista", response_model=List[MunicipioResponse])
async def listar_municipios_admin(
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_super_admin),
):
    result = await db.execute(select(Municipio).order_by(Municipio.nome))
    return result.scalars().all()


@router.get("/{municipio_id}", response_model=MunicipioResponse)
async def detalhar_municipio(
    municipio_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_super_admin),
):
    result = await db.execute(select(Municipio).where(Municipio.id == municipio_id))
    municipio = result.scalar_one_or_none()
    if not municipio:
        raise HTTPException(status_code=404, detail="Município não encontrado")
    return municipio


@router.post("", response_model=MunicipioResponse, status_code=201)
async def criar_municipio(
    data: MunicipioCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_super_admin),
):
    existing = await db.execute(select(Municipio).where(Municipio.identificador == data.identificador))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Identificador já cadastrado")

    municipio = Municipio(**data.model_dump())
    db.add(municipio)
    await db.flush()
    await db.refresh(municipio)
    return municipio


@router.put("/{municipio_id}", response_model=MunicipioResponse)
async def atualizar_municipio(
    municipio_id: int,
    data: MunicipioUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_super_admin),
):
    result = await db.execute(select(Municipio).where(Municipio.id == municipio_id))
    municipio = result.scalar_one_or_none()
    if not municipio:
        raise HTTPException(status_code=404, detail="Município não encontrado")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(municipio, field, value)

    await db.flush()
    await db.refresh(municipio)
    return municipio
