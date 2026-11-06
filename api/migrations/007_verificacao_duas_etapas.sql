-- Migração 007: verificação em duas etapas (MFA) por e-mail para administradores.
-- Depois da senha certa, a API envia um código de 6 dígitos por e-mail e entrega ao
-- navegador um "desafio" (valor aleatório). Aqui ficam só o hash do desafio e um HMAC do código.

CREATE TABLE IF NOT EXISTS desafios_mfa (
  id            BIGSERIAL    PRIMARY KEY,
  usuario_id    INTEGER      NOT NULL REFERENCES usuarios(id),
  desafio_hash  CHAR(64)     NOT NULL UNIQUE,
  codigo_hash   CHAR(64)     NOT NULL,
  tentativas    SMALLINT     NOT NULL DEFAULT 0,  -- códigos errados digitados
  envios        SMALLINT     NOT NULL DEFAULT 1,  -- e-mails enviados (o primeiro + reenvios)
  enviado_em    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expira_em     TIMESTAMPTZ  NOT NULL,
  usado_em      TIMESTAMPTZ,                      -- usado ou encerrado (erros demais, senha trocada...)
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ip            VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS desafios_mfa_usuario ON desafios_mfa (usuario_id, criado_em);
