from sqlalchemy import BigInteger, String, Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import Optional, List
import enum


class StatusModeloEnum(str, enum.Enum):
    RASCUNHO = "RASCUNHO"
    PUBLICADO = "PUBLICADO"
    ARQUIVADO = "ARQUIVADO"


class TipoRespostaEnum(str, enum.Enum):
    MULTIPLA_ESCOLHA = "MULTIPLA_ESCOLHA"
    ESCALA_1_5 = "ESCALA_1_5"
    SIM_NAO = "SIM_NAO"
    TEXTO_LIVRE = "TEXTO_LIVRE"


class LetraOpcaoEnum(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"


class CategoriaAvaliacao(Base):
    __tablename__ = "categorias_avaliacao"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    municipio: Mapped["Municipio"] = relationship("Municipio", back_populates="categorias_avaliacao")
    perguntas: Mapped[List["PerguntaAvaliacao"]] = relationship("PerguntaAvaliacao", back_populates="categoria")


class ModeloAvaliacao(Base):
    __tablename__ = "modelos_avaliacao"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    versao: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[StatusModeloEnum] = mapped_column(Enum(StatusModeloEnum), nullable=False, default=StatusModeloEnum.RASCUNHO)
    para_autoavaliacao: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    para_superior_imediato: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    para_subcomissao: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    pontuacao_maxima: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    publicado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    criado_por_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("usuarios.id"), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    atualizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=func.now())

    municipio: Mapped["Municipio"] = relationship("Municipio", back_populates="modelos_avaliacao")
    criado_por: Mapped[Optional["Usuario"]] = relationship("Usuario", foreign_keys=[criado_por_id])
    perguntas: Mapped[List["PerguntaAvaliacao"]] = relationship(
        "PerguntaAvaliacao", back_populates="modelo", cascade="all, delete-orphan",
        order_by="PerguntaAvaliacao.numero_pergunta"
    )
    periodos: Mapped[List["PeriodoAvaliacao"]] = relationship("PeriodoAvaliacao", back_populates="modelo_avaliacao")


class PerguntaAvaliacao(Base):
    __tablename__ = "perguntas_avaliacao"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    modelo_avaliacao_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("modelos_avaliacao.id"), nullable=False)
    categoria_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("categorias_avaliacao.id"), nullable=True)
    criterio: Mapped[str] = mapped_column(String(150), nullable=False)
    numero_pergunta: Mapped[int] = mapped_column(Integer, nullable=False)
    texto_pergunta: Mapped[str] = mapped_column(Text, nullable=False)
    tipo_resposta: Mapped[TipoRespostaEnum] = mapped_column(Enum(TipoRespostaEnum), nullable=False, default=TipoRespostaEnum.MULTIPLA_ESCOLHA)
    peso: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False, default=1.00)
    obrigatoria: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    apenas_autoavaliacao: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    apenas_superior: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    apenas_subcomissao: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ativa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    modelo: Mapped["ModeloAvaliacao"] = relationship("ModeloAvaliacao", back_populates="perguntas")
    categoria: Mapped[Optional["CategoriaAvaliacao"]] = relationship("CategoriaAvaliacao", back_populates="perguntas")
    opcoes: Mapped[List["OpcaoPerguntaAvaliacao"]] = relationship(
        "OpcaoPerguntaAvaliacao", back_populates="pergunta", cascade="all, delete-orphan",
        order_by="OpcaoPerguntaAvaliacao.letra_opcao"
    )


class OpcaoPerguntaAvaliacao(Base):
    __tablename__ = "opcoes_pergunta_avaliacao"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pergunta_avaliacao_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("perguntas_avaliacao.id"), nullable=False)
    letra_opcao: Mapped[LetraOpcaoEnum] = mapped_column(Enum(LetraOpcaoEnum), nullable=False)
    texto_opcao: Mapped[str] = mapped_column(Text, nullable=False)
    pontuacao: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    pergunta: Mapped["PerguntaAvaliacao"] = relationship("PerguntaAvaliacao", back_populates="opcoes")
