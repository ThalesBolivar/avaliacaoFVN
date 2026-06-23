-- ============================================================================
-- TABELA lotacoes + migração de servidores.lotacao (VARCHAR) para lotacao_id (FK)
-- ============================================================================

START TRANSACTION;

-- 1) Cria tabela de lotações (por município)
CREATE TABLE IF NOT EXISTS lotacoes (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    municipio_id BIGINT NOT NULL,
    nome        VARCHAR(150) NOT NULL,
    descricao   TEXT NULL,
    ordem       INT NOT NULL DEFAULT 0,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_lotacoes_municipio_nome UNIQUE (municipio_id, nome),
    CONSTRAINT fk_lotacoes_municipio FOREIGN KEY (municipio_id) REFERENCES municipios(id)
);

-- 2) Importa todos os valores existentes como lotações iniciais
INSERT IGNORE INTO lotacoes (municipio_id, nome)
SELECT DISTINCT municipio_id, TRIM(lotacao)
FROM servidores
WHERE lotacao IS NOT NULL AND TRIM(lotacao) != '';

-- 3) Adiciona coluna FK (nullable — servidor pode não ter lotação)
ALTER TABLE servidores ADD COLUMN lotacao_id BIGINT NULL AFTER lotacao;

-- 4) Backfill: liga pelo valor texto atual
UPDATE servidores s
  JOIN lotacoes l ON l.municipio_id = s.municipio_id AND l.nome = TRIM(s.lotacao)
SET s.lotacao_id = l.id
WHERE s.lotacao IS NOT NULL AND TRIM(s.lotacao) != '';

-- 5) Adiciona FK
ALTER TABLE servidores
  ADD CONSTRAINT fk_servidores_lotacao FOREIGN KEY (lotacao_id) REFERENCES lotacoes(id);

-- 6) Remove coluna texto antiga
ALTER TABLE servidores DROP COLUMN lotacao;

COMMIT;
