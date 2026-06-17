from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class LogResponse(BaseModel):
    id: int
    municipio_id: int
    usuario_id: Optional[int]
    nome_usuario: Optional[str]
    perfil_usuario: Optional[str]
    acao: str
    entidade: str
    entidade_id: Optional[str]
    descricao: Optional[str]
    dados_antes: Optional[Any]
    dados_depois: Optional[Any]
    endereco_ip: Optional[str]
    criado_em: datetime

    model_config = {"from_attributes": True}
