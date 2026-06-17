from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.municipio import Municipio
from app.models.servidor import Servidor
from app.models.periodo import PeriodoAvaliacao, FormularioAvaliacao, StatusPeriodoEnum, StatusVinculoEnum
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
