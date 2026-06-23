from sqlalchemy import BigInteger, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.questionario import ModeloAvaliacao
    from app.models.funcao_usuario import FuncaoUsuario


class ModeloAvaliacaoFuncao(Base):
    __tablename__ = "modelo_avaliacao_funcao"
    __table_args__ = (UniqueConstraint("modelo_avaliacao_id", "funcao_usuario_id", name="uq_modelo_funcao"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    modelo_avaliacao_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("modelos_avaliacao.id", ondelete="CASCADE"), nullable=False)
    funcao_usuario_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("funcoes_usuario.id"), nullable=False)

    modelo: Mapped["ModeloAvaliacao"] = relationship("ModeloAvaliacao", back_populates="funcoes_vinculadas")
    funcao: Mapped["FuncaoUsuario"] = relationship("FuncaoUsuario")
