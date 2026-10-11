-- Migração 002: novos campos dos cadastros, colunas de rastreabilidade,
-- soft delete e tabela de auditoria.

-- ========== EMPRESAS ==========

-- A coluna "endereco" passa a se chamar "logradouro" (o número e o bairro ganham colunas próprias)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'empresas' AND column_name = 'endereco') THEN
    ALTER TABLE empresas RENAME COLUMN endereco TO logradouro;
  END IF;
END $$;

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS nome_fantasia       VARCHAR(150),
  ADD COLUMN IF NOT EXISTS inscricao_estadual  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(20),
  ADD COLUMN IF NOT EXISTS data_abertura       DATE,
  ADD COLUMN IF NOT EXISTS porte               VARCHAR(10),
  ADD COLUMN IF NOT EXISTS ramo_atividade      VARCHAR(150),
  ADD COLUMN IF NOT EXISTS celular             VARCHAR(11),
  ADD COLUMN IF NOT EXISTS site                VARCHAR(200),
  ADD COLUMN IF NOT EXISTS logradouro          VARCHAR(200),
  ADD COLUMN IF NOT EXISTS numero              VARCHAR(10),
  ADD COLUMN IF NOT EXISTS complemento         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bairro              VARCHAR(100),
  ADD COLUMN IF NOT EXISTS observacoes         TEXT,
  ADD COLUMN IF NOT EXISTS criado_em           TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS criado_por          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS atualizado_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atualizado_por      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS excluido_em         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS excluido_por        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS motivo_exclusao     TEXT;

ALTER TABLE empresas ALTER COLUMN criado_em TYPE TIMESTAMPTZ;

-- ========== PESSOAS ==========

ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS nome_social     VARCHAR(150),
  ADD COLUMN IF NOT EXISTS rg              VARCHAR(20),
  ADD COLUMN IF NOT EXISTS orgao_emissor   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS sexo            VARCHAR(30),
  ADD COLUMN IF NOT EXISTS estado_civil    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS celular         VARCHAR(11),
  ADD COLUMN IF NOT EXISTS cep             VARCHAR(8),
  ADD COLUMN IF NOT EXISTS logradouro      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS numero          VARCHAR(10),
  ADD COLUMN IF NOT EXISTS complemento     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bairro          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cidade          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS estado          CHAR(2),
  ADD COLUMN IF NOT EXISTS empresa_id      INTEGER REFERENCES empresas(id),
  ADD COLUMN IF NOT EXISTS cargo           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS observacoes     TEXT,
  ADD COLUMN IF NOT EXISTS criado_em       TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS criado_por      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS atualizado_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atualizado_por  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS excluido_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS excluido_por    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS motivo_exclusao TEXT;

ALTER TABLE pessoas ALTER COLUMN criado_em TYPE TIMESTAMPTZ;

-- ========== DOCUMENTOS ÚNICOS (apenas entre registros ativos) ==========
-- Com soft delete o registro excluído continua no banco; por isso o CPF/CNPJ
-- só precisa ser único entre os registros que NÃO foram excluídos.

ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_cnpj_key;
ALTER TABLE pessoas  DROP CONSTRAINT IF EXISTS pessoas_cpf_key;

CREATE UNIQUE INDEX IF NOT EXISTS empresas_cnpj_ativo ON empresas (cnpj) WHERE excluido_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pessoas_cpf_ativo   ON pessoas  (cpf)  WHERE excluido_em IS NULL;

-- ========== AUDITORIA ==========
-- Guarda quem fez cada ação, quando, de onde e como o registro estava antes e depois.

CREATE TABLE IF NOT EXISTS auditoria (
  id                BIGSERIAL    PRIMARY KEY,
  entidade          VARCHAR(30)  NOT NULL,
  registro_id       INTEGER      NOT NULL,
  acao              VARCHAR(20)  NOT NULL CHECK (acao IN ('CRIAR', 'EDITAR', 'EXCLUIR', 'RESTAURAR')),
  usuario           VARCHAR(100) NOT NULL,
  ip                VARCHAR(45),
  dados_anteriores  JSONB,
  dados_novos       JSONB,
  motivo            TEXT,
  data              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auditoria_registro ON auditoria (entidade, registro_id);
CREATE INDEX IF NOT EXISTS auditoria_data     ON auditoria (data DESC);

-- O histórico de auditoria nunca pode ser alterado nem apagado
CREATE OR REPLACE FUNCTION bloquear_alteracao_auditoria() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registros de auditoria não podem ser alterados ou excluídos.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auditoria_imutavel ON auditoria;
CREATE TRIGGER auditoria_imutavel
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_auditoria();
