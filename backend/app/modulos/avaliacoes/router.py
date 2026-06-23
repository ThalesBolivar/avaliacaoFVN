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
from app.models.servidor_funcao import ServidorFuncao
from app.models.cargo import PesoQuestaoCargo
from app.models.notificacao import Notificacao
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


TIPO_LABEL = {
    "AUTOAVALIACAO": "Autoavaliação",
    "SUPERIOR_IMEDIATO": "Avaliação pela Chefia",
    "SUBCOMISSAO": "Avaliação pela Subcomissão",
}


async def _notificar(
    db: AsyncSession,
    *,
    municipio_id: int,
    usuario_id: int,
    tipo: str,
    titulo: str,
    mensagem: str,
) -> None:
    db.add(Notificacao(
        municipio_id=municipio_id,
        usuario_id=usuario_id,
        tipo=tipo,
        titulo=titulo,
        mensagem=mensagem,
    ))


async def _pesos_por_cargo(db: AsyncSession, cargo_id: int | None) -> dict[int, float]:
    """Retorna {numero_pergunta: peso} para o cargo do servidor avaliado."""
    if not cargo_id:
        return {}
    result = await db.execute(
        select(PesoQuestaoCargo).where(PesoQuestaoCargo.cargo_id == cargo_id)
    )
    return {p.numero_pergunta: float(p.peso) for p in result.scalars().all()}


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
    query = (
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

    # Subcomissão não pode avaliar seus próprios membros
    if current_user.perfil == PerfilEnum.SUBCOMISSAO and current_user.funcao_usuario_id:
        membros_result = await db.execute(
            select(ServidorFuncao.servidor_id).where(
                ServidorFuncao.funcao_usuario_id == current_user.funcao_usuario_id,
                ServidorFuncao.ativo == True,
            )
        )
        ids_membros = [row[0] for row in membros_result.all()]
        if ids_membros:
            from sqlalchemy import not_
            query = query.where(
                FormularioAvaliacao.servidor_avaliado_id.not_in(ids_membros)
            )

    result = await db.execute(query)
    forms = result.scalars().all()
    items = []
    for f in forms:
        srv = await db.get(Servidor, f.servidor_avaliado_id)
        item = FormularioResumo.model_validate(f)
        item.nome_servidor = srv.nome if srv else None
        items.append(item)
    return items


@router.get("/recebidas", response_model=List[FormularioResumo])
async def avaliacoes_recebidas(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Retorna todas as avaliações RECEBIDAS pelo servidor logado (como avaliado)."""
    if not current_user.servidor_id:
        return []

    result = await db.execute(
        select(FormularioAvaliacao)
        .join(VinculoAvaliacao, VinculoAvaliacao.id == FormularioAvaliacao.vinculo_avaliacao_id)
        .join(PeriodoAvaliacao, PeriodoAvaliacao.id == VinculoAvaliacao.periodo_avaliacao_id)
        .where(
            FormularioAvaliacao.municipio_id == current_user.municipio_id,
            FormularioAvaliacao.servidor_avaliado_id == current_user.servidor_id,
            FormularioAvaliacao.ativo == "S",
            PeriodoAvaliacao.status.in_([StatusPeriodoEnum.ATIVO, StatusPeriodoEnum.ENCERRADO]),
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


@router.get("/minha-subcomissao")
async def membros_minha_subcomissao(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.perfil != PerfilEnum.SUBCOMISSAO:
        raise HTTPException(status_code=403, detail="Apenas usuários de subcomissão podem acessar este recurso")

    if not current_user.funcao_usuario_id:
        raise HTTPException(status_code=404, detail="Usuário não está vinculado a nenhuma subcomissão")

    result = await db.execute(
        select(ServidorFuncao)
        .options(selectinload(ServidorFuncao.servidor))
        .where(
            ServidorFuncao.funcao_usuario_id == current_user.funcao_usuario_id,
            ServidorFuncao.ativo == True,
        )
    )
    vinculos = result.scalars().all()

    from app.models.funcao_usuario import FuncaoUsuario
    funcao = await db.get(FuncaoUsuario, current_user.funcao_usuario_id)

    return {
        "funcao_nome": funcao.nome if funcao else None,
        "membros": [
            {
                "id": v.servidor.id,
                "nome": v.servidor.nome,
                "matricula": v.servidor.matricula,
                "cargo": v.servidor.cargo,
            }
            for v in vinculos if v.servidor
        ],
    }


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
    pesos = await _pesos_por_cargo(db, srv.cargo_id if srv else None)

    resp = FormularioDetalhado.model_validate(formulario)
    resp.nome_servidor = srv.nome if srv else None

    perguntas_filtradas = [
        p for p in modelo.perguntas
        if p.ativa and _pergunta_aplicavel(p, formulario.tipo_avaliacao)
    ]
    # Sobrescreve o peso de cada pergunta com o valor de pesos_questao_cargo
    from app.schemas.avaliacao import PerguntaFormularioResponse
    perguntas_response = []
    for p in perguntas_filtradas:
        pr = PerguntaFormularioResponse.model_validate(p)
        if p.numero_pergunta in pesos:
            pr.peso = pesos[p.numero_pergunta]
        perguntas_response.append(pr)
    resp.perguntas = perguntas_response
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


    srv_fin = await db.get(Servidor, formulario.servidor_avaliado_id)
    pesos_cargo = await _pesos_por_cargo(db, srv_fin.cargo_id if srv_fin else None)

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

        # Usa peso de pesos_questao_cargo se disponível, senão fallback para pergunta.peso
        peso = float(pesos_cargo.get(pergunta.numero_pergunta, pergunta.peso)) if pergunta else 1.0

        if resp.opcao_selecionada and pergunta:
            opcao_result = await db.execute(
                select(OpcaoPerguntaAvaliacao).where(
                    OpcaoPerguntaAvaliacao.pergunta_avaliacao_id == resp.pergunta_avaliacao_id,
                    OpcaoPerguntaAvaliacao.letra_opcao == resp.opcao_selecionada,
                )
            )
            opcao = opcao_result.scalar_one_or_none()
            if opcao and opcao.pontuacao:
                pontuacao = float(opcao.pontuacao) * peso

        elif resp.resposta_numerica and pergunta:
            pontuacao = float(resp.resposta_numerica) * peso

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

    # Notificar o avaliador que finalizou
    tipo_label = TIPO_LABEL.get(formulario.tipo_avaliacao.value, "Avaliação")
    nome_avaliado = srv_fin.nome if srv_fin else f"Servidor #{formulario.servidor_avaliado_id}"
    await _notificar(
        db,
        municipio_id=formulario.municipio_id,
        usuario_id=current_user.id,
        tipo="AVALIACAO_FINALIZADA",
        titulo=f"{tipo_label} finalizada",
        mensagem=f"Você finalizou a avaliação de {nome_avaliado} com {pontuacao_total:.2f} pontos.",
    )

    # Notificar o servidor avaliado (se tiver usuário vinculado)
    if srv_fin and srv_fin.usuario_id:
        await _notificar(
            db,
            municipio_id=formulario.municipio_id,
            usuario_id=srv_fin.usuario_id,
            tipo="AVALIACAO_RECEBIDA",
            titulo="Você foi avaliado",
            mensagem=f"Uma avaliação foi finalizada para você ({tipo_label}). Consulte 'Avaliações Recebidas'.",
        )

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
