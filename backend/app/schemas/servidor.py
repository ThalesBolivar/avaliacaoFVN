from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional


class ServidorBase(BaseModel):
    nome: str
    matricula: str
    cargo: Optional[str] = None
    lotacao: Optional[str] = None
    cpf: Optional[str] = None
    data_admissao: Optional[date] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    chefia_servidor_id: Optional[int] = None


class ServidorCreate(ServidorBase):
    pass


class ServidorUpdate(BaseModel):
    nome: Optional[str] = None
    cargo: Optional[str] = None
    lotacao: Optional[str] = None
    cpf: Optional[str] = None
    data_admissao: Optional[date] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    chefia_servidor_id: Optional[int] = None
    ativo: Optional[bool] = None


class ServidorResponse(ServidorBase):
    id: int
    municipio_id: int
    usuario_id: Optional[int]
    ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


class ServidorResumo(BaseModel):
    id: int
    nome: str
    matricula: str
    cargo: Optional[str]
    lotacao: Optional[str]
    ativo: bool

    model_config = {"from_attributes": True}


class ImportacaoStatus(BaseModel):
    lote_id: int
    status: str
    total_registros: int
    registros_validos: int
    registros_invalidos: int
    mensagem_erro: Optional[str]
