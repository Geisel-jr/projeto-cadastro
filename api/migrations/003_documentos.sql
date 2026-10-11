-- Migração 003: documentos anexados às empresas.
-- O arquivo fica no storage (MinIO); aqui guardamos os dados dele e onde está ("objeto").

CREATE TABLE IF NOT EXISTS documentos (
  id               SERIAL       PRIMARY KEY,
  empresa_id       INTEGER      NOT NULL REFERENCES empresas(id),
  tipo             VARCHAR(80)  NOT NULL,
  descricao        VARCHAR(150),
  validade         DATE,
  nome_arquivo     VARCHAR(255) NOT NULL,
  objeto           VARCHAR(400) NOT NULL UNIQUE,
  content_type     VARCHAR(150) NOT NULL,
  tamanho          BIGINT       NOT NULL,
  criado_em        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  criado_por       VARCHAR(100) NOT NULL,
  excluido_em      TIMESTAMPTZ,
  excluido_por     VARCHAR(100),
  motivo_exclusao  TEXT
);

CREATE INDEX IF NOT EXISTS documentos_empresa ON documentos (empresa_id);

-- Novas ações de auditoria para os anexos
ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS auditoria_acao_check;
ALTER TABLE auditoria ADD CONSTRAINT auditoria_acao_check
  CHECK (acao IN ('CRIAR', 'EDITAR', 'EXCLUIR', 'RESTAURAR', 'ANEXAR', 'REMOVER_ANEXO', 'RESTAURAR_ANEXO'));
