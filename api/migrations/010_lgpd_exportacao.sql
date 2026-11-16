-- Migração 010: novas ações na auditoria.
-- VISUALIZAR: alguém abriu os dados completos de uma pessoa (a lista mostra o CPF mascarado). LGPD.
-- EXPORTAR: alguém baixou uma lista em planilha (CSV), levando os dados para fora do sistema.

ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS auditoria_acao_check;
ALTER TABLE auditoria ADD CONSTRAINT auditoria_acao_check CHECK (acao IN (
  'CRIAR', 'EDITAR', 'EXCLUIR', 'RESTAURAR',
  'ANEXAR', 'REMOVER_ANEXO', 'RESTAURAR_ANEXO',
  'LOGIN', 'LOGOUT', 'LOGIN_FALHOU', 'TROCAR_SENHA', 'REDEFINIR_SENHA',
  'PEDIDO_RECUPERACAO', 'RECUPERAR_SENHA',
  'VISUALIZAR', 'EXPORTAR'
));

-- Para conferir rápido se a mesma pessoa já abriu o registro nos últimos minutos
CREATE INDEX IF NOT EXISTS auditoria_leituras ON auditoria (entidade, registro_id, usuario_id, data)
  WHERE acao = 'VISUALIZAR';
