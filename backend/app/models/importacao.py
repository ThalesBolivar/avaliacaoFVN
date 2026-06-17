from sqlalchemy import BigInteger, String, Integer, Enum, ForeignKey, Text, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import Optional, List
import enum


class StatusLoteEnum(str, enum.Enum):
    PROCESSANDO = "PROCESSANDO"
    FINALIZADO = "FINALIZADO"
    ERRO = "ERRO"


class StatusLinhaEnum(str, enum.Enum):
    VALIDO = "VALIDO"
    INVALIDO = "INVALIDO"
    IMPORTADO = "IMPORTADO"


class LoteImportacao(Base):
    __tablename__ = "lotes_importacao"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    usuario_importador_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("usuarios.id"), nullable=False)
    nome_arquivo: Mapped[str] = mapped_column(String(255), nullable=False)
    total_registros: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    registros_validos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    registros_invalidos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[StatusLoteEnum] = mapped_column(Enum(StatusLoteEnum), nullable=False, default=StatusLoteEnum.PROCESSANDO)
    mensagem_erro: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    finalizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    linhas: Mapped[List["LinhaImportacao"]] = relationship("LinhaImportacao", back_populates="lote")


class LinhaImportacao(Base):
    __tablename__ = "linhas_importacao"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lote_importacao_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("lotes_importacao.id"), nullable=False)
    numero_linha: Mapped[int] = mapped_column(Integer, nullable=False)
    dados_originais: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[StatusLinhaEnum] = mapped_column(Enum(StatusLinhaEnum), nullable=False, default=StatusLinhaEnum.VALIDO)
    mensagem_erro: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    lote: Mapped["LoteImportacao"] = relationship("LoteImportacao", back_populates="linhas")
