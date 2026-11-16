const express = require('express');
const { validar } = require('./validacoes');
const { paraSnake, linhaParaObjeto, emTransacao, registrarAuditoria, lerId, lerMotivo, ErroHttp } = require('./util');
const { gerarCsv, COLUNAS_EXCLUSAO } = require('./exportacao');

const LIMITE_EXPORTACAO = 10000; // linhas por planilha

// Cria as rotas de um cadastro (empresas ou pessoas):
//
//   GET    /                  lista paginada (?status=excluidos&q=&pagina=&limite=&ordem=&direcao=)
//   GET    /exportar          a lista filtrada em CSV (planilha), registrada na auditoria
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
//   exportacao:  colunas da planilha ({ campo, titulo, formato }), ver exportacao.js
//   privacidade: { mascarar(registro) } para dados pessoais. A lista vem mascarada e cada
//                abertura do detalhe fica registrada na auditoria (LGPD)
function rotasCadastro({ pool, tabela, regras, consulta, verificar, busca, ordenacao, opcoes, exportacao, privacidade }) {
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

  // Filtro (excluídos e busca) e ordenação vindos da URL. Usado pela lista e pela exportação.
  function filtrarPelaUrl(query) {
    const excluidos = query.status === 'excluidos';
    const condicoes = [`t.excluido_em IS ${excluidos ? 'NOT ' : ''}NULL`];
    const parametros = [];

    // Busca: texto sem acentos em várias colunas; números também nos documentos e telefones
    const termo = String(query.q ?? '').trim().slice(0, 100);
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
    const coluna = ordenacao?.[query.ordem];
    const direcao = query.direcao === 'desc' ? 'DESC' : 'ASC';
    const ordem = coluna ? `${coluna} ${direcao} NULLS LAST, t.id DESC` : padrao;

    return { excluidos, termo, onde, parametros, ordem };
  }

  // Na lista, dados pessoais vão mascarados (LGPD); o completo só no detalhe, que fica registrado
  const paraLista = (linha) => {
    const registro = linhaParaObjeto(linha);
    return privacidade ? privacidade.mascarar(registro) : registro;
  };

  router.get('/', async (req, res) => {
    const limite = Math.min(Math.max(Number(req.query.limite) || 20, 1), 100);
    const { onde, parametros, ordem } = filtrarPelaUrl(req.query);

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM (${consulta} ${onde}) filtrados`, parametros
    );
    const paginas = Math.max(Math.ceil(total / limite), 1);
    const pagina = Math.min(Math.max(Number(req.query.pagina) || 1, 1), paginas);

    const { rows } = await pool.query(
      `${consulta} ${onde} ORDER BY ${ordem} LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
      parametros
    );
    res.json({ itens: rows.map(paraLista), total, pagina, paginas, limite });
  });

  // Planilha (CSV) com tudo o que a lista filtrada mostra, sem paginação. Vai para a auditoria,
  // porque leva os dados completos (inclusive CPF) para fora do sistema.
  router.get('/exportar', async (req, res) => {
    if (!exportacao) throw new ErroHttp(404, 'Não disponível.');
    const { excluidos, termo, onde, parametros, ordem } = filtrarPelaUrl(req.query);
    const { rows } = await pool.query(
      `${consulta} ${onde} ORDER BY ${ordem} LIMIT ${LIMITE_EXPORTACAO}`, parametros
    );
    const colunas = excluidos ? [...exportacao, ...COLUNAS_EXCLUSAO] : exportacao;
    const csv = gerarCsv(colunas, rows.map(linhaParaObjeto));

    await registrarAuditoria(pool, req, {
      entidade: tabela, registroId: 0, acao: 'EXPORTAR',
      depois: { total: rows.length, lista: excluidos ? 'excluidos' : 'ativos', busca: termo || null },
    });
    const hoje = new Date().toISOString().slice(0, 10);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${tabela}${excluidos ? '-excluidos' : ''}-${hoje}.csv"`);
    res.send(csv);
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
    const id = lerId(req.params.id);
    const registro = await buscarOuFalhar(pool, id);
    if (privacidade) await registrarLeitura(req, registro);
    res.json(registro);
  });

  // LGPD: registra quem abriu os dados completos. Uma vez a cada 10 minutos por pessoa e
  // registro, para abrir e fechar o formulário várias vezes não encher a auditoria.
  // Guarda só o nome (para o histórico mostrar de quem eram os dados), nunca o CPF.
  const registrarLeitura = (req, registro) =>
    pool.query(
      `INSERT INTO auditoria (entidade, registro_id, acao, usuario, usuario_id, ip, dados_novos)
       SELECT $1::varchar, $2::int, 'VISUALIZAR', $3, $4::int, $5, $6::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM auditoria
           WHERE entidade = $1::varchar AND registro_id = $2::int AND acao = 'VISUALIZAR'
             AND usuario_id = $4::int AND data > NOW() - INTERVAL '10 minutes')`,
      [tabela, registro.id, req.usuario, req.usuarioId, req.ipOrigem,
        JSON.stringify({ nome: registro.nome, nomeSocial: registro.nomeSocial ?? null })]
    );

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
