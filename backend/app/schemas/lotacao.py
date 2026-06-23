from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LotacaoCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=150)
    descricao: Optional[str] = None
    ordem: int = 0
    ativo: bool = True


class LotacaoUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1, max_length=150)
    descricao: Optional[str] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None


class LotacaoResponse(BaseModel):
    id: int
    municipio_id: int
    nome: str
    descricao: Optional[str] = None
    ordem: int
    ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}
