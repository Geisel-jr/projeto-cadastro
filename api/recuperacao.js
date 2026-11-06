const crypto = require('crypto');
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { gerarHash, validarForcaSenha } = require('./senhas');
const { hashToken } = require('./tokens');
const { revogarSessoesDoUsuario } = require('./auth');
const { enviarLinkRecuperacao, avisarSenhaAlterada } = require('./email');
const { emTransacao, registrarAuditoria, ErroHttp } = require('./util');

const MINUTOS_VALIDADE = 30;

// "fulano@empresa.com" -> "fu***@empresa.com" (confirma a conta sem expor o e-mail inteiro)
const mascararEmail = (email) => {
  const [nome, dominio] = email.split('@');
  return `${nome.slice(0, 2)}***@${dominio}`;
};

const limitar = (limite) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: limite,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ipOrigem),
  handler: (req, res) => res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }),
});

// Recuperação de senha por e-mail (rotas públicas em /api/auth)
function rotasRecuperacao({ pool }) {
  const router = express.Router();

  const auditar = (db, req, usuario, acao) =>
    registrarAuditoria(db, req, {
      entidade: 'usuarios', registroId: usuario.id, acao, usuario: usuario.nome, usuarioId: usuario.id,
    });

  // Procura um pedido válido (existe, não usado, não vencido) a partir do código do link
  const buscarPedido = async (db, token, bloquear = false) => {
    if (!token || token.length > 100) return null;
    const { rows } = await db.query(
      `SELECT r.id, r.usuario_id, u.nome, u.email, u.ativo
         FROM redefinicoes_senha r JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.token_hash = $1 AND r.usado_em IS NULL AND r.expira_em > NOW()
        ${bloquear ? 'FOR UPDATE OF r' : ''}`,
      [hashToken(token)]
    );
    return rows[0]?.ativo ? rows[0] : null;
  };

  // Gera o código, invalida pedidos anteriores e envia o e-mail
  async function processarPedido(email, req) {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
    const usuario = rows[0];
    if (!usuario?.ativo) return; // e-mail desconhecido ou conta desativada: nada acontece

    const token = crypto.randomBytes(32).toString('base64url');
    await emTransacao(pool, async (db) => {
      await db.query('UPDATE redefinicoes_senha SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL', [usuario.id]);
      await db.query(
        `INSERT INTO redefinicoes_senha (usuario_id, token_hash, expira_em, ip)
         VALUES ($1, $2, NOW() + make_interval(mins => $3), $4)`,
        [usuario.id, hashToken(token), MINUTOS_VALIDADE, req.ipOrigem]
      );
      await auditar(db, req, usuario, 'PEDIDO_RECUPERACAO');
    });
    await enviarLinkRecuperacao(usuario, token, MINUTOS_VALIDADE);
  }

  // 1) Pedir o link. A resposta é sempre a mesma e sai antes de qualquer consulta,
  //    para não revelar (nem pelo tempo) se o e-mail está cadastrado.
  router.post('/esqueci', limitar(5), (req, res) => {
    const email = String(req.body?.email ?? '').trim().slice(0, 150);
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ErroHttp(400, 'Informe um e-mail válido.', { email: 'Informe um e-mail válido.' });

    const dadosRequisicao = { ipOrigem: req.ipOrigem };
    setImmediate(() => {
      processarPedido(email, dadosRequisicao).catch((erro) => console.error('Erro na recuperação de senha:', erro.message));
    });
    res.status(202).json({ mensagem: 'Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha.' });
  });

  // 2) Conferir o link antes de mostrar o formulário (o código vai no corpo, não na URL da API)
  router.post('/redefinir/verificar', limitar(30), async (req, res) => {
    const pedido = await buscarPedido(pool, String(req.body?.token ?? ''));
    if (!pedido) throw new ErroHttp(400, 'Este link é inválido ou expirou.');
    res.json({ email: mascararEmail(pedido.email) });
  });

  // 3) Criar a nova senha
  router.post('/redefinir', limitar(30), async (req, res) => {
    const token = String(req.body?.token ?? '');
    const novaSenha = String(req.body?.novaSenha ?? '');
    const fraca = validarForcaSenha(novaSenha);
    if (fraca) throw new ErroHttp(400, fraca, { novaSenha: fraca });

    const hash = await gerarHash(novaSenha);
    const usuario = await emTransacao(pool, async (db) => {
      const pedido = await buscarPedido(db, token, true);
      if (!pedido) throw new ErroHttp(400, 'Este link é inválido ou expirou.');

      const { rows } = await db.query(
        `UPDATE usuarios SET senha_hash = $1, deve_trocar_senha = FALSE, atualizado_em = NOW()
         WHERE id = $2 RETURNING *`,
        [hash, pedido.usuario_id]
      );
      await db.query('UPDATE redefinicoes_senha SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL', [pedido.usuario_id]);
      await revogarSessoesDoUsuario(db, pedido.usuario_id); // quem tinha a senha antiga perde o acesso
      await auditar(db, req, rows[0], 'RECUPERAR_SENHA');
      return rows[0];
    });

    avisarSenhaAlterada(usuario).catch((erro) => console.error('Erro ao avisar troca de senha:', erro.message));
    res.json({ mensagem: 'Senha alterada. Entre com a nova senha.' });
  });

  return router;
}

// Hard delete: pedidos vencidos há mais de 7 dias não têm valor (a auditoria registra pedido e uso)
const limparPedidosAntigos = (pool) =>
  pool.query("DELETE FROM redefinicoes_senha WHERE expira_em < NOW() - INTERVAL '7 days'").catch(() => {});

module.exports = { rotasRecuperacao, limparPedidosAntigos };
