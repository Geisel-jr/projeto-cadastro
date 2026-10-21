-- Migração 004: usuários, sessões (refresh tokens) e eventos de acesso na auditoria.

CREATE TABLE IF NOT EXISTS usuarios (
  id                 SERIAL       PRIMARY KEY,
  nome               VARCHAR(100) NOT NULL,
  email              VARCHAR(150) NOT NULL,
  senha_hash         TEXT,                          -- nulo = acesso só pelo Google
  google_id          VARCHAR(64)  UNIQUE,           -- "sub" do token do Google
  foto_url           TEXT,
  papel              VARCHAR(20)  NOT NULL DEFAULT 'operador' CHECK (papel IN ('admin', 'operador')),
  ativo              BOOLEAN      NOT NULL DEFAULT TRUE,
  deve_trocar_senha  BOOLEAN      NOT NULL DEFAULT FALSE,
  ultimo_login_em    TIMESTAMPTZ,
  criado_em          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  criado_por         VARCHAR(100),
  atualizado_em      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email ON usuarios (LOWER(email));

-- Cada login gera uma sessão. O refresh token nunca é guardado: só o hash SHA-256 dele.
-- A cada renovação a sessão é revogada e substituída por outra (rotação).
CREATE TABLE IF NOT EXISTS sessoes (
  id               BIGSERIAL    PRIMARY KEY,
  usuario_id       INTEGER      NOT NULL REFERENCES usuarios(id),
  token_hash       CHAR(64)     NOT NULL UNIQUE,
  expira_em        TIMESTAMPTZ  NOT NULL,
  criado_em        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revogado_em      TIMESTAMPTZ,
  substituida_por  BIGINT,
  ip               VARCHAR(45),
  user_agent       VARCHAR(300)
);

CREATE INDEX IF NOT EXISTS sessoes_usuario ON sessoes (usuario_id);

-- A auditoria passa a guardar também o id de quem fez a ação (o nome pode mudar)
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS usuario_id INTEGER;

ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS auditoria_acao_check;
ALTER TABLE auditoria ADD CONSTRAINT auditoria_acao_check CHECK (acao IN (
  'CRIAR', 'EDITAR', 'EXCLUIR', 'RESTAURAR',
  'ANEXAR', 'REMOVER_ANEXO', 'RESTAURAR_ANEXO',
  'LOGIN', 'LOGOUT', 'LOGIN_FALHOU', 'TROCAR_SENHA', 'REDEFINIR_SENHA'
));
