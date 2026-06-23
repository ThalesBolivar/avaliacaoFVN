from sqlalchemy import BigInteger, String, Boolean, DateTime, Numeric, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import Optional, List


class Cargo(Base):
    __tablename__ = "cargos"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    nivel_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("niveis_cargo.id"), nullable=False)
    modelo_avaliacao_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("modelos_avaliacao.id"), nullable=True
    )
    pontuacao_maxima: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=100.00)
    pontos_min_estagio: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    pontos_min_progressao: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    municipio: Mapped["Municipio"] = relationship("Municipio")
    nivel: Mapped["NivelCargo"] = relationship("NivelCargo")
    modelo_avaliacao: Mapped[Optional["ModeloAvaliacao"]] = relationship("ModeloAvaliacao")
    pesos: Mapped[List["PesoQuestaoCargo"]] = relationship(
        "PesoQuestaoCargo", back_populates="cargo", cascade="all, delete-orphan",
        order_by="PesoQuestaoCargo.numero_pergunta",
    )


class PesoQuestaoCargo(Base):
    __tablename__ = "pesos_questao_cargo"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cargo_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cargos.id", ondelete="CASCADE"), nullable=False)
    numero_pergunta: Mapped[int] = mapped_column(Integer, nullable=False)
    peso: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)

    cargo: Mapped["Cargo"] = relationship("Cargo", back_populates="pesos")
