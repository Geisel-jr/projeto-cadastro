// Funções auxiliares usadas em toda a API.

// "nomeFantasia" -> "nome_fantasia"
const paraSnake = (texto) => texto.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);

// "nome_fantasia" -> "nomeFantasia"
const paraCamel = (texto) => texto.replace(/_([a-z])/g, (_, letra) => letra.toUpperCase());

// Converte uma linha do banco (snake_case) em objeto da API (camelCase)
const linhaParaObjeto = (linha) =>
  Object.fromEntries(Object.entries(linha).map(([chave, valor]) => [paraCamel(chave), valor]));

// Executa várias queries como uma única operação: ou tudo é salvo, ou nada é.
async function emTransacao(pool, funcao) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await funcao(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

// Grava uma ação na tabela de auditoria (deve rodar dentro da mesma transação da alteração)
const registrarAuditoria = (db, req, { entidade, registroId, acao, antes = null, depois = null, motivo = null }) =>
  db.query(
    `INSERT INTO auditoria (entidade, registro_id, acao, usuario, ip, dados_anteriores, dados_novos, motivo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [entidade, registroId, acao, req.usuario, req.ipOrigem,
      antes && JSON.stringify(antes), depois && JSON.stringify(depois), motivo]
  );

// Erro com status HTTP, tratado pelo middleware de erros do server.js
class ErroHttp extends Error {
  constructor(status, mensagem, erros) {
    super(mensagem);
    this.status = status;
    this.erros = erros;
  }
}

module.exports = { paraSnake, paraCamel, linhaParaObjeto, emTransacao, registrarAuditoria, ErroHttp };
