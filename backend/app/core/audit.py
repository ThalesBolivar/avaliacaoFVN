from sqlalchemy.ext.asyncio import AsyncSession
from app.models.log import LogSistema
from app.models.usuario import Usuario
from typing import Optional, Any


async def log_event(
    db: AsyncSession,
    municipio_id: int,
    acao: str,
    entidade: str,
    usuario: Optional[Usuario] = None,
    entidade_id: Optional[str] = None,
    descricao: Optional[str] = None,
    dados_antes: Optional[dict] = None,
    dados_depois: Optional[dict] = None,
    endereco_ip: Optional[str] = None,
    navegador: Optional[str] = None,
) -> None:
    log = LogSistema(
        municipio_id=municipio_id,
        usuario_id=usuario.id if usuario else None,
        nome_usuario=usuario.nome if usuario else None,
        perfil_usuario=usuario.perfil.value if usuario else None,
        acao=acao,
        entidade=entidade,
        entidade_id=str(entidade_id) if entidade_id else None,
        descricao=descricao,
        dados_antes=dados_antes,
        dados_depois=dados_depois,
        endereco_ip=endereco_ip,
        navegador=navegador,
    )
    db.add(log)


# Constantes de eventos de auditoria
class Acoes:
    LOGIN_REALIZADO = "LOGIN_REALIZADO"
    LOGIN_INVALIDO = "LOGIN_INVALIDO"
    LOGOUT_REALIZADO = "LOGOUT_REALIZADO"
    USUARIO_CRIADO = "USUARIO_CRIADO"
    USUARIO_ALTERADO = "USUARIO_ALTERADO"
    USUARIO_DESATIVADO = "USUARIO_DESATIVADO"
    SERVIDOR_CRIADO = "SERVIDOR_CRIADO"
    SERVIDOR_ALTERADO = "SERVIDOR_ALTERADO"
    PLANILHA_IMPORTADA = "PLANILHA_IMPORTADA"
    QUESTIONARIO_CRIADO = "QUESTIONARIO_CRIADO"
    QUESTIONARIO_ALTERADO = "QUESTIONARIO_ALTERADO"
    QUESTIONARIO_PUBLICADO = "QUESTIONARIO_PUBLICADO"
    QUESTIONARIO_CLONADO = "QUESTIONARIO_CLONADO"
    QUESTIONARIO_ARQUIVADO = "QUESTIONARIO_ARQUIVADO"
    PERIODO_CRIADO = "PERIODO_CRIADO"
    PERIODO_ATIVADO = "PERIODO_ATIVADO"
    PERIODO_ENCERRADO = "PERIODO_ENCERRADO"
    AVALIACAO_INICIADA = "AVALIACAO_INICIADA"
    AVALIACAO_SALVA = "AVALIACAO_SALVA"
    AVALIACAO_FINALIZADA = "AVALIACAO_FINALIZADA"
    AVALIACAO_EXCLUIDA = "AVALIACAO_EXCLUIDA"
    PDF_GERADO = "PDF_GERADO"
    PDF_BAIXADO = "PDF_BAIXADO"
    RELATORIO_EXPORTADO = "RELATORIO_EXPORTADO"
