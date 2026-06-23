-- ============================================================================
-- TABELA niveis_cargo + conversão de cargos.nivel de ENUM para VARCHAR
-- ----------------------------------------------------------------------------
-- Permite cadastrar e gerenciar os níveis de cargo dinamicamente,
-- em vez de depender de um ENUM fixo no banco de dados.
-- ============================================================================

START TRANSACTION;

-- 1) Cria tabela de níveis de cargo (global, gerenciada pelo SUPER_ADMIN)
CREATE TABLE IF NOT EXISTS niveis_cargo (
    id        BIGINT PRIMARY KEY AUTO_INCREMENT,
    nome      VARCHAR(50) NOT NULL UNIQUE COMMENT 'Chave interna (ex: FUNDAMENTAL)',
    label     VARCHAR(100) NOT NULL COMMENT 'Nome exibido na interface',
    descricao TEXT NULL,
    ordem     INT NOT NULL DEFAULT 0,
    ativo     BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2) Insere os 4 níveis existentes como padrão
INSERT IGNORE INTO niveis_cargo (nome, label, descricao, ordem) VALUES
    ('FUNDAMENTAL', 'Ensino Fundamental', 'Cargos que exigem escolaridade de nível fundamental', 1),
    ('MEDIO',       'Ensino Médio',       'Cargos que exigem escolaridade de nível médio',       2),
    ('SUPERIOR',    'Ensino Superior',    'Cargos que exigem escolaridade de nível superior',    3),
    ('COMISSAO',    'Cargo em Comissão',  'Cargos de livre nomeação e exoneração',               4);

-- 3) Converte cargos.nivel de ENUM para VARCHAR mantendo os dados existentes
ALTER TABLE cargos MODIFY COLUMN nivel VARCHAR(50) NOT NULL;

COMMIT;
