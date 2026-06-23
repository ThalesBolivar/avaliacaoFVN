-- Tabela de chamados: solicitações de cadastro feitas por admins de município
-- (ex.: cargo/lotação inexistente durante a importação de servidores).
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
