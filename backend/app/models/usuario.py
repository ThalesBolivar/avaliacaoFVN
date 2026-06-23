from sqlalchemy import BigInteger, String, Boolean, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import Optional
import enum


class PerfilEnum(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMINISTRADOR = "ADMINISTRADOR"
    SERVIDOR = "SERVIDOR"
    CHEFIA = "CHEFIA"
    SUBCOMISSAO = "SUBCOMISSAO"


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    servidor_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("servidores.id"), nullable=True)
    funcao_usuario_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("funcoes_usuario.id"), nullable=True)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    perfil: Mapped[PerfilEnum] = mapped_column(Enum(PerfilEnum), nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ultimo_login_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    token_recuperacao: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    token_recuperacao_expira: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    atualizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=func.now())

    municipio: Mapped["Municipio"] = relationship("Municipio", back_populates="usuarios", foreign_keys=[municipio_id])
    servidor: Mapped[Optional["Servidor"]] = relationship("Servidor", foreign_keys=[servidor_id])
    funcao_usuario: Mapped[Optional["FuncaoUsuario"]] = relationship("FuncaoUsuario", back_populates="usuarios", foreign_keys=[funcao_usuario_id])
