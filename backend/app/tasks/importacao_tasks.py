from app.celery_app import celery_app


@celery_app.task(name="app.tasks.importacao_tasks.processar_importacao", queue="importacao")
def processar_importacao(lote_id: int) -> dict:
    return {"status": "ok", "lote_id": lote_id}
