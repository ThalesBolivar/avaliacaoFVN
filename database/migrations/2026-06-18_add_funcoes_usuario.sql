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
    ADD COLUMN funcao_usuario_id BIGINT NULL AFTER servidor_id,
    ADD CONSTRAINT fk_usuarios_funcao_usuario FOREIGN KEY (funcao_usuario_id) REFERENCES funcoes_usuario(id);
