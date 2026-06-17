from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from typing import List

from app.database import get_db
from app.core.deps import get_current_user
from app.core.audit import log_event, Acoes
from app.models.periodo import (
    FormularioAvaliacao, VinculoAvaliacao, PeriodoAvaliacao, RespostaAvaliacao,
    TipoAvaliacaoEnum, StatusPeriodoEnum, StatusVinculoEnum,
)
from app.models.questionario import ModeloAvaliacao, PerguntaAvaliacao, OpcaoPerguntaAvaliacao
from app.models.usuario import Usuario, PerfilEnum
from app.models.servidor import Servidor
from app.schemas.avaliacao import (
    SalvarAvaliacaoRequest, FinalizarAvaliacaoRequest,
    FormularioResumo, FormularioDetalhado,
)

router = APIRouter(prefix="/avaliacoes", tags=["Avaliações"])


def _pode_acessar_formulario(formulario: FormularioAvaliacao, current_user: Usuario) -> bool:
    if current_user.perfil in (PerfilEnum.SUPER_ADMIN, PerfilEnum.ADMINISTRADOR):
        return formulario.municipio_id == current_user.municipio_id
    return formulario.usuario_avaliador_id == current_user.id


async def _sincronizar_status_vinculo(db: AsyncSession, vinculo_id: int) -> None:
    vinculo = await db.get(VinculoAvaliacao, vinculo_id)
    if not vinculo:
        return

    result = await db.execute(
        select(FormularioAvaliacao).where(
            FormularioAvaliacao.vinculo_avaliacao_id == vinculo_id,
            FormularioAvaliacao.ativo == "S",
        )
    )
    formularios = result.scalars().all()
    if not formularios:
        vinculo.status = StatusVinculoEnum.PENDENTE
        return

    statuses = {formulario.status for formulario in formularios}
    if statuses == {StatusVinculoEnum.FINALIZADA}:
        vinculo.status = StatusVinculoEnum.FINALIZADA
    elif StatusVinculoEnum.EM_ANDAMENTO in statuses or StatusVinculoEnum.FINALIZADA in statuses:
        vinculo.status = StatusVinculoEnum.EM_ANDAMENTO
    elif statuses == {StatusVinculoEnum.CANCELADA}:
        vinculo.status = StatusVinculoEnum.CANCELADA
    else:
        vinculo.status = StatusVinculoEnum.PENDENTE


def _pergunta_aplicavel(pergunta: PerguntaAvaliacao, tipo_avaliacao: TipoAvaliacaoEnum) -> bool:
    if tipo_avaliacao == TipoAvaliacaoEnum.AUTOAVALIACAO:
        return not pergunta.apenas_superior and not pergunta.apenas_subcomissao
    if tipo_avaliacao == TipoAvaliacaoEnum.SUPERIOR_IMEDIATO:
        return not pergunta.apenas_autoavaliacao and not pergunta.apenas_subcomissao
    if tipo_avaliacao == TipoAvaliacaoEnum.SUBCOMISSAO:
        return not pergunta.apenas_autoavaliacao and not pergunta.apenas_superior
    return True


@router.get("/minhas", response_model=List[FormularioResumo])
async def minhas_avaliacoes(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    result = await db.execute(
        select(FormularioAvaliacao)
        .where(
            FormularioAvaliacao.municipio_id == current_user.municipio_id,
            FormularioAvaliacao.usuario_avaliador_id == current_user.id,
            FormularioAvaliacao.ativo == "S",
        )
        .order_by(FormularioAvaliacao.criado_em.desc())
    )
    forms = result.scalars().all()
    items = []
    for f in forms:
        srv = await db.get(Servidor, f.servidor_avaliado_id)
        item = FormularioResumo.model_validate(f)
        item.nome_servidor = srv.nome if srv else None
        items.append(item)
    return items


@router.get("/pendentes", response_model=List[FormularioResumo])
async def avaliacoes_pendentes(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    result = await db.execute(
        select(FormularioAvaliacao)
        .join(VinculoAvaliacao, VinculoAvaliacao.id == FormularioAvaliacao.vinculo_avaliacao_id)
        .join(PeriodoAvaliacao, PeriodoAvaliacao.id == VinculoAvaliacao.periodo_avaliacao_id)
        .where(
            FormularioAvaliacao.municipio_id == current_user.municipio_id,
            FormularioAvaliacao.usuario_avaliador_id == current_user.id,
            FormularioAvaliacao.ativo == "S",
            PeriodoAvaliacao.status == StatusPeriodoEnum.ATIVO,
            FormularioAvaliacao.status.in_([StatusVinculoEnum.PENDENTE, StatusVinculoEnum.EM_ANDAMENTO]),
        )
        .order_by(FormularioAvaliacao.criado_em)
    )
    forms = result.scalars().all()
    items = []
    for f in forms:
        srv = await db.get(Servidor, f.servidor_avaliado_id)
        item = FormularioResumo.model_validate(f)
        item.nome_servidor = srv.nome if srv else None
        items.append(item)
    return items


@router.get("/{formulario_id}", response_model=FormularioDetalhado)
async def carregar_formulario(
    formulario_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    result = await db.execute(
        select(FormularioAvaliacao)
        .options(selectinload(FormularioAvaliacao.respostas))
        .where(
            FormularioAvaliacao.id == formulario_id,
            FormularioAvaliacao.ativo == "S",
        )
    )
    formulario = result.scalar_one_or_none()
    if not formulario or not _pode_acessar_formulario(formulario, current_user):
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    vinculo = await db.get(VinculoAvaliacao, formulario.vinculo_avaliacao_id)
    periodo = await db.get(PeriodoAvaliacao, vinculo.periodo_avaliacao_id) if vinculo else None
    if not periodo or periodo.status != StatusPeriodoEnum.ATIVO:
        raise HTTPException(status_code=400, detail="O período desta avaliação não está ativo")

    modelo_result = await db.execute(
        select(ModeloAvaliacao)
        .options(
            selectinload(ModeloAvaliacao.perguntas)
            .selectinload(PerguntaAvaliacao.opcoes)
        )
        .where(ModeloAvaliacao.id == vinculo.modelo_avaliacao_id)
    )
    modelo = modelo_result.scalar_one_or_none()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo da avaliação não encontrado")

    srv = await db.get(Servidor, formulario.servidor_avaliado_id)
    resp = FormularioDetalhado.model_validate(formulario)
    resp.nome_servidor = srv.nome if srv else None
    resp.perguntas = [
        pergunta for pergunta in modelo.perguntas
        if pergunta.ativa and _pergunta_aplicavel(pergunta, formulario.tipo_avaliacao)
    ]
    return resp


@router.post("/{formulario_id}/iniciar", response_model=FormularioResumo)
async def iniciar_avaliacao(
    formulario_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    result = await db.execute(
        select(FormularioAvaliacao).where(FormularioAvaliacao.id == formulario_id)
        .where(FormularioAvaliacao.ativo == "S")
    )
    formulario = result.scalar_one_or_none()
    if not formulario or not _pode_acessar_formulario(formulario, current_user):
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    vinculo = await db.get(VinculoAvaliacao, formulario.vinculo_avaliacao_id)
    periodo = await db.get(PeriodoAvaliacao, vinculo.periodo_avaliacao_id) if vinculo else None
    if not periodo or periodo.status != StatusPeriodoEnum.ATIVO:
        raise HTTPException(status_code=400, detail="O período desta avaliação não está ativo")

    if formulario.status == StatusVinculoEnum.FINALIZADA:
        raise HTTPException(status_code=400, detail="Avaliação já finalizada")

    if formulario.status == StatusVinculoEnum.PENDENTE:
        formulario.status = StatusVinculoEnum.EM_ANDAMENTO
        formulario.iniciado_em = datetime.now(timezone.utc)

    await log_event(
        db, formulario.municipio_id, Acoes.AVALIACAO_INICIADA, "avaliacao",
        usuario=current_user, entidade_id=str(formulario_id),
    )
    await _sincronizar_status_vinculo(db, formulario.vinculo_avaliacao_id)

    await db.flush()
    await db.refresh(formulario)
    srv = await db.get(Servidor, formulario.servidor_avaliado_id)
    resp = FormularioResumo.model_validate(formulario)
    resp.nome_servidor = srv.nome if srv else None
    return resp


@router.post("/{formulario_id}/salvar", response_model=FormularioResumo)
async def salvar_avaliacao(
    formulario_id: int,
    data: SalvarAvaliacaoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    result = await db.execute(
        select(FormularioAvaliacao).where(FormularioAvaliacao.id == formulario_id)
        .where(FormularioAvaliacao.ativo == "S")
    )
    formulario = result.scalar_one_or_none()
    if not formulario or not _pode_acessar_formulario(formulario, current_user):
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    vinculo = await db.get(VinculoAvaliacao, formulario.vinculo_avaliacao_id)
    periodo = await db.get(PeriodoAvaliacao, vinculo.periodo_avaliacao_id) if vinculo else None
    if not periodo or periodo.status != StatusPeriodoEnum.ATIVO:
        raise HTTPException(status_code=400, detail="O período desta avaliação não está ativo")

    if formulario.status == StatusVinculoEnum.FINALIZADA:
        raise HTTPException(status_code=400, detail="Avaliação já finalizada")

    if formulario.status == StatusVinculoEnum.PENDENTE:
        formulario.status = StatusVinculoEnum.EM_ANDAMENTO
        formulario.iniciado_em = formulario.iniciado_em or datetime.now(timezone.utc)

    if data.observacoes is not None:
        formulario.observacoes = data.observacoes
    if data.sugestoes_melhoria is not None:
        formulario.sugestoes_melhoria = data.sugestoes_melhoria
    if data.uso_alcool_drogas is not None:
        formulario.uso_alcool_drogas = data.uso_alcool_drogas

    for resp in data.respostas:
        existing = await db.execute(
            select(RespostaAvaliacao).where(
                RespostaAvaliacao.formulario_avaliacao_id == formulario_id,
                RespostaAvaliacao.pergunta_avaliacao_id == resp.pergunta_avaliacao_id,
            )
        )
        resposta = existing.scalar_one_or_none()
        if resposta:
            resposta.opcao_selecionada = resp.opcao_selecionada
            resposta.resposta_numerica = resp.resposta_numerica
            resposta.resposta_texto = resp.resposta_texto
        else:
            resposta = RespostaAvaliacao(
                municipio_id=formulario.municipio_id,
                formulario_avaliacao_id=formulario_id,
                pergunta_avaliacao_id=resp.pergunta_avaliacao_id,
                opcao_selecionada=resp.opcao_selecionada,
                resposta_numerica=resp.resposta_numerica,
                resposta_texto=resp.resposta_texto,
            )
            db.add(resposta)

    await log_event(
        db, formulario.municipio_id, Acoes.AVALIACAO_SALVA, "avaliacao",
        usuario=current_user, entidade_id=str(formulario_id),
    )
    await _sincronizar_status_vinculo(db, formulario.vinculo_avaliacao_id)

    await db.flush()
    await db.refresh(formulario)
    srv = await db.get(Servidor, formulario.servidor_avaliado_id)
    resp_schema = FormularioResumo.model_validate(formulario)
    resp_schema.nome_servidor = srv.nome if srv else None
    return resp_schema


@router.post("/{formulario_id}/finalizar", response_model=FormularioDetalhado)
async def finalizar_avaliacao(
    formulario_id: int,
    data: FinalizarAvaliacaoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    result = await db.execute(
        select(FormularioAvaliacao)
        .options(selectinload(FormularioAvaliacao.respostas))
        .where(
            FormularioAvaliacao.id == formulario_id,
            FormularioAvaliacao.ativo == "S",
        )
    )
    formulario = result.scalar_one_or_none()
    if not formulario or not _pode_acessar_formulario(formulario, current_user):
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    vinculo = await db.get(VinculoAvaliacao, formulario.vinculo_avaliacao_id)
    periodo = await db.get(PeriodoAvaliacao, vinculo.periodo_avaliacao_id) if vinculo else None
    if not periodo or periodo.status != StatusPeriodoEnum.ATIVO:
        raise HTTPException(status_code=400, detail="O período desta avaliação não está ativo")

    if formulario.status == StatusVinculoEnum.FINALIZADA:
        raise HTTPException(status_code=400, detail="Avaliação já finalizada")

    formulario.iniciado_em = formulario.iniciado_em or datetime.now(timezone.utc)

    if data.observacoes is not None:
        formulario.observacoes = data.observacoes
    if data.sugestoes_melhoria is not None:
        formulario.sugestoes_melhoria = data.sugestoes_melhoria
    if data.uso_alcool_drogas is not None:
        formulario.uso_alcool_drogas = data.uso_alcool_drogas

    pontuacao_total = 0.0
    for resp in data.respostas:
        existing = await db.execute(
            select(RespostaAvaliacao).where(
                RespostaAvaliacao.formulario_avaliacao_id == formulario_id,
                RespostaAvaliacao.pergunta_avaliacao_id == resp.pergunta_avaliacao_id,
            )
        )
        resposta = existing.scalar_one_or_none()

        pergunta = await db.get(PerguntaAvaliacao, resp.pergunta_avaliacao_id)
        pontuacao = 0.0

        if resp.opcao_selecionada and pergunta:
            opcao_result = await db.execute(
                select(OpcaoPerguntaAvaliacao).where(
                    OpcaoPerguntaAvaliacao.pergunta_avaliacao_id == resp.pergunta_avaliacao_id,
                    OpcaoPerguntaAvaliacao.letra_opcao == resp.opcao_selecionada,
                )
            )
            opcao = opcao_result.scalar_one_or_none()
            if opcao and opcao.pontuacao:
                pontuacao = float(opcao.pontuacao) * float(pergunta.peso)

        elif resp.resposta_numerica and pergunta:
            pontuacao = float(resp.resposta_numerica) * float(pergunta.peso)

        pontuacao_total += pontuacao

        if resposta:
            resposta.opcao_selecionada = resp.opcao_selecionada
            resposta.resposta_numerica = resp.resposta_numerica
            resposta.resposta_texto = resp.resposta_texto
            resposta.pontuacao_obtida = pontuacao
        else:
            resposta = RespostaAvaliacao(
                municipio_id=formulario.municipio_id,
                formulario_avaliacao_id=formulario_id,
                pergunta_avaliacao_id=resp.pergunta_avaliacao_id,
                opcao_selecionada=resp.opcao_selecionada,
                resposta_numerica=resp.resposta_numerica,
                resposta_texto=resp.resposta_texto,
                pontuacao_obtida=pontuacao,
            )
            db.add(resposta)

    formulario.status = StatusVinculoEnum.FINALIZADA
    formulario.pontuacao_total = pontuacao_total
    formulario.finalizado_em = datetime.now(timezone.utc)

    await log_event(
        db, formulario.municipio_id, Acoes.AVALIACAO_FINALIZADA, "avaliacao",
        usuario=current_user, entidade_id=str(formulario_id),
        descricao=f"Pontuação total: {pontuacao_total:.2f}",
    )
    await _sincronizar_status_vinculo(db, formulario.vinculo_avaliacao_id)

    await db.flush()
    await db.refresh(formulario)
    srv = await db.get(Servidor, formulario.servidor_avaliado_id)
    resp_schema = FormularioDetalhado.model_validate(formulario)
    resp_schema.nome_servidor = srv.nome if srv else None
    return resp_schema


@router.delete("/{formulario_id}")
async def excluir_avaliacao(
    formulario_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    result = await db.execute(
        select(FormularioAvaliacao).where(
            FormularioAvaliacao.id == formulario_id,
            FormularioAvaliacao.ativo == "S",
        )
    )
    formulario = result.scalar_one_or_none()
    if not formulario or not _pode_acessar_formulario(formulario, current_user):
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    formulario.ativo = "N"
    formulario.status = StatusVinculoEnum.CANCELADA

    await log_event(
        db, formulario.municipio_id, Acoes.AVALIACAO_EXCLUIDA, "avaliacao",
        usuario=current_user, entidade_id=str(formulario_id),
        descricao="Avaliação marcada como inativa",
    )
    await _sincronizar_status_vinculo(db, formulario.vinculo_avaliacao_id)

    return {"message": "Avaliação excluída com sucesso"}
