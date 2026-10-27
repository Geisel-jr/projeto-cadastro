const express = require('express');
const { validar } = require('./validacoes');
const { paraSnake, linhaParaObjeto, emTransacao, registrarAuditoria, lerId, lerMotivo, ErroHttp } = require('./util');

// Cria as rotas de um cadastro (empresas ou pessoas):
//
//   GET    /                  lista paginada (?status=excluidos&q=&pagina=&limite=&ordem=&direcao=)
//   GET    /opcoes            id e nome de todos os ativos (para campos de seleção)
//   GET    /:id               detalhe
//   GET    /:id/historico     histórico de auditoria do registro
//   POST   /                  cria
//   PUT    /:id               edita
//   DELETE /:id               exclusão lógica (soft delete), exige motivo
//   POST   /:id/restaurar     desfaz a exclusão
//
// Toda alteração grava, na mesma transação, uma linha na tabela "auditoria".
// Opções de listagem:
//   busca:     { texto: [colunas comparadas sem acento], digitos: [colunas só com números] }
//   ordenacao: { chave da URL: expressão SQL } — só estas colunas podem ser usadas para ordenar
//   opcoes:    expressões SQL do "nome" devolvido em /opcoes
function rotasCadastro({ pool, tabela, regras, consulta, verificar, busca, ordenacao, opcoes }) {
  const router = express.Router();
  const campos = regras.map((regra) => regra.campo);
  const colunas = campos.map(paraSnake);

  const buscar = async (db, id, bloquear = false) => {
    const { rows } = await db.query(`${consulta} WHERE t.id = $1${bloquear ? ' FOR UPDATE OF t' : ''}`, [id]);
    return rows[0] ? linhaParaObjeto(rows[0]) : null;
  };

  const buscarOuFalhar = async (db, id, bloquear) => {
    const registro = await buscar(db, id, bloquear);
    if (!registro) throw new ErroHttp(404, 'Registro não encontrado.');
    return registro;
  };

  const validarCorpo = async (corpo) => {
    const { dados, erros } = validar(regras, corpo);
    if (verificar) Object.assign(erros, await verificar(pool, dados, erros));
    if (Object.keys(erros).length > 0) throw new ErroHttp(400, 'Verifique os campos destacados.', erros);
    return dados;
  };

  const auditar = (db, req, registroId, acao, dados) =>
    registrarAuditoria(db, req, { entidade: tabela, registroId, acao, ...dados });

  router.get('/', async (req, res) => {
    const excluidos = req.query.status === 'excluidos';
    const limite = Math.min(Math.max(Number(req.query.limite) || 20, 1), 100);
    const condicoes = [`t.excluido_em IS ${excluidos ? 'NOT ' : ''}NULL`];
    const parametros = [];

    // Busca: texto sem acentos em várias colunas; números também nos documentos e telefones
    const termo = String(req.query.q ?? '').trim().slice(0, 100);
    if (termo && busca) {
      parametros.push(`%${termo}%`);
      const posicaoTexto = parametros.length;
      const alternativas = busca.texto.map((coluna) => `unaccent(${coluna}) ILIKE unaccent($${posicaoTexto})`);
      const digitos = termo.replace(/\D/g, '');
      if (digitos.length >= 3 && busca.digitos?.length) {
        parametros.push(`%${digitos}%`);
        const posicaoDigitos = parametros.length;
        alternativas.push(...busca.digitos.map((coluna) => `${coluna} LIKE $${posicaoDigitos}`));
      }
      condicoes.push(`(${alternativas.join(' OR ')})`);
    }
    const onde = `WHERE ${condicoes.join(' AND ')}`;

    // Ordenação só por colunas permitidas (nada da URL entra direto no SQL)
    const padrao = excluidos ? 't.excluido_em DESC' : 't.id DESC';
    const coluna = ordenacao?.[req.query.ordem];
    const direcao = req.query.direcao === 'desc' ? 'DESC' : 'ASC';
    const ordem = coluna ? `${coluna} ${direcao} NULLS LAST, t.id DESC` : padrao;

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM (${consulta} ${onde}) filtrados`, parametros
    );
    const paginas = Math.max(Math.ceil(total / limite), 1);
    const pagina = Math.min(Math.max(Number(req.query.pagina) || 1, 1), paginas);

    const { rows } = await pool.query(
      `${consulta} ${onde} ORDER BY ${ordem} LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
      parametros
    );
    res.json({ itens: rows.map(linhaParaObjeto), total, pagina, paginas, limite });
  });

  // Lista curta (id e nome) de todos os ativos, para campos de seleção em outros formulários
  router.get('/opcoes', async (req, res) => {
    if (!opcoes) throw new ErroHttp(404, 'Não disponível.');
    const { rows } = await pool.query(
      `SELECT t.id, COALESCE(${opcoes.join(', ')}) AS nome FROM ${tabela} t
       WHERE t.excluido_em IS NULL ORDER BY 2`
    );
    res.json(rows);
  });

  router.get('/:id', async (req, res) => {
    res.json(await buscarOuFalhar(pool, lerId(req.params.id)));
  });

  router.get('/:id/historico', async (req, res) => {
    const { rows } = await pool.query(
      'SELECT * FROM auditoria WHERE entidade = $1 AND registro_id = $2 ORDER BY data DESC, id DESC',
      [tabela, lerId(req.params.id)]
    );
    res.json(rows.map(linhaParaObjeto));
  });

  router.post('/', async (req, res) => {
    const dados = await validarCorpo(req.body);

    const registro = await emTransacao(pool, async (db) => {
      const valores = campos.map((campo) => dados[campo]);
      const parametros = valores.map((_, i) => `$${i + 1}`);
      const { rows } = await db.query(
        `INSERT INTO ${tabela} (${colunas.join(', ')}, criado_por)
         VALUES (${parametros.join(', ')}, $${valores.length + 1}) RETURNING id`,
        [...valores, req.usuario]
      );
      const novo = await buscar(db, rows[0].id);
      await auditar(db, req, novo.id, 'CRIAR', { depois: novo });
      return novo;
    });

    res.status(201).json(registro);
  });

  router.put('/:id', async (req, res) => {
    const id = lerId(req.params.id);
    const dados = await validarCorpo(req.body);

    const registro = await emTransacao(pool, async (db) => {
      const antes = await buscarOuFalhar(db, id, true);
      if (antes.excluidoEm) throw new ErroHttp(409, 'Este registro está excluído. Restaure-o antes de editar.');

      // Se nada mudou, não grava nem gera auditoria
      const mudou = campos.some((campo) => String(antes[campo] ?? '') !== String(dados[campo] ?? ''));
      if (!mudou) return antes;

      const atribuicoes = colunas.map((coluna, i) => `${coluna} = $${i + 1}`);
      await db.query(
        `UPDATE ${tabela} SET ${atribuicoes.join(', ')}, atualizado_em = NOW(), atualizado_por = $${campos.length + 1}
         WHERE id = $${campos.length + 2}`,
        [...campos.map((campo) => dados[campo]), req.usuario, id]
      );
      const depois = await buscar(db, id);
      await auditar(db, req, id, 'EDITAR', { antes, depois });
      return depois;
    });

    res.json(registro);
  });

  router.delete('/:id', async (req, res) => {
    const id = lerId(req.params.id);
    const motivo = lerMotivo(req.body);

    const registro = await emTransacao(pool, async (db) => {
      const antes = await buscarOuFalhar(db, id, true);
      if (antes.excluidoEm) throw new ErroHttp(409, 'Este registro já está excluído.');

      await db.query(
        `UPDATE ${tabela} SET excluido_em = NOW(), excluido_por = $1, motivo_exclusao = $2 WHERE id = $3`,
        [req.usuario, motivo, id]
      );
      const depois = await buscar(db, id);
      await auditar(db, req, id, 'EXCLUIR', { antes, depois, motivo });
      return depois;
    });

    res.json(registro);
  });

  router.post('/:id/restaurar', async (req, res) => {
    const id = lerId(req.params.id);

    const registro = await emTransacao(pool, async (db) => {
      const antes = await buscarOuFalhar(db, id, true);
      if (!antes.excluidoEm) throw new ErroHttp(409, 'Este registro não está excluído.');

      await db.query(
        `UPDATE ${tabela} SET excluido_em = NULL, excluido_por = NULL, motivo_exclusao = NULL,
         atualizado_em = NOW(), atualizado_por = $1 WHERE id = $2`,
        [req.usuario, id]
      );
      const depois = await buscar(db, id);
      await auditar(db, req, id, 'RESTAURAR', { antes, depois });
      return depois;
    });

    res.json(registro);
  });

  return router;
}

module.exports = rotasCadastro;
