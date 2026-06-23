from sqlalchemy import BigInteger, String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import Optional, List


class Municipio(Base):
    __tablename__ = "municipios"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    identificador: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    estado: Mapped[str] = mapped_column(String(2), nullable=False, default="MG")
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cor_primaria: Mapped[Optional[str]] = mapped_column(String(7), nullable=True, default="#1a56db")
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    atualizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=func.now())

    usuarios: Mapped[List["Usuario"]] = relationship("Usuario", back_populates="municipio", foreign_keys="Usuario.municipio_id")
    servidores: Mapped[List["Servidor"]] = relationship("Servidor", back_populates="municipio")
    funcoes_usuario: Mapped[List["FuncaoUsuario"]] = relationship("FuncaoUsuario", back_populates="municipio")
    modelos_avaliacao: Mapped[List["ModeloAvaliacao"]] = relationship("ModeloAvaliacao", back_populates="municipio")
    categorias_avaliacao: Mapped[List["CategoriaAvaliacao"]] = relationship("CategoriaAvaliacao", back_populates="municipio")
    periodos_avaliacao: Mapped[List["PeriodoAvaliacao"]] = relationship("PeriodoAvaliacao", back_populates="municipio")
