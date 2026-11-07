-- Migração 008: conta de demonstração.
-- Criada na primeira subida quando o .env não define o primeiro administrador (ADMIN_EMAIL vazio).
-- Enquanto "demo" for verdadeiro, a conta usa a senha pública mostrada na tela de login;
-- qualquer troca de senha desmarca, e a tela deixa de mostrar os dados de acesso.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS demo BOOLEAN NOT NULL DEFAULT FALSE;
