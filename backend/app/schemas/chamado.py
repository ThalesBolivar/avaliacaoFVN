from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.chamado import ChamadoTipo, ChamadoStatus


class ChamadoCreate(BaseModel):
    tipo: ChamadoTipo
    valor_solicitado: str
    descricao: Optional[str] = None
    lote_importacao_id: Optional[int] = None


class ChamadoResolver(BaseModel):
    status: ChamadoStatus


class ChamadoResponse(BaseModel):
    id: int
    municipio_id: int
    usuario_id: int
    tipo: ChamadoTipo
    valor_solicitado: str
    descricao: Optional[str] = None
    status: ChamadoStatus
    lote_importacao_id: Optional[int] = None
    criado_em: datetime
    resolvido_em: Optional[datetime] = None

    model_config = {"from_attributes": True}
