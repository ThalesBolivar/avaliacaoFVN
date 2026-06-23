from sqlalchemy import BigInteger, String, Text, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import Optional
import enum


class ChamadoTipo(str, enum.Enum):
    CARGO = "CARGO"
    LOTACAO = "LOTACAO"
    OUTRO = "OUTRO"


class ChamadoStatus(str, enum.Enum):
    ABERTO = "ABERTO"
    RESOLVIDO = "RESOLVIDO"
    REJEITADO = "REJEITADO"


class Chamado(Base):
    """Solicitação de cadastro feita por um admin de município (ex.: cargo ou
    lotação que não existe no banco e foi necessário durante uma importação).
    O super admin consulta e resolve essas solicitações."""

    __tablename__ = "chamados"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    usuario_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("usuarios.id"), nullable=False)
    tipo: Mapped[ChamadoTipo] = mapped_column(Enum(ChamadoTipo), nullable=False)
    valor_solicitado: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ChamadoStatus] = mapped_column(Enum(ChamadoStatus), nullable=False, default=ChamadoStatus.ABERTO)
    lote_importacao_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("lotes_importacao.id"), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    resolvido_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    municipio: Mapped["Municipio"] = relationship("Municipio")
    usuario: Mapped["Usuario"] = relationship("Usuario")
