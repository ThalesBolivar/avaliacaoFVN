CREATE DATABASE IF NOT EXISTS sistema_avaliacao
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE sistema_avaliacao;

-- ============================================================
-- MUNICÍPIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS municipios (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    nome          VARCHAR(150) NOT NULL,
    identificador VARCHAR(100) NOT NULL UNIQUE,
    estado        VARCHAR(2) NOT NULL DEFAULT 'MG',
    logo_url      VARCHAR(500) NULL,
    cor_primaria  VARCHAR(7) NULL DEFAULT '#1a56db',
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- USUÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id                       BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id             BIGINT NOT NULL,
    servidor_id              BIGINT NULL,
    funcao_usuario_id        BIGINT NULL,
    nome                     VARCHAR(150) NOT NULL,
    email                    VARCHAR(150) NOT NULL,
    senha_hash               VARCHAR(255) NOT NULL,
    perfil                   ENUM('SUPER_ADMIN','ADMINISTRADOR','SERVIDOR','CHEFIA','SUBCOMISSAO') NOT NULL,
    ativo                    BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_login_em          DATETIME NULL,
    token_recuperacao        VARCHAR(255) NULL,
    token_recuperacao_expira DATETIME NULL,
    criado_em                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em            DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    UNIQUE KEY uk_usuarios_email_municipio (email, municipio_id)
);

-- ============================================================
-- SERVIDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS servidores (
    id                 BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id       BIGINT NOT NULL,
    usuario_id         BIGINT NULL,
    chefia_servidor_id BIGINT NULL,
    matricula_chefia   VARCHAR(50) NULL,
    nome_chefia        VARCHAR(150) NULL,
    nome               VARCHAR(150) NOT NULL,
    cpf                VARCHAR(14) NULL,
    matricula          VARCHAR(50) NOT NULL,
    grau_instrucao     VARCHAR(100) NULL,
    situacao_grau_instrucao VARCHAR(100) NULL,
    data_nascimento    DATE NULL,
    vinculo            VARCHAR(100) NULL,
    cargo              VARCHAR(150) NULL,
    cargo_id           BIGINT NULL,
    lotacao            VARCHAR(150) NULL,
    data_admissao      DATE NULL,
    email              VARCHAR(150) NULL,
    telefone           VARCHAR(30) NULL,
    ativo              BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_servidores_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_servidores_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT fk_servidores_chefia FOREIGN KEY (chefia_servidor_id) REFERENCES servidores(id),
    UNIQUE KEY uk_servidor_matricula_municipio (matricula, municipio_id),
    UNIQUE KEY uk_servidor_cpf_municipio (cpf, municipio_id)
);

ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_servidor FOREIGN KEY (servidor_id) REFERENCES servidores(id);

-- ============================================================
-- FUNÇÕES DE USUÁRIO
-- ============================================================
CREATE TABLE IF NOT EXISTS funcoes_usuario (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id  BIGINT NOT NULL,
    nome          VARCHAR(150) NOT NULL,
    perfil_base   ENUM('ADMINISTRADOR','CHEFIA','SUBCOMISSAO') NOT NULL,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_funcoes_usuario_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    UNIQUE KEY uk_funcao_usuario_nome_municipio (nome, municipio_id)
);

ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_funcao_usuario FOREIGN KEY (funcao_usuario_id) REFERENCES funcoes_usuario(id);

-- ============================================================
-- CATEGORIAS DE AVALIAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias_avaliacao (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id BIGINT NOT NULL,
    nome         VARCHAR(150) NOT NULL,
    descricao    TEXT NULL,
    ordem        INT NOT NULL DEFAULT 0,
    ativo        BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_categorias_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id)
);

-- ============================================================
-- MODELOS DE AVALIAÇÃO (QUESTIONÁRIOS)
-- ============================================================
CREATE TABLE IF NOT EXISTS modelos_avaliacao (
    id                     BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id           BIGINT NOT NULL,
    nome                   VARCHAR(200) NOT NULL,
    descricao              TEXT NULL,
    versao                 INT NOT NULL DEFAULT 1,
    status                 ENUM('RASCUNHO','PUBLICADO','ARQUIVADO') NOT NULL DEFAULT 'RASCUNHO',
    para_autoavaliacao     BOOLEAN NOT NULL DEFAULT TRUE,
    para_superior_imediato BOOLEAN NOT NULL DEFAULT TRUE,
    para_subcomissao       BOOLEAN NOT NULL DEFAULT TRUE,
    pontuacao_maxima       DECIMAL(8,2) NULL,
    publicado_em           DATETIME NULL,
    criado_por_id          BIGINT NULL,
    criado_em              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em          DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_modelos_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_modelos_criador FOREIGN KEY (criado_por_id) REFERENCES usuarios(id)
);

-- ============================================================
-- CARGOS (CATÁLOGO) + PESOS DE QUESTÃO POR CARGO
-- Catálogo de cargos do município. servidores.cargo_id aponta para cá.
-- O campo texto servidores.cargo é mantido só para exibição/compatibilidade.
-- ============================================================
CREATE TABLE IF NOT EXISTS cargos (
    id                     BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id           BIGINT NOT NULL,
    nome                   VARCHAR(150) NOT NULL,
    nivel                  ENUM('FUNDAMENTAL','MEDIO','SUPERIOR','COMISSAO') NOT NULL,
    modelo_avaliacao_id    BIGINT NULL,
    pontuacao_maxima       DECIMAL(6,2) NOT NULL DEFAULT 100.00,
    pontos_min_estagio     DECIMAL(6,2) NULL,
    pontos_min_progressao  DECIMAL(6,2) NULL,
    ativo                  BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_cargos_municipio_nome UNIQUE (municipio_id, nome),
    CONSTRAINT fk_cargos_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_cargos_modelo    FOREIGN KEY (modelo_avaliacao_id) REFERENCES modelos_avaliacao(id)
);

CREATE TABLE IF NOT EXISTS pesos_questao_cargo (
    id               BIGINT PRIMARY KEY AUTO_INCREMENT,
    cargo_id         BIGINT NOT NULL,
    numero_pergunta  INT NOT NULL,
    peso             DECIMAL(4,2) NOT NULL,
    CONSTRAINT uk_peso_cargo_questao UNIQUE (cargo_id, numero_pergunta),
    CONSTRAINT fk_peso_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE CASCADE
);

ALTER TABLE servidores
    ADD CONSTRAINT fk_servidores_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id);

-- ============================================================
-- PERGUNTAS DO QUESTIONÁRIO
-- ============================================================
CREATE TABLE IF NOT EXISTS perguntas_avaliacao (
    id                   BIGINT PRIMARY KEY AUTO_INCREMENT,
    modelo_avaliacao_id  BIGINT NOT NULL,
    categoria_id         BIGINT NULL,
    criterio             VARCHAR(150) NOT NULL,
    numero_pergunta      INT NOT NULL,
    texto_pergunta       TEXT NOT NULL,
    tipo_resposta        ENUM('MULTIPLA_ESCOLHA','ESCALA_1_5','SIM_NAO','TEXTO_LIVRE') NOT NULL DEFAULT 'MULTIPLA_ESCOLHA',
    peso                 DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    obrigatoria          BOOLEAN NOT NULL DEFAULT TRUE,
    apenas_autoavaliacao BOOLEAN NOT NULL DEFAULT FALSE,
    apenas_superior      BOOLEAN NOT NULL DEFAULT FALSE,
    apenas_subcomissao   BOOLEAN NOT NULL DEFAULT FALSE,
    ativa                BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_perguntas_modelo    FOREIGN KEY (modelo_avaliacao_id) REFERENCES modelos_avaliacao(id),
    CONSTRAINT fk_perguntas_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_avaliacao(id)
);

-- ============================================================
-- OPÇÕES DAS PERGUNTAS (A, B, C, D)
-- ============================================================
CREATE TABLE IF NOT EXISTS opcoes_pergunta_avaliacao (
    id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
    pergunta_avaliacao_id BIGINT NOT NULL,
    letra_opcao           ENUM('A','B','C','D','E') NOT NULL,
    texto_opcao           TEXT NOT NULL,
    pontuacao             DECIMAL(5,2) NULL,
    criado_em             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_opcoes_pergunta FOREIGN KEY (pergunta_avaliacao_id) REFERENCES perguntas_avaliacao(id),
    UNIQUE KEY uk_pergunta_opcao (pergunta_avaliacao_id, letra_opcao)
);

-- ============================================================
-- PERÍODOS DE AVALIAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS periodos_avaliacao (
    id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id        BIGINT NOT NULL,
    nome                VARCHAR(150) NOT NULL,
    data_inicio         DATE NOT NULL,
    data_fim            DATE NOT NULL,
    modelo_avaliacao_id BIGINT NULL,
    status              ENUM('PLANEJADO','ATIVO','ENCERRADO') NOT NULL DEFAULT 'PLANEJADO',
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em       DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_periodos_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_periodos_modelo    FOREIGN KEY (modelo_avaliacao_id) REFERENCES modelos_avaliacao(id)
);

-- ============================================================
-- VÍNCULOS DE AVALIAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS vinculos_avaliacao (
    id                   BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id         BIGINT NOT NULL,
    periodo_avaliacao_id BIGINT NOT NULL,
    modelo_avaliacao_id  BIGINT NOT NULL,
    servidor_avaliado_id BIGINT NOT NULL,
    chefia_servidor_id   BIGINT NULL,
    status               ENUM('PENDENTE','EM_ANDAMENTO','FINALIZADA','CANCELADA') NOT NULL DEFAULT 'PENDENTE',
    criado_em            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em        DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_vinculos_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_vinculos_periodo   FOREIGN KEY (periodo_avaliacao_id) REFERENCES periodos_avaliacao(id),
    CONSTRAINT fk_vinculos_modelo    FOREIGN KEY (modelo_avaliacao_id) REFERENCES modelos_avaliacao(id),
    CONSTRAINT fk_vinculos_servidor  FOREIGN KEY (servidor_avaliado_id) REFERENCES servidores(id),
    CONSTRAINT fk_vinculos_chefia    FOREIGN KEY (chefia_servidor_id) REFERENCES servidores(id)
);

-- ============================================================
-- FORMULÁRIOS DE AVALIAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS formularios_avaliacao (
    id                   BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id         BIGINT NOT NULL,
    vinculo_avaliacao_id BIGINT NOT NULL,
    tipo_avaliacao       ENUM('AUTOAVALIACAO','SUPERIOR_IMEDIATO','SUBCOMISSAO') NOT NULL,
    usuario_avaliador_id BIGINT NOT NULL,
    servidor_avaliado_id BIGINT NOT NULL,
    status               ENUM('PENDENTE','EM_ANDAMENTO','FINALIZADA','CANCELADA') NOT NULL DEFAULT 'PENDENTE',
    ativo                CHAR(1) NOT NULL DEFAULT 'S',
    observacoes          TEXT NULL,
    sugestoes_melhoria   TEXT NULL,
    uso_alcool_drogas    BOOLEAN NULL,
    pontuacao_total      DECIMAL(8,2) NULL,
    iniciado_em          DATETIME NULL,
    finalizado_em        DATETIME NULL,
    criado_em            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em        DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_formularios_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_formularios_vinculo   FOREIGN KEY (vinculo_avaliacao_id) REFERENCES vinculos_avaliacao(id),
    CONSTRAINT fk_formularios_avaliador FOREIGN KEY (usuario_avaliador_id) REFERENCES usuarios(id),
    CONSTRAINT fk_formularios_servidor  FOREIGN KEY (servidor_avaliado_id) REFERENCES servidores(id),
    UNIQUE KEY uk_vinculo_tipo (vinculo_avaliacao_id, tipo_avaliacao)
);

-- ============================================================
-- RESPOSTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS respostas_avaliacao (
    id                      BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id            BIGINT NOT NULL,
    formulario_avaliacao_id BIGINT NOT NULL,
    pergunta_avaliacao_id   BIGINT NOT NULL,
    opcao_selecionada       ENUM('A','B','C','D','E') NULL,
    resposta_numerica       DECIMAL(4,2) NULL,
    resposta_texto          TEXT NULL,
    pontuacao_obtida        DECIMAL(5,2) NULL,
    criado_em               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em           DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_respostas_municipio  FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_respostas_formulario FOREIGN KEY (formulario_avaliacao_id) REFERENCES formularios_avaliacao(id),
    CONSTRAINT fk_respostas_pergunta   FOREIGN KEY (pergunta_avaliacao_id) REFERENCES perguntas_avaliacao(id),
    UNIQUE KEY uk_resposta_formulario_pergunta (formulario_avaliacao_id, pergunta_avaliacao_id)
);

-- ============================================================
-- LOTES E LINHAS DE IMPORTAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS lotes_importacao (
    id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id          BIGINT NOT NULL,
    usuario_importador_id BIGINT NOT NULL,
    nome_arquivo          VARCHAR(255) NOT NULL,
    total_registros       INT NOT NULL DEFAULT 0,
    registros_validos     INT NOT NULL DEFAULT 0,
    registros_invalidos   INT NOT NULL DEFAULT 0,
    status                ENUM('PROCESSANDO','FINALIZADO','ERRO') NOT NULL DEFAULT 'PROCESSANDO',
    mensagem_erro         TEXT NULL,
    criado_em             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalizado_em         DATETIME NULL,
    CONSTRAINT fk_lotes_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_lotes_usuario   FOREIGN KEY (usuario_importador_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS linhas_importacao (
    id                 BIGINT PRIMARY KEY AUTO_INCREMENT,
    lote_importacao_id BIGINT NOT NULL,
    numero_linha       INT NOT NULL,
    dados_originais    JSON NOT NULL,
    status             ENUM('VALIDO','INVALIDO','IMPORTADO') NOT NULL DEFAULT 'VALIDO',
    mensagem_erro      TEXT NULL,
    criado_em          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_linhas_lote FOREIGN KEY (lote_importacao_id) REFERENCES lotes_importacao(id)
);

-- ============================================================
-- CHAMADOS (solicitações de cadastro — ex.: cargo/lotação inexistente)
-- ============================================================
CREATE TABLE IF NOT EXISTS chamados (
    id                 BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id       BIGINT NOT NULL,
    usuario_id         BIGINT NOT NULL,
    tipo               ENUM('CARGO','LOTACAO','OUTRO') NOT NULL,
    valor_solicitado   VARCHAR(255) NOT NULL,
    descricao          TEXT NULL,
    status             ENUM('ABERTO','RESOLVIDO','REJEITADO') NOT NULL DEFAULT 'ABERTO',
    lote_importacao_id BIGINT NULL,
    criado_em          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolvido_em       DATETIME NULL,
    CONSTRAINT fk_chamados_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_chamados_usuario   FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT fk_chamados_lote      FOREIGN KEY (lote_importacao_id) REFERENCES lotes_importacao(id)
);

-- ============================================================
-- DOCUMENTOS GERADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS documentos_gerados (
    id                      BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id            BIGINT NOT NULL,
    formulario_avaliacao_id BIGINT NULL,
    servidor_id             BIGINT NULL,
    usuario_gerador_id      BIGINT NULL,
    tipo_documento          ENUM('PDF_AVALIACAO','RELATORIO','EXPORTACAO_EXCEL') NOT NULL,
    nome_arquivo            VARCHAR(255) NOT NULL,
    caminho_arquivo         VARCHAR(500) NULL,
    tamanho_bytes           BIGINT NULL,
    criado_em               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_documentos_municipio  FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_documentos_formulario FOREIGN KEY (formulario_avaliacao_id) REFERENCES formularios_avaliacao(id),
    CONSTRAINT fk_documentos_servidor   FOREIGN KEY (servidor_id) REFERENCES servidores(id),
    CONSTRAINT fk_documentos_usuario    FOREIGN KEY (usuario_gerador_id) REFERENCES usuarios(id)
);

-- ============================================================
-- NOTIFICAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS notificacoes (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id BIGINT NOT NULL,
    usuario_id   BIGINT NOT NULL,
    tipo         VARCHAR(100) NOT NULL,
    titulo       VARCHAR(255) NOT NULL,
    mensagem     TEXT NOT NULL,
    lida         BOOLEAN NOT NULL DEFAULT FALSE,
    lida_em      DATETIME NULL,
    dados_extras JSON NULL,
    criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_notif_usuario   FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    INDEX idx_notif_usuario (usuario_id, lida)
);

-- ============================================================
-- LOGS DE AUDITORIA
-- ============================================================
CREATE TABLE IF NOT EXISTS logs_sistema (
    id             BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id   BIGINT NOT NULL,
    usuario_id     BIGINT NULL,
    nome_usuario   VARCHAR(150) NULL,
    perfil_usuario VARCHAR(50) NULL,
    acao           VARCHAR(100) NOT NULL,
    entidade       VARCHAR(100) NOT NULL,
    entidade_id    VARCHAR(100) NULL,
    descricao      TEXT NULL,
    dados_antes    JSON NULL,
    dados_depois   JSON NULL,
    endereco_ip    VARCHAR(50) NULL,
    navegador      TEXT NULL,
    criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_logs_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT fk_logs_usuario   FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    INDEX idx_logs_municipio_acao (municipio_id, acao),
    INDEX idx_logs_criado (criado_em)
);

-- ============================================================
-- DADOS INICIAIS
-- ============================================================
INSERT INTO municipios (nome, identificador, estado) VALUES
('Mariana', 'mariana', 'MG'),
('Brumadinho', 'brumadinho', 'MG');

-- Categorias iniciais para Mariana (id=1)
INSERT INTO categorias_avaliacao (municipio_id, nome, ordem) VALUES
(1, 'Conduta Funcional', 1),
(1, 'Capacidade Técnica', 2),
(1, 'Relacionamento Interpessoal', 3),
(1, 'Produtividade', 4);

-- Categorias iniciais para Brumadinho (id=2)
INSERT INTO categorias_avaliacao (municipio_id, nome, ordem) VALUES
(2, 'Conduta Funcional', 1),
(2, 'Capacidade Técnica', 2),
(2, 'Relacionamento Interpessoal', 3),
(2, 'Produtividade', 4);

-- Super Admin (senha: Admin@123 — TROCAR EM PRODUÇÃO)
-- Hash bcrypt gerado com cost 12
INSERT INTO usuarios (municipio_id, nome, email, senha_hash, perfil) VALUES
(1, 'Super Administrador', 'superadmin@sistema.com',
 '$2b$12$5ERnTmfbH/S.LtFHJXEhyuFtVBklFp8e2R0Ma0C6k6DsUd4o9APF6', 'SUPER_ADMIN');
