from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List
from app.models.periodo import StatusPeriodoEnum, StatusVinculoEnum, TipoAvaliacaoEnum


class PeriodoCreate(BaseModel):
    nome: str
    data_inicio: date
    data_fim: date
    modelo_avaliacao_id: Optional[int] = None


class PeriodoUpdate(BaseModel):
    nome: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    modelo_avaliacao_id: Optional[int] = None


class PeriodoResponse(BaseModel):
    id: int
    municipio_id: int
    nome: str
    data_inicio: date
    data_fim: date
    modelo_avaliacao_id: Optional[int]
    status: StatusPeriodoEnum
    ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


class PeriodoProgresso(BaseModel):
    total_vinculos: int
    pendentes: int
    em_andamento: int
    finalizados: int
    percentual_concluido: float


class VinculoResponse(BaseModel):
    id: int
    municipio_id: int
    periodo_avaliacao_id: int
    modelo_avaliacao_id: int
    servidor_avaliado_id: int
    chefia_servidor_id: Optional[int]
    status: StatusVinculoEnum
    criado_em: datetime

    model_config = {"from_attributes": True}
