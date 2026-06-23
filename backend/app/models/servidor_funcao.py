from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.servidor import Servidor
    from app.models.funcao_usuario import FuncaoUsuario


class ServidorFuncao(Base):
    __tablename__ = "servidor_funcao"
    __table_args__ = (UniqueConstraint("servidor_id", "funcao_usuario_id", name="uq_servidor_funcao"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    servidor_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("servidores.id", ondelete="CASCADE"), nullable=False)
    funcao_usuario_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("funcoes_usuario.id"), nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    servidor: Mapped["Servidor"] = relationship("Servidor", back_populates="funcoes")
    funcao: Mapped["FuncaoUsuario"] = relationship("FuncaoUsuario")
