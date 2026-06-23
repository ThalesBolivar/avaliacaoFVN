from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.audit import log_event, Acoes
from app.core.notificacoes import criar_notificacao
from app.models.cargo import Cargo
from app.models.funcao_usuario import FuncaoUsuario
from app.models.modelo_avaliacao_funcao import ModeloAvaliacaoFuncao
from app.models.periodo import PeriodoAvaliacao, VinculoAvaliacao, FormularioAvaliacao, StatusPeriodoEnum, TipoAvaliacaoEnum
from app.models.servidor import Servidor
from app.models.servidor_funcao import ServidorFuncao
from app.models.questionario import ModeloAvaliacao, StatusModeloEnum
from app.models.usuario import Usuario, PerfilEnum
from app.schemas.periodo import PeriodoCreate, PeriodoUpdate, PeriodoResponse, PeriodoProgresso, VinculoResponse

router = APIRouter(prefix="/periodos-avaliacao", tags=["Períodos de Avaliação"])


async def _buscar_usuario_por_servidor(
    db: AsyncSession,
    *,
    servidor_id: int | None,
    municipio_id: int,
    perfil_preferido: PerfilEnum | None = None,
) -> Usuario | None:
    if not servidor_id:
        return None

    servidor = await db.get(Servidor, servidor_id)
    if not servidor or servidor.municipio_id != municipio_id:
        return None

    candidatos: list[Usuario] = []

    if servidor.usuario_id:
        usuario_vinculado = await db.get(Usuario, servidor.usuario_id)
        if usuario_vinculado and usuario_vinculado.ativo and usuario_vinculado.municipio_id == municipio_id:
            candidatos.append(usuario_vinculado)

    result = await db.execute(
        select(Usuario).where(
            Usuario.municipio_id == municipio_id,
            Usuario.servidor_id == servidor.id,
            Usuario.ativo == True,
        )
    )
    for usuario in result.scalars().all():
        if all(c.id != usuario.id for c in candidatos):
            candidatos.append(usuario)

    if servidor.email:
        email_normalizado = servidor.email.strip().lower()
        result = await db.execute(
            select(Usuario).where(
                Usuario.municipio_id == municipio_id,
                func.lower(Usuario.email) == email_normalizado,
                Usuario.ativo == True,
            )
        )
        for usuario in result.scalars().all():
            if all(c.id != usuario.id for c in candidatos):
                candidatos.append(usuario)

    if perfil_preferido:
        for candidato in candidatos:
            if candidato.perfil == perfil_preferido:
                return candidato

    return candidatos[0] if candidatos else None


async def _listar_usuarios_por_funcao_ids(
    db: AsyncSession, funcao_ids: list[int], municipio_id: int
) -> list[Usuario]:
    """Retorna usuários que possuem vínculo ativo com alguma das funcoes_ids informadas."""
    if not funcao_ids:
        return []
    result = await db.execute(
        select(Usuario)
        .join(Servidor, Servidor.id == Usuario.servidor_id)
        .join(ServidorFuncao, ServidorFuncao.servidor_id == Servidor.id)
        .where(
            ServidorFuncao.municipio_id == municipio_id,
            ServidorFuncao.ativo == True,
            ServidorFuncao.funcao_usuario_id.in_(funcao_ids),
            Usuario.ativo == True,
        )
        .distinct()
    )
    return result.scalars().all()


async def _listar_usuarios_subcomissao(db: AsyncSession, municipio_id: int) -> list[Usuario]:
    # Busca servidores vinculados a funções com perfil_base=SUBCOMISSAO na nova tabela servidor_funcao
    result = await db.execute(
        select(Usuario)
        .join(Servidor, Servidor.id == Usuario.servidor_id)
        .join(ServidorFuncao, ServidorFuncao.servidor_id == Servidor.id)
        .join(FuncaoUsuario, FuncaoUsuario.id == ServidorFuncao.funcao_usuario_id)
        .where(
            ServidorFuncao.municipio_id == municipio_id,
            ServidorFuncao.ativo == True,
            FuncaoUsuario.perfil_base == PerfilEnum.SUBCOMISSAO,
            Usuario.ativo == True,
        )
        .distinct()
    )
    usuarios = result.scalars().all()

    # Fallback: mantém compatibilidade com usuários criados manualmente com perfil SUBCOMISSAO
    if not usuarios:
        result_legado = await db.execute(
            select(Usuario).where(
                Usuario.municipio_id == municipio_id,
                Usuario.perfil == PerfilEnum.SUBCOMISSAO,
                Usuario.ativo == True,
            )
        )
        usuarios = result_legado.scalars().all()

    return usuarios


async def _criar_formulario_se_necessario(
    db: AsyncSession,
    *,
    vinculo_id: int,
    municipio_id: int,
    tipo_avaliacao: TipoAvaliacaoEnum,
    usuario_avaliador_id: int,
    servidor_avaliado_id: int,
) -> tuple[FormularioAvaliacao, bool]:
    existing = await db.execute(
        select(FormularioAvaliacao).where(
            FormularioAvaliacao.vinculo_avaliacao_id == vinculo_id,
            FormularioAvaliacao.tipo_avaliacao == tipo_avaliacao,
            FormularioAvaliacao.usuario_avaliador_id == usuario_avaliador_id,
            FormularioAvaliacao.servidor_avaliado_id == servidor_avaliado_id,
        )
    )
    formulario = existing.scalar_one_or_none()
    if formulario:
        if formulario.ativo != "S":
            formulario.ativo = "S"
        return formulario, False

    formulario = FormularioAvaliacao(
        municipio_id=municipio_id,
        vinculo_avaliacao_id=vinculo_id,
        tipo_avaliacao=tipo_avaliacao,
        usuario_avaliador_id=usuario_avaliador_id,
        servidor_avaliado_id=servidor_avaliado_id,
    )
    db.add(formulario)
    await db.flush()
    return formulario, True


async def _gerar_formularios_para_vinculo(
    db: AsyncSession,
    *,
    vinculo: VinculoAvaliacao,
    modelo: ModeloAvaliacao,
) -> list[FormularioAvaliacao]:
    formularios_criados: list[FormularioAvaliacao] = []

    # Determina quais funções estão vinculadas ao modelo
    funcoes_vinculadas = getattr(modelo, 'funcoes_vinculadas', None) or []
    funcao_ids_chefia = [fv.funcao_usuario_id for fv in funcoes_vinculadas if fv.funcao.perfil_base == PerfilEnum.CHEFIA]
    funcao_ids_sub = [fv.funcao_usuario_id for fv in funcoes_vinculadas if fv.funcao.perfil_base == PerfilEnum.SUBCOMISSAO]

    # ── AUTOAVALIAÇÃO ──────────────────────────────────────────────
    if modelo.para_autoavaliacao:
        usuario_servidor = await _buscar_usuario_por_servidor(
            db,
            servidor_id=vinculo.servidor_avaliado_id,
            municipio_id=vinculo.municipio_id,
            perfil_preferido=PerfilEnum.SERVIDOR,
        )
        if usuario_servidor:
            formulario, criado = await _criar_formulario_se_necessario(
                db,
                vinculo_id=vinculo.id,
                municipio_id=vinculo.municipio_id,
                tipo_avaliacao=TipoAvaliacaoEnum.AUTOAVALIACAO,
                usuario_avaliador_id=usuario_servidor.id,
                servidor_avaliado_id=vinculo.servidor_avaliado_id,
            )
            if criado:
                formularios_criados.append(formulario)

    # ── SUPERIOR IMEDIATO (Chefia) ─────────────────────────────────
    # Usa funcao_ids_chefia para verificar se o modelo tem função de chefia vinculada;
    # se não tiver (modelos antigos), cai no flag para_superior_imediato
    if funcao_ids_chefia or (not funcoes_vinculadas and modelo.para_superior_imediato):
        usuario_chefia = await _buscar_usuario_por_servidor(
            db,
            servidor_id=vinculo.chefia_servidor_id,
            municipio_id=vinculo.municipio_id,
        )
        if usuario_chefia:
            formulario, criado = await _criar_formulario_se_necessario(
                db,
                vinculo_id=vinculo.id,
                municipio_id=vinculo.municipio_id,
                tipo_avaliacao=TipoAvaliacaoEnum.SUPERIOR_IMEDIATO,
                usuario_avaliador_id=usuario_chefia.id,
                servidor_avaliado_id=vinculo.servidor_avaliado_id,
            )
            if criado:
                formularios_criados.append(formulario)

    # ── SUBCOMISSÃO ────────────────────────────────────────────────
    # Se o modelo tem funções de subcomissão vinculadas, usa apenas os membros daquelas funções;
    # caso contrário (modelos antigos), busca todos os membros de subcomissão
    if funcao_ids_sub:
        usuarios_subcomissao = await _listar_usuarios_por_funcao_ids(db, funcao_ids_sub, vinculo.municipio_id)
    elif not funcoes_vinculadas and modelo.para_subcomissao:
        usuarios_subcomissao = await _listar_usuarios_subcomissao(db, vinculo.municipio_id)
    else:
        usuarios_subcomissao = []

    for usuario_subcomissao in usuarios_subcomissao:
        formulario, criado = await _criar_formulario_se_necessario(
            db,
            vinculo_id=vinculo.id,
            municipio_id=vinculo.municipio_id,
            tipo_avaliacao=TipoAvaliacaoEnum.SUBCOMISSAO,
            usuario_avaliador_id=usuario_subcomissao.id,
            servidor_avaliado_id=vinculo.servidor_avaliado_id,
        )
        if criado:
            formularios_criados.append(formulario)

    return formularios_criados


async def _notificar_formularios(
    db: AsyncSession,
    *,
    periodo: PeriodoAvaliacao,
    formularios: list[FormularioAvaliacao],
) -> int:
    if not formularios:
        return 0

    result = await db.execute(
        select(Servidor).where(
            Servidor.id.in_([formulario.servidor_avaliado_id for formulario in formularios])
        )
    )
    servidores = {servidor.id: servidor for servidor in result.scalars().all()}

    por_usuario: dict[int, list[FormularioAvaliacao]] = defaultdict(list)
    for formulario in formularios:
        por_usuario[formulario.usuario_avaliador_id].append(formulario)

    notificacoes_criadas = 0
    for usuario_id, formularios_usuario in por_usuario.items():
        if len(formularios_usuario) == 1:
            formulario = formularios_usuario[0]
            servidor = servidores.get(formulario.servidor_avaliado_id)
            nome_servidor = servidor.nome if servidor else "servidor do município"
            mensagem = (
                f"Uma nova avaliação de {nome_servidor} foi liberada no período "
                f"'{periodo.nome}'."
            )
        else:
            mensagem = (
                f"{len(formularios_usuario)} novas avaliações foram liberadas no período "
                f"'{periodo.nome}'."
            )

        await criar_notificacao(
            db,
            municipio_id=periodo.municipio_id,
            usuario_id=usuario_id,
            tipo="PERIODO_ATIVADO",
            titulo="Novas avaliações disponíveis",
            mensagem=mensagem,
            dados_extras={
                "periodo_id": periodo.id,
                "rota": "/avaliacoes/pendentes",
                "formularios_ids": [formulario.id for formulario in formularios_usuario],
            },
        )
        notificacoes_criadas += 1

    return notificacoes_criadas


@router.get("", response_model=List[PeriodoResponse])
async def listar_periodos(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(PeriodoAvaliacao)
        .where(PeriodoAvaliacao.municipio_id == current_user.municipio_id)
        .order_by(PeriodoAvaliacao.data_inicio.desc())
    )
    return result.scalars().all()


@router.post("", response_model=PeriodoResponse, status_code=201)
async def criar_periodo(
    data: PeriodoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    if data.modelo_avaliacao_id:
        modelo_result = await db.execute(
            select(ModeloAvaliacao).where(
                ModeloAvaliacao.id == data.modelo_avaliacao_id,
                ModeloAvaliacao.municipio_id == current_user.municipio_id,
                ModeloAvaliacao.status == StatusModeloEnum.PUBLICADO,
            )
        )
        if not modelo_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Modelo não encontrado ou não publicado")

    periodo = PeriodoAvaliacao(municipio_id=current_user.municipio_id, **data.model_dump())
    db.add(periodo)
    await db.flush()
    await db.refresh(periodo)

    await log_event(
        db, current_user.municipio_id, Acoes.PERIODO_CRIADO, "periodo",
        usuario=current_user, entidade_id=str(periodo.id),
        descricao=f"Período '{periodo.nome}' criado",
    )
    return periodo


@router.get("/{periodo_id}", response_model=PeriodoResponse)
async def detalhar_periodo(
    periodo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(PeriodoAvaliacao).where(
            PeriodoAvaliacao.id == periodo_id,
            PeriodoAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    periodo = result.scalar_one_or_none()
    if not periodo:
        raise HTTPException(status_code=404, detail="Período não encontrado")
    return periodo


@router.post("/{periodo_id}/ativar", response_model=PeriodoResponse)
async def ativar_periodo(
    periodo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(PeriodoAvaliacao).where(
            PeriodoAvaliacao.id == periodo_id,
            PeriodoAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    periodo = result.scalar_one_or_none()
    if not periodo:
        raise HTTPException(status_code=404, detail="Período não encontrado")

    if periodo.status != StatusPeriodoEnum.PLANEJADO:
        raise HTTPException(status_code=400, detail="Apenas períodos PLANEJADOS podem ser ativados")

    periodo.status = StatusPeriodoEnum.ATIVO

    vinculos_result = await db.execute(
        select(VinculoAvaliacao).where(
            VinculoAvaliacao.periodo_avaliacao_id == periodo_id,
            VinculoAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    vinculos = vinculos_result.scalars().all()
    if vinculos:
        modelos_cache_ativacao: dict[int, ModeloAvaliacao] = {}
        for vinculo in vinculos:
            mid = vinculo.modelo_avaliacao_id or periodo.modelo_avaliacao_id
            if not mid:
                continue
            if mid not in modelos_cache_ativacao:
                m_result = await db.execute(
                    select(ModeloAvaliacao)
                    .options(selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao))
                    .where(ModeloAvaliacao.id == mid)
                )
                m = m_result.scalar_one_or_none()
                if m:
                    modelos_cache_ativacao[mid] = m
            m_vinculo = modelos_cache_ativacao.get(mid)
            if m_vinculo:
                await _gerar_formularios_para_vinculo(db, vinculo=vinculo, modelo=m_vinculo)

    formularios_result = await db.execute(
        select(FormularioAvaliacao)
        .join(VinculoAvaliacao, VinculoAvaliacao.id == FormularioAvaliacao.vinculo_avaliacao_id)
        .where(
            VinculoAvaliacao.periodo_avaliacao_id == periodo_id,
            FormularioAvaliacao.ativo == "S",
        )
    )
    formularios = formularios_result.scalars().all()

    await log_event(
        db, current_user.municipio_id, Acoes.PERIODO_ATIVADO, "periodo",
        usuario=current_user, entidade_id=str(periodo_id),
    )

    await _notificar_formularios(db, periodo=periodo, formularios=formularios)

    await db.flush()
    await db.refresh(periodo)
    return periodo


@router.post("/{periodo_id}/encerrar", response_model=PeriodoResponse)
async def encerrar_periodo(
    periodo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(PeriodoAvaliacao).where(
            PeriodoAvaliacao.id == periodo_id,
            PeriodoAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    periodo = result.scalar_one_or_none()
    if not periodo:
        raise HTTPException(status_code=404, detail="Período não encontrado")

    if periodo.status != StatusPeriodoEnum.ATIVO:
        raise HTTPException(status_code=400, detail="Apenas períodos ATIVOS podem ser encerrados")

    periodo.status = StatusPeriodoEnum.ENCERRADO

    await log_event(
        db, current_user.municipio_id, Acoes.PERIODO_ENCERRADO, "periodo",
        usuario=current_user, entidade_id=str(periodo_id),
    )

    await db.flush()
    await db.refresh(periodo)
    return periodo


@router.post("/{periodo_id}/vinculos")
async def gerar_vinculos(
    periodo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(PeriodoAvaliacao).where(
            PeriodoAvaliacao.id == periodo_id,
            PeriodoAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    periodo = result.scalar_one_or_none()
    if not periodo:
        raise HTTPException(status_code=404, detail="Período não encontrado")

    if not periodo.modelo_avaliacao_id:
        raise HTTPException(status_code=400, detail="Período precisa ter um modelo de avaliação")

    modelo_q = await db.execute(
        select(ModeloAvaliacao)
        .options(selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao))
        .where(ModeloAvaliacao.id == periodo.modelo_avaliacao_id)
    )
    modelo = modelo_q.scalar_one_or_none()
    if not modelo or modelo.municipio_id != current_user.municipio_id:
        raise HTTPException(status_code=400, detail="Modelo de avaliação inválido para este município")

    servidores_result = await db.execute(
        select(Servidor)
        .options(selectinload(Servidor.cargo_catalogo))
        .where(
            Servidor.municipio_id == current_user.municipio_id,
            Servidor.ativo == True,
        )
    )
    servidores = servidores_result.scalars().all()

    # Cache de modelos carregados para não repetir queries
    modelos_cache: dict[int, ModeloAvaliacao] = {}
    if modelo:
        modelos_cache[modelo.id] = modelo

    async def _modelo_para_servidor(srv: Servidor) -> ModeloAvaliacao | None:
        # Prioridade: cargo do servidor → fallback do período
        mid = None
        if srv.cargo_catalogo and srv.cargo_catalogo.modelo_avaliacao_id:
            mid = srv.cargo_catalogo.modelo_avaliacao_id
        elif periodo.modelo_avaliacao_id:
            mid = periodo.modelo_avaliacao_id
        if not mid:
            return None
        if mid not in modelos_cache:
            m_result = await db.execute(
                select(ModeloAvaliacao)
                .options(selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao))
                .where(ModeloAvaliacao.id == mid)
            )
            m = m_result.scalar_one_or_none()
            if m:
                modelos_cache[mid] = m
        return modelos_cache.get(mid)

    criados = 0
    pulados = 0
    formularios_criados = 0
    novos_formularios: list[FormularioAvaliacao] = []
    for servidor in servidores:
        modelo_srv = await _modelo_para_servidor(servidor)
        if not modelo_srv:
            pulados += 1
            continue

        existing = await db.execute(
            select(VinculoAvaliacao).where(
                VinculoAvaliacao.periodo_avaliacao_id == periodo_id,
                VinculoAvaliacao.servidor_avaliado_id == servidor.id,
            )
        )
        vinculo_existente = existing.scalar_one_or_none()
        if vinculo_existente:
            novos = await _gerar_formularios_para_vinculo(
                db, vinculo=vinculo_existente, modelo=modelo_srv,
            )
            formularios_criados += len(novos)
            novos_formularios.extend(novos)
            continue

        vinculo = VinculoAvaliacao(
            municipio_id=current_user.municipio_id,
            periodo_avaliacao_id=periodo_id,
            modelo_avaliacao_id=modelo_srv.id,
            servidor_avaliado_id=servidor.id,
            chefia_servidor_id=servidor.chefia_servidor_id,
        )
        db.add(vinculo)
        await db.flush()
        novos = await _gerar_formularios_para_vinculo(
            db, vinculo=vinculo, modelo=modelo_srv,
        )
        formularios_criados += len(novos)
        novos_formularios.extend(novos)
        criados += 1

    if periodo.status == StatusPeriodoEnum.ATIVO and novos_formularios:
        await _notificar_formularios(db, periodo=periodo, formularios=novos_formularios)

    return {
        "message": f"{criados} vínculos e {formularios_criados} formulários criados" + (f" ({pulados} servidores sem cargo/questionário vinculado foram ignorados)" if pulados else ""),
        "total": criados,
        "formularios_criados": formularios_criados,
        "pulados": pulados,
    }


@router.get("/{periodo_id}/progresso", response_model=PeriodoProgresso)
async def progresso_periodo(
    periodo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    total = await db.execute(
        select(func.count(VinculoAvaliacao.id)).where(
            VinculoAvaliacao.periodo_avaliacao_id == periodo_id,
            VinculoAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    total_count = total.scalar() or 0

    from app.models.periodo import StatusVinculoEnum
    pendentes = await db.execute(
        select(func.count(VinculoAvaliacao.id)).where(
            VinculoAvaliacao.periodo_avaliacao_id == periodo_id,
            VinculoAvaliacao.municipio_id == current_user.municipio_id,
            VinculoAvaliacao.status == StatusVinculoEnum.PENDENTE,
        )
    )
    em_andamento = await db.execute(
        select(func.count(VinculoAvaliacao.id)).where(
            VinculoAvaliacao.periodo_avaliacao_id == periodo_id,
            VinculoAvaliacao.municipio_id == current_user.municipio_id,
            VinculoAvaliacao.status == StatusVinculoEnum.EM_ANDAMENTO,
        )
    )
    finalizados = await db.execute(
        select(func.count(VinculoAvaliacao.id)).where(
            VinculoAvaliacao.periodo_avaliacao_id == periodo_id,
            VinculoAvaliacao.municipio_id == current_user.municipio_id,
            VinculoAvaliacao.status == StatusVinculoEnum.FINALIZADA,
        )
    )

    p = pendentes.scalar() or 0
    ea = em_andamento.scalar() or 0
    f = finalizados.scalar() or 0
    pct = round((f / total_count * 100) if total_count > 0 else 0, 1)

    return PeriodoProgresso(
        total_vinculos=total_count,
        pendentes=p,
        em_andamento=ea,
        finalizados=f,
        percentual_concluido=pct,
    )
