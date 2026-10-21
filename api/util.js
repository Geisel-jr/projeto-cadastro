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

// Grava uma ação na tabela de auditoria (deve rodar dentro da mesma transação da alteração).
// Quem fez vem do usuário autenticado (req.usuario / req.usuarioId), salvo quando informado.
const registrarAuditoria = (db, req, {
  entidade, registroId, acao, antes = null, depois = null, motivo = null,
  usuario = req.usuario, usuarioId = req.usuarioId ?? null,
}) =>
  db.query(
    `INSERT INTO auditoria (entidade, registro_id, acao, usuario, usuario_id, ip, dados_anteriores, dados_novos, motivo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [entidade, registroId, acao, usuario, usuarioId, req.ipOrigem,
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

// ID numérico vindo da URL (ex: req.params.id)
function lerId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErroHttp(400, 'ID inválido.');
  return id;
}

// Motivo obrigatório de exclusões e remoções (3 a 500 caracteres)
function lerMotivo(corpo) {
  const motivo = String(corpo?.motivo ?? '').trim();
  if (motivo.length < 3) throw new ErroHttp(400, 'Informe o motivo.', { motivo: 'Informe o motivo (mínimo 3 caracteres).' });
  if (motivo.length > 500) throw new ErroHttp(400, 'Motivo muito longo.', { motivo: 'Máximo de 500 caracteres.' });
  return motivo;
}

module.exports = { paraSnake, linhaParaObjeto, emTransacao, registrarAuditoria, lerId, lerMotivo, ErroHttp };
