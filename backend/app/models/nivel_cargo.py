from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from datetime import datetime
from typing import Optional


class NivelCargo(Base):
    __tablename__ = "niveis_cargo"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
