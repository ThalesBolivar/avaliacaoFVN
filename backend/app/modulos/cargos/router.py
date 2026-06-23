from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.core.deps import require_admin
from app.core.audit import log_event, Acoes
from app.models.cargo import Cargo, PesoQuestaoCargo
from app.models.nivel_cargo import NivelCargo as NivelCargoModel
from app.models.questionario import ModeloAvaliacao, StatusModeloEnum
from app.models.servidor import Servidor
from app.models.usuario import Usuario, PerfilEnum
from app.schemas.cargo import CargoResponse, CargoDetalhe, CargoCreate, CargoUpdate


class VincularNivelRequest(BaseModel):
    nivel_id: int
    modelo_avaliacao_id: int | None = None

router = APIRouter(prefix="/cargos", tags=["Cargos"])


def _municipio_escopo(current_user: Usuario, municipio_id: int | None) -> int | None:
    if current_user.perfil == PerfilEnum.SUPER_ADMIN:
        return municipio_id
    return current_user.municipio_id


async def _validar_nivel(db: AsyncSession, nivel_id: int) -> NivelCargoModel:
    nivel = (await db.execute(
        select(NivelCargoModel).where(NivelCargoModel.id == nivel_id, NivelCargoModel.ativo == True)
    )).scalar_one_or_none()
    if not nivel:
        raise HTTPException(status_code=400, detail="Nível de cargo inválido ou inativo")
    return nivel


async def _validar_modelo_no_municipio(
    db: AsyncSession, municipio_id: int, modelo_avaliacao_id: int | None
) -> None:
    if modelo_avaliacao_id is None:
        return
    modelo = (await db.execute(
        select(ModeloAvaliacao).where(
            ModeloAvaliacao.id == modelo_avaliacao_id,
            ModeloAvaliacao.municipio_id == municipio_id,
        )
    )).scalar_one_or_none()
    if not modelo:
        raise HTTPException(status_code=400, detail="Modelo de avaliação inválido para este município")


async def _validar_nome_unico(
    db: AsyncSession, municipio_id: int, nome: str, cargo_id: int | None = None
) -> None:
    query = select(Cargo).where(
        Cargo.municipio_id == municipio_id,
        func.upper(func.trim(Cargo.nome)) == nome.strip().upper(),
    )
    if cargo_id is not None:
        query = query.where(Cargo.id != cargo_id)
    if (await db.execute(query)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Já existe um cargo com este nome neste município")


async def _substituir_pesos(db: AsyncSession, cargo: Cargo, pesos) -> None:
    cargo.pesos.clear()
    await db.flush()
    for p in pesos:
        db.add(PesoQuestaoCargo(
            cargo_id=cargo.id, numero_pergunta=p.numero_pergunta, peso=p.peso
        ))


def _query_cargo_completo():
    return select(Cargo).options(selectinload(Cargo.nivel), selectinload(Cargo.pesos))


@router.get("", response_model=List[CargoResponse])
async def listar_cargos(
    ativo: bool | None = Query(default=None),
    municipio_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(Cargo).options(selectinload(Cargo.nivel))

    escopo = _municipio_escopo(current_user, municipio_id)
    if escopo is not None:
        query = query.where(Cargo.municipio_id == escopo)

    if ativo is not None:
        query = query.where(Cargo.ativo == ativo)

    result = await db.execute(query.order_by(Cargo.nome))
    return result.scalars().all()


@router.get("/{cargo_id}", response_model=CargoDetalhe)
async def detalhar_cargo(
    cargo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = _query_cargo_completo().where(Cargo.id == cargo_id)
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(Cargo.municipio_id == current_user.municipio_id)

    cargo = (await db.execute(query)).scalar_one_or_none()
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo não encontrado")
    return cargo


@router.post("/vincular-por-nivel", status_code=200)
async def vincular_modelo_por_nivel(
    data: VincularNivelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    """Vincula todos os cargos de um nível ao mesmo modelo de avaliação."""
    await _validar_nivel(db, data.nivel_id)

    if data.modelo_avaliacao_id is not None:
        modelo = (await db.execute(
            select(ModeloAvaliacao).where(
                ModeloAvaliacao.id == data.modelo_avaliacao_id,
                ModeloAvaliacao.municipio_id == current_user.municipio_id,
                ModeloAvaliacao.status == StatusModeloEnum.PUBLICADO,
            )
        )).scalar_one_or_none()
        if not modelo:
            raise HTTPException(status_code=400, detail="Modelo não encontrado ou não publicado")

    await db.execute(
        update(Cargo)
        .where(
            Cargo.municipio_id == current_user.municipio_id,
            Cargo.nivel_id == data.nivel_id,
        )
        .values(modelo_avaliacao_id=data.modelo_avaliacao_id)
    )
    await db.flush()

    count = (await db.execute(
        select(func.count(Cargo.id)).where(
            Cargo.municipio_id == current_user.municipio_id,
            Cargo.nivel_id == data.nivel_id,
        )
    )).scalar_one()

    return {"message": f"{count} cargos do nível vinculados ao modelo", "total": count}


@router.post("", response_model=CargoDetalhe, status_code=201)
async def criar_cargo(
    data: CargoCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    municipio_id = current_user.municipio_id
    if current_user.perfil == PerfilEnum.SUPER_ADMIN:
        if data.municipio_id is None:
            raise HTTPException(status_code=400, detail="Informe o município do cargo")
        municipio_id = data.municipio_id

    await _validar_nivel(db, data.nivel_id)
    await _validar_nome_unico(db, municipio_id, data.nome)
    await _validar_modelo_no_municipio(db, municipio_id, data.modelo_avaliacao_id)

    cargo = Cargo(
        municipio_id=municipio_id,
        nome=data.nome.strip(),
        nivel_id=data.nivel_id,
        modelo_avaliacao_id=data.modelo_avaliacao_id,
        pontuacao_maxima=data.pontuacao_maxima,
        pontos_min_estagio=data.pontos_min_estagio,
        pontos_min_progressao=data.pontos_min_progressao,
        ativo=data.ativo,
    )
    db.add(cargo)
    await db.flush()

    if data.pesos:
        for p in data.pesos:
            db.add(PesoQuestaoCargo(
                cargo_id=cargo.id, numero_pergunta=p.numero_pergunta, peso=p.peso
            ))

    await log_event(
        db, municipio_id=municipio_id, acao=Acoes.CARGO_CRIADO, entidade="cargos",
        usuario=current_user, entidade_id=cargo.id,
        descricao=f"Cargo '{cargo.nome}' criado",
        endereco_ip=request.client.host if request.client else None,
        navegador=request.headers.get("user-agent"),
    )
    await db.flush()

    result = await db.execute(_query_cargo_completo().where(Cargo.id == cargo.id))
    return result.scalar_one()


@router.put("/{cargo_id}", response_model=CargoDetalhe)
async def atualizar_cargo(
    cargo_id: int,
    data: CargoUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = _query_cargo_completo().where(Cargo.id == cargo_id)
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(Cargo.municipio_id == current_user.municipio_id)
    cargo = (await db.execute(query)).scalar_one_or_none()
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo não encontrado")

    update_data = data.model_dump(exclude_unset=True)

    if "nome" in update_data and update_data["nome"] is not None:
        await _validar_nome_unico(db, cargo.municipio_id, update_data["nome"], cargo_id=cargo.id)
        cargo.nome = update_data["nome"].strip()
    if "nivel_id" in update_data and update_data["nivel_id"] is not None:
        await _validar_nivel(db, update_data["nivel_id"])
        cargo.nivel_id = update_data["nivel_id"]
    if "modelo_avaliacao_id" in update_data:
        await _validar_modelo_no_municipio(db, cargo.municipio_id, update_data["modelo_avaliacao_id"])
        cargo.modelo_avaliacao_id = update_data["modelo_avaliacao_id"]
    for campo in ("pontuacao_maxima", "pontos_min_estagio", "pontos_min_progressao", "ativo"):
        if campo in update_data:
            setattr(cargo, campo, update_data[campo])

    if "nome" in update_data and update_data["nome"] is not None:
        await db.execute(
            update(Servidor).where(Servidor.cargo_id == cargo.id).values(cargo=cargo.nome)
        )

    if data.pesos is not None:
        await _substituir_pesos(db, cargo, data.pesos)

    await log_event(
        db, municipio_id=cargo.municipio_id, acao=Acoes.CARGO_ALTERADO, entidade="cargos",
        usuario=current_user, entidade_id=cargo.id,
        descricao=f"Cargo '{cargo.nome}' alterado",
        endereco_ip=request.client.host if request.client else None,
        navegador=request.headers.get("user-agent"),
    )
    await db.flush()

    result = await db.execute(_query_cargo_completo().where(Cargo.id == cargo.id))
    return result.scalar_one()


@router.delete("/{cargo_id}", status_code=200)
async def excluir_cargo(
    cargo_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(Cargo).where(Cargo.id == cargo_id)
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(Cargo.municipio_id == current_user.municipio_id)
    cargo = (await db.execute(query)).scalar_one_or_none()
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo não encontrado")

    vinculados = (await db.execute(
        select(func.count(Servidor.id)).where(Servidor.cargo_id == cargo.id)
    )).scalar_one()
    municipio_id = cargo.municipio_id
    nome = cargo.nome

    if vinculados:
        cargo.ativo = False
        mensagem = f"Cargo '{nome}' possui {vinculados} servidor(es) vinculado(s) e foi desativado em vez de excluído"
    else:
        await db.delete(cargo)
        mensagem = f"Cargo '{nome}' excluído"

    await log_event(
        db, municipio_id=municipio_id, acao=Acoes.CARGO_EXCLUIDO, entidade="cargos",
        usuario=current_user, entidade_id=cargo_id, descricao=mensagem,
        endereco_ip=request.client.host if request.client else None,
        navegador=request.headers.get("user-agent"),
    )
    await db.flush()
    return {"message": mensagem, "desativado": bool(vinculados)}
