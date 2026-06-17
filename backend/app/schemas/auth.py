from pydantic import BaseModel, EmailStr
from app.models.usuario import PerfilEnum


class LoginRequest(BaseModel):
    municipio_id: int
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    perfil: PerfilEnum
    nome: str
    municipio_id: int


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    id: int
    nome: str
    email: str
    perfil: PerfilEnum
    municipio_id: int
    ativo: bool

    model_config = {"from_attributes": True}


class RecuperarSenhaRequest(BaseModel):
    municipio_id: int
    email: EmailStr


class RedefinirSenhaRequest(BaseModel):
    token: str
    nova_senha: str
