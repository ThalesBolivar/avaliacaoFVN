# Sistema de Avaliação de Desempenho v2.0

Plataforma web multi-município para avaliação de desempenho de servidores públicos.

## Requisitos

- Docker 24+
- Docker Compose v2

## Como rodar (desenvolvimento)

```bash
# 1. Clone e entre no diretório
cd sistema-avaliacao

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env e defina senhas seguras + SECRET_KEY

# Gerar SECRET_KEY:
openssl rand -hex 32

# 3. Suba todos os serviços
docker compose up -d

# 4. Aguarde o MySQL iniciar (~30s) e acesse:
# Frontend:  http://localhost:5173
# Backend:   http://localhost:8000/docs
# MinIO:     http://localhost:9001
```

## Login inicial

| Campo     | Valor                     |
|-----------|---------------------------|
| Município | Mariana                   |
| E-mail    | superadmin@sistema.com    |
| Senha     | Admin@123                 |

> **Importante:** Troque a senha do superadmin logo após o primeiro acesso!

## Estrutura

```
sistema-avaliacao/
├── backend/          # FastAPI + SQLAlchemy + Celery
│   ├── app/
│   │   ├── models/   # SQLAlchemy models (16 tabelas)
│   │   ├── schemas/  # Pydantic v2 schemas
│   │   ├── core/     # Security, deps, audit
│   │   └── modulos/  # Routers por domínio
│   └── alembic/      # Migrations
├── frontend/         # React 18 + TypeScript + Vite + Tailwind
│   └── src/
│       ├── pages/    # Todas as telas
│       ├── services/ # Chamadas à API
│       └── store/    # Zustand state
├── database/
│   └── init.sql      # Schema completo + dados iniciais
└── nginx/
    └── nginx.conf    # Proxy reverso
```

## Perfis de acesso

| Perfil       | Acesso                                    |
|--------------|-------------------------------------------|
| SUPER_ADMIN  | Tudo — gerencia municípios e admins       |
| ADMINISTRADOR| Seu município — servidores, questionários |
| CHEFIA       | Avaliações dos seus subordinados          |
| SUBCOMISSAO  | Avaliações institucionais                 |
| SERVIDOR     | Autoavaliação e histórico próprio         |

## Módulos implementados

- **Autenticação** — JWT + refresh token + Redis + rate limiting
- **Municípios** — CRUD (Super Admin)
- **Servidores** — CRUD + importação XLSX
- **Questionários** — Builder completo com drag-and-drop, categorias, pesos, publicação, clone
- **Períodos** — Criar, ativar, encerrar, gerar vínculos
- **Avaliações** — Iniciar, salvar rascunho, finalizar, calcular pontuação ponderada
- **Dashboard** — Estatísticas por município e por servidor
- **Documentos** — Geração de PDF das avaliações
- **Notificações** — Sistema in-app com contador
- **Logs** — Auditoria completa de todas as ações

## Comandos úteis

```bash
# Ver logs
docker compose logs -f backend

# Rodar migrations (quando houver alterações no schema)
docker compose exec backend alembic upgrade head

# Acessar o banco
docker compose exec mysql mysql -u root -p sistema_avaliacao

# Rebuild após mudanças
docker compose up -d --build backend
```
