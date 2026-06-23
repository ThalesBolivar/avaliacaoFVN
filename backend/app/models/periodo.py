from sqlalchemy import BigInteger, String, Boolean, DateTime, Date, Enum, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime, date
from typing import Optional, List
import enum


class StatusPeriodoEnum(str, enum.Enum):
    PLANEJADO = "PLANEJADO"
    ATIVO = "ATIVO"
    ENCERRADO = "ENCERRADO"


class StatusVinculoEnum(str, enum.Enum):
    PENDENTE = "PENDENTE"
    EM_ANDAMENTO = "EM_ANDAMENTO"
    FINALIZADA = "FINALIZADA"
    CANCELADA = "CANCELADA"


class TipoAvaliacaoEnum(str, enum.Enum):
    AUTOAVALIACAO = "AUTOAVALIACAO"
    SUPERIOR_IMEDIATO = "SUPERIOR_IMEDIATO"
    SUBCOMISSAO = "SUBCOMISSAO"


class PeriodoAvaliacao(Base):
    __tablename__ = "periodos_avaliacao"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    data_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    data_fim: Mapped[date] = mapped_column(Date, nullable=False)
    modelo_avaliacao_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("modelos_avaliacao.id"), nullable=True)
    status: Mapped[StatusPeriodoEnum] = mapped_column(Enum(StatusPeriodoEnum), nullable=False, default=StatusPeriodoEnum.PLANEJADO)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    atualizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=func.now())

    municipio: Mapped["Municipio"] = relationship("Municipio", back_populates="periodos_avaliacao")
    modelo_avaliacao: Mapped[Optional["ModeloAvaliacao"]] = relationship("ModeloAvaliacao", back_populates="periodos")
    vinculos: Mapped[List["VinculoAvaliacao"]] = relationship("VinculoAvaliacao", back_populates="periodo")


class VinculoAvaliacao(Base):
    __tablename__ = "vinculos_avaliacao"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    periodo_avaliacao_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("periodos_avaliacao.id"), nullable=False)
    modelo_avaliacao_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("modelos_avaliacao.id"), nullable=False)
    servidor_avaliado_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("servidores.id"), nullable=False)
    chefia_servidor_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("servidores.id"), nullable=True)
    status: Mapped[StatusVinculoEnum] = mapped_column(Enum(StatusVinculoEnum), nullable=False, default=StatusVinculoEnum.PENDENTE)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    atualizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=func.now())

    periodo: Mapped["PeriodoAvaliacao"] = relationship("PeriodoAvaliacao", back_populates="vinculos")
    servidor_avaliado: Mapped["Servidor"] = relationship("Servidor", foreign_keys=[servidor_avaliado_id])
    chefia: Mapped[Optional["Servidor"]] = relationship("Servidor", foreign_keys=[chefia_servidor_id])
    formularios: Mapped[List["FormularioAvaliacao"]] = relationship("FormularioAvaliacao", back_populates="vinculo")


class FormularioAvaliacao(Base):
    __tablename__ = "formularios_avaliacao"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    vinculo_avaliacao_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("vinculos_avaliacao.id"), nullable=False)
    tipo_avaliacao: Mapped[TipoAvaliacaoEnum] = mapped_column(Enum(TipoAvaliacaoEnum), nullable=False)
    usuario_avaliador_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("usuarios.id"), nullable=False)
    servidor_avaliado_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("servidores.id"), nullable=False)
    status: Mapped[StatusVinculoEnum] = mapped_column(Enum(StatusVinculoEnum), nullable=False, default=StatusVinculoEnum.PENDENTE)
    ativo: Mapped[str] = mapped_column(String(1), nullable=False, default="S", server_default="S")
    observacoes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sugestoes_melhoria: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pontuacao_total: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    iniciado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finalizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    atualizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=func.now())

    vinculo: Mapped["VinculoAvaliacao"] = relationship("VinculoAvaliacao", back_populates="formularios")
    usuario_avaliador: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[usuario_avaliador_id])
    servidor_avaliado: Mapped["Servidor"] = relationship("Servidor", foreign_keys=[servidor_avaliado_id])
    respostas: Mapped[List["RespostaAvaliacao"]] = relationship("RespostaAvaliacao", back_populates="formulario", cascade="all, delete-orphan")


class RespostaAvaliacao(Base):
    __tablename__ = "respostas_avaliacao"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    formulario_avaliacao_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("formularios_avaliacao.id"), nullable=False)
    pergunta_avaliacao_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("perguntas_avaliacao.id"), nullable=False)
    opcao_selecionada: Mapped[Optional[str]] = mapped_column(Enum("A", "B", "C", "D", "E"), nullable=True)
    resposta_numerica: Mapped[Optional[float]] = mapped_column(Numeric(4, 2), nullable=True)
    resposta_texto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pontuacao_obtida: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    atualizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=func.now())

    formulario: Mapped["FormularioAvaliacao"] = relationship("FormularioAvaliacao", back_populates="respostas")
    pergunta: Mapped["PerguntaAvaliacao"] = relationship("PerguntaAvaliacao")
