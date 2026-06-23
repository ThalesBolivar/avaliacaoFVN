from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.modulos.autenticacao.router import router as auth_router
from app.modulos.municipios.router import router as municipios_router
from app.modulos.usuarios.router import router as usuarios_router
from app.modulos.servidores.router import router as servidores_router
from app.modulos.cargos.router import router as cargos_router
from app.modulos.questionarios.router import router as questionarios_router
from app.modulos.periodos.router import router as periodos_router
from app.modulos.avaliacoes.router import router as avaliacoes_router
from app.modulos.dashboard.router import router as dashboard_router
from app.modulos.notificacoes.router import router as notificacoes_router
from app.modulos.logs.router import router as logs_router
from app.modulos.documentos.router import router as documentos_router
from app.modulos.funcoes_usuario.router import router as funcoes_usuario_router
from app.modulos.niveis_cargo.router import router as niveis_cargo_router
from app.modulos.lotacoes.router import router as lotacoes_router
from app.modulos.chamados.router import router as chamados_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Sistema de Avaliação de Desempenho",
    description="API para avaliação de desempenho de servidores públicos — multi-município",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(municipios_router, prefix=API_PREFIX)
app.include_router(usuarios_router, prefix=API_PREFIX)
app.include_router(servidores_router, prefix=API_PREFIX)
app.include_router(cargos_router, prefix=API_PREFIX)
app.include_router(questionarios_router, prefix=API_PREFIX)
app.include_router(periodos_router, prefix=API_PREFIX)
app.include_router(avaliacoes_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(notificacoes_router, prefix=API_PREFIX)
app.include_router(logs_router, prefix=API_PREFIX)
app.include_router(documentos_router, prefix=API_PREFIX)
app.include_router(funcoes_usuario_router, prefix=API_PREFIX)
app.include_router(niveis_cargo_router, prefix=API_PREFIX)
app.include_router(lotacoes_router, prefix=API_PREFIX)
app.include_router(chamados_router, prefix=API_PREFIX)


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0", "environment": settings.ENVIRONMENT}
