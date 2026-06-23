from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.models.usuario import PerfilEnum


class UsuarioCompartilhadoInfo(BaseModel):
    id: int
    email: str
    ativo: bool

    model_config = {"from_attributes": True}


class FuncaoUsuarioCreate(BaseModel):
    nome: str
    perfil_base: Optional[PerfilEnum] = None
    municipio_id: Optional[int] = None


class FuncaoUsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    ativo: Optional[bool] = None


class FuncaoUsuarioResponse(BaseModel):
    id: int
    municipio_id: int
    nome: str
    perfil_base: PerfilEnum
    ativo: bool
    criado_em: datetime
    usuario_compartilhado: Optional[UsuarioCompartilhadoInfo] = None

    model_config = {"from_attributes": True}


class FuncaoUsuarioCriadaResponse(FuncaoUsuarioResponse):
    """Retornado apenas na criação — inclui a senha gerada para subcomissões."""
    senha_gerada: Optional[str] = None
