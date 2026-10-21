const crypto = require('crypto');
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const { gerarHash, conferirSenha, conferirSenhaFicticia, validarForcaSenha } = require('./senhas');
const { gerarTokenAcesso, verificarTokenAcesso, gerarTokenRenovacao, hashToken, DIAS_RENOVACAO } = require('./tokens');
const { emTransacao, registrarAuditoria, ErroHttp } = require('./util');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;
const google = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Cookie do refresh token: inacessível ao JavaScript (httpOnly), enviado só para
// /api/auth e nunca em requisições vindas de outros sites (SameSite=Strict).
const COOKIE = 'cadastrohub_renovacao';
const OPCOES_COOKIE = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.COOKIE_SECURE === 'true', // ligar em produção (HTTPS)
  path: '/api/auth',
};

// Usuário como é devolvido ao front (nunca inclui o hash da senha)
const usuarioPublico = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  papel: u.papel,
  fotoUrl: u.foto_url,
  temSenha: Boolean(u.senha_hash),
  temGoogle: Boolean(u.google_id),
  deveTrocarSenha: u.deve_trocar_senha,
});

// Limite de tentativas de login por IP: 10 falhas a cada 15 minutos
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ipOrigem),
  handler: (req, res, next, opcoes) => res.status(opcoes.statusCode).json({
    error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  }),
});

// Requisições que usam o cookie precisam deste cabeçalho. Um site de terceiros não
// consegue enviá-lo sem passar pelo CORS, o que reforça a proteção contra CSRF.
function exigirCabecalhoApp(req, res, next) {
  if (req.get('x-requested-with') !== 'CadastroHub') {
    return res.status(403).json({ error: 'Requisição recusada.' });
  }
  next();
}

// ========== MIDDLEWARES DE PROTEÇÃO ==========

// Exige um token de acesso válido: "Authorization: Bearer <token>"
function autenticar(req, res, next) {
  const [tipo, token] = String(req.get('authorization') || '').split(' ');
  if (tipo !== 'Bearer' || !token) return res.status(401).json({ error: 'Faça login para continuar.' });

  try {
    const dados = verificarTokenAcesso(token);
    req.usuarioId = Number(dados.sub);
    req.usuario = dados.nome;
    req.papel = dados.papel;
    req.sessaoId = Number(dados.sid);
    req.trocarSenha = Boolean(dados.trocarSenha);
  } catch {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.', codigo: 'TOKEN_INVALIDO' });
  }

  // Com senha provisória, só as rotas de conta ficam liberadas
  if (req.trocarSenha && !req.originalUrl.startsWith('/api/auth/')) {
    return res.status(403).json({ error: 'Troque sua senha provisória para continuar.', codigo: 'TROCAR_SENHA' });
  }
  next();
}

const exigirPapel = (papel) => (req, res, next) =>
  req.papel === papel ? next() : res.status(403).json({ error: 'Você não tem permissão para esta ação.' });

// ========== SESSÕES ==========

async function criarSessao(db, req, usuarioId) {
  const renovacao = gerarTokenRenovacao();
  const { rows } = await db.query(
    `INSERT INTO sessoes (usuario_id, token_hash, expira_em, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [usuarioId, renovacao.hash, renovacao.expiraEm, req.ipOrigem, String(req.get('user-agent') || '').slice(0, 300)]
  );
  return { sessaoId: rows[0].id, ...renovacao };
}

const gravarCookie = (res, token) =>
  res.cookie(COOKIE, token, { ...OPCOES_COOKIE, maxAge: DIAS_RENOVACAO * 86400000 });

const revogarSessoesDoUsuario = (db, usuarioId, excetoId = null) =>
  db.query(
    'UPDATE sessoes SET revogado_em = NOW() WHERE usuario_id = $1 AND revogado_em IS NULL AND id IS DISTINCT FROM $2',
    [usuarioId, excetoId]
  );

// Hard delete: sessões vencidas há mais de 30 dias não têm valor de auditoria
// (os logins ficam registrados na tabela "auditoria").
const limparSessoesAntigas = (pool) =>
  pool.query("DELETE FROM sessoes WHERE expira_em < NOW() - INTERVAL '30 days'").catch(() => {});

function rotasAuth({ pool }) {
  const router = express.Router();

  const buscarUsuario = async (db, campo, valor) => {
    const condicao = campo === 'email' ? 'LOWER(email) = LOWER($1)' : `${campo} = $1`;
    const { rows } = await db.query(`SELECT * FROM usuarios WHERE ${condicao}`, [valor]);
    return rows[0] || null;
  };

  const auditarAcesso = (db, req, acao, usuario, extras = {}) =>
    registrarAuditoria(db, req, {
      entidade: 'usuarios',
      registroId: usuario?.id ?? 0,
      acao,
      usuario: usuario?.nome ?? extras.usuario,
      usuarioId: usuario?.id ?? null,
      depois: extras.dados ?? null,
      motivo: extras.motivo ?? null,
    });

  // Login concluído (senha ou Google): cria sessão, grava cookie e devolve o token de acesso
  const concluirLogin = async (req, res, usuario, metodo) => {
    const resposta = await emTransacao(pool, async (db) => {
      const { sessaoId, token } = await criarSessao(db, req, usuario.id);
      await db.query('UPDATE usuarios SET ultimo_login_em = NOW() WHERE id = $1', [usuario.id]);
      await auditarAcesso(db, req, 'LOGIN', usuario, { dados: { metodo } });
      gravarCookie(res, token);
      return { tokenAcesso: gerarTokenAcesso(usuario, sessaoId), usuario: usuarioPublico(usuario) };
    });
    res.json(resposta);
  };

  const recusarLogin = async (req, usuario, emailInformado, motivo) => {
    await auditarAcesso(pool, req, 'LOGIN_FALHOU', usuario, { usuario: emailInformado.slice(0, 100), motivo });
  };

  // Configuração pública usada pela tela de login
  router.get('/config', (req, res) => {
    res.json({ googleClientId: GOOGLE_CLIENT_ID });
  });

  // ---------- Login com e-mail e senha ----------
  router.post('/login', limiteLogin, async (req, res) => {
    const email = String(req.body?.email ?? '').trim().slice(0, 150);
    const senha = String(req.body?.senha ?? '');
    if (!email || !senha) throw new ErroHttp(400, 'Informe e-mail e senha.');
    if (senha.length > 128) throw new ErroHttp(401, 'E-mail ou senha incorretos.');

    const usuario = await buscarUsuario(pool, 'email', email);
    const correta = usuario?.senha_hash
      ? await conferirSenha(senha, usuario.senha_hash)
      : await conferirSenhaFicticia(senha);

    // Mesma mensagem para e-mail inexistente, senha errada ou conta inativa (não revela quem existe)
    if (!correta || !usuario.ativo) {
      await recusarLogin(req, usuario, email, !usuario ? 'E-mail não cadastrado' : !correta ? 'Senha incorreta' : 'Conta desativada');
      throw new ErroHttp(401, 'E-mail ou senha incorretos.');
    }
    await concluirLogin(req, res, usuario, 'senha');
  });

  // ---------- Login com Google ----------
  // O front recebe do Google um ID token (JWT) e o envia para cá. Aqui conferimos
  // assinatura, destinatário (nosso Client ID), validade e emissor com a biblioteca oficial.
  router.post('/google', limiteLogin, async (req, res) => {
    if (!google) throw new ErroHttp(404, 'Login com Google não está configurado.');
    const credencial = String(req.body?.credencial ?? '');
    if (!credencial || credencial.length > 4096) throw new ErroHttp(400, 'Credencial inválida.');

    let dados;
    try {
      const ticket = await google.verifyIdToken({ idToken: credencial, audience: GOOGLE_CLIENT_ID });
      dados = ticket.getPayload();
    } catch {
      throw new ErroHttp(401, 'Não foi possível validar o login com o Google.');
    }
    if (!dados?.sub || !dados.email || !dados.email_verified) {
      throw new ErroHttp(401, 'O e-mail da conta Google não está verificado.');
    }

    // Procura pelo id do Google; no primeiro acesso, vincula pelo e-mail verificado
    let usuario = await buscarUsuario(pool, 'google_id', dados.sub);
    if (!usuario) {
      const porEmail = await buscarUsuario(pool, 'email', dados.email);
      if (porEmail && !porEmail.google_id) {
        const { rows } = await pool.query(
          'UPDATE usuarios SET google_id = $1, foto_url = COALESCE(foto_url, $2) WHERE id = $3 RETURNING *',
          [dados.sub, dados.picture || null, porEmail.id]
        );
        usuario = rows[0];
      }
    }

    // Só entra quem foi cadastrado por um administrador
    if (!usuario || !usuario.ativo) {
      await recusarLogin(req, usuario, dados.email, usuario ? 'Conta desativada' : 'Conta Google sem acesso');
      throw new ErroHttp(403, `A conta ${dados.email} não tem acesso. Peça a um administrador para liberar este e-mail.`);
    }
    await concluirLogin(req, res, usuario, 'google');
  });

  // ---------- Renovação (rotação do refresh token) ----------
  router.post('/renovar', exigirCabecalhoApp, async (req, res) => {
    const token = req.cookies?.[COOKIE];
    if (!token) throw new ErroHttp(401, 'Sessão encerrada.');

    const resultado = await emTransacao(pool, async (db) => {
      const { rows } = await db.query('SELECT * FROM sessoes WHERE token_hash = $1 FOR UPDATE', [hashToken(token)]);
      const sessao = rows[0];
      if (!sessao) return { erro: 'Sessão encerrada.' };

      if (sessao.revogado_em) {
        // Um token já trocado voltou a ser usado. Se foi há poucos segundos, é só outra
        // aba renovando ao mesmo tempo; se não, é sinal de roubo: derruba todas as sessões.
        const segundos = (Date.now() - new Date(sessao.revogado_em).getTime()) / 1000;
        if (!sessao.substituida_por || segundos > 30) {
          await revogarSessoesDoUsuario(db, sessao.usuario_id);
          console.warn(`⚠️  Reuso de refresh token detectado (usuário ${sessao.usuario_id}); sessões revogadas.`);
        }
        return { erro: 'Sessão encerrada.' };
      }
      if (new Date(sessao.expira_em) < new Date()) return { erro: 'Sessão expirada.' };

      const usuario = await buscarUsuario(db, 'id', sessao.usuario_id);
      if (!usuario?.ativo) {
        await revogarSessoesDoUsuario(db, sessao.usuario_id);
        return { erro: 'Conta desativada.' };
      }

      const nova = await criarSessao(db, req, usuario.id);
      await db.query('UPDATE sessoes SET revogado_em = NOW(), substituida_por = $1 WHERE id = $2', [nova.sessaoId, sessao.id]);
      return { usuario, nova };
    });

    if (resultado.erro) {
      res.clearCookie(COOKIE, OPCOES_COOKIE);
      throw new ErroHttp(401, resultado.erro);
    }
    gravarCookie(res, resultado.nova.token);
    res.json({
      tokenAcesso: gerarTokenAcesso(resultado.usuario, resultado.nova.sessaoId),
      usuario: usuarioPublico(resultado.usuario),
    });
  });

  // ---------- Sair ----------
  router.post('/sair', exigirCabecalhoApp, async (req, res) => {
    const token = req.cookies?.[COOKIE];
    if (token) {
      const { rows } = await pool.query(
        `UPDATE sessoes SET revogado_em = NOW() WHERE token_hash = $1 AND revogado_em IS NULL
         RETURNING usuario_id`,
        [hashToken(token)]
      );
      if (rows[0]) {
        const usuario = await buscarUsuario(pool, 'id', rows[0].usuario_id);
        await auditarAcesso(pool, req, 'LOGOUT', usuario);
      }
    }
    res.clearCookie(COOKIE, OPCOES_COOKIE);
    res.status(204).end();
  });

  // ---------- Conta do usuário logado ----------
  router.get('/eu', autenticar, async (req, res) => {
    const usuario = await buscarUsuario(pool, 'id', req.usuarioId);
    if (!usuario?.ativo) throw new ErroHttp(401, 'Conta desativada.');
    res.json(usuarioPublico(usuario));
  });

  router.post('/trocar-senha', autenticar, async (req, res) => {
    const senhaAtual = String(req.body?.senhaAtual ?? '');
    const novaSenha = String(req.body?.novaSenha ?? '');

    const usuario = await buscarUsuario(pool, 'id', req.usuarioId);
    if (!usuario?.ativo) throw new ErroHttp(401, 'Conta desativada.');

    // Quem já tem senha precisa confirmar a atual (quem só usa Google está criando a primeira)
    if (usuario.senha_hash && !(await conferirSenha(senhaAtual, usuario.senha_hash))) {
      throw new ErroHttp(400, 'Senha atual incorreta.', { senhaAtual: 'Senha atual incorreta.' });
    }
    const fraca = validarForcaSenha(novaSenha);
    if (fraca) throw new ErroHttp(400, fraca, { novaSenha: fraca });
    if (usuario.senha_hash && (await conferirSenha(novaSenha, usuario.senha_hash))) {
      throw new ErroHttp(400, 'A nova senha deve ser diferente da atual.', { novaSenha: 'Escolha uma senha diferente da atual.' });
    }

    const hash = await gerarHash(novaSenha);
    const atualizado = await emTransacao(pool, async (db) => {
      const { rows } = await db.query(
        `UPDATE usuarios SET senha_hash = $1, deve_trocar_senha = FALSE, atualizado_em = NOW()
         WHERE id = $2 RETURNING *`,
        [hash, usuario.id]
      );
      await revogarSessoesDoUsuario(db, usuario.id, req.sessaoId); // derruba as outras sessões
      await auditarAcesso(db, req, 'TROCAR_SENHA', usuario);
      return rows[0];
    });

    // Novo token de acesso, já sem a marcação de senha provisória
    res.json({ tokenAcesso: gerarTokenAcesso(atualizado, req.sessaoId), usuario: usuarioPublico(atualizado) });
  });

  return router;
}

// Cria o primeiro administrador quando a tabela de usuários está vazia.
// A senha inicial é provisória: no primeiro login o sistema exige a troca.
async function criarAdministradorInicial(pool) {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM usuarios');
  if (rows[0].total > 0) return;

  const email = process.env.ADMIN_EMAIL || 'admin@cadastrohub.local';
  const senha = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, papel, deve_trocar_senha, criado_por)
     VALUES ($1, $2, $3, 'admin', TRUE, 'sistema')`,
    [process.env.ADMIN_NOME || 'Administrador', email, await gerarHash(senha)]
  );
  console.log(`👤 Administrador inicial criado: ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`   Senha provisória: ${senha} (troque no primeiro acesso)`);
}

module.exports = {
  rotasAuth, autenticar, exigirPapel, criarAdministradorInicial, limparSessoesAntigas,
  revogarSessoesDoUsuario, usuarioPublico,
};
