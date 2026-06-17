from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class NotificacaoResponse(BaseModel):
    id: int
    tipo: str
    titulo: str
    mensagem: str
    lida: bool
    lida_em: Optional[datetime]
    dados_extras: Optional[Any]
    criado_em: datetime

    model_config = {"from_attributes": True}
