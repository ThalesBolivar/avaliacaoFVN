from sqlalchemy import BigInteger, String, DateTime, ForeignKey, Text, JSON, func, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from datetime import datetime
from typing import Optional


class LogSistema(Base):
    __tablename__ = "logs_sistema"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    usuario_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("usuarios.id"), nullable=True)
    nome_usuario: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    perfil_usuario: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    acao: Mapped[str] = mapped_column(String(100), nullable=False)
    entidade: Mapped[str] = mapped_column(String(100), nullable=False)
    entidade_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dados_antes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    dados_depois: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    endereco_ip: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    navegador: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        Index("idx_logs_municipio_acao", "municipio_id", "acao"),
        Index("idx_logs_criado", "criado_em"),
    )
