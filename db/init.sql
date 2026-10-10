-- Script executado automaticamente pelo container do PostgreSQL na primeira vez que ele sobe.
-- Documentos (CPF, CNPJ, CEP, telefone) são armazenados apenas com números.

CREATE TABLE IF NOT EXISTS empresas (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(150) NOT NULL,
  cnpj       VARCHAR(14)  NOT NULL UNIQUE,
  email      VARCHAR(150) NOT NULL,
  telefone   VARCHAR(11)  NOT NULL,
  cep        VARCHAR(8)   NOT NULL,
  endereco   VARCHAR(200),
  cidade     VARCHAR(100),
  estado     CHAR(2),
  criado_em  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pessoas (
  id               SERIAL PRIMARY KEY,
  nome             VARCHAR(150) NOT NULL,
  cpf              VARCHAR(11)  NOT NULL UNIQUE,
  email            VARCHAR(150) NOT NULL,
  telefone         VARCHAR(11)  NOT NULL,
  data_nascimento  DATE         NOT NULL,
  profissao        VARCHAR(100) NOT NULL,
  criado_em        TIMESTAMP    NOT NULL DEFAULT NOW()
);
