const express = require('express');
const { validar } = require('./validacoes');
const { paraSnake, linhaParaObjeto, emTransacao, registrarAuditoria, ErroHttp } = require('./util');

// Cria as rotas de um cadastro (empresas ou pessoas):
//
//   GET    /                  lista (ativos, ou ?status=excluidos)
//   GET    /:id               detalhe
//   GET    /:id/historico     histórico de auditoria do registro
//   POST   /                  cria
//   PUT    /:id               edita
//   DELETE /:id               exclusão lógica (soft delete), exige motivo
//   POST   /:id/restaurar     desfaz a exclusão
//
// Toda alteração grava, na mesma transação, uma linha na tabela "auditoria".
function rotasCadastro({ pool, tabela, regras, consulta, verificar }) {
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

  const lerId = (req) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ErroHttp(400, 'ID inválido.');
    return id;
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
    const { rows } = await pool.query(
      `${consulta} WHERE t.excluido_em IS ${excluidos ? 'NOT NULL ORDER BY t.excluido_em' : 'NULL ORDER BY t.id'} DESC`
    );
    res.json(rows.map(linhaParaObjeto));
  });

  router.get('/:id', async (req, res) => {
    res.json(await buscarOuFalhar(pool, lerId(req)));
  });

  router.get('/:id/historico', async (req, res) => {
    const { rows } = await pool.query(
      'SELECT * FROM auditoria WHERE entidade = $1 AND registro_id = $2 ORDER BY data DESC, id DESC',
      [tabela, lerId(req)]
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
    const id = lerId(req);
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
    const id = lerId(req);
    const motivo = String(req.body?.motivo ?? '').trim();
    if (motivo.length < 3) {
      throw new ErroHttp(400, 'Informe o motivo da exclusão.', { motivo: 'Informe o motivo da exclusão (mínimo 3 caracteres).' });
    }

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
    const id = lerId(req);

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
