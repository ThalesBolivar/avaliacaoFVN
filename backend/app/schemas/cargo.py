from pydantic import BaseModel, Field
from typing import Optional


class PesoQuestaoResponse(BaseModel):
    numero_pergunta: int
    peso: float

    model_config = {"from_attributes": True}


class PesoQuestaoInput(BaseModel):
    numero_pergunta: int = Field(ge=1)
    peso: float = Field(ge=0)


class NivelCargoEmbed(BaseModel):
    id: int
    nome: str
    label: str

    model_config = {"from_attributes": True}


class CargoCreate(BaseModel):
    municipio_id: Optional[int] = None  # usado apenas pelo SUPER_ADMIN
    nome: str = Field(min_length=1, max_length=150)
    nivel_id: int
    modelo_avaliacao_id: Optional[int] = None
    pontuacao_maxima: float = Field(default=100.00, ge=0)
    pontos_min_estagio: Optional[float] = Field(default=None, ge=0)
    pontos_min_progressao: Optional[float] = Field(default=None, ge=0)
    ativo: bool = True
    pesos: Optional[list[PesoQuestaoInput]] = None


class CargoUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1, max_length=150)
    nivel_id: Optional[int] = None
    modelo_avaliacao_id: Optional[int] = None
    pontuacao_maxima: Optional[float] = Field(default=None, ge=0)
    pontos_min_estagio: Optional[float] = Field(default=None, ge=0)
    pontos_min_progressao: Optional[float] = Field(default=None, ge=0)
    ativo: Optional[bool] = None
    pesos: Optional[list[PesoQuestaoInput]] = None


class CargoResponse(BaseModel):
    id: int
    municipio_id: int
    nome: str
    nivel_id: int
    nivel: NivelCargoEmbed
    modelo_avaliacao_id: Optional[int] = None
    pontuacao_maxima: float
    pontos_min_estagio: Optional[float] = None
    pontos_min_progressao: Optional[float] = None
    ativo: bool

    model_config = {"from_attributes": True}


class CargoDetalhe(CargoResponse):
    pesos: list[PesoQuestaoResponse] = []
