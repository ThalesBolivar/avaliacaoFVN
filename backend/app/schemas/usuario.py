from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from app.models.usuario import PerfilEnum


class UsuarioCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    perfil: PerfilEnum
    municipio_id: Optional[int] = None
    servidor_id: Optional[int] = None


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    perfil: Optional[PerfilEnum] = None
    municipio_id: Optional[int] = None
    servidor_id: Optional[int] = None


class UsuarioResponse(BaseModel):
    id: int
    municipio_id: int
    servidor_id: Optional[int]
    nome: str
    email: str
    perfil: PerfilEnum
    ativo: bool
    ultimo_login_em: Optional[datetime]
    criado_em: datetime

    model_config = {"from_attributes": True}


class AlterarSenhaRequest(BaseModel):
    senha_atual: str
    nova_senha: str
