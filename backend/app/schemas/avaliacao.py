from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.periodo import TipoAvaliacaoEnum, StatusVinculoEnum
from app.models.questionario import TipoRespostaEnum, LetraOpcaoEnum


class RespostaInput(BaseModel):
    pergunta_avaliacao_id: int
    opcao_selecionada: Optional[str] = None
    resposta_numerica: Optional[float] = None
    resposta_texto: Optional[str] = None


class SalvarAvaliacaoRequest(BaseModel):
    respostas: List[RespostaInput]
    observacoes: Optional[str] = None
    sugestoes_melhoria: Optional[str] = None
    uso_alcool_drogas: Optional[bool] = None


class FinalizarAvaliacaoRequest(SalvarAvaliacaoRequest):
    pass


class RespostaResponse(BaseModel):
    id: int
    pergunta_avaliacao_id: int
    opcao_selecionada: Optional[str]
    resposta_numerica: Optional[float]
    resposta_texto: Optional[str]
    pontuacao_obtida: Optional[float]

    model_config = {"from_attributes": True}


class OpcaoFormularioResponse(BaseModel):
    id: int
    letra_opcao: LetraOpcaoEnum
    texto_opcao: str
    pontuacao: Optional[float]

    model_config = {"from_attributes": True}


class PerguntaFormularioResponse(BaseModel):
    id: int
    criterio: str
    numero_pergunta: int
    texto_pergunta: str
    tipo_resposta: TipoRespostaEnum
    peso: float
    obrigatoria: bool
    opcoes: List[OpcaoFormularioResponse] = []

    model_config = {"from_attributes": True}


class FormularioResumo(BaseModel):
    id: int
    tipo_avaliacao: TipoAvaliacaoEnum
    status: StatusVinculoEnum
    servidor_avaliado_id: int
    nome_servidor: Optional[str] = None
    pontuacao_total: Optional[float]
    iniciado_em: Optional[datetime]
    finalizado_em: Optional[datetime]
    criado_em: datetime

    model_config = {"from_attributes": True}


class FormularioDetalhado(FormularioResumo):
    observacoes: Optional[str]
    sugestoes_melhoria: Optional[str]
    uso_alcool_drogas: Optional[bool]
    perguntas: List[PerguntaFormularioResponse] = []
    respostas: List[RespostaResponse] = []

    model_config = {"from_attributes": True}
