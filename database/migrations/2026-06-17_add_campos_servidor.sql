ALTER TABLE servidores
    ADD COLUMN grau_instrucao VARCHAR(100) NULL AFTER matricula,
    ADD COLUMN situacao_grau_instrucao VARCHAR(100) NULL AFTER grau_instrucao,
    ADD COLUMN data_nascimento DATE NULL AFTER situacao_grau_instrucao,
    ADD COLUMN vinculo VARCHAR(100) NULL AFTER data_nascimento;
