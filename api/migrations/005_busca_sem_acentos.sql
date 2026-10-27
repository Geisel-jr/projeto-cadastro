-- Migração 005: busca que ignora acentos ("pao" encontra "Pão") nas listagens.
CREATE EXTENSION IF NOT EXISTS unaccent;
