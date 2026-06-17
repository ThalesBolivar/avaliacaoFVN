from celery import Celery
from app.config import settings

celery_app = Celery(
    "sistema_avaliacao",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.pdf_tasks",
        "app.tasks.importacao_tasks",
        "app.tasks.notificacao_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,
    task_routes={
        "app.tasks.pdf_tasks.*": {"queue": "pdf"},
        "app.tasks.importacao_tasks.*": {"queue": "importacao"},
        "app.tasks.notificacao_tasks.*": {"queue": "default"},
    },
    task_soft_time_limit=300,
    task_time_limit=600,
)
