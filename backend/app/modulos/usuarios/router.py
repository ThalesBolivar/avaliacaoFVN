from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.core.deps import require_admin
from app.core.security import get_password_hash
from app.core.audit import log_event, Acoes
from app.models.funcao_usuario import FuncaoUsuario
from app.models.municipio import Municipio
from app.models.servidor import Servidor
from app.models.usuario import Usuario, PerfilEnum
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioResponse

router = APIRouter(prefix="/usuarios", tags=["Usuários"])

PERFIS_GERENCIAVEIS_ADMIN = (
    PerfilEnum.CHEFIA,
    PerfilEnum.SUBCOMISSAO,
    PerfilEnum.SERVIDOR,
)

PERFIS_CRIACAO_MANUAL_ADMIN = (
    PerfilEnum.CHEFIA,
    PerfilEnum.SUBCOMISSAO,
)

PERFIS_CRIACAO_MANUAL_SUPER_ADMIN = (
    PerfilEnum.ADMINISTRADOR,
    PerfilEnum.CHEFIA,
    PerfilEnum.SUBCOMISSAO,
)


def _aplicar_escopo_admin(query, current_user: Usuario):
    if current_user.perfil == PerfilEnum.SUPER_ADMIN:
        return query

    return query.where(
        Usuario.municipio_id == current_user.municipio_id,
        Usuario.perfil.in_(PERFIS_GERENCIAVEIS_ADMIN),
    )


def _anexar_funcao_nome(usuario: Usuario, funcao_usuario: FuncaoUsuario | None = None) -> Usuario:
    funcao = funcao_usuario if funcao_usuario is not None else usuario.funcao_usuario
    setattr(usuario, "funcao_usuario_nome", funcao.nome if funcao else None)
    return usuario


async def _validar_servidor_do_municipio(
    db: AsyncSession,
    *,
    servidor_id: int | None,
    municipio_id: int,
) -> Servidor | None:
    if not servidor_id:
        return None

    servidor = await db.get(Servidor, servidor_id)
    if not servidor or servidor.municipio_id != municipio_id:
        raise HTTPException(status_code=404, detail="Servidor não encontrado para este município")

    return servidor


async def _validar_funcao_do_municipio(
    db: AsyncSession,
    *,
    funcao_usuario_id: int | None,
    municipio_id: int,
    current_user: Usuario,
) -> FuncaoUsuario | None:
    if not funcao_usuario_id:
        raise HTTPException(status_code=400, detail="Selecione uma função de usuário válida")

    funcao = await db.get(FuncaoUsuario, funcao_usuario_id)
    if not funcao or funcao.municipio_id != municipio_id:
        raise HTTPException(status_code=404, detail="Função de usuário não encontrada para este município")

    if not funcao.ativo:
        raise HTTPException(status_code=400, detail="A função de usuário selecionada está inativa")

    if current_user.perfil == PerfilEnum.ADMINISTRADOR and funcao.perfil_base not in PERFIS_CRIACAO_MANUAL_ADMIN:
        raise HTTPException(status_code=403, detail="Você não pode usar esta função de usuário")

    if funcao.perfil_base == PerfilEnum.SERVIDOR:
        raise HTTPException(status_code=400, detail="Usuários do tipo servidor são criados automaticamente no cadastro de servidores")

    if funcao.perfil_base == PerfilEnum.SUBCOMISSAO:
        raise HTTPException(
            status_code=400,
            detail="Usuários de subcomissão são criados automaticamente ao cadastrar a função — cada subcomissão possui um único login compartilhado",
        )

    return funcao


@router.get("", response_model=List[UsuarioResponse])
async def listar_usuarios(
    municipio_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(Usuario).options(selectinload(Usuario.funcao_usuario))

    if current_user.perfil == PerfilEnum.SUPER_ADMIN:
        if municipio_id is not None:
            query = query.where(Usuario.municipio_id == municipio_id)
    else:
        query = _aplicar_escopo_admin(query, current_user)

    result = await db.execute(query.order_by(Usuario.nome))
    return [_anexar_funcao_nome(usuario) for usuario in result.scalars().all()]


@router.post("", response_model=UsuarioResponse, status_code=201)
async def criar_usuario(
    data: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    municipio_id = current_user.municipio_id

    if current_user.perfil == PerfilEnum.SUPER_ADMIN and data.municipio_id is not None:
        municipio_id = data.municipio_id
    elif current_user.perfil != PerfilEnum.SUPER_ADMIN and data.municipio_id not in (None, current_user.municipio_id):
        raise HTTPException(status_code=403, detail="Você não pode criar usuários para outro município")

    municipio = await db.get(Municipio, municipio_id)
    if not municipio:
        raise HTTPException(status_code=404, detail="Município não encontrado")

    funcao_usuario = await _validar_funcao_do_municipio(
        db,
        funcao_usuario_id=data.funcao_usuario_id,
        municipio_id=municipio_id,
        current_user=current_user,
    )
    perfil_resolvido = funcao_usuario.perfil_base

    if current_user.perfil == PerfilEnum.ADMINISTRADOR and perfil_resolvido not in PERFIS_GERENCIAVEIS_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="ADMINISTRADOR só pode criar usuários de chefia, subcomissão ou servidor",
        )

    if perfil_resolvido == PerfilEnum.SERVIDOR:
        raise HTTPException(
            status_code=400,
            detail="Usuários do tipo servidor são criados automaticamente no cadastro de servidores",
        )

    perfis_permitidos = (
        PERFIS_CRIACAO_MANUAL_SUPER_ADMIN
        if current_user.perfil == PerfilEnum.SUPER_ADMIN
        else PERFIS_CRIACAO_MANUAL_ADMIN
    )
    if perfil_resolvido not in perfis_permitidos:
        raise HTTPException(
            status_code=400,
            detail="Criação manual disponível apenas para os perfis permitidos para este usuário",
        )

    servidor = await _validar_servidor_do_municipio(
        db,
        servidor_id=data.servidor_id,
        municipio_id=municipio_id,
    )

    existing = await db.execute(
        select(Usuario).where(
            Usuario.email == data.email,
            Usuario.municipio_id == municipio_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email já cadastrado neste município")

    usuario = Usuario(
        municipio_id=municipio_id,
        nome=data.nome,
        email=data.email,
        senha_hash=get_password_hash(data.senha),
        perfil=perfil_resolvido,
        servidor_id=data.servidor_id,
        funcao_usuario_id=funcao_usuario.id,
    )
    db.add(usuario)
    await db.flush()

    if servidor:
        usuario.servidor_id = servidor.id
        servidor.usuario_id = usuario.id

    await db.refresh(usuario)
    _anexar_funcao_nome(usuario, funcao_usuario)

    await log_event(
        db, municipio_id, Acoes.USUARIO_CRIADO, "usuario",
        usuario=current_user, entidade_id=str(usuario.id),
        descricao=f"Usuário {usuario.nome} ({usuario.perfil.value}) criado",
    )
    return usuario


@router.get("/{usuario_id}", response_model=UsuarioResponse)
async def detalhar_usuario(
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(Usuario).options(selectinload(Usuario.funcao_usuario)).where(Usuario.id == usuario_id)
    query = _aplicar_escopo_admin(query, current_user)

    result = await db.execute(query)
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return _anexar_funcao_nome(usuario)


@router.put("/{usuario_id}", response_model=UsuarioResponse)
async def atualizar_usuario(
    usuario_id: int,
    data: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(Usuario).options(selectinload(Usuario.funcao_usuario)).where(Usuario.id == usuario_id)
    query = _aplicar_escopo_admin(query, current_user)

    result = await db.execute(query)
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    update_data = data.model_dump(exclude_none=True)

    if "perfil" in update_data and "funcao_usuario_id" not in update_data:
        raise HTTPException(
            status_code=400,
            detail="O perfil técnico do usuário é definido pela função de usuário",
        )

    if "municipio_id" in update_data:
        if current_user.perfil != PerfilEnum.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Você não pode alterar o município do usuário")

        municipio = await db.get(Municipio, update_data["municipio_id"])
        if not municipio:
            raise HTTPException(status_code=404, detail="Município não encontrado")

    municipio_id_resolvido = update_data.get("municipio_id", usuario.municipio_id)

    if "servidor_id" in update_data:
        servidor = await _validar_servidor_do_municipio(
            db,
            servidor_id=update_data["servidor_id"],
            municipio_id=municipio_id_resolvido,
        )
    else:
        servidor = None

    if "funcao_usuario_id" in update_data:
        funcao_usuario = await _validar_funcao_do_municipio(
            db,
            funcao_usuario_id=update_data["funcao_usuario_id"],
            municipio_id=municipio_id_resolvido,
            current_user=current_user,
        )
        update_data["perfil"] = funcao_usuario.perfil_base
    else:
        funcao_usuario = None

    if current_user.perfil == PerfilEnum.ADMINISTRADOR and "perfil" in update_data:
        if update_data["perfil"] not in PERFIS_GERENCIAVEIS_ADMIN:
            raise HTTPException(
                status_code=403,
                detail="ADMINISTRADOR só pode definir perfis de chefia, subcomissão ou servidor",
            )

    servidor_anterior = await db.get(Servidor, usuario.servidor_id) if usuario.servidor_id else None

    # Tratar senha separadamente — precisa ser hashada
    nova_senha = update_data.pop("senha", None)
    if nova_senha:
        if len(nova_senha) < 8:
            raise HTTPException(status_code=400, detail="A nova senha deve ter pelo menos 8 caracteres")
        usuario.senha_hash = get_password_hash(nova_senha)

    for field, value in update_data.items():
        setattr(usuario, field, value)

    if "servidor_id" in update_data:
        if servidor_anterior and servidor_anterior.id != update_data["servidor_id"]:
            servidor_anterior.usuario_id = None
        if servidor:
            servidor.usuario_id = usuario.id

    await db.flush()
    await db.refresh(usuario)
    _anexar_funcao_nome(usuario, funcao_usuario if "funcao_usuario_id" in update_data else None)
    await log_event(
        db, usuario.municipio_id, Acoes.USUARIO_ALTERADO, "usuario",
        usuario=current_user, entidade_id=str(usuario.id),
    )
    return usuario


@router.patch("/{usuario_id}/status")
async def alterar_status_usuario(
    usuario_id: int,
    ativo: bool,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(Usuario).options(selectinload(Usuario.funcao_usuario)).where(Usuario.id == usuario_id)
    query = _aplicar_escopo_admin(query, current_user)

    result = await db.execute(query)
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    usuario.ativo = ativo
    await log_event(
        db, usuario.municipio_id,
        Acoes.USUARIO_DESATIVADO if not ativo else Acoes.USUARIO_ALTERADO,
        "usuario", usuario=current_user, entidade_id=str(usuario.id),
    )
    return {"message": f"Usuário {'ativado' if ativo else 'desativado'} com sucesso"}
