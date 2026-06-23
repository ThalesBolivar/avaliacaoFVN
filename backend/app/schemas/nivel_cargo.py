from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class NivelCargoCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=50)
    label: str = Field(min_length=1, max_length=100)
    descricao: Optional[str] = None
    ordem: int = 0
    ativo: bool = True


class NivelCargoUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=100)
    descricao: Optional[str] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None


class NivelCargoResponse(BaseModel):
    id: int
    nome: str
    label: str
    descricao: Optional[str] = None
    ordem: int
    ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}
