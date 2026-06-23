-- ============================================================================
-- TABELA DE PESOS POR CARGO  (LC 193/2019 - PCCV SAAE)
-- ----------------------------------------------------------------------------
-- Cria o catálogo de CARGOS e o PESO de cada questão por cargo, para ponderar
-- as respostas da avaliação conforme o cargo do servidor avaliado.
--
-- Modelo de dados:
--   cargos                -> 1 linha por cargo (nivel, questionário aplicável, limites)
--   pesos_questao_cargo   -> peso de cada questão (numero_pergunta) para o cargo
--   servidores.cargo_id   -> (bloco opcional no fim) amarra o servidor ao cargo
--
-- Soma dos pesos de cada cargo = 50  ->  pontuação máxima = 100 (50 x grau máximo 2).
-- Banco: MySQL.  Como rodar:  mysql -u USUARIO -p BANCO < pesos_avaliacao_por_cargo.sql
-- ============================================================================

-- Município: Mariana (resolvido pelo identificador — robusto para multi-município)
SET @municipio_id = (SELECT id FROM municipios WHERE identificador = 'mariana' LIMIT 1);

-- ---------------------------------------------------------------------------
-- 1) Estrutura
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cargos (
    id                     BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id           BIGINT NOT NULL,
    nome                   VARCHAR(150) NOT NULL,
    nivel                  ENUM('FUNDAMENTAL','MEDIO','SUPERIOR','COMISSAO') NOT NULL,
    modelo_avaliacao_id    BIGINT NULL,
    pontuacao_maxima       DECIMAL(6,2) NOT NULL DEFAULT 100.00,
    pontos_min_estagio     DECIMAL(6,2) NULL,   -- mínimo p/ estágio probatório (60)
    pontos_min_progressao  DECIMAL(6,2) NULL,   -- mínimo p/ progressão (70)
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

-- ---------------------------------------------------------------------------
-- 2) Dados: cargos + pesos por questão
--    O modelo_avaliacao_id é resolvido pelo nome do questionário do nível
--    (use o MAX/mais recente). Se o questionário ainda não existir, fica NULL.
-- ---------------------------------------------------------------------------
START TRANSACTION;

-- BIÓLOGO (SUPERIOR)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'BIÓLOGO', 'SUPERIOR',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Superior' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,1.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,2.00),
  (@cargo_id,11,3.00),(@cargo_id,12,2.00),(@cargo_id,13,2.00),(@cargo_id,14,2.00),(@cargo_id,15,2.00),
  (@cargo_id,16,3.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,3.00),(@cargo_id,20,2.00);

-- ENGENHEIRO (SUPERIOR)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'ENGENHEIRO', 'SUPERIOR',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Superior' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,1.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,2.00),
  (@cargo_id,11,3.00),(@cargo_id,12,2.00),(@cargo_id,13,2.00),(@cargo_id,14,2.00),(@cargo_id,15,2.00),
  (@cargo_id,16,3.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,3.00),(@cargo_id,20,2.00);

-- QUÍMICO (SUPERIOR)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'QUÍMICO', 'SUPERIOR',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Superior' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,1.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,2.00),
  (@cargo_id,11,3.00),(@cargo_id,12,2.00),(@cargo_id,13,2.00),(@cargo_id,14,2.00),(@cargo_id,15,2.00),
  (@cargo_id,16,3.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,3.00),(@cargo_id,20,2.00);

-- AGENTE ADMINISTRATIVO (MEDIO)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'AGENTE ADMINISTRATIVO', 'MEDIO',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Médio' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,2.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,2.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,3.00),
  (@cargo_id,11,3.00),(@cargo_id,12,2.00),(@cargo_id,13,2.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,3.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,2.00);

-- AUXILIAR ADMINISTRATIVO (MEDIO)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'AUXILIAR ADMINISTRATIVO', 'MEDIO',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Médio' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,2.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,2.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,3.00),
  (@cargo_id,11,3.00),(@cargo_id,12,2.00),(@cargo_id,13,2.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,3.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,2.00);

-- FISCAL (MEDIO)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'FISCAL', 'MEDIO',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Médio' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,2.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,2.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,3.00),
  (@cargo_id,11,2.00),(@cargo_id,12,3.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,2.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,2.00);

-- TÉCNICO EM EDIFICAÇÕES (MEDIO)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'TÉCNICO EM EDIFICAÇÕES', 'MEDIO',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Médio' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,2.00),(@cargo_id,3,2.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,2.00),
  (@cargo_id,11,2.00),(@cargo_id,12,3.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,2.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,3.00);

-- TÉCNICO EM ELETROMECÂNICA (MEDIO)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'TÉCNICO EM ELETROMECÂNICA', 'MEDIO',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Médio' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,2.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,2.00),
  (@cargo_id,11,2.00),(@cargo_id,12,2.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,2.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,3.00);

-- TÉCNICO EM LABORATÓRIO (MEDIO)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'TÉCNICO EM LABORATÓRIO', 'MEDIO',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Médio' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,2.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,2.00),
  (@cargo_id,11,2.00),(@cargo_id,12,2.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,2.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,3.00);

-- TÉCNICO OPERACIONAL DE ETA/ETE (MEDIO)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'TÉCNICO OPERACIONAL DE ETA/ETE', 'MEDIO',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Médio' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,2.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,2.00),
  (@cargo_id,11,2.00),(@cargo_id,12,2.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,2.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,3.00);

-- TÉCNICO EM SEGURANÇA DO TRABALHO (MEDIO)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'TÉCNICO EM SEGURANÇA DO TRABALHO', 'MEDIO',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Médio' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,2.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,2.00),
  (@cargo_id,11,2.00),(@cargo_id,12,2.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,2.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,3.00);

-- TÉCNICO QUÍMICO (MEDIO)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'TÉCNICO QUÍMICO', 'MEDIO',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Médio' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,2.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,2.00),
  (@cargo_id,11,2.00),(@cargo_id,12,2.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,2.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,3.00);

-- AJUDANTE DE SANEAMENTO (FUNDAMENTAL)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'AJUDANTE DE SANEAMENTO', 'FUNDAMENTAL',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Fundamental' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,3.00),
  (@cargo_id,11,3.00),(@cargo_id,12,3.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,2.00),(@cargo_id,17,3.00);

-- CALCETEIRO (FUNDAMENTAL)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'CALCETEIRO', 'FUNDAMENTAL',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Fundamental' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,3.00),
  (@cargo_id,11,2.00),(@cargo_id,12,3.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,3.00),(@cargo_id,17,3.00);

-- ENCANADOR (FUNDAMENTAL)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'ENCANADOR', 'FUNDAMENTAL',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Fundamental' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,3.00),
  (@cargo_id,11,3.00),(@cargo_id,12,3.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,2.00),(@cargo_id,17,3.00);

-- MOTORISTA (FUNDAMENTAL)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'MOTORISTA', 'FUNDAMENTAL',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Fundamental' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,3.00),
  (@cargo_id,11,3.00),(@cargo_id,12,3.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,3.00),(@cargo_id,17,2.00);

-- OPERADOR DE MÁQUINAS PESADAS (FUNDAMENTAL)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'OPERADOR DE MÁQUINAS PESADAS', 'FUNDAMENTAL',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Fundamental' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,3.00),
  (@cargo_id,11,3.00),(@cargo_id,12,3.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,3.00),(@cargo_id,17,2.00);

-- PEDREIRO (FUNDAMENTAL)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'PEDREIRO', 'FUNDAMENTAL',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Fundamental' ORDER BY id DESC LIMIT 1) m),
        100.00, 60.00, 70.00);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,3.00),(@cargo_id,2,3.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,3.00),
  (@cargo_id,11,3.00),(@cargo_id,12,3.00),(@cargo_id,13,3.00),(@cargo_id,14,3.00),(@cargo_id,15,3.00),
  (@cargo_id,16,3.00),(@cargo_id,17,2.00);

-- CARGOS EM COMISSÃO (COMISSAO)
INSERT INTO cargos (municipio_id, nome, nivel, modelo_avaliacao_id, pontuacao_maxima, pontos_min_estagio, pontos_min_progressao)
VALUES (@municipio_id,
        'CARGOS EM COMISSÃO', 'COMISSAO',
        (SELECT id FROM (SELECT id FROM modelos_avaliacao WHERE municipio_id=@municipio_id AND nome='Avaliação de Desempenho - Nível Superior' ORDER BY id DESC LIMIT 1) m),
        100.00, NULL, NULL);
SET @cargo_id := LAST_INSERT_ID();
INSERT INTO pesos_questao_cargo (cargo_id, numero_pergunta, peso) VALUES
  (@cargo_id,1,2.00),(@cargo_id,2,2.00),(@cargo_id,3,3.00),(@cargo_id,4,3.00),(@cargo_id,5,3.00),
  (@cargo_id,6,3.00),(@cargo_id,7,3.00),(@cargo_id,8,3.00),(@cargo_id,9,3.00),(@cargo_id,10,2.00),
  (@cargo_id,11,3.00),(@cargo_id,12,2.00),(@cargo_id,13,2.00),(@cargo_id,14,2.00),(@cargo_id,15,2.00),
  (@cargo_id,16,3.00),(@cargo_id,17,2.00),(@cargo_id,18,2.00),(@cargo_id,19,3.00),(@cargo_id,20,2.00);

COMMIT;

-- ---------------------------------------------------------------------------
-- 3) Amarração do servidor ao cargo (servidores.cargo_id)
--    Liga cada servidor ao catálogo de cargos. O campo texto `cargo` é mantido
--    para compatibilidade/exibição, mas a fonte de verdade passa a ser cargo_id.
-- ---------------------------------------------------------------------------
ALTER TABLE servidores
  ADD COLUMN cargo_id BIGINT NULL AFTER cargo,
  ADD CONSTRAINT fk_servidores_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id);

-- Backfill: liga pelo texto do campo 'cargo' que já existe no cadastro do servidor
-- (casa por nome ignorando maiúsculas/minúsculas e espaços nas pontas)
UPDATE servidores s
  JOIN cargos c ON c.municipio_id = s.municipio_id
               AND UPPER(TRIM(s.cargo)) = UPPER(TRIM(c.nome))
  SET s.cargo_id = c.id
WHERE s.cargo_id IS NULL;

-- Conferência:
--   SELECT c.nome, c.nivel, COUNT(p.id) AS qtd_pesos, SUM(p.peso) AS soma_pesos
--     FROM cargos c LEFT JOIN pesos_questao_cargo p ON p.cargo_id=c.id
--    GROUP BY c.id ORDER BY c.nivel, c.nome;  -- soma_pesos deve ser 50 em todos
