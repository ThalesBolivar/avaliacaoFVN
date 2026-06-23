from sqlalchemy import BigInteger, String, Boolean, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import List, Optional

from app.models.usuario import PerfilEnum


class FuncaoUsuario(Base):
    __tablename__ = "funcoes_usuario"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    perfil_base: Mapped[PerfilEnum] = mapped_column(Enum(PerfilEnum), nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    atualizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=func.now())

    municipio: Mapped["Municipio"] = relationship("Municipio", back_populates="funcoes_usuario")
    usuarios: Mapped[List["Usuario"]] = relationship("Usuario", back_populates="funcao_usuario")
