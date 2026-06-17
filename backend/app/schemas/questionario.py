from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.questionario import StatusModeloEnum, TipoRespostaEnum, LetraOpcaoEnum


# ── Categorias ────────────────────────────────────────────────

class CategoriaCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    ordem: int = 0


class CategoriaUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None


class CategoriaResponse(BaseModel):
    id: int
    municipio_id: int
    nome: str
    descricao: Optional[str]
    ordem: int
    ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


# ── Opções de Pergunta ────────────────────────────────────────

class OpcaoCreate(BaseModel):
    letra_opcao: LetraOpcaoEnum
    texto_opcao: str
    pontuacao: Optional[float] = None


class OpcaoUpdate(BaseModel):
    texto_opcao: Optional[str] = None
    pontuacao: Optional[float] = None


class OpcaoResponse(BaseModel):
    id: int
    letra_opcao: LetraOpcaoEnum
    texto_opcao: str
    pontuacao: Optional[float]

    model_config = {"from_attributes": True}


# ── Perguntas ─────────────────────────────────────────────────

class PerguntaCreate(BaseModel):
    criterio: str
    numero_pergunta: int
    texto_pergunta: str
    tipo_resposta: TipoRespostaEnum = TipoRespostaEnum.MULTIPLA_ESCOLHA
    peso: float = 1.0
    obrigatoria: bool = True
    categoria_id: Optional[int] = None
    apenas_autoavaliacao: bool = False
    apenas_superior: bool = False
    apenas_subcomissao: bool = False
    opcoes: List[OpcaoCreate] = []


class PerguntaUpdate(BaseModel):
    criterio: Optional[str] = None
    texto_pergunta: Optional[str] = None
    tipo_resposta: Optional[TipoRespostaEnum] = None
    peso: Optional[float] = None
    obrigatoria: Optional[bool] = None
    categoria_id: Optional[int] = None
    apenas_autoavaliacao: Optional[bool] = None
    apenas_superior: Optional[bool] = None
    apenas_subcomissao: Optional[bool] = None
    ativa: Optional[bool] = None


class PerguntaReordenar(BaseModel):
    id: int
    numero_pergunta: int


class PerguntaResponse(BaseModel):
    id: int
    modelo_avaliacao_id: int
    categoria_id: Optional[int]
    criterio: str
    numero_pergunta: int
    texto_pergunta: str
    tipo_resposta: TipoRespostaEnum
    peso: float
    obrigatoria: bool
    apenas_autoavaliacao: bool
    apenas_superior: bool
    apenas_subcomissao: bool
    ativa: bool
    opcoes: List[OpcaoResponse]

    model_config = {"from_attributes": True}


# ── Modelos de Avaliação ──────────────────────────────────────

class ModeloCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    para_autoavaliacao: bool = True
    para_superior_imediato: bool = True
    para_subcomissao: bool = True
    perguntas: List[PerguntaCreate] = []


class ModeloUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    para_autoavaliacao: Optional[bool] = None
    para_superior_imediato: Optional[bool] = None
    para_subcomissao: Optional[bool] = None
    perguntas: Optional[List[PerguntaCreate]] = None


class ModeloResumo(BaseModel):
    id: int
    municipio_id: int
    nome: str
    versao: int
    status: StatusModeloEnum
    para_autoavaliacao: bool
    para_superior_imediato: bool
    para_subcomissao: bool
    pontuacao_maxima: Optional[float]
    publicado_em: Optional[datetime]
    criado_em: datetime
    total_perguntas: int = 0

    model_config = {"from_attributes": True}


class ModeloResponse(ModeloResumo):
    descricao: Optional[str]
    perguntas: List[PerguntaResponse] = []

    model_config = {"from_attributes": True}
