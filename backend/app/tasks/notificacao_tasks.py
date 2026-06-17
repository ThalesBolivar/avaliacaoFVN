from app.celery_app import celery_app


@celery_app.task(name="app.tasks.notificacao_tasks.enviar_notificacao", queue="default")
def enviar_notificacao(usuario_id: int, titulo: str, mensagem: str) -> dict:
    return {"status": "ok", "usuario_id": usuario_id}
