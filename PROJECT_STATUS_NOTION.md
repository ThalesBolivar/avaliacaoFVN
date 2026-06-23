# Sistema de Avaliacao Funcional - Painel do Projeto

## Visao geral

Projeto de plataforma web multi-municipio para avaliacao de desempenho de servidores publicos.

Objetivo principal:
- centralizar o ciclo de avaliacao funcional
- permitir gestao por municipio
- organizar questionarios, periodos, formularios, pontuacao e historico
- dar visibilidade para administradores, chefias, subcomissao e servidores

## Stack e base tecnica

Backend:
- FastAPI
- SQLAlchemy assincorno
- Pydantic
- Celery
- Redis
- MySQL

Frontend:
- React 18
- TypeScript
- Vite
- Tailwind
- React Query
- Zustand

Infra:
- Docker Compose
- Nginx
- MinIO

## Bases do sistema

Bases ja estruturadas no projeto:
- autenticacao com JWT, refresh token e controle de acesso por perfil
- arquitetura separada em frontend, backend, banco e infraestrutura
- roteamento por modulo no backend
- paginas organizadas por area no frontend
- inicializacao completa via Docker Compose
- banco com script inicial e migrations complementares
- suporte a multi-municipio
- auditoria e logs de acoes
- notificacoes in-app
- geracao de documentos PDF

Perfis previstos:
- SUPER_ADMIN
- ADMINISTRADOR
- CHEFIA
- SUBCOMISSAO
- SERVIDOR

## O que ja foi feito

### Estrutura principal entregue
- login e controle de sessao
- dashboard principal
- cadastro e gestao de municipios
- cadastro e gestao de servidores
- cadastro e gestao de usuarios
- cadastro e gestao de periodos de avaliacao
- cadastro e gestao de questionarios
- logs administrativos

### Fluxo de avaliacao entregue
- listagem de avaliacoes pendentes
- listagem de minhas avaliacoes
- tela para preencher avaliacao
- salvamento parcial de respostas
- finalizacao de avaliacao
- calculo de pontuacao ponderada
- visualizacao de avaliacoes recebidas pelo servidor
- visualizacao da minha subcomissao

### Regras de negocio ja implementadas
- criacao de vinculos por periodo de avaliacao
- geracao de formularios por tipo de avaliacao
- suporte a autoavaliacao
- suporte a avaliacao por chefia imediata
- suporte a avaliacao por subcomissao
- bloqueio para subcomissao nao avaliar seus proprios membros
- publicacao, clonagem, preview e arquivamento de questionarios
- categorias e opcoes para perguntas
- pesos por pergunta e peso por cargo
- notificacoes quando avaliacoes sao liberadas ou finalizadas
- encerramento de formularios pendentes ao arquivar questionarios

### Avancos recentes identificados no codigo
- modulo de cargos
- modulo de funcoes de usuario
- relacao servidor x funcao
- relacao modelo de avaliacao x funcao
- cadastro unificado de usuarios e vinculos
- seeds de questionarios por nivel de escolaridade
- migrations para ajustes de cargos, funcoes e textos

## Em andamento

Pelo estado atual do repositorio, estas frentes parecem estar em desenvolvimento agora:
- refinamento do fluxo de autenticacao
- ajustes em dashboard e indicadores
- revisao das telas de questionarios
- revisao da tela de periodos
- evolucao das telas de servidores e usuarios
- consolidacao do cadastro unificado
- consolidacao das regras de cargos e funcoes
- ajustes de modelos, schemas e dados iniciais

Arquivos alterados indicam trabalho recente em:
- backend de autenticacao, avaliacoes, dashboard, documentos, periodos, questionarios, servidores e usuarios
- frontend de login, dashboard, questionarios, periodos, servidores, usuarios e preenchimento de avaliacoes
- banco inicial, migrations e seeds

## O que ainda precisa ser feito

### Prioridade alta
- criar testes automatizados de backend
- criar testes automatizados de frontend
- validar fluxo ponta a ponta dos perfis principais
- revisar tratamento de erros e mensagens amigaveis na interface
- validar regras de permissao para todos os perfis
- validar consistencia entre dados legados e novo modelo de funcoes/cargos
- fechar fluxos de cadastro unificado para evitar inconsistencias operacionais

### Prioridade media
- melhorar observabilidade com logs mais rastreaveis por fluxo
- revisar performance de consultas com joins e carregamentos relacionais
- padronizar estados e feedbacks visuais nas telas
- revisar responsividade das telas administrativas
- documentar regras de negocio por modulo
- documentar processo de publicacao de questionarios e abertura de periodos

### Prioridade baixa
- melhorar experiencia de uso do dashboard
- criar atalhos e filtros mais completos nas listagens
- ampliar exportacoes e relatorios
- criar historico mais detalhado por servidor e por periodo
- criar indicadores de produtividade e andamento por funcao

## Melhorias sugeridas

### Produto
- criar pagina de acompanhamento do ciclo de avaliacao por periodo
- mostrar gargalos por chefia, subcomissao e setor
- permitir reabertura controlada de avaliacao
- permitir aprovacao ou homologacao final do ciclo
- criar timeline do servidor com historico de avaliacoes

### Tecnico
- adicionar suite de testes com cobertura minima por modulo critico
- adicionar validacoes de integridade em services e schemas
- revisar pontos com possiveis consultas repetidas no backend
- criar camada mais clara para regras de negocio compartilhadas
- separar melhor comandos administrativos de leitura
- padronizar migrations e seeds por contexto funcional

### Operacional
- criar checklist de implantacao por municipio
- criar usuarios e dados demo por ambiente
- criar documento de suporte para administradores
- criar procedimento de backup e restauracao
- definir rotina de versionamento dos questionarios

## Pendencias e riscos atuais

- nao foram encontrados testes automatizados alem do arquivo inicial em `backend/tests`
- ha muitas alteracoes locais ainda nao commitadas, entao parte do escopo esta em consolidacao
- o historico de commits visivel esta muito curto, o que dificulta rastrear entregas anteriores
- o projeto parece ter mistura de evolucao funcional com ajustes estruturais, entao vale separar backlog tecnico de backlog de produto

## Proximo plano sugerido

### Sprint de consolidacao
- finalizar cadastro unificado de usuarios, funcoes e vinculos
- estabilizar cargos, pesos e relacoes com modelos de avaliacao
- validar fluxos de periodos ativos e geracao de formularios
- revisar dashboards e indicadores principais

### Sprint de qualidade
- adicionar testes criticos de autenticacao, periodos, questionarios e avaliacoes
- revisar mensagens de erro e UX
- validar banco com cenarios reais de municipio

### Sprint de evolucao
- relatorios gerenciais
- homologacao final do ciclo
- historico consolidado por servidor
- melhorias de performance e monitoramento

## Modelo de acompanhamento sugerido no Notion

Status geral do projeto:
- Em desenvolvimento

Campos recomendados:
- modulo
- status
- prioridade
- responsavel
- observacoes

Quadros recomendados:
- A fazer
- Em andamento
- Concluido
- Melhorias
- Debitos tecnicos

## Resumo executivo

O projeto ja tem uma base forte e varias entregas importantes funcionando, principalmente no nucleo de autenticacao, cadastro, questionarios, periodos e avaliacoes. O foco agora deveria ser consolidar as novas regras de cargos e funcoes, estabilizar os fluxos administrativos e elevar a confiabilidade com testes, documentacao e revisao fina da experiencia de uso.
