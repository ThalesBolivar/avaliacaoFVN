from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notificacao import Notificacao


async def criar_notificacao(
    db: AsyncSession,
    *,
    municipio_id: int,
    usuario_id: int,
    tipo: str,
    titulo: str,
    mensagem: str,
    dados_extras: dict | None = None,
) -> Notificacao:
    notificacao = Notificacao(
        municipio_id=municipio_id,
        usuario_id=usuario_id,
        tipo=tipo,
        titulo=titulo,
        mensagem=mensagem,
        dados_extras=dados_extras,
    )
    db.add(notificacao)
    await db.flush()
    return notificacao
