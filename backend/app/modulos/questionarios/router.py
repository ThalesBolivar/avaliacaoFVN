from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from typing import List

from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.audit import log_event, Acoes
from datetime import date as date_type
from app.models.cargo import Cargo
from app.models.funcao_usuario import FuncaoUsuario
from app.models.modelo_avaliacao_funcao import ModeloAvaliacaoFuncao
from app.models.periodo import PeriodoAvaliacao, VinculoAvaliacao, FormularioAvaliacao, StatusPeriodoEnum, StatusVinculoEnum
from app.models.servidor import Servidor
from app.models.servidor_funcao import ServidorFuncao
from app.models.questionario import (
    ModeloAvaliacao, PerguntaAvaliacao, OpcaoPerguntaAvaliacao,
    CategoriaAvaliacao, StatusModeloEnum,
)
from app.models.usuario import Usuario, PerfilEnum
from app.schemas.questionario import (
    ModeloCreate, ModeloUpdate, ModeloResumo, ModeloResponse,
    FuncaoVinculadaResponse,
    PerguntaCreate, PerguntaUpdate, PerguntaResponse, PerguntaReordenar,
    OpcaoCreate, OpcaoUpdate, OpcaoResponse,
    CategoriaCreate, CategoriaUpdate, CategoriaResponse,
)


async def _auto_gerar_avaliacoes(
    db: AsyncSession,
    modelo: ModeloAvaliacao,
    municipio_id: int,
) -> tuple[PeriodoAvaliacao, int]:
    """Cria um período oculto e gera todos os formulários ao publicar o questionário."""
    from app.modulos.periodos.router import _gerar_formularios_para_vinculo

    # Cria o período automático vinculado ao modelo
    periodo = PeriodoAvaliacao(
        municipio_id=municipio_id,
        nome=modelo.nome,
        data_inicio=date_type.today(),
        data_fim=date_type(2099, 12, 31),
        modelo_avaliacao_id=modelo.id,
        status=StatusPeriodoEnum.ATIVO,
    )
    db.add(periodo)
    await db.flush()

    # Busca servidores cujo cargo aponta para este modelo
    servidores_result = await db.execute(
        select(Servidor)
        .join(Cargo, Cargo.id == Servidor.cargo_id)
        .where(
            Servidor.municipio_id == municipio_id,
            Servidor.ativo == True,
            Cargo.modelo_avaliacao_id == modelo.id,
        )
    )
    servidores = servidores_result.scalars().all()

    formularios_criados = 0
    for servidor in servidores:
        vinculo = VinculoAvaliacao(
            municipio_id=municipio_id,
            periodo_avaliacao_id=periodo.id,
            modelo_avaliacao_id=modelo.id,
            servidor_avaliado_id=servidor.id,
            chefia_servidor_id=servidor.chefia_servidor_id,
        )
        db.add(vinculo)
        await db.flush()

        novos = await _gerar_formularios_para_vinculo(db, vinculo=vinculo, modelo=modelo)
        formularios_criados += len(novos)

    return periodo, formularios_criados


def _fv_list(modelo: ModeloAvaliacao) -> list[dict]:
    return [
        {"id": fv.id, "funcao_usuario_id": fv.funcao_usuario_id, "nome": fv.funcao.nome, "perfil_base": fv.funcao.perfil_base}
        for fv in modelo.funcoes_vinculadas
    ]


def _build_modelo_response(modelo: ModeloAvaliacao, total_perguntas: int = 0) -> ModeloResponse:
    fv = _fv_list(modelo)
    return ModeloResponse(
        id=modelo.id, municipio_id=modelo.municipio_id, nome=modelo.nome,
        descricao=modelo.descricao, versao=modelo.versao, status=modelo.status,
        para_autoavaliacao=modelo.para_autoavaliacao,
        para_superior_imediato=modelo.para_superior_imediato,
        para_subcomissao=modelo.para_subcomissao,
        pontuacao_maxima=modelo.pontuacao_maxima, publicado_em=modelo.publicado_em,
        criado_em=modelo.criado_em, total_perguntas=total_perguntas,
        funcao_ids=[f["funcao_usuario_id"] for f in fv],
        funcoes_vinculadas=fv,
        perguntas=[
            PerguntaResponse.model_validate(p)
            for p in (modelo.perguntas or [])
        ],
    )

router = APIRouter(prefix="/admin", tags=["Questionários"])


async def _sincronizar_funcoes_modelo(
    db: AsyncSession,
    modelo: ModeloAvaliacao,
    funcao_ids: list[int],
    municipio_id: int,
) -> None:
    """Substitui as funções vinculadas ao modelo pelo novo conjunto de funcao_ids."""
    # Valida que todas as funções pertencem ao município
    if funcao_ids:
        result = await db.execute(
            select(FuncaoUsuario).where(
                FuncaoUsuario.id.in_(funcao_ids),
                FuncaoUsuario.municipio_id == municipio_id,
            )
        )
        encontradas = {f.id for f in result.scalars().all()}
        invalidas = set(funcao_ids) - encontradas
        if invalidas:
            raise HTTPException(status_code=400, detail=f"Funções não encontradas: {invalidas}")

    # Remove todos os vínculos existentes
    for vf in list(modelo.funcoes_vinculadas):
        await db.delete(vf)
    await db.flush()

    # Cria os novos vínculos
    for fid in funcao_ids:
        db.add(ModeloAvaliacaoFuncao(modelo_avaliacao_id=modelo.id, funcao_usuario_id=fid))

    # Atualiza os flags booleanos derivados (compatibilidade)
    result = await db.execute(
        select(FuncaoUsuario).where(FuncaoUsuario.id.in_(funcao_ids))
    ) if funcao_ids else None
    perfis = {f.perfil_base for f in (result.scalars().all() if result else [])}
    modelo.para_superior_imediato = "CHEFIA" in perfis
    modelo.para_subcomissao = "SUBCOMISSAO" in perfis

    await db.flush()


async def _criar_perguntas_modelo(
    modelo_id: int,
    perguntas_data: List[PerguntaCreate],
    db: AsyncSession,
) -> None:
    for pergunta_data in perguntas_data:
      pergunta = PerguntaAvaliacao(
          modelo_avaliacao_id=modelo_id,
          categoria_id=pergunta_data.categoria_id,
          criterio=pergunta_data.criterio,
          numero_pergunta=pergunta_data.numero_pergunta,
          texto_pergunta=pergunta_data.texto_pergunta,
          tipo_resposta=pergunta_data.tipo_resposta,
          peso=pergunta_data.peso,
          obrigatoria=pergunta_data.obrigatoria,
          apenas_autoavaliacao=pergunta_data.apenas_autoavaliacao,
          apenas_superior=pergunta_data.apenas_superior,
          apenas_subcomissao=pergunta_data.apenas_subcomissao,
      )
      db.add(pergunta)
      await db.flush()

      for opcao_data in pergunta_data.opcoes:
          opcao = OpcaoPerguntaAvaliacao(
              pergunta_avaliacao_id=pergunta.id,
              **opcao_data.model_dump(),
          )
          db.add(opcao)

    await db.flush()


# ── Categorias ──────────────────────────────────────────────────────────────

@router.get("/categorias", response_model=List[CategoriaResponse])
async def listar_categorias(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(CategoriaAvaliacao)
        .where(
            CategoriaAvaliacao.municipio_id == current_user.municipio_id,
            CategoriaAvaliacao.ativo == True,
        )
        .order_by(CategoriaAvaliacao.ordem)
    )
    return result.scalars().all()


@router.post("/categorias", response_model=CategoriaResponse, status_code=201)
async def criar_categoria(
    data: CategoriaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    categoria = CategoriaAvaliacao(municipio_id=current_user.municipio_id, **data.model_dump())
    db.add(categoria)
    await db.flush()
    await db.refresh(categoria)
    return categoria


@router.put("/categorias/{categoria_id}", response_model=CategoriaResponse)
async def atualizar_categoria(
    categoria_id: int,
    data: CategoriaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(CategoriaAvaliacao).where(
            CategoriaAvaliacao.id == categoria_id,
            CategoriaAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(cat, field, value)

    await db.flush()
    await db.refresh(cat)
    return cat


@router.delete("/categorias/{categoria_id}", status_code=204)
async def deletar_categoria(
    categoria_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(CategoriaAvaliacao).where(
            CategoriaAvaliacao.id == categoria_id,
            CategoriaAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    cat.ativo = False


# ── Modelos de Avaliação ────────────────────────────────────────────────────

@router.get("/questionarios", response_model=List[ModeloResumo])
async def listar_modelos(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(ModeloAvaliacao)
        .options(selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao))
        .where(ModeloAvaliacao.municipio_id == current_user.municipio_id)
        .order_by(ModeloAvaliacao.criado_em.desc())
    )
    modelos = result.scalars().all()

    items = []
    for m in modelos:
        count_result = await db.execute(
            select(func.count(PerguntaAvaliacao.id)).where(
                PerguntaAvaliacao.modelo_avaliacao_id == m.id,
                PerguntaAvaliacao.ativa == True,
            )
        )
        total = count_result.scalar() or 0
        fv_list = [
            {"id": fv.id, "funcao_usuario_id": fv.funcao_usuario_id, "nome": fv.funcao.nome, "perfil_base": fv.funcao.perfil_base}
            for fv in m.funcoes_vinculadas
        ]
        item = ModeloResumo(
            id=m.id, municipio_id=m.municipio_id, nome=m.nome, versao=m.versao,
            status=m.status, para_autoavaliacao=m.para_autoavaliacao,
            para_superior_imediato=m.para_superior_imediato, para_subcomissao=m.para_subcomissao,
            pontuacao_maxima=m.pontuacao_maxima, publicado_em=m.publicado_em, criado_em=m.criado_em,
            total_perguntas=total,
            funcao_ids=[fv["funcao_usuario_id"] for fv in fv_list],
            funcoes_vinculadas=fv_list,
        )
        items.append(item)

    return items


@router.post("/questionarios", response_model=ModeloResponse, status_code=201)
async def criar_modelo(
    data: ModeloCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    payload = data.model_dump(exclude={"perguntas", "funcao_ids"})
    modelo = ModeloAvaliacao(
        municipio_id=current_user.municipio_id,
        criado_por_id=current_user.id,
        **payload,
    )
    db.add(modelo)
    await db.flush()

    if data.funcao_ids:
        await _sincronizar_funcoes_modelo(db, modelo, data.funcao_ids, current_user.municipio_id)

    if data.perguntas:
        await _criar_perguntas_modelo(modelo.id, data.perguntas, db)

    await db.refresh(modelo)

    await log_event(
        db, current_user.municipio_id, Acoes.QUESTIONARIO_CRIADO, "questionario",
        usuario=current_user, entidade_id=str(modelo.id),
        descricao=f"Questionário '{modelo.nome}' criado",
    )

    result = await db.execute(
        select(ModeloAvaliacao)
        .options(
            selectinload(ModeloAvaliacao.perguntas).selectinload(PerguntaAvaliacao.opcoes),
            selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao),
        )
        .where(ModeloAvaliacao.id == modelo.id)
    )
    m = result.scalar_one()
    return _build_modelo_response(m)


@router.get("/questionarios/{modelo_id}", response_model=ModeloResponse)
async def detalhar_modelo(
    modelo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(ModeloAvaliacao)
        .options(
            selectinload(ModeloAvaliacao.perguntas).selectinload(PerguntaAvaliacao.opcoes),
            selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao),
        )
        .where(
            ModeloAvaliacao.id == modelo_id,
            ModeloAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    modelo = result.scalar_one_or_none()
    if not modelo:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    count_result = await db.execute(
        select(func.count(PerguntaAvaliacao.id)).where(
            PerguntaAvaliacao.modelo_avaliacao_id == modelo_id,
            PerguntaAvaliacao.ativa == True,
        )
    )
    total = count_result.scalar() or 0
    return _build_modelo_response(modelo, total)


@router.put("/questionarios/{modelo_id}", response_model=ModeloResponse)
async def atualizar_modelo(
    modelo_id: int,
    data: ModeloUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(ModeloAvaliacao).where(
            ModeloAvaliacao.id == modelo_id,
            ModeloAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    modelo = result.scalar_one_or_none()
    if not modelo:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    if modelo.status != StatusModeloEnum.RASCUNHO:
        raise HTTPException(status_code=400, detail="Apenas questionários em RASCUNHO podem ser editados")

    update_data = data.model_dump(exclude_none=True, exclude={"perguntas", "funcao_ids"})
    for field, value in update_data.items():
        setattr(modelo, field, value)

    if data.funcao_ids is not None:
        loaded_m = await db.execute(
            select(ModeloAvaliacao)
            .options(selectinload(ModeloAvaliacao.funcoes_vinculadas))
            .where(ModeloAvaliacao.id == modelo_id)
        )
        modelo_com_funcoes = loaded_m.scalar_one()
        await _sincronizar_funcoes_modelo(db, modelo_com_funcoes, data.funcao_ids, current_user.municipio_id)

    if data.perguntas is not None:
        loaded = await db.execute(
            select(ModeloAvaliacao)
            .options(selectinload(ModeloAvaliacao.perguntas).selectinload(PerguntaAvaliacao.opcoes))
            .where(ModeloAvaliacao.id == modelo_id)
        )
        modelo_completo = loaded.scalar_one()
        for pergunta in list(modelo_completo.perguntas):
            await db.delete(pergunta)
        await db.flush()
        await _criar_perguntas_modelo(modelo_id, data.perguntas, db)

    await db.flush()

    await log_event(
        db, current_user.municipio_id, Acoes.QUESTIONARIO_ALTERADO, "questionario",
        usuario=current_user, entidade_id=str(modelo_id),
    )

    full = await db.execute(
        select(ModeloAvaliacao)
        .options(
            selectinload(ModeloAvaliacao.perguntas).selectinload(PerguntaAvaliacao.opcoes),
            selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao),
        )
        .where(ModeloAvaliacao.id == modelo_id)
    )
    m = full.scalar_one()
    return _build_modelo_response(m)


@router.post("/questionarios/{modelo_id}/publicar", response_model=ModeloResumo)
async def publicar_modelo(
    modelo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(ModeloAvaliacao).where(
            ModeloAvaliacao.id == modelo_id,
            ModeloAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    modelo = result.scalar_one_or_none()
    if not modelo:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    if modelo.status != StatusModeloEnum.RASCUNHO:
        raise HTTPException(status_code=400, detail="Apenas RASCUNHO pode ser publicado")

    count = await db.execute(
        select(func.count(PerguntaAvaliacao.id)).where(
            PerguntaAvaliacao.modelo_avaliacao_id == modelo_id,
            PerguntaAvaliacao.ativa == True,
        )
    )
    total_perguntas = count.scalar() or 0
    if total_perguntas == 0:
        raise HTTPException(status_code=400, detail="O questionário precisa ter ao menos uma pergunta")

    pontuacao = await db.execute(
        select(func.sum(
            func.coalesce(
                select(func.max(OpcaoPerguntaAvaliacao.pontuacao))
                .where(OpcaoPerguntaAvaliacao.pergunta_avaliacao_id == PerguntaAvaliacao.id)
                .scalar_subquery(),
                0
            ) * PerguntaAvaliacao.peso
        )).where(
            PerguntaAvaliacao.modelo_avaliacao_id == modelo_id,
            PerguntaAvaliacao.ativa == True,
        )
    )

    modelo.status = StatusModeloEnum.PUBLICADO
    modelo.publicado_em = datetime.now(timezone.utc)
    modelo.pontuacao_maxima = pontuacao.scalar()
    await db.flush()

    # Carrega funcoes_vinculadas para geração
    m_full = await db.execute(
        select(ModeloAvaliacao)
        .options(selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao))
        .where(ModeloAvaliacao.id == modelo_id)
    )
    modelo_com_funcoes = m_full.scalar_one()

    _, formularios = await _auto_gerar_avaliacoes(db, modelo_com_funcoes, current_user.municipio_id)

    await log_event(
        db, current_user.municipio_id, Acoes.QUESTIONARIO_PUBLICADO, "questionario",
        usuario=current_user, entidade_id=str(modelo_id),
        descricao=f"Questionário '{modelo.nome}' v{modelo.versao} publicado — {formularios} formulários gerados",
    )

    await db.flush()

    m_pub = await db.execute(
        select(ModeloAvaliacao)
        .options(selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao))
        .where(ModeloAvaliacao.id == modelo_id)
    )
    m = m_pub.scalar_one()
    fv = _fv_list(m)
    return ModeloResumo(
        id=m.id, municipio_id=m.municipio_id, nome=m.nome, versao=m.versao,
        status=m.status, para_autoavaliacao=m.para_autoavaliacao,
        para_superior_imediato=m.para_superior_imediato, para_subcomissao=m.para_subcomissao,
        pontuacao_maxima=m.pontuacao_maxima, publicado_em=m.publicado_em, criado_em=m.criado_em,
        total_perguntas=total_perguntas,
        funcao_ids=[f["funcao_usuario_id"] for f in fv],
        funcoes_vinculadas=fv,
    )


@router.post("/questionarios/{modelo_id}/arquivar", response_model=ModeloResumo)
async def arquivar_modelo(
    modelo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    """Arquiva o questionário e cancela todos os formulários pendentes vinculados a ele."""
    result = await db.execute(
        select(ModeloAvaliacao).where(
            ModeloAvaliacao.id == modelo_id,
            ModeloAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    modelo = result.scalar_one_or_none()
    if not modelo:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    if modelo.status != StatusModeloEnum.PUBLICADO:
        raise HTTPException(status_code=400, detail="Apenas questionários PUBLICADOS podem ser arquivados")

    modelo.status = StatusModeloEnum.ARQUIVADO

    # Encerra períodos ativos deste modelo
    periodos_result = await db.execute(
        select(PeriodoAvaliacao).where(
            PeriodoAvaliacao.modelo_avaliacao_id == modelo_id,
            PeriodoAvaliacao.municipio_id == current_user.municipio_id,
            PeriodoAvaliacao.status == StatusPeriodoEnum.ATIVO,
        )
    )
    for periodo in periodos_result.scalars().all():
        periodo.status = StatusPeriodoEnum.ENCERRADO

    # Cancela formulários pendentes/em andamento vinculados a este modelo
    forms_result = await db.execute(
        select(FormularioAvaliacao)
        .join(VinculoAvaliacao, VinculoAvaliacao.id == FormularioAvaliacao.vinculo_avaliacao_id)
        .where(
            VinculoAvaliacao.modelo_avaliacao_id == modelo_id,
            FormularioAvaliacao.municipio_id == current_user.municipio_id,
            FormularioAvaliacao.status.in_([StatusVinculoEnum.PENDENTE, StatusVinculoEnum.EM_ANDAMENTO]),
            FormularioAvaliacao.ativo == "S",
        )
    )
    cancelados = 0
    for form in forms_result.scalars().all():
        form.status = StatusVinculoEnum.CANCELADA
        form.ativo = "N"
        cancelados += 1

    await log_event(
        db, current_user.municipio_id, Acoes.QUESTIONARIO_ALTERADO, "questionario",
        usuario=current_user, entidade_id=str(modelo_id),
        descricao=f"Questionário '{modelo.nome}' arquivado — {cancelados} formulários cancelados",
    )
    await db.flush()

    m_pub = await db.execute(
        select(ModeloAvaliacao)
        .options(selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao))
        .where(ModeloAvaliacao.id == modelo_id)
    )
    m = m_pub.scalar_one()
    fv = _fv_list(m)
    return ModeloResumo(
        id=m.id, municipio_id=m.municipio_id, nome=m.nome, versao=m.versao,
        status=m.status, para_autoavaliacao=m.para_autoavaliacao,
        para_superior_imediato=m.para_superior_imediato, para_subcomissao=m.para_subcomissao,
        pontuacao_maxima=m.pontuacao_maxima, publicado_em=m.publicado_em, criado_em=m.criado_em,
        total_perguntas=0, funcao_ids=[f["funcao_usuario_id"] for f in fv], funcoes_vinculadas=fv,
    )


@router.post("/questionarios/{modelo_id}/clonar", response_model=ModeloResponse, status_code=201)
async def clonar_modelo(
    modelo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(ModeloAvaliacao)
        .options(selectinload(ModeloAvaliacao.perguntas).selectinload(PerguntaAvaliacao.opcoes))
        .where(
            ModeloAvaliacao.id == modelo_id,
            ModeloAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    clone = ModeloAvaliacao(
        municipio_id=current_user.municipio_id,
        nome=f"{original.nome} (cópia)",
        descricao=original.descricao,
        versao=1,
        status=StatusModeloEnum.RASCUNHO,
        para_autoavaliacao=original.para_autoavaliacao,
        para_superior_imediato=original.para_superior_imediato,
        para_subcomissao=original.para_subcomissao,
        criado_por_id=current_user.id,
    )
    db.add(clone)
    await db.flush()

    for pergunta in original.perguntas:
        if not pergunta.ativa:
            continue
        nova_pergunta = PerguntaAvaliacao(
            modelo_avaliacao_id=clone.id,
            categoria_id=pergunta.categoria_id,
            criterio=pergunta.criterio,
            numero_pergunta=pergunta.numero_pergunta,
            texto_pergunta=pergunta.texto_pergunta,
            tipo_resposta=pergunta.tipo_resposta,
            peso=pergunta.peso,
            obrigatoria=pergunta.obrigatoria,
            apenas_autoavaliacao=pergunta.apenas_autoavaliacao,
            apenas_superior=pergunta.apenas_superior,
            apenas_subcomissao=pergunta.apenas_subcomissao,
        )
        db.add(nova_pergunta)
        await db.flush()

        for opcao in pergunta.opcoes:
            nova_opcao = OpcaoPerguntaAvaliacao(
                pergunta_avaliacao_id=nova_pergunta.id,
                letra_opcao=opcao.letra_opcao,
                texto_opcao=opcao.texto_opcao,
                pontuacao=opcao.pontuacao,
            )
            db.add(nova_opcao)

    await log_event(
        db, current_user.municipio_id, Acoes.QUESTIONARIO_CLONADO, "questionario",
        usuario=current_user, entidade_id=str(clone.id),
        descricao=f"Clonado de questionário id={modelo_id}",
    )

    await db.flush()

    full = await db.execute(
        select(ModeloAvaliacao)
        .options(
            selectinload(ModeloAvaliacao.perguntas).selectinload(PerguntaAvaliacao.opcoes),
            selectinload(ModeloAvaliacao.funcoes_vinculadas).selectinload(ModeloAvaliacaoFuncao.funcao),
        )
        .where(ModeloAvaliacao.id == clone.id)
    )
    return _build_modelo_response(full.scalar_one())


@router.get("/questionarios/{modelo_id}/preview")
async def preview_modelo(
    modelo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(ModeloAvaliacao)
        .options(
            selectinload(ModeloAvaliacao.perguntas)
            .selectinload(PerguntaAvaliacao.opcoes),
            selectinload(ModeloAvaliacao.perguntas)
            .selectinload(PerguntaAvaliacao.categoria),
        )
        .where(
            ModeloAvaliacao.id == modelo_id,
            ModeloAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    modelo = result.scalar_one_or_none()
    if not modelo:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    perguntas_ativas = [p for p in modelo.perguntas if p.ativa]

    return {
        "id": modelo.id,
        "nome": modelo.nome,
        "descricao": modelo.descricao,
        "status": modelo.status,
        "total_perguntas": len(perguntas_ativas),
        "perguntas": [
            {
                "numero": p.numero_pergunta,
                "criterio": p.criterio,
                "texto": p.texto_pergunta,
                "tipo": p.tipo_resposta,
                "peso": float(p.peso),
                "obrigatoria": p.obrigatoria,
                "categoria": p.categoria.nome if p.categoria else None,
                "opcoes": [
                    {"letra": o.letra_opcao, "texto": o.texto_opcao, "pontuacao": float(o.pontuacao) if o.pontuacao else None}
                    for o in p.opcoes
                ],
            }
            for p in sorted(perguntas_ativas, key=lambda x: x.numero_pergunta)
        ],
    }


@router.delete("/questionarios/{modelo_id}", status_code=204)
async def deletar_modelo(
    modelo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(ModeloAvaliacao).where(
            ModeloAvaliacao.id == modelo_id,
            ModeloAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    modelo = result.scalar_one_or_none()
    if not modelo:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")

    if modelo.status != StatusModeloEnum.RASCUNHO:
        raise HTTPException(status_code=400, detail="Apenas RASCUNHO pode ser excluído")

    await db.delete(modelo)


# ── Perguntas ───────────────────────────────────────────────────────────────

async def _get_modelo_rascunho(modelo_id: int, municipio_id: int, db: AsyncSession) -> ModeloAvaliacao:
    result = await db.execute(
        select(ModeloAvaliacao).where(
            ModeloAvaliacao.id == modelo_id,
            ModeloAvaliacao.municipio_id == municipio_id,
        )
    )
    modelo = result.scalar_one_or_none()
    if not modelo:
        raise HTTPException(status_code=404, detail="Questionário não encontrado")
    if modelo.status != StatusModeloEnum.RASCUNHO:
        raise HTTPException(status_code=400, detail="Questionário publicado não pode ser editado. Crie uma nova versão.")
    return modelo


@router.get("/questionarios/{modelo_id}/perguntas", response_model=List[PerguntaResponse])
async def listar_perguntas(
    modelo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    await db.execute(
        select(ModeloAvaliacao).where(
            ModeloAvaliacao.id == modelo_id,
            ModeloAvaliacao.municipio_id == current_user.municipio_id,
        )
    )
    result = await db.execute(
        select(PerguntaAvaliacao)
        .options(selectinload(PerguntaAvaliacao.opcoes))
        .where(
            PerguntaAvaliacao.modelo_avaliacao_id == modelo_id,
            PerguntaAvaliacao.ativa == True,
        )
        .order_by(PerguntaAvaliacao.numero_pergunta)
    )
    return result.scalars().all()


@router.post("/questionarios/{modelo_id}/perguntas", response_model=PerguntaResponse, status_code=201)
async def adicionar_pergunta(
    modelo_id: int,
    data: PerguntaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    await _get_modelo_rascunho(modelo_id, current_user.municipio_id, db)

    pergunta = PerguntaAvaliacao(
        modelo_avaliacao_id=modelo_id,
        categoria_id=data.categoria_id,
        criterio=data.criterio,
        numero_pergunta=data.numero_pergunta,
        texto_pergunta=data.texto_pergunta,
        tipo_resposta=data.tipo_resposta,
        peso=data.peso,
        obrigatoria=data.obrigatoria,
        apenas_autoavaliacao=data.apenas_autoavaliacao,
        apenas_superior=data.apenas_superior,
        apenas_subcomissao=data.apenas_subcomissao,
    )
    db.add(pergunta)
    await db.flush()

    for opcao_data in data.opcoes:
        opcao = OpcaoPerguntaAvaliacao(
            pergunta_avaliacao_id=pergunta.id,
            **opcao_data.model_dump(),
        )
        db.add(opcao)

    await db.flush()

    result = await db.execute(
        select(PerguntaAvaliacao)
        .options(selectinload(PerguntaAvaliacao.opcoes))
        .where(PerguntaAvaliacao.id == pergunta.id)
    )
    return result.scalar_one()


@router.put("/questionarios/{modelo_id}/perguntas/{pergunta_id}", response_model=PerguntaResponse)
async def atualizar_pergunta(
    modelo_id: int,
    pergunta_id: int,
    data: PerguntaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    await _get_modelo_rascunho(modelo_id, current_user.municipio_id, db)

    result = await db.execute(
        select(PerguntaAvaliacao)
        .options(selectinload(PerguntaAvaliacao.opcoes))
        .where(
            PerguntaAvaliacao.id == pergunta_id,
            PerguntaAvaliacao.modelo_avaliacao_id == modelo_id,
        )
    )
    pergunta = result.scalar_one_or_none()
    if not pergunta:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(pergunta, field, value)

    await db.flush()
    await db.refresh(pergunta)
    return pergunta


@router.delete("/questionarios/{modelo_id}/perguntas/{pergunta_id}", status_code=204)
async def deletar_pergunta(
    modelo_id: int,
    pergunta_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    await _get_modelo_rascunho(modelo_id, current_user.municipio_id, db)

    result = await db.execute(
        select(PerguntaAvaliacao).where(
            PerguntaAvaliacao.id == pergunta_id,
            PerguntaAvaliacao.modelo_avaliacao_id == modelo_id,
        )
    )
    pergunta = result.scalar_one_or_none()
    if not pergunta:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada")

    pergunta.ativa = False


@router.patch("/questionarios/{modelo_id}/perguntas/reordenar")
async def reordenar_perguntas(
    modelo_id: int,
    items: List[PerguntaReordenar],
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    await _get_modelo_rascunho(modelo_id, current_user.municipio_id, db)

    for item in items:
        result = await db.execute(
            select(PerguntaAvaliacao).where(
                PerguntaAvaliacao.id == item.id,
                PerguntaAvaliacao.modelo_avaliacao_id == modelo_id,
            )
        )
        pergunta = result.scalar_one_or_none()
        if pergunta:
            pergunta.numero_pergunta = item.numero_pergunta

    return {"message": "Ordem atualizada com sucesso"}


# ── Opções ──────────────────────────────────────────────────────────────────

@router.post("/questionarios/{modelo_id}/perguntas/{pergunta_id}/opcoes", response_model=OpcaoResponse, status_code=201)
async def adicionar_opcao(
    modelo_id: int,
    pergunta_id: int,
    data: OpcaoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    await _get_modelo_rascunho(modelo_id, current_user.municipio_id, db)

    existing = await db.execute(
        select(OpcaoPerguntaAvaliacao).where(
            OpcaoPerguntaAvaliacao.pergunta_avaliacao_id == pergunta_id,
            OpcaoPerguntaAvaliacao.letra_opcao == data.letra_opcao,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Opção {data.letra_opcao} já existe nesta pergunta")

    opcao = OpcaoPerguntaAvaliacao(pergunta_avaliacao_id=pergunta_id, **data.model_dump())
    db.add(opcao)
    await db.flush()
    await db.refresh(opcao)
    return opcao


@router.put("/questionarios/{modelo_id}/perguntas/{pergunta_id}/opcoes/{opcao_id}", response_model=OpcaoResponse)
async def atualizar_opcao(
    modelo_id: int,
    pergunta_id: int,
    opcao_id: int,
    data: OpcaoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    await _get_modelo_rascunho(modelo_id, current_user.municipio_id, db)

    result = await db.execute(
        select(OpcaoPerguntaAvaliacao).where(
            OpcaoPerguntaAvaliacao.id == opcao_id,
            OpcaoPerguntaAvaliacao.pergunta_avaliacao_id == pergunta_id,
        )
    )
    opcao = result.scalar_one_or_none()
    if not opcao:
        raise HTTPException(status_code=404, detail="Opção não encontrada")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(opcao, field, value)

    await db.flush()
    await db.refresh(opcao)
    return opcao


@router.delete("/questionarios/{modelo_id}/perguntas/{pergunta_id}/opcoes/{opcao_id}", status_code=204)
async def deletar_opcao(
    modelo_id: int,
    pergunta_id: int,
    opcao_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    await _get_modelo_rascunho(modelo_id, current_user.municipio_id, db)

    result = await db.execute(
        select(OpcaoPerguntaAvaliacao).where(
            OpcaoPerguntaAvaliacao.id == opcao_id,
            OpcaoPerguntaAvaliacao.pergunta_avaliacao_id == pergunta_id,
        )
    )
    opcao = result.scalar_one_or_none()
    if not opcao:
        raise HTTPException(status_code=404, detail="Opção não encontrada")

    await db.delete(opcao)
