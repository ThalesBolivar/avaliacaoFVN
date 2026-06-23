-- Armazena a chefia imediata informada na planilha como texto livre.
-- A matrícula da chefia não precisa existir previamente como servidor;
-- quando existir, o vínculo continua sendo refletido em chefia_servidor_id.
ALTER TABLE servidores
    ADD COLUMN matricula_chefia VARCHAR(50) NULL AFTER chefia_servidor_id,
    ADD COLUMN nome_chefia VARCHAR(150) NULL AFTER matricula_chefia;
