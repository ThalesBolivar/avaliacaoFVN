from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
from app.schemas.cargo import CargoDetalhe


class LotacaoEmbed(BaseModel):
    id: int
    nome: str

    model_config = {"from_attributes": True}


class ServidorBase(BaseModel):
    nome: str
    matricula: str
    grau_instrucao: Optional[str] = None
    cargo: Optional[str] = None
    cargo_id: Optional[int] = None
    lotacao_id: Optional[int] = None
    cpf: Optional[str] = None
    data_admissao: Optional[date] = None
    email: Optional[str] = None
    chefia_servidor_id: Optional[int] = None
    matricula_chefia: Optional[str] = None
    nome_chefia: Optional[str] = None


class ServidorCreate(ServidorBase):
    municipio_id: Optional[int] = None


class ServidorUpdate(BaseModel):
    municipio_id: Optional[int] = None
    matricula: Optional[str] = None
    nome: Optional[str] = None
    grau_instrucao: Optional[str] = None
    cargo: Optional[str] = None
    cargo_id: Optional[int] = None
    lotacao_id: Optional[int] = None
    cpf: Optional[str] = None
    data_admissao: Optional[date] = None
    email: Optional[str] = None
    chefia_servidor_id: Optional[int] = None
    ativo: Optional[bool] = None


class ServidorResponse(ServidorBase):
    id: int
    municipio_id: int
    usuario_id: Optional[int]
    lotacao: Optional[LotacaoEmbed] = None
    credenciais_acesso: Optional[dict[str, str]] = None
    ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


class ServidorResumo(BaseModel):
    id: int
    municipio_id: int
    nome: str
    matricula: str
    cargo: Optional[str]
    cargo_id: Optional[int] = None
    lotacao_id: Optional[int] = None
    lotacao: Optional[LotacaoEmbed] = None
    ativo: bool

    model_config = {"from_attributes": True}


class ServidorFicha(ServidorResponse):
    cargo_catalogo: Optional[CargoDetalhe] = None


class ImportacaoStatus(BaseModel):
    lote_id: int
    status: str
    total_registros: int
    registros_validos: int
    registros_invalidos: int
    mensagem_erro: Optional[str]
