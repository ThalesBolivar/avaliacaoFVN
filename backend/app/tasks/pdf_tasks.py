from app.celery_app import celery_app


@celery_app.task(name="app.tasks.pdf_tasks.gerar_pdf_avaliacao", queue="pdf")
def gerar_pdf_avaliacao(formulario_id: int, municipio_id: int) -> dict:
    return {"status": "ok", "formulario_id": formulario_id}
