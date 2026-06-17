from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import openpyxl
import io

from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.audit import log_event, Acoes
from app.models.servidor import Servidor
from app.models.usuario import Usuario, PerfilEnum
from app.models.importacao import LoteImportacao, LinhaImportacao
from app.schemas.servidor import ServidorCreate, ServidorUpdate, ServidorResponse, ServidorResumo

router = APIRouter(prefix="/servidores", tags=["Servidores"])


async def _vincular_usuario_por_email(
    db: AsyncSession,
    *,
    servidor: Servidor,
) -> None:
    if not servidor.email:
        return

    email_normalizado = servidor.email.strip().lower()
    result = await db.execute(
        select(Usuario).where(
            Usuario.municipio_id == servidor.municipio_id,
            func.lower(Usuario.email) == email_normalizado,
            Usuario.ativo == True,
            Usuario.perfil.in_([PerfilEnum.SERVIDOR, PerfilEnum.CHEFIA]),
        )
    )
    usuario = result.scalar_one_or_none()
    if not usuario:
        return

    if usuario.servidor_id not in (None, servidor.id):
        return

    if servidor.usuario_id not in (None, usuario.id):
        return

    usuario.servidor_id = servidor.id
    servidor.usuario_id = usuario.id


@router.get("", response_model=List[ServidorResumo])
async def listar_servidores(
    ativo: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(Servidor)
        .where(
            Servidor.municipio_id == current_user.municipio_id,
            Servidor.ativo == ativo,
        )
        .order_by(Servidor.nome)
    )
    return result.scalars().all()


@router.post("", response_model=ServidorResponse, status_code=201)
async def criar_servidor(
    data: ServidorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    existing = await db.execute(
        select(Servidor).where(
            Servidor.matricula == data.matricula,
            Servidor.municipio_id == current_user.municipio_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Matrícula já cadastrada neste município")

    servidor = Servidor(municipio_id=current_user.municipio_id, **data.model_dump())
    db.add(servidor)
    await db.flush()
    await _vincular_usuario_por_email(db, servidor=servidor)
    await db.refresh(servidor)

    await log_event(
        db, current_user.municipio_id, Acoes.SERVIDOR_CRIADO, "servidor",
        usuario=current_user, entidade_id=str(servidor.id),
        descricao=f"Servidor {servidor.nome} (matrícula: {servidor.matricula}) cadastrado",
    )
    return servidor


@router.get("/{servidor_id}", response_model=ServidorResponse)
async def detalhar_servidor(
    servidor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(Servidor).where(
            Servidor.id == servidor_id,
            Servidor.municipio_id == current_user.municipio_id,
        )
    )
    servidor = result.scalar_one_or_none()
    if not servidor:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")
    return servidor


@router.put("/{servidor_id}", response_model=ServidorResponse)
async def atualizar_servidor(
    servidor_id: int,
    data: ServidorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(Servidor).where(
            Servidor.id == servidor_id,
            Servidor.municipio_id == current_user.municipio_id,
        )
    )
    servidor = result.scalar_one_or_none()
    if not servidor:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(servidor, field, value)

    await _vincular_usuario_por_email(db, servidor=servidor)
    await db.flush()
    await db.refresh(servidor)
    await log_event(
        db, current_user.municipio_id, Acoes.SERVIDOR_ALTERADO, "servidor",
        usuario=current_user, entidade_id=str(servidor_id),
    )
    return servidor


@router.patch("/{servidor_id}/status")
async def alterar_status_servidor(
    servidor_id: int,
    ativo: bool,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(Servidor).where(
            Servidor.id == servidor_id,
            Servidor.municipio_id == current_user.municipio_id,
        )
    )
    servidor = result.scalar_one_or_none()
    if not servidor:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")

    servidor.ativo = ativo
    return {"message": f"Servidor {'ativado' if ativo else 'desativado'}"}


@router.post("/importar")
async def importar_servidores(
    arquivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    if not arquivo.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Arquivo deve ser .xlsx ou .xls")

    conteudo = await arquivo.read()
    wb = openpyxl.load_workbook(io.BytesIO(conteudo), read_only=True)
    ws = wb.active

    lote = LoteImportacao(
        municipio_id=current_user.municipio_id,
        usuario_importador_id=current_user.id,
        nome_arquivo=arquivo.filename,
    )
    db.add(lote)
    await db.flush()

    linhas = list(ws.iter_rows(min_row=2, values_only=True))
    lote.total_registros = len(linhas)

    validos = 0
    invalidos = 0

    for i, row in enumerate(linhas, start=2):
        if not row or not row[0]:
            continue

        dados = {
            "nome": row[0],
            "matricula": str(row[1]) if row[1] else None,
            "cargo": row[2] if len(row) > 2 else None,
            "lotacao": row[3] if len(row) > 3 else None,
            "cpf": str(row[4]) if len(row) > 4 and row[4] else None,
        }

        erro = None
        if not dados["nome"]:
            erro = "Nome obrigatório"
        elif not dados["matricula"]:
            erro = "Matrícula obrigatória"

        linha = LinhaImportacao(
            lote_importacao_id=lote.id,
            numero_linha=i,
            dados_originais=dados,
            status="INVALIDO" if erro else "VALIDO",
            mensagem_erro=erro,
        )
        db.add(linha)

        if not erro:
            existing = await db.execute(
                select(Servidor).where(
                    Servidor.matricula == dados["matricula"],
                    Servidor.municipio_id == current_user.municipio_id,
                )
            )
            if existing.scalar_one_or_none():
                linha.status = "INVALIDO"
                linha.mensagem_erro = f"Matrícula {dados['matricula']} já existe"
                invalidos += 1
            else:
                servidor = Servidor(
                    municipio_id=current_user.municipio_id,
                    nome=dados["nome"],
                    matricula=dados["matricula"],
                    cargo=dados.get("cargo"),
                    lotacao=dados.get("lotacao"),
                    cpf=dados.get("cpf"),
                )
                db.add(servidor)
                linha.status = "IMPORTADO"
                validos += 1
        else:
            invalidos += 1

    lote.registros_validos = validos
    lote.registros_invalidos = invalidos
    lote.status = "FINALIZADO"

    from datetime import datetime, timezone
    lote.finalizado_em = datetime.now(timezone.utc)

    await log_event(
        db, current_user.municipio_id, Acoes.PLANILHA_IMPORTADA, "servidor",
        usuario=current_user, entidade_id=str(lote.id),
        descricao=f"Importados {validos} de {lote.total_registros} registros",
    )

    return {
        "lote_id": lote.id,
        "total": lote.total_registros,
        "validos": validos,
        "invalidos": invalidos,
    }


@router.get("/importar/{lote_id}")
async def status_importacao(
    lote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    result = await db.execute(
        select(LoteImportacao).where(
            LoteImportacao.id == lote_id,
            LoteImportacao.municipio_id == current_user.municipio_id,
        )
    )
    lote = result.scalar_one_or_none()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    return lote
