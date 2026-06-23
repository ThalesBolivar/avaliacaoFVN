import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.audit import Acoes, log_event
from app.core.deps import require_admin
from app.core.security import get_password_hash
from app.database import get_db
from app.models.funcao_usuario import FuncaoUsuario
from app.models.municipio import Municipio
from app.models.usuario import PerfilEnum, Usuario
from app.schemas.funcao_usuario import (
    FuncaoUsuarioCriadaResponse,
    FuncaoUsuarioCreate,
    FuncaoUsuarioResponse,
    FuncaoUsuarioUpdate,
    UsuarioCompartilhadoInfo,
)

router = APIRouter(prefix="/funcoes-usuario", tags=["Funções de Usuário"])

PERFIS_FUNCAO_ADMIN = (PerfilEnum.CHEFIA, PerfilEnum.SUBCOMISSAO)
PERFIS_FUNCAO_SUPER_ADMIN = (PerfilEnum.ADMINISTRADOR, PerfilEnum.CHEFIA, PerfilEnum.SUBCOMISSAO)

PERFIL_FUNCAO_PADRAO = PerfilEnum.SUBCOMISSAO


def _perfis_permitidos(current_user: Usuario) -> tuple[PerfilEnum, ...]:
    return PERFIS_FUNCAO_SUPER_ADMIN if current_user.perfil == PerfilEnum.SUPER_ADMIN else PERFIS_FUNCAO_ADMIN


async def _resolver_municipio_id(
    db: AsyncSession,
    *,
    current_user: Usuario,
    municipio_id: int | None = None,
) -> int:
    resolved_id = current_user.municipio_id
    if current_user.perfil == PerfilEnum.SUPER_ADMIN and municipio_id is not None:
        resolved_id = municipio_id

    municipio = await db.get(Municipio, resolved_id)
    if not municipio:
        raise HTTPException(status_code=404, detail="Município não encontrado")
    return resolved_id


async def _buscar_funcao_por_escopo(
    db: AsyncSession,
    *,
    funcao_id: int,
    current_user: Usuario,
) -> FuncaoUsuario:
    query = select(FuncaoUsuario).where(FuncaoUsuario.id == funcao_id)
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(FuncaoUsuario.municipio_id == current_user.municipio_id)

    result = await db.execute(query)
    funcao = result.scalar_one_or_none()
    if not funcao:
        raise HTTPException(status_code=404, detail="Função de usuário não encontrada")
    return funcao


async def _validar_nome_unico(
    db: AsyncSession,
    *,
    municipio_id: int,
    nome: str,
    funcao_id: int | None = None,
) -> None:
    result = await db.execute(
        select(FuncaoUsuario).where(
            FuncaoUsuario.municipio_id == municipio_id,
            func.lower(FuncaoUsuario.nome) == nome.strip().lower(),
        )
    )
    existente = result.scalar_one_or_none()
    if existente and existente.id != funcao_id:
        raise HTTPException(status_code=400, detail="Já existe uma função de usuário com esse nome neste município")


def _gerar_email_subcomissao(nome: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", ".", nome.lower().strip()).strip(".")
    return f"{slug}@sistema.local"


async def _buscar_usuario_compartilhado(
    db: AsyncSession,
    funcao_id: int,
) -> Usuario | None:
    result = await db.execute(
        select(Usuario).where(
            Usuario.funcao_usuario_id == funcao_id,
            Usuario.perfil == PerfilEnum.SUBCOMISSAO,
        )
    )
    return result.scalar_one_or_none()


def _montar_response(funcao: FuncaoUsuario, usuario: Usuario | None) -> FuncaoUsuarioResponse:
    return FuncaoUsuarioResponse(
        id=funcao.id,
        municipio_id=funcao.municipio_id,
        nome=funcao.nome,
        perfil_base=funcao.perfil_base,
        ativo=funcao.ativo,
        criado_em=funcao.criado_em,
        usuario_compartilhado=UsuarioCompartilhadoInfo(
            id=usuario.id,
            email=usuario.email,
            ativo=usuario.ativo,
        ) if usuario else None,
    )


@router.get("", response_model=List[FuncaoUsuarioResponse])
async def listar_funcoes_usuario(
    ativo: bool | None = Query(default=None),
    municipio_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(FuncaoUsuario)

    if ativo is not None:
        query = query.where(FuncaoUsuario.ativo == ativo)

    if current_user.perfil == PerfilEnum.SUPER_ADMIN:
        if municipio_id is not None:
            query = query.where(FuncaoUsuario.municipio_id == municipio_id)
    else:
        query = query.where(FuncaoUsuario.municipio_id == current_user.municipio_id)

    result = await db.execute(query.order_by(FuncaoUsuario.nome))
    funcoes = result.scalars().all()

    # Buscar usuários compartilhados das subcomissões em lote
    funcao_ids_sub = [f.id for f in funcoes if f.perfil_base == PerfilEnum.SUBCOMISSAO]
    usuarios_por_funcao: dict[int, Usuario] = {}
    if funcao_ids_sub:
        u_result = await db.execute(
            select(Usuario).where(
                Usuario.funcao_usuario_id.in_(funcao_ids_sub),
                Usuario.perfil == PerfilEnum.SUBCOMISSAO,
            )
        )
        for u in u_result.scalars().all():
            if u.funcao_usuario_id:
                usuarios_por_funcao[u.funcao_usuario_id] = u

    return [_montar_response(f, usuarios_por_funcao.get(f.id)) for f in funcoes]


@router.post("", response_model=FuncaoUsuarioCriadaResponse, status_code=201)
async def criar_funcao_usuario(
    data: FuncaoUsuarioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    perfil_base = data.perfil_base or PERFIL_FUNCAO_PADRAO
    if perfil_base not in _perfis_permitidos(current_user):
        perfil_base = PERFIL_FUNCAO_PADRAO

    municipio_id = await _resolver_municipio_id(db, current_user=current_user, municipio_id=data.municipio_id)
    await _validar_nome_unico(db, municipio_id=municipio_id, nome=data.nome)

    funcao = FuncaoUsuario(
        municipio_id=municipio_id,
        nome=data.nome.strip(),
        perfil_base=perfil_base,
    )
    db.add(funcao)
    await db.flush()
    await db.refresh(funcao)

    senha_gerada: str | None = None
    usuario_compartilhado: UsuarioCompartilhadoInfo | None = None

    if funcao.perfil_base == PerfilEnum.SUBCOMISSAO:
        senha_gerada = secrets.token_urlsafe(10)
        novo_usuario = Usuario(
            municipio_id=municipio_id,
            funcao_usuario_id=funcao.id,
            nome=funcao.nome,
            email=_gerar_email_subcomissao(funcao.nome),
            senha_hash=get_password_hash(senha_gerada),
            perfil=PerfilEnum.SUBCOMISSAO,
        )
        db.add(novo_usuario)
        await db.flush()
        await db.refresh(novo_usuario)
        usuario_compartilhado = UsuarioCompartilhadoInfo(
            id=novo_usuario.id,
            email=novo_usuario.email,
            ativo=novo_usuario.ativo,
        )

    await log_event(
        db, municipio_id, Acoes.FUNCAO_USUARIO_CRIADA, "funcao_usuario",
        usuario=current_user, entidade_id=str(funcao.id),
        descricao=f"Função de usuário {funcao.nome} criada",
    )

    return FuncaoUsuarioCriadaResponse(
        id=funcao.id,
        municipio_id=funcao.municipio_id,
        nome=funcao.nome,
        perfil_base=funcao.perfil_base,
        ativo=funcao.ativo,
        criado_em=funcao.criado_em,
        usuario_compartilhado=usuario_compartilhado,
        senha_gerada=senha_gerada,
    )


@router.put("/{funcao_id}", response_model=FuncaoUsuarioResponse)
async def atualizar_funcao_usuario(
    funcao_id: int,
    data: FuncaoUsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    funcao = await _buscar_funcao_por_escopo(db, funcao_id=funcao_id, current_user=current_user)
    update_data = data.model_dump(exclude_none=True)

    if "nome" in update_data:
        await _validar_nome_unico(db, municipio_id=funcao.municipio_id, nome=update_data["nome"], funcao_id=funcao.id)
        update_data["nome"] = update_data["nome"].strip()

    for field, value in update_data.items():
        setattr(funcao, field, value)

    await db.flush()
    await db.refresh(funcao)
    await log_event(
        db, funcao.municipio_id, Acoes.FUNCAO_USUARIO_ALTERADA, "funcao_usuario",
        usuario=current_user, entidade_id=str(funcao.id),
    )

    usuario = await _buscar_usuario_compartilhado(db, funcao.id)
    return _montar_response(funcao, usuario)


@router.patch("/{funcao_id}/status")
async def alterar_status_funcao_usuario(
    funcao_id: int,
    ativo: bool,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    funcao = await _buscar_funcao_por_escopo(db, funcao_id=funcao_id, current_user=current_user)
    funcao.ativo = ativo
    await log_event(
        db, funcao.municipio_id, Acoes.FUNCAO_USUARIO_ALTERADA, "funcao_usuario",
        usuario=current_user, entidade_id=str(funcao.id),
        descricao=f"Função de usuário {funcao.nome} {'ativada' if ativo else 'desativada'}",
    )
    return {"message": f"Função de usuário {'ativada' if ativo else 'desativada'} com sucesso"}
