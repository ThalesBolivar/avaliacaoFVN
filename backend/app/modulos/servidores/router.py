from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Any, List
import csv
import io
import re
import unicodedata
from datetime import date, datetime, timezone

import openpyxl

from pydantic import BaseModel

from app.database import get_db
from app.core.deps import require_admin
from app.core.security import get_password_hash
from app.core.audit import log_event, Acoes
from app.models.funcao_usuario import FuncaoUsuario
from app.models.municipio import Municipio
from app.models.servidor import Servidor
from app.models.servidor_funcao import ServidorFuncao
from app.models.cargo import Cargo
from app.models.lotacao import Lotacao
from app.models.usuario import Usuario, PerfilEnum
from app.models.importacao import LoteImportacao, LinhaImportacao
from app.schemas.servidor import ServidorCreate, ServidorUpdate, ServidorResponse, ServidorResumo, ServidorFicha


class VincularFuncaoRequest(BaseModel):
    funcao_usuario_id: int


class CorrecaoLinhaImportacao(BaseModel):
    linha_id: int
    cargo_id: int | None = None
    lotacao_id: int | None = None


class ReprocessarImportacaoRequest(BaseModel):
    correcoes: list[CorrecaoLinhaImportacao]

router = APIRouter(prefix="/servidores", tags=["Servidores"])

# Aliases de cabeçalho já normalizados (sem acento, minúsculo, sem "*",
# sem parênteses e com espaços colapsados — ver _normalizar_cabecalho).
HEADER_ALIASES = {
    "nome": "nome",
    "nome do servidor": "nome",
    "matricula": "matricula",
    "matricula do servidor": "matricula",
    "grau instrucao": "grau_instrucao",
    "grau de escolaridade": "grau_instrucao",
    "grau de escolaridade do cargo": "grau_instrucao",
    "cargo": "cargo",
    "data admissao": "data_admissao",
    "data de admissao": "data_admissao",
    "chefia imediata": "nome_chefia",
    "matricula chefia": "matricula_chefia",
    "matricula da chefia": "matricula_chefia",
    "nome chefia": "nome_chefia",
    "nome da chefia": "nome_chefia",
    "lotacao": "lotacao",
    "e-mail": "email",
    "email": "email",
    "cpf": "cpf",
}

# Opções aceitas para GRAU DE ESCOLARIDADE (comparadas já normalizadas).
GRAUS_ESCOLARIDADE_VALIDOS = {"fundamental", "medio", "tecnico", "superior"}

_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _gerar_email_interno_servidor(servidor: Servidor) -> str:
    matricula_normalizada = "".join(ch for ch in servidor.matricula.strip().lower() if ch.isalnum())
    return f"{matricula_normalizada}.{servidor.municipio_id}@servidor.local"


def _is_email_interno_servidor(email: str | None) -> bool:
    return bool(email and email.endswith("@servidor.local"))


def _normalizar_texto(valor: Any) -> str:
    if valor is None:
        return ""
    texto = str(valor).strip()
    texto = unicodedata.normalize("NFKD", texto)
    return "".join(ch for ch in texto if not unicodedata.combining(ch)).strip().lower()


def _valor_limpo(valor: Any) -> str | None:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def _parse_data(valor: Any) -> date | None:
    if valor in (None, ""):
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor

    texto = str(valor).strip()
    for formato in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            continue

    # Datas vindas do Excel são serializadas em ISO (ex.: "2020-03-15T00:00:00")
    # ao gravar dados_originais; aceitamos esse formato no reprocessamento.
    try:
        return datetime.fromisoformat(texto).date()
    except ValueError:
        return None


def _decodificar_csv(conteudo: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return conteudo.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="Não foi possível ler a codificação do arquivo CSV")


def _serializar_dados_importacao(dados: dict[str, Any]) -> dict[str, Any]:
    serializados: dict[str, Any] = {}
    for chave, valor in dados.items():
        if isinstance(valor, (date, datetime)):
            serializados[chave] = valor.isoformat()
        else:
            serializados[chave] = valor
    return serializados


def _normalizar_cabecalho(valor: Any) -> str:
    """Normaliza um cabeçalho de coluna para casar com HEADER_ALIASES:
    remove acentos/maiúsculas, descarta o marcador de obrigatório "*" e
    notas entre parênteses, e colapsa quebras de linha/espaços."""
    texto = _normalizar_texto(valor)
    texto = re.sub(r"\([^)]*\)", " ", texto)  # remove "(cadastrado no sistema)" etc.
    texto = texto.replace("*", " ")
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto


def _mapear_cabecalhos(cabecalho: list[Any]) -> dict[int, str]:
    mapeamento: dict[int, str] = {}
    for indice, nome_coluna in enumerate(cabecalho):
        chave = HEADER_ALIASES.get(_normalizar_cabecalho(nome_coluna))
        if chave:
            mapeamento[indice] = chave
    return mapeamento


def _extrair_dados_linha(row: list[Any] | tuple[Any, ...], colunas: dict[int, str]) -> dict[str, Any]:
    # data_admissao é mantida como o valor bruto da célula para que o
    # importador possa distinguir "vazia" (campo obrigatório) de "formato
    # inválido" — a conversão acontece na validação da linha.
    dados: dict[str, Any] = {
        "nome": None,
        "matricula": None,
        "grau_instrucao": None,
        "cargo": None,
        "data_admissao": None,
        "matricula_chefia": None,
        "nome_chefia": None,
        "lotacao": None,
        "email": None,
        "cpf": None,
    }
    for indice, campo in colunas.items():
        valor = row[indice] if indice < len(row) else None
        if isinstance(valor, (date, datetime)):
            dados[campo] = valor
        else:
            dados[campo] = _valor_limpo(valor)
    return dados


def _grau_escolaridade_valido(valor: str | None) -> bool:
    return _normalizar_texto(valor) in GRAUS_ESCOLARIDADE_VALIDOS


def _email_valido(valor: str | None) -> bool:
    return bool(valor and _EMAIL_REGEX.match(valor.strip()))


def _validar_linha_importacao(
    dados: dict[str, Any],
    *,
    matriculas_vistas: set[str],
    mapa_cargos: dict[str, int],
    mapa_lotacoes: dict[str, int],
) -> str | None:
    """Aplica as validações críticas da planilha de servidores.
    Retorna a mensagem de inconsistência (linha INVÁLIDA) ou None se válida.

    Importante: a matrícula da chefia é informação livre — ela NÃO precisa
    existir no banco nem dentro da própria planilha, e pode se repetir em
    várias linhas. Só é crítica quando vazia (campo obrigatório)."""
    matricula = (dados.get("matricula") or "").strip()
    if not matricula:
        return "Matrícula do servidor obrigatória"
    if _normalizar_texto(matricula) in matriculas_vistas:
        return f"Matrícula do servidor '{matricula}' duplicada na planilha"

    if not dados.get("nome"):
        return "Nome do servidor obrigatório"

    grau = dados.get("grau_instrucao")
    if not grau:
        return "Grau de escolaridade obrigatório"
    if not _grau_escolaridade_valido(grau):
        return "Grau de escolaridade inválido (use FUNDAMENTAL, MÉDIO, TÉCNICO ou SUPERIOR)"

    cargo_texto = dados.get("cargo")
    if not cargo_texto:
        return "Cargo obrigatório"
    if mapa_cargos.get(_normalizar_texto(cargo_texto)) is None:
        return f"Cargo '{cargo_texto}' inexistente no banco"

    lotacao_texto = dados.get("lotacao")
    if not lotacao_texto:
        return "Lotação obrigatória"
    if mapa_lotacoes.get(_normalizar_texto(lotacao_texto)) is None:
        return f"Lotação '{lotacao_texto}' inexistente no banco"

    data_bruta = dados.get("data_admissao")
    if data_bruta in (None, ""):
        return "Data de admissão obrigatória"
    if _parse_data(data_bruta) is None:
        return "Data de admissão inválida (use o formato DD/MM/AAAA)"

    if not (dados.get("matricula_chefia") or "").strip():
        return "Matrícula da chefia obrigatória"
    if not (dados.get("nome_chefia") or "").strip():
        return "Nome da chefia obrigatório"

    email = dados.get("email")
    if email and not _email_valido(email):
        return f"E-mail inválido: '{email}'"

    return None


async def _persistir_servidor_importado(
    db: AsyncSession,
    *,
    dados: dict[str, Any],
    municipio_id: int,
    mapa_cargos: dict[str, int],
    mapa_lotacoes: dict[str, int],
) -> "Servidor":
    """Cria ou atualiza um servidor a partir de uma linha já validada.
    A matrícula é o identificador: existe → atualiza; não existe → cria.
    Usado tanto na importação inicial quanto no reprocessamento corrigido."""
    matricula = dados["matricula"].strip()
    cargo_texto = dados.get("cargo")
    cargo_id_match = mapa_cargos.get(_normalizar_texto(cargo_texto)) if cargo_texto else None
    lotacao_id_match = mapa_lotacoes.get(_normalizar_texto(dados.get("lotacao")))

    existing = await db.execute(
        select(Servidor).where(
            Servidor.matricula == matricula,
            Servidor.municipio_id == municipio_id,
        )
    )
    servidor = existing.scalar_one_or_none()
    if servidor is None:
        servidor = Servidor(municipio_id=municipio_id, matricula=matricula)
        db.add(servidor)

    servidor.nome = dados["nome"]
    servidor.grau_instrucao = dados.get("grau_instrucao")
    servidor.cargo = cargo_texto
    servidor.cargo_id = cargo_id_match
    servidor.data_admissao = _parse_data(dados.get("data_admissao"))
    servidor.lotacao_id = lotacao_id_match
    servidor.email = dados.get("email") or servidor.email
    servidor.cpf = dados.get("cpf") or servidor.cpf
    # Chefia imediata como informação livre da planilha: armazenada como texto,
    # sem exigir cadastro prévio. O vínculo é resolvido depois.
    servidor.matricula_chefia = (dados.get("matricula_chefia") or "").strip() or None
    servidor.nome_chefia = (dados.get("nome_chefia") or "").strip() or None
    await db.flush()

    await _garantir_usuario_acesso_servidor(db, servidor=servidor)
    return servidor


async def _resolver_vinculo_chefia(
    db: AsyncSession,
    *,
    servidor: "Servidor",
    municipio_id: int,
) -> None:
    """Liga chefia_servidor_id quando a MATRÍCULA CHEFIA corresponde a um
    servidor existente do município. Não-bloqueante: se não casar, mantém só
    o texto (matricula_chefia / nome_chefia)."""
    if not servidor.matricula_chefia:
        return
    chefia = (await db.execute(
        select(Servidor).where(
            Servidor.municipio_id == municipio_id,
            Servidor.matricula == servidor.matricula_chefia,
        )
    )).scalar_one_or_none()
    if chefia and chefia.id != servidor.id:
        servidor.chefia_servidor_id = chefia.id


async def _buscar_servidor_por_escopo(
    db: AsyncSession,
    *,
    servidor_id: int,
    current_user: Usuario,
) -> Servidor:
    query = select(Servidor).where(Servidor.id == servidor_id)
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(Servidor.municipio_id == current_user.municipio_id)

    result = await db.execute(query)
    servidor = result.scalar_one_or_none()
    if not servidor:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")
    return servidor


async def _validar_municipio(
    db: AsyncSession,
    *,
    municipio_id: int,
) -> Municipio:
    municipio = await db.get(Municipio, municipio_id)
    if not municipio:
        raise HTTPException(status_code=404, detail="Município não encontrado")
    return municipio


async def _validar_matricula_no_municipio(
    db: AsyncSession,
    *,
    servidor_id: int | None,
    municipio_id: int,
    matricula: str,
) -> None:
    result = await db.execute(
        select(Servidor).where(
            Servidor.municipio_id == municipio_id,
            Servidor.matricula == matricula,
        )
    )
    existente = result.scalar_one_or_none()
    if existente and existente.id != servidor_id:
        raise HTTPException(status_code=400, detail="Matrícula já cadastrada neste município")


async def _validar_cargo_no_municipio(
    db: AsyncSession,
    *,
    municipio_id: int,
    cargo_id: int | None,
) -> Cargo | None:
    """Valida que o cargo pertence ao município e o retorna (ou None se não informado)."""
    if cargo_id is None:
        return None
    cargo = await db.get(Cargo, cargo_id)
    if not cargo or cargo.municipio_id != municipio_id:
        raise HTTPException(status_code=400, detail="Cargo inválido para este município")
    return cargo


async def _validar_chefia_no_municipio(
    db: AsyncSession,
    *,
    municipio_id: int,
    chefia_servidor_id: int | None,
    servidor_id: int | None = None,
) -> None:
    if chefia_servidor_id is None:
        return

    chefia = await db.get(Servidor, chefia_servidor_id)
    if not chefia or chefia.municipio_id != municipio_id:
        raise HTTPException(status_code=400, detail="Chefia imediata inválida para este município")

    if servidor_id is not None and chefia.id == servidor_id:
        raise HTTPException(status_code=400, detail="O servidor não pode ser a própria chefia imediata")


async def _garantir_usuario_acesso_servidor(
    db: AsyncSession,
    *,
    servidor: Servidor,
) -> dict[str, str] | None:
    email_normalizado = servidor.email.strip().lower() if servidor.email else _gerar_email_interno_servidor(servidor)
    servidor.email = email_normalizado

    usuario_vinculado = await db.get(Usuario, servidor.usuario_id) if servidor.usuario_id else None
    result = await db.execute(
        select(Usuario).where(
            Usuario.municipio_id == servidor.municipio_id,
            func.lower(Usuario.email) == email_normalizado,
        )
    )
    usuario_mesmo_email = result.scalar_one_or_none()

    if usuario_vinculado:
        if usuario_mesmo_email and usuario_mesmo_email.id != usuario_vinculado.id:
            raise HTTPException(status_code=400, detail="E-mail já cadastrado para outro usuário neste município")

        usuario_vinculado.municipio_id = servidor.municipio_id
        usuario_vinculado.nome = servidor.nome
        usuario_vinculado.email = email_normalizado
        usuario_vinculado.servidor_id = servidor.id
        usuario_vinculado.perfil = PerfilEnum.SERVIDOR
        usuario_vinculado.senha_hash = get_password_hash(servidor.matricula)
        servidor.usuario_id = usuario_vinculado.id
        return None

    if usuario_mesmo_email:
        if usuario_mesmo_email.perfil != PerfilEnum.SERVIDOR:
            raise HTTPException(status_code=400, detail="E-mail já cadastrado para outro tipo de usuário neste município")
        if usuario_mesmo_email.servidor_id not in (None, servidor.id):
            raise HTTPException(status_code=400, detail="E-mail já vinculado a outro servidor neste município")

        usuario_mesmo_email.municipio_id = servidor.municipio_id
        usuario_mesmo_email.nome = servidor.nome
        usuario_mesmo_email.servidor_id = servidor.id
        usuario_mesmo_email.senha_hash = get_password_hash(servidor.matricula)
        servidor.usuario_id = usuario_mesmo_email.id
        return None

    usuario = Usuario(
        municipio_id=servidor.municipio_id,
        servidor_id=servidor.id,
        nome=servidor.nome,
        email=email_normalizado,
        senha_hash=get_password_hash(servidor.matricula),
        perfil=PerfilEnum.SERVIDOR,
    )
    db.add(usuario)
    await db.flush()

    servidor.usuario_id = usuario.id
    return {"login": servidor.matricula, "senha_provisoria": servidor.matricula}


@router.get("", response_model=List[ServidorResumo])
async def listar_servidores(
    ativo: bool | None = Query(default=None),
    municipio_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(Servidor).options(selectinload(Servidor.lotacao))

    if ativo is not None:
        query = query.where(Servidor.ativo == ativo)

    if current_user.perfil == PerfilEnum.SUPER_ADMIN:
        if municipio_id is not None:
            query = query.where(Servidor.municipio_id == municipio_id)
    else:
        query = query.where(Servidor.municipio_id == current_user.municipio_id)

    result = await db.execute(query.order_by(Servidor.nome))
    return result.scalars().all()


@router.post("", response_model=ServidorResponse, status_code=201)
async def criar_servidor(
    data: ServidorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    municipio_id = current_user.municipio_id
    if current_user.perfil == PerfilEnum.SUPER_ADMIN and data.municipio_id is not None:
        municipio_id = data.municipio_id

    await _validar_municipio(db, municipio_id=municipio_id)
    await _validar_matricula_no_municipio(
        db,
        servidor_id=None,
        municipio_id=municipio_id,
        matricula=data.matricula,
    )
    await _validar_chefia_no_municipio(
        db,
        municipio_id=municipio_id,
        chefia_servidor_id=data.chefia_servidor_id,
    )
    cargo = await _validar_cargo_no_municipio(
        db,
        municipio_id=municipio_id,
        cargo_id=data.cargo_id,
    )

    payload = data.model_dump(exclude={"municipio_id"})
    payload["email"] = data.email.strip().lower() if data.email else None
    if cargo is not None:
        # mantém o texto `cargo` sincronizado com o catálogo
        payload["cargo"] = cargo.nome
    servidor = Servidor(municipio_id=municipio_id, **payload)
    db.add(servidor)
    await db.flush()
    credenciais_acesso = await _garantir_usuario_acesso_servidor(db, servidor=servidor)
    await db.refresh(servidor)

    if credenciais_acesso:
        setattr(servidor, "credenciais_acesso", credenciais_acesso)

    await log_event(
        db, municipio_id, Acoes.SERVIDOR_CRIADO, "servidor",
        usuario=current_user, entidade_id=str(servidor.id),
        descricao=f"Servidor {servidor.nome} (matrícula: {servidor.matricula}) cadastrado",
    )
    return servidor


@router.get("/{servidor_id}/ficha", response_model=ServidorFicha)
async def ficha_servidor(
    servidor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = (
        select(Servidor)
        .options(
            selectinload(Servidor.cargo_catalogo).selectinload(Cargo.pesos),
            selectinload(Servidor.lotacao),
        )
        .where(Servidor.id == servidor_id)
    )
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(Servidor.municipio_id == current_user.municipio_id)

    result = await db.execute(query)
    servidor = result.scalar_one_or_none()
    if not servidor:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")
    return servidor


@router.get("/{servidor_id}", response_model=ServidorResponse)
async def detalhar_servidor(
    servidor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    return await _buscar_servidor_por_escopo(db, servidor_id=servidor_id, current_user=current_user)


@router.put("/{servidor_id}", response_model=ServidorResponse)
async def atualizar_servidor(
    servidor_id: int,
    data: ServidorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    servidor = await _buscar_servidor_por_escopo(db, servidor_id=servidor_id, current_user=current_user)

    update_data = data.model_dump(exclude_none=True)
    if "municipio_id" in update_data:
        if current_user.perfil != PerfilEnum.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Você não pode alterar o município do servidor")
        await _validar_municipio(db, municipio_id=update_data["municipio_id"])

    novo_municipio_id = update_data.get("municipio_id", servidor.municipio_id)
    nova_matricula = update_data.get("matricula", servidor.matricula)
    await _validar_matricula_no_municipio(
        db,
        servidor_id=servidor.id,
        municipio_id=novo_municipio_id,
        matricula=nova_matricula,
    )
    await _validar_chefia_no_municipio(
        db,
        municipio_id=novo_municipio_id,
        chefia_servidor_id=update_data.get("chefia_servidor_id", servidor.chefia_servidor_id),
        servidor_id=servidor.id,
    )

    if "cargo_id" in update_data:
        cargo = await _validar_cargo_no_municipio(
            db,
            municipio_id=novo_municipio_id,
            cargo_id=update_data["cargo_id"],
        )
        if cargo is not None:
            update_data["cargo"] = cargo.nome

    if "email" in update_data and update_data["email"]:
        update_data["email"] = update_data["email"].strip().lower()

    if "municipio_id" in update_data and _is_email_interno_servidor(servidor.email):
        update_data["email"] = None

    for field, value in update_data.items():
        setattr(servidor, field, value)

    credenciais_acesso = await _garantir_usuario_acesso_servidor(db, servidor=servidor)
    await db.flush()
    await db.refresh(servidor)

    if credenciais_acesso:
        setattr(servidor, "credenciais_acesso", credenciais_acesso)

    await log_event(
        db, servidor.municipio_id, Acoes.SERVIDOR_ALTERADO, "servidor",
        usuario=current_user, entidade_id=str(servidor_id),
    )
    return servidor


@router.patch("/{servidor_id}/municipio", response_model=ServidorResponse)
async def vincular_servidor_municipio(
    servidor_id: int,
    municipio_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Apenas o super admin pode vincular servidor a outro município")

    servidor = await _buscar_servidor_por_escopo(db, servidor_id=servidor_id, current_user=current_user)
    await _validar_municipio(db, municipio_id=municipio_id)
    await _validar_matricula_no_municipio(
        db,
        servidor_id=servidor.id,
        municipio_id=municipio_id,
        matricula=servidor.matricula,
    )

    if _is_email_interno_servidor(servidor.email):
        servidor.email = None

    servidor.municipio_id = municipio_id
    credenciais_acesso = await _garantir_usuario_acesso_servidor(db, servidor=servidor)
    await db.flush()
    await db.refresh(servidor)

    if credenciais_acesso:
        setattr(servidor, "credenciais_acesso", credenciais_acesso)

    await log_event(
        db, municipio_id, Acoes.SERVIDOR_ALTERADO, "servidor",
        usuario=current_user, entidade_id=str(servidor_id),
        descricao=f"Servidor {servidor.nome} vinculado ao município {municipio_id}",
    )
    return servidor


@router.get("/funcoes/todos")
async def listar_todos_vinculos(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = (
        select(ServidorFuncao)
        .options(selectinload(ServidorFuncao.funcao))
        .where(ServidorFuncao.ativo == True)
    )
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(ServidorFuncao.municipio_id == current_user.municipio_id)
    result = await db.execute(query)
    return [
        {
            "id": sf.id,
            "servidor_id": sf.servidor_id,
            "funcao_usuario_id": sf.funcao_usuario_id,
            "nome": sf.funcao.nome,
            "criado_em": sf.criado_em,
        }
        for sf in result.scalars().all()
    ]


@router.get("/{servidor_id}/funcoes")
async def listar_funcoes_servidor(
    servidor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    await _buscar_servidor_por_escopo(db, servidor_id=servidor_id, current_user=current_user)
    result = await db.execute(
        select(ServidorFuncao)
        .options(selectinload(ServidorFuncao.funcao))
        .where(ServidorFuncao.servidor_id == servidor_id, ServidorFuncao.ativo == True)
    )
    return [
        {"id": sf.id, "funcao_usuario_id": sf.funcao_usuario_id, "nome": sf.funcao.nome, "criado_em": sf.criado_em}
        for sf in result.scalars().all()
    ]


@router.post("/{servidor_id}/funcoes")
async def vincular_funcao_servidor(
    servidor_id: int,
    data: VincularFuncaoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    servidor = await _buscar_servidor_por_escopo(db, servidor_id=servidor_id, current_user=current_user)

    funcao = await db.get(FuncaoUsuario, data.funcao_usuario_id)
    if not funcao or funcao.municipio_id != servidor.municipio_id:
        raise HTTPException(status_code=404, detail="Função não encontrada para este município")
    if not funcao.ativo:
        raise HTTPException(status_code=400, detail="A função selecionada está inativa")

    existing = await db.execute(
        select(ServidorFuncao).where(
            ServidorFuncao.servidor_id == servidor_id,
            ServidorFuncao.funcao_usuario_id == data.funcao_usuario_id,
        )
    )
    sf = existing.scalar_one_or_none()
    if sf:
        if sf.ativo:
            raise HTTPException(status_code=400, detail="Servidor já está vinculado a esta função")
        sf.ativo = True
    else:
        sf = ServidorFuncao(
            municipio_id=servidor.municipio_id,
            servidor_id=servidor_id,
            funcao_usuario_id=data.funcao_usuario_id,
        )
        db.add(sf)

    await log_event(
        db, servidor.municipio_id, Acoes.SERVIDOR_ALTERADO, "servidor",
        usuario=current_user, entidade_id=str(servidor_id),
        descricao=f"Servidor {servidor.nome} vinculado à função '{funcao.nome}'",
    )
    return {"message": f"Servidor vinculado à função '{funcao.nome}' com sucesso"}


@router.delete("/{servidor_id}/funcoes/{vinculo_id}")
async def desvincular_funcao_servidor(
    servidor_id: int,
    vinculo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    await _buscar_servidor_por_escopo(db, servidor_id=servidor_id, current_user=current_user)
    sf = await db.get(ServidorFuncao, vinculo_id)
    if not sf or sf.servidor_id != servidor_id:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado")
    sf.ativo = False
    return {"message": "Vínculo removido com sucesso"}


@router.patch("/{servidor_id}/status")
async def alterar_status_servidor(
    servidor_id: int,
    ativo: bool,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    servidor = await _buscar_servidor_por_escopo(db, servidor_id=servidor_id, current_user=current_user)
    servidor.ativo = ativo
    return {"message": f"Servidor {'ativado' if ativo else 'desativado'}"}


@router.post("/importar")
async def importar_servidores(
    arquivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    if current_user.perfil == PerfilEnum.SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="Selecione um município para importar servidores")

    nome_arquivo = (arquivo.filename or "").lower()
    if not nome_arquivo.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Arquivo deve ser .xlsx, .xls ou .csv")

    conteudo = await arquivo.read()
    if nome_arquivo.endswith(".csv"):
        texto_csv = _decodificar_csv(conteudo)
        leitor = csv.reader(io.StringIO(texto_csv), delimiter=";")
        linhas_planilha = list(leitor)
        if not linhas_planilha:
            raise HTTPException(status_code=400, detail="Arquivo CSV vazio")
    else:
        wb = openpyxl.load_workbook(io.BytesIO(conteudo), read_only=True, data_only=True)
        ws = wb.active
        linhas_planilha = list(ws.iter_rows(values_only=True))
        if not linhas_planilha:
            raise HTTPException(status_code=400, detail="Planilha vazia")

    # A planilha modelo traz linhas de título/instruções antes do cabeçalho
    # real (NOME/MATRÍCULA...). Localiza dinamicamente a linha de cabeçalho:
    # a primeira que mapear ao menos as colunas obrigatórias NOME e MATRÍCULA.
    indice_cabecalho = None
    colunas: dict[int, str] = {}
    for idx, linha_atual in enumerate(linhas_planilha):
        mapeamento = _mapear_cabecalhos(list(linha_atual))
        if {"nome", "matricula"}.issubset(set(mapeamento.values())):
            indice_cabecalho = idx
            colunas = mapeamento
            break

    if indice_cabecalho is None:
        raise HTTPException(
            status_code=400,
            detail="A planilha deve conter ao menos as colunas NOME e MATRÍCULA",
        )

    linhas = linhas_planilha[indice_cabecalho + 1:]

    lote = LoteImportacao(
        municipio_id=current_user.municipio_id,
        usuario_importador_id=current_user.id,
        nome_arquivo=arquivo.filename,
    )
    db.add(lote)
    await db.flush()

    # Catálogo de cargos do município, indexado por nome normalizado
    # (sem acento/maiúsculas) para casar automaticamente o cargo da planilha.
    cargos_result = await db.execute(
        select(Cargo).where(Cargo.municipio_id == current_user.municipio_id)
    )
    mapa_cargos = {_normalizar_texto(c.nome): c.id for c in cargos_result.scalars().all()}

    lotacoes_result = await db.execute(
        select(Lotacao).where(Lotacao.municipio_id == current_user.municipio_id)
    )
    mapa_lotacoes: dict[str, int] = {_normalizar_texto(l.nome): l.id for l in lotacoes_result.scalars().all()}

    validos = 0
    invalidos = 0
    erros_detalhados: list[dict[str, Any]] = []
    matriculas_vistas: set[str] = set()
    # Servidores importados nesta planilha que precisam ter o vínculo de
    # chefia resolvido a partir da MATRÍCULA CHEFIA (texto livre).
    servidores_para_vincular: list[Servidor] = []

    for i, row in enumerate(linhas, start=2):
        if not row or not any(str(valor).strip() for valor in row if valor is not None):
            continue

        dados = _extrair_dados_linha(row, colunas)

        erro = _validar_linha_importacao(
            dados,
            matriculas_vistas=matriculas_vistas,
            mapa_cargos=mapa_cargos,
            mapa_lotacoes=mapa_lotacoes,
        )

        linha = LinhaImportacao(
            lote_importacao_id=lote.id,
            numero_linha=i,
            dados_originais=_serializar_dados_importacao(dados),
            status="INVALIDO" if erro else "VALIDO",
            mensagem_erro=erro,
        )
        db.add(linha)

        if erro:
            invalidos += 1
            erros_detalhados.append({
                "linha": i,
                "matricula": (dados.get("matricula") or "").strip() or None,
                "nome": dados.get("nome"),
                "mensagem": erro,
                "_obj": linha,
            })
            continue

        matriculas_vistas.add(_normalizar_texto(dados["matricula"]))

        servidor = await _persistir_servidor_importado(
            db,
            dados=dados,
            municipio_id=current_user.municipio_id,
            mapa_cargos=mapa_cargos,
            mapa_lotacoes=mapa_lotacoes,
        )
        servidores_para_vincular.append(servidor)
        linha.status = "IMPORTADO"
        validos += 1

    # Resolução não-bloqueante do vínculo de chefia (ver _resolver_vinculo_chefia).
    for servidor in servidores_para_vincular:
        await _resolver_vinculo_chefia(db, servidor=servidor, municipio_id=current_user.municipio_id)

    # Garante que as linhas inválidas tenham id (para correção posterior).
    await db.flush()
    for item in erros_detalhados:
        item["linha_id"] = item.pop("_obj").id

    lote.total_registros = validos + invalidos
    lote.registros_validos = validos
    lote.registros_invalidos = invalidos
    lote.status = "FINALIZADO"
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
        "erros": erros_detalhados,
    }


@router.get("/importar/{lote_id}")
async def status_importacao(
    lote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    query = select(LoteImportacao).where(LoteImportacao.id == lote_id)
    if current_user.perfil != PerfilEnum.SUPER_ADMIN:
        query = query.where(LoteImportacao.municipio_id == current_user.municipio_id)

    result = await db.execute(query)
    lote = result.scalar_one_or_none()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    return lote


def _erro_payload_da_linha(linha: LinhaImportacao) -> dict[str, Any]:
    dados = linha.dados_originais or {}
    return {
        "linha": linha.numero_linha,
        "linha_id": linha.id,
        "matricula": (dados.get("matricula") or None),
        "nome": dados.get("nome"),
        "mensagem": linha.mensagem_erro,
    }


@router.post("/importar/{lote_id}/reprocessar")
async def reprocessar_importacao(
    lote_id: int,
    body: ReprocessarImportacaoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    """Reprocessa linhas que ficaram inválidas, aplicando correções de
    cargo/lotação (escolhidos pelo admin entre os já cadastrados no banco).
    As linhas válidas anteriores não são tocadas; a mesma matrícula é
    atualizada, então não há duplicação."""
    if current_user.perfil == PerfilEnum.SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="Selecione um município para reprocessar a importação")

    lote = await db.get(LoteImportacao, lote_id)
    if not lote or lote.municipio_id != current_user.municipio_id:
        raise HTTPException(status_code=404, detail="Lote não encontrado")

    cargos_result = await db.execute(
        select(Cargo).where(Cargo.municipio_id == current_user.municipio_id)
    )
    mapa_cargos = {_normalizar_texto(c.nome): c.id for c in cargos_result.scalars().all()}
    lotacoes_result = await db.execute(
        select(Lotacao).where(Lotacao.municipio_id == current_user.municipio_id)
    )
    mapa_lotacoes = {_normalizar_texto(l.nome): l.id for l in lotacoes_result.scalars().all()}

    servidores_para_vincular: list[Servidor] = []

    for correcao in body.correcoes:
        linha = await db.get(LinhaImportacao, correcao.linha_id)
        if not linha or linha.lote_importacao_id != lote_id or linha.status == "IMPORTADO":
            continue

        dados = dict(linha.dados_originais or {})

        # Aplica o cargo/lotação escolhido pelo admin (sobrescreve o texto da
        # planilha pelo nome cadastrado, garantindo o casamento na validação).
        if correcao.cargo_id is not None:
            cargo = await db.get(Cargo, correcao.cargo_id)
            if not cargo or cargo.municipio_id != current_user.municipio_id:
                raise HTTPException(status_code=400, detail="Cargo inválido para este município")
            dados["cargo"] = cargo.nome
        if correcao.lotacao_id is not None:
            lotacao = await db.get(Lotacao, correcao.lotacao_id)
            if not lotacao or lotacao.municipio_id != current_user.municipio_id:
                raise HTTPException(status_code=400, detail="Lotação inválida para este município")
            dados["lotacao"] = lotacao.nome

        erro = _validar_linha_importacao(
            dados,
            matriculas_vistas=set(),
            mapa_cargos=mapa_cargos,
            mapa_lotacoes=mapa_lotacoes,
        )
        linha.dados_originais = _serializar_dados_importacao(dados)

        if erro:
            linha.status = "INVALIDO"
            linha.mensagem_erro = erro
            continue

        servidor = await _persistir_servidor_importado(
            db,
            dados=dados,
            municipio_id=current_user.municipio_id,
            mapa_cargos=mapa_cargos,
            mapa_lotacoes=mapa_lotacoes,
        )
        servidores_para_vincular.append(servidor)
        linha.status = "IMPORTADO"
        linha.mensagem_erro = None

    for servidor in servidores_para_vincular:
        await _resolver_vinculo_chefia(db, servidor=servidor, municipio_id=current_user.municipio_id)

    await db.flush()

    # Recalcula o estado do lote a partir de todas as linhas.
    linhas_result = await db.execute(
        select(LinhaImportacao).where(LinhaImportacao.lote_importacao_id == lote_id)
    )
    todas = linhas_result.scalars().all()
    importadas = [l for l in todas if l.status == "IMPORTADO"]
    invalidas = [l for l in todas if l.status == "INVALIDO"]

    lote.registros_validos = len(importadas)
    lote.registros_invalidos = len(invalidas)
    lote.total_registros = len(importadas) + len(invalidas)

    return {
        "lote_id": lote.id,
        "total": lote.total_registros,
        "validos": lote.registros_validos,
        "invalidos": lote.registros_invalidos,
        "erros": [_erro_payload_da_linha(l) for l in invalidas],
    }
