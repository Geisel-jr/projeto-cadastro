-- Migração 006: recuperação de senha por e-mail.
-- O link enviado contém um código aleatório; aqui fica só o hash SHA-256 dele.

CREATE TABLE IF NOT EXISTS redefinicoes_senha (
  id          BIGSERIAL    PRIMARY KEY,
  usuario_id  INTEGER      NOT NULL REFERENCES usuarios(id),
  token_hash  CHAR(64)     NOT NULL UNIQUE,
  expira_em   TIMESTAMPTZ  NOT NULL,
  usado_em    TIMESTAMPTZ,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ip          VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS redefinicoes_usuario ON redefinicoes_senha (usuario_id);

ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS auditoria_acao_check;
ALTER TABLE auditoria ADD CONSTRAINT auditoria_acao_check CHECK (acao IN (
  'CRIAR', 'EDITAR', 'EXCLUIR', 'RESTAURAR',
  'ANEXAR', 'REMOVER_ANEXO', 'RESTAURAR_ANEXO',
  'LOGIN', 'LOGOUT', 'LOGIN_FALHOU', 'TROCAR_SENHA', 'REDEFINIR_SENHA',
  'PEDIDO_RECUPERACAO', 'RECUPERAR_SENHA'
));
