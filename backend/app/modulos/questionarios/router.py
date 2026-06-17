from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from typing import List

from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.audit import log_event, Acoes
from app.models.questionario import (
    ModeloAvaliacao, PerguntaAvaliacao, OpcaoPerguntaAvaliacao,
    CategoriaAvaliacao, StatusModeloEnum,
)
from app.models.usuario import Usuario, PerfilEnum
from app.schemas.questionario import (
    ModeloCreate, ModeloUpdate, ModeloResumo, ModeloResponse,
    PerguntaCreate, PerguntaUpdate, PerguntaResponse, PerguntaReordenar,
    OpcaoCreate, OpcaoUpdate, OpcaoResponse,
    CategoriaCreate, CategoriaUpdate, CategoriaResponse,
)

router = APIRouter(prefix="/admin", tags=["Questionários"])


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
        item = ModeloResumo.model_validate(m)
        item.total_perguntas = total
        items.append(item)

    return items


@router.post("/questionarios", response_model=ModeloResponse, status_code=201)
async def criar_modelo(
    data: ModeloCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    payload = data.model_dump(exclude={"perguntas"})
    modelo = ModeloAvaliacao(
        municipio_id=current_user.municipio_id,
        criado_por_id=current_user.id,
        **payload,
    )
    db.add(modelo)
    await db.flush()

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
        .options(selectinload(ModeloAvaliacao.perguntas).selectinload(PerguntaAvaliacao.opcoes))
        .where(ModeloAvaliacao.id == modelo.id)
    )
    return result.scalar_one()


@router.get("/questionarios/{modelo_id}", response_model=ModeloResponse)
async def detalhar_modelo(
    modelo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(ModeloAvaliacao)
        .options(
            selectinload(ModeloAvaliacao.perguntas)
            .selectinload(PerguntaAvaliacao.opcoes)
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
    resp = ModeloResponse.model_validate(modelo)
    resp.total_perguntas = count_result.scalar() or 0
    return resp


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

    update_data = data.model_dump(exclude_none=True, exclude={"perguntas"})
    for field, value in update_data.items():
        setattr(modelo, field, value)

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
        .options(selectinload(ModeloAvaliacao.perguntas).selectinload(PerguntaAvaliacao.opcoes))
        .where(ModeloAvaliacao.id == modelo_id)
    )
    return full.scalar_one()


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
    if (count.scalar() or 0) == 0:
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

    await log_event(
        db, current_user.municipio_id, Acoes.QUESTIONARIO_PUBLICADO, "questionario",
        usuario=current_user, entidade_id=str(modelo_id),
        descricao=f"Questionário '{modelo.nome}' v{modelo.versao} publicado",
    )

    await db.flush()
    await db.refresh(modelo)
    resp = ModeloResumo.model_validate(modelo)
    return resp


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
        .options(selectinload(ModeloAvaliacao.perguntas).selectinload(PerguntaAvaliacao.opcoes))
        .where(ModeloAvaliacao.id == clone.id)
    )
    resp = ModeloResponse.model_validate(full.scalar_one())
    resp.total_perguntas = len([p for p in clone.perguntas if p.ativa])
    return resp


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
