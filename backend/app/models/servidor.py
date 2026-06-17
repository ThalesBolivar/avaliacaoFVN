from sqlalchemy import BigInteger, String, Boolean, DateTime, Date, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime, date
from typing import Optional, List


class Servidor(Base):
    __tablename__ = "servidores"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    usuario_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("usuarios.id"), nullable=True)
    chefia_servidor_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("servidores.id"), nullable=True)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    cpf: Mapped[Optional[str]] = mapped_column(String(14), nullable=True)
    matricula: Mapped[str] = mapped_column(String(50), nullable=False)
    cargo: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    lotacao: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    data_admissao: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    telefone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    atualizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=func.now())

    municipio: Mapped["Municipio"] = relationship("Municipio", back_populates="servidores")
    usuario: Mapped[Optional["Usuario"]] = relationship("Usuario", foreign_keys=[usuario_id])
    chefia: Mapped[Optional["Servidor"]] = relationship("Servidor", remote_side="Servidor.id", foreign_keys=[chefia_servidor_id])
    subordinados: Mapped[List["Servidor"]] = relationship("Servidor", foreign_keys=[chefia_servidor_id], back_populates="chefia")
