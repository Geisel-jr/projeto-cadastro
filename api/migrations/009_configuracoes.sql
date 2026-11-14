-- Migração 009: configurações geradas pelo próprio sistema.
-- Hoje guarda só o segredo dos tokens (jwt_secret) quando o .env não define JWT_SECRET:
-- ele é criado na primeira subida e reaproveitado depois, para as sessões não caírem a cada reinício.

CREATE TABLE IF NOT EXISTS configuracoes (
  chave      VARCHAR(50)  PRIMARY KEY,
  valor      TEXT         NOT NULL,
  criado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
