const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool, migrar } = require('./db');
const rotasCadastro = require('./cadastros');
const { rotasDocumentos, TIPOS_DOCUMENTO, TIPOS_ARQUIVO, TAMANHO_MAXIMO } = require('./documentos');
const { prepararStorage } = require('./storage');
const { REGRAS_EMPRESA, REGRAS_PESSOA } = require('./validacoes');
const { linhaParaObjeto, ErroHttp } = require('./util');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Identifica quem está fazendo a requisição (usado na auditoria).
// Leituras são livres; qualquer alteração exige o cabeçalho X-Usuario.
app.use('/api', (req, res, next) => {
  req.ipOrigem = (req.get('x-real-ip') || req.ip || '').replace(/^::ffff:/, '');
  if (req.method === 'GET') return next();

  let usuario = '';
  try {
    usuario = decodeURIComponent(req.get('x-usuario') || '').trim();
  } catch {
    // cabeçalho mal formatado: tratado como ausente
  }
  if (!usuario) {
    return res.status(401).json({ error: 'Identifique o operador antes de realizar alterações.' });
  }
  req.usuario = usuario.slice(0, 100);
  next();
});

// Verifica se a API e o banco estão no ar
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'erro', error: 'Banco de dados indisponível.' });
  }
});

// ========== DOCUMENTOS (anexos das empresas) ==========

// Tipos de documento e formatos aceitos, usados pelo front
app.get('/api/documentos/tipos', (req, res) => {
  res.json({
    tipos: TIPOS_DOCUMENTO,
    extensoes: Object.values(TIPOS_ARQUIVO).flat(),
    tamanhoMaximo: TAMANHO_MAXIMO,
  });
});

app.use('/api/empresas/:empresaId/documentos', rotasDocumentos({ pool }));

// ========== CADASTROS ==========

app.use('/api/empresas', rotasCadastro({
  pool,
  tabela: 'empresas',
  regras: REGRAS_EMPRESA,
  // Junto com a empresa vem a quantidade de documentos e se falta o Cartão CNPJ
  consulta: `SELECT t.*,
               (SELECT COUNT(*) FROM documentos d
                 WHERE d.empresa_id = t.id AND d.excluido_em IS NULL)::int AS total_documentos,
               NOT EXISTS (SELECT 1 FROM documentos d
                 WHERE d.empresa_id = t.id AND d.excluido_em IS NULL AND d.tipo = 'Cartão CNPJ') AS falta_cartao_cnpj
             FROM empresas t`,
}));

app.use('/api/pessoas', rotasCadastro({
  pool,
  tabela: 'pessoas',
  regras: REGRAS_PESSOA,
  consulta: `SELECT t.*, COALESCE(e.nome_fantasia, e.nome) AS empresa_nome
             FROM pessoas t LEFT JOIN empresas e ON e.id = t.empresa_id`,
  // A empresa vinculada precisa existir e estar ativa
  verificar: async (db, dados, erros) => {
    if (!dados.empresaId || erros.empresaId) return {};
    const { rowCount } = await db.query(
      'SELECT 1 FROM empresas WHERE id = $1 AND excluido_em IS NULL', [dados.empresaId]
    );
    return rowCount ? {} : { empresaId: 'Empresa não encontrada ou excluída.' };
  },
}));

// ========== AUDITORIA ==========

// Lista as ações registradas, com filtros opcionais e paginação
app.get('/api/auditoria', async (req, res) => {
  const filtros = [];
  const parametros = [];
  const filtrar = (condicao, valor) => {
    parametros.push(valor);
    filtros.push(condicao.replace('?', `$${parametros.length}`));
  };

  if (req.query.entidade) filtrar('entidade = ?', String(req.query.entidade));
  if (req.query.acao) filtrar('acao = ?', String(req.query.acao));
  if (req.query.usuario) filtrar('usuario ILIKE ?', `%${req.query.usuario}%`);

  const limite = Math.min(Number(req.query.limite) || 30, 100);
  const pagina = Math.max(Number(req.query.pagina) || 1, 1);
  parametros.push(limite + 1, (pagina - 1) * limite);

  const { rows } = await pool.query(
    `SELECT * FROM auditoria
     ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
     ORDER BY data DESC, id DESC
     LIMIT $${parametros.length - 1} OFFSET $${parametros.length}`,
    parametros
  );

  res.json({ itens: rows.slice(0, limite).map(linhaParaObjeto), temMais: rows.length > limite });
});

// Números exibidos no painel
app.get('/api/resumo', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM empresas WHERE excluido_em IS NULL)::int     AS empresas,
      (SELECT COUNT(*) FROM empresas WHERE excluido_em IS NOT NULL)::int AS empresas_excluidas,
      (SELECT COUNT(*) FROM pessoas  WHERE excluido_em IS NULL)::int     AS pessoas,
      (SELECT COUNT(*) FROM pessoas  WHERE excluido_em IS NOT NULL)::int AS pessoas_excluidas,
      (SELECT COUNT(*) FROM auditoria WHERE data >= NOW() - INTERVAL '24 hours')::int AS acoes_dia
  `);
  res.json(linhaParaObjeto(rows[0]));
});

// ========== TRATAMENTO DE ERROS ==========

// CPF/CNPJ duplicado: qual campo destacar e qual mensagem mostrar
const DUPLICADOS = {
  empresas_cnpj_ativo: { campo: 'cnpj', mensagem: 'Já existe uma empresa ativa com este CNPJ.' },
  pessoas_cpf_ativo: { campo: 'cpf', mensagem: 'Já existe uma pessoa ativa com este CPF.' },
};

app.use((erro, req, res, next) => {
  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({ error: erro.message, erros: erro.erros });
  }
  if (erro.name === 'MulterError') {
    const mensagem = erro.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que 10 MB.' : 'Envio de arquivo inválido.';
    return res.status(400).json({ error: mensagem, erros: { arquivo: mensagem } });
  }
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido.' });
  }
  if (erro.code === '23505') {
    const duplicado = DUPLICADOS[erro.constraint];
    return res.status(409).json({
      error: duplicado?.mensagem || 'Registro duplicado.',
      erros: duplicado && { [duplicado.campo]: duplicado.mensagem },
    });
  }
  console.error(erro);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

// ========== INICIAR SERVIDOR ==========

const PORT = process.env.PORT || 5000;

migrar()
  .then(prepararStorage)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch((erro) => {
    console.error('❌ Erro ao preparar o banco de dados:', erro.message);
    process.exit(1);
  });
