from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.municipio import Municipio
from app.models.servidor import Servidor
from app.models.servidor_funcao import ServidorFuncao
from app.models.funcao_usuario import FuncaoUsuario
from app.models.periodo import PeriodoAvaliacao, FormularioAvaliacao, VinculoAvaliacao, StatusPeriodoEnum, StatusVinculoEnum, TipoAvaliacaoEnum
from app.models.questionario import ModeloAvaliacao, StatusModeloEnum
from app.models.usuario import Usuario, PerfilEnum

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/admin")
async def dashboard_admin(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    municipio_id = current_user.municipio_id
    is_super_admin = current_user.perfil == PerfilEnum.SUPER_ADMIN

    servidor_filters = [Servidor.ativo == True]
    periodo_filters = []
    modelo_filters = [ModeloAvaliacao.status == StatusModeloEnum.PUBLICADO]
    avaliacao_filters = []

    if not is_super_admin:
        servidor_filters.append(Servidor.municipio_id == municipio_id)
        periodo_filters.append(PeriodoAvaliacao.municipio_id == municipio_id)
        modelo_filters.append(ModeloAvaliacao.municipio_id == municipio_id)
        avaliacao_filters.append(FormularioAvaliacao.municipio_id == municipio_id)

    total_servidores = await db.execute(
        select(func.count(Servidor.id)).where(*servidor_filters)
    )

    periodo_ativo = await db.execute(
        select(PeriodoAvaliacao).where(
            *periodo_filters,
            PeriodoAvaliacao.status == StatusPeriodoEnum.ATIVO,
        ).limit(1)
    )
    periodo = periodo_ativo.scalar_one_or_none()

    total_periodos_ativos = await db.execute(
        select(func.count(PeriodoAvaliacao.id)).where(
            *periodo_filters,
            PeriodoAvaliacao.status == StatusPeriodoEnum.ATIVO,
        )
    )

    avaliacoes_stats = {
        "total": 0, "pendentes": 0, "em_andamento": 0, "finalizadas": 0,
    }

    if periodo:
        for st in [StatusVinculoEnum.PENDENTE, StatusVinculoEnum.EM_ANDAMENTO, StatusVinculoEnum.FINALIZADA]:
            cnt = await db.execute(
                select(func.count(FormularioAvaliacao.id)).where(
                    *avaliacao_filters,
                    FormularioAvaliacao.status == st,
                )
            )
            key = st.value.lower().replace("_", "")
            avaliacoes_stats[key] = cnt.scalar() or 0
            avaliacoes_stats["total"] += avaliacoes_stats[key]

    modelos_publicados = await db.execute(
        select(func.count(ModeloAvaliacao.id)).where(*modelo_filters)
    )

    total_periodos = await db.execute(
        select(func.count(PeriodoAvaliacao.id)).where(*periodo_filters)
    )

    total_municipios = None
    if is_super_admin:
        municipios = await db.execute(select(func.count(Municipio.id)))
        total_municipios = municipios.scalar() or 0

    return {
        "escopo": "global" if is_super_admin else "municipio",
        "municipio_id": None if is_super_admin else municipio_id,
        "total_municipios": total_municipios,
        "total_servidores": total_servidores.scalar() or 0,
        "modelos_publicados": modelos_publicados.scalar() or 0,
        "total_periodos": total_periodos.scalar() or 0,
        "total_periodos_ativos": total_periodos_ativos.scalar() or 0,
        "periodo_ativo": {
            "id": periodo.id,
            "nome": periodo.nome,
            "data_inicio": periodo.data_inicio.isoformat(),
            "data_fim": periodo.data_fim.isoformat(),
        } if periodo and not is_super_admin else None,
        "avaliacoes": avaliacoes_stats,
        "percentual_concluido": round(
            (avaliacoes_stats["finalizadas"] / avaliacoes_stats["total"] * 100)
            if avaliacoes_stats["total"] > 0 else 0,
            1,
        ),
    }


@router.get("/admin/funcoes-progresso")
async def dashboard_admin_funcoes_progresso(
    periodo_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    municipio_id = current_user.municipio_id
    is_super_admin = current_user.perfil == PerfilEnum.SUPER_ADMIN

    # Resolve período
    if periodo_id:
        periodo = await db.get(PeriodoAvaliacao, periodo_id)
        if not periodo or (not is_super_admin and periodo.municipio_id != municipio_id):
            return {"periodo_id": None, "periodo_nome": None, "funcoes": [], "periodos_disponiveis": []}
    else:
        filters = [PeriodoAvaliacao.status == StatusPeriodoEnum.ATIVO]
        if not is_super_admin:
            filters.append(PeriodoAvaliacao.municipio_id == municipio_id)
        result = await db.execute(select(PeriodoAvaliacao).where(*filters).limit(1))
        periodo = result.scalar_one_or_none()

    # Lista de períodos disponíveis para o filtro
    per_filters = [] if is_super_admin else [PeriodoAvaliacao.municipio_id == municipio_id]
    all_periodos_q = await db.execute(
        select(PeriodoAvaliacao.id, PeriodoAvaliacao.nome, PeriodoAvaliacao.status)
        .where(*per_filters)
        .order_by(PeriodoAvaliacao.criado_em.desc())
    )
    periodos_disponiveis = [
        {"id": row.id, "nome": row.nome, "status": row.status}
        for row in all_periodos_q
    ]

    if not periodo:
        return {
            "periodo_id": None,
            "periodo_nome": None,
            "funcoes": [],
            "periodos_disponiveis": periodos_disponiveis,
        }

    mun_filter = [] if is_super_admin else [FormularioAvaliacao.municipio_id == municipio_id]
    funcoes_progresso = []

    async def _contar_por_status(tipo: Optional[TipoAvaliacaoEnum] = None, funcao_usuario_id: Optional[int] = None):
        q = (
            select(FormularioAvaliacao.status, func.count(FormularioAvaliacao.id).label("cnt"))
            .join(VinculoAvaliacao, FormularioAvaliacao.vinculo_avaliacao_id == VinculoAvaliacao.id)
            .where(
                VinculoAvaliacao.periodo_avaliacao_id == periodo.id,
                FormularioAvaliacao.ativo == "S",
                *mun_filter,
            )
        )
        if tipo:
            q = q.where(FormularioAvaliacao.tipo_avaliacao == tipo)
        if funcao_usuario_id is not None:
            q = q.join(Usuario, FormularioAvaliacao.usuario_avaliador_id == Usuario.id).where(
                Usuario.funcao_usuario_id == funcao_usuario_id
            )
        q = q.group_by(FormularioAvaliacao.status)
        result = await db.execute(q)
        counts = {row.status: row.cnt for row in result}
        pendentes = counts.get(StatusVinculoEnum.PENDENTE, 0)
        em_andamento = counts.get(StatusVinculoEnum.EM_ANDAMENTO, 0)
        finalizadas = counts.get(StatusVinculoEnum.FINALIZADA, 0)
        total = pendentes + em_andamento + finalizadas
        pct = round(finalizadas / total * 100, 1) if total > 0 else 0.0
        if total == 0:
            status_geral = "PENDENTE"
        elif finalizadas == total:
            status_geral = "CONCLUIDO"
        else:
            status_geral = "EM_ANDAMENTO"
        return {
            "pendentes": pendentes,
            "em_andamento": em_andamento,
            "realizadas": finalizadas,
            "total_servidores": total,
            "percentual_conclusao": pct,
            "status_geral": status_geral,
        }

    # Autoavaliação
    auto = await _contar_por_status(tipo=TipoAvaliacaoEnum.AUTOAVALIACAO)
    funcoes_progresso.append({
        "id": "autoavaliacao",
        "nome": "Autoavaliação",
        "perfil_base": "AUTOAVALIACAO",
        **auto,
        "membros": [],
    })

    # Funções de usuário cadastradas
    fu_filters = [FuncaoUsuario.ativo == True]
    if not is_super_admin:
        fu_filters.append(FuncaoUsuario.municipio_id == municipio_id)
    fu_result = await db.execute(
        select(FuncaoUsuario).where(*fu_filters).order_by(FuncaoUsuario.nome)
    )
    funcoes_usuario = fu_result.scalars().all()

    for fu in funcoes_usuario:
        counts = await _contar_por_status(funcao_usuario_id=fu.id)

        # Membros vinculados via ServidorFuncao
        membros_q = await db.execute(
            select(Servidor.id, Servidor.nome, Servidor.cargo, Servidor.matricula, Servidor.lotacao)
            .join(ServidorFuncao, Servidor.id == ServidorFuncao.servidor_id)
            .where(
                ServidorFuncao.funcao_usuario_id == fu.id,
                ServidorFuncao.ativo == True,
                Servidor.ativo == True,
            )
            .order_by(Servidor.nome)
        )
        membros = [
            {
                "servidor_id": row.id,
                "nome": row.nome,
                "cargo": row.cargo,
                "matricula": row.matricula,
                "lotacao": row.lotacao,
                "papel": fu.nome,
            }
            for row in membros_q
        ]

        funcoes_progresso.append({
            "id": fu.id,
            "nome": fu.nome,
            "perfil_base": fu.perfil_base,
            **counts,
            "membros": membros,
        })

    return {
        "periodo_id": periodo.id,
        "periodo_nome": periodo.nome,
        "funcoes": funcoes_progresso,
        "periodos_disponiveis": periodos_disponiveis,
    }


@router.get("/servidor")
async def dashboard_servidor(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    total = await db.execute(
        select(func.count(FormularioAvaliacao.id)).where(
            FormularioAvaliacao.usuario_avaliador_id == current_user.id
        )
    )
    pendentes = await db.execute(
        select(func.count(FormularioAvaliacao.id)).where(
            FormularioAvaliacao.usuario_avaliador_id == current_user.id,
            FormularioAvaliacao.status == StatusVinculoEnum.PENDENTE,
        )
    )
    finalizadas = await db.execute(
        select(func.count(FormularioAvaliacao.id)).where(
            FormularioAvaliacao.usuario_avaliador_id == current_user.id,
            FormularioAvaliacao.status == StatusVinculoEnum.FINALIZADA,
        )
    )

    return {
        "total_avaliacoes": total.scalar() or 0,
        "pendentes": pendentes.scalar() or 0,
        "finalizadas": finalizadas.scalar() or 0,
    }
