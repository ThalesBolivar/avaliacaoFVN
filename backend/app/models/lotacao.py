from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import Optional


class Lotacao(Base):
    __tablename__ = "lotacoes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    municipio: Mapped["Municipio"] = relationship("Municipio")
