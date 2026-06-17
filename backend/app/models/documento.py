from sqlalchemy import BigInteger, String, Enum, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import Optional
import enum


class TipoDocumentoEnum(str, enum.Enum):
    PDF_AVALIACAO = "PDF_AVALIACAO"
    RELATORIO = "RELATORIO"
    EXPORTACAO_EXCEL = "EXPORTACAO_EXCEL"


class DocumentoGerado(Base):
    __tablename__ = "documentos_gerados"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    municipio_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("municipios.id"), nullable=False)
    formulario_avaliacao_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("formularios_avaliacao.id"), nullable=True)
    servidor_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("servidores.id"), nullable=True)
    usuario_gerador_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("usuarios.id"), nullable=True)
    tipo_documento: Mapped[TipoDocumentoEnum] = mapped_column(Enum(TipoDocumentoEnum), nullable=False)
    nome_arquivo: Mapped[str] = mapped_column(String(255), nullable=False)
    caminho_arquivo: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    tamanho_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
