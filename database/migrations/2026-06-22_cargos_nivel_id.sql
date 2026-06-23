-- ============================================================================
-- Migra cargos.nivel (VARCHAR) para cargos.nivel_id (FK -> niveis_cargo.id)
-- ============================================================================
-- PRÉ-REQUISITO: já ter rodado 2026-06-22_niveis_cargo.sql
-- ============================================================================

START TRANSACTION;

-- 1) Adiciona a nova coluna (nullable por enquanto para o backfill)
ALTER TABLE cargos ADD COLUMN nivel_id BIGINT NULL AFTER nivel;

-- 2) Preenche nivel_id baseado no valor texto atual de nivel
UPDATE cargos c
  JOIN niveis_cargo n ON n.nome = c.nivel
SET c.nivel_id = n.id;

-- 3) Torna NOT NULL (todos os registros devem ter sido preenchidos)
ALTER TABLE cargos MODIFY COLUMN nivel_id BIGINT NOT NULL;

-- 4) Adiciona FK
ALTER TABLE cargos
  ADD CONSTRAINT fk_cargos_nivel FOREIGN KEY (nivel_id) REFERENCES niveis_cargo(id);

-- 5) Remove a coluna texto antiga
ALTER TABLE cargos DROP COLUMN nivel;

COMMIT;
