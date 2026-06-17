from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class MunicipioBase(BaseModel):
    nome: str
    identificador: str
    estado: str = "MG"
    logo_url: Optional[str] = None
    cor_primaria: Optional[str] = "#1a56db"


class MunicipioCreate(MunicipioBase):
    pass


class MunicipioUpdate(BaseModel):
    nome: Optional[str] = None
    logo_url: Optional[str] = None
    cor_primaria: Optional[str] = None
    ativo: Optional[bool] = None


class MunicipioResponse(MunicipioBase):
    id: int
    ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


class MunicipioPublic(BaseModel):
    id: int
    nome: str
    identificador: str
    estado: str
    cor_primaria: Optional[str]
    logo_url: Optional[str]

    model_config = {"from_attributes": True}
