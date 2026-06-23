-- ============================================================================
-- CORREÇÃO DE NOMES CORROMPIDOS NA TABELA CARGOS
-- ----------------------------------------------------------------------------
-- Ajusta registros já gravados com texto mojibake, causados por importação
-- anterior com codificação incorreta.
--
-- Como rodar:
--   mysql -u USUARIO -p BANCO < 2026-06-19_corrigir_nomes_cargos.sql
-- ============================================================================

START TRANSACTION;

UPDATE cargos
SET nome = CONVERT(BINARY(CONVERT(nome USING latin1)) USING utf8mb4)
WHERE nome REGEXP 'Ã|Â|â';

-- Mantém o texto legado de servidores sincronizado com o catálogo corrigido.
UPDATE servidores s
JOIN cargos c ON c.id = s.cargo_id
SET s.cargo = c.nome
WHERE s.cargo_id IS NOT NULL;

COMMIT;
