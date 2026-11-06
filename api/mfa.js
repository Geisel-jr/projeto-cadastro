const crypto = require('crypto');
const { hashToken, assinar } = require('./tokens');
const { enviarCodigoAcesso } = require('./email');
const { emTransacao, mascararEmail, ErroHttp } = require('./util');

// Verificação em duas etapas (MFA) por e-mail para administradores: depois da senha certa,
// a API envia um código de 6 dígitos e só cria a sessão quando ele é digitado. Quem descobriu
// a senha (vazamento, chute, phishing) mas não tem acesso ao e-mail fica de fora.
//
// O login com Google não passa por aqui: o código iria para a mesma conta Google que acabou
// de ser confirmada, então não acrescentaria proteção (lá, a verificação em duas etapas é do Google).
const ATIVO = process.env.MFA_ADMIN !== 'false';
const MINUTOS_VALIDADE = 10;
const MAX_TENTATIVAS = 5;    // códigos errados por desafio; depois disso, só com a senha de novo
const MAX_ENVIOS = 3;        // o e-mail inicial + 2 reenvios
const SEGUNDOS_REENVIO = 30;
const MAX_DESAFIOS = 5;      // logins com senha certa por usuário a cada 15 minutos

const ENCERRADO = 'Este código expirou. Entre de novo para receber outro.';

const exigeMfa = (usuario) => ATIVO && usuario.papel === 'admin';

const gerarCodigo = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// O HMAC inclui o desafio: o mesmo código em outro desafio dá outro valor
const hashCodigo = (desafioHash, codigo) => assinar(`${desafioHash}:${codigo}`);

const iguais = (a, b) => crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

// Desafio em aberto (não usado, não vencido). FOR UPDATE: tentativas simultâneas entram
// em fila, então ninguém consegue testar códigos em paralelo além do limite.
async function buscarDesafio(db, desafio) {
  if (!desafio || desafio.length > 100) return null;
  const { rows } = await db.query(
    `SELECT d.*, u.nome, u.email
       FROM desafios_mfa d JOIN usuarios u ON u.id = d.usuario_id
      WHERE d.desafio_hash = $1 AND d.usado_em IS NULL AND d.expira_em > NOW()
      FOR UPDATE OF d`,
    [hashToken(desafio)]
  );
  return rows[0] || null;
}

async function enviarCodigo(usuario, codigo) {
  try {
    await enviarCodigoAcesso(usuario, codigo, MINUTOS_VALIDADE);
  } catch (erro) {
    console.error('Erro ao enviar o código de acesso:', erro.message);
    throw new ErroHttp(503, 'Não foi possível enviar o código de acesso. Tente de novo em instantes.');
  }
}

// 1ª etapa concluída (senha certa): cria o desafio e envia o código por e-mail
async function criarDesafio(pool, req, usuario) {
  const desafio = crypto.randomBytes(32).toString('base64url');
  const desafioHash = hashToken(desafio);
  const codigo = gerarCodigo();

  await emTransacao(pool, async (db) => {
    const { rows } = await db.query(
      "SELECT COUNT(*)::int AS total FROM desafios_mfa WHERE usuario_id = $1 AND criado_em > NOW() - INTERVAL '15 minutes'",
      [usuario.id]
    );
    if (rows[0].total >= MAX_DESAFIOS) {
      throw new ErroHttp(429, 'Muitas tentativas de entrada. Aguarde alguns minutos e tente de novo.');
    }
    // Só o código mais recente vale
    await db.query('UPDATE desafios_mfa SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL', [usuario.id]);
    await db.query(
      `INSERT INTO desafios_mfa (usuario_id, desafio_hash, codigo_hash, expira_em, ip)
       VALUES ($1, $2, $3, NOW() + make_interval(mins => $4), $5)`,
      [usuario.id, desafioHash, hashCodigo(desafioHash, codigo), MINUTOS_VALIDADE, req.ipOrigem]
    );
  });
  await enviarCodigo(usuario, codigo);

  return {
    desafio,
    email: mascararEmail(usuario.email),
    minutos: MINUTOS_VALIDADE,
    reenviarEm: SEGUNDOS_REENVIO,
    reenvios: MAX_ENVIOS - 1,
  };
}

// 2ª etapa: confere o código. Devolve { usuarioId } quando está certo ou { status, erro }.
// Não lança erro de propósito: o contador de tentativas precisa ser gravado (sem rollback).
async function conferirCodigo(pool, desafio, codigo) {
  return emTransacao(pool, async (db) => {
    const registro = await buscarDesafio(db, desafio);
    if (!registro) return { status: 410, erro: ENCERRADO };

    const digitos = codigo.replace(/\D/g, '');
    if (digitos.length === 6 && iguais(hashCodigo(registro.desafio_hash, digitos), registro.codigo_hash)) {
      await db.query('UPDATE desafios_mfa SET usado_em = NOW() WHERE id = $1', [registro.id]);
      return { usuarioId: registro.usuario_id };
    }

    const restantes = MAX_TENTATIVAS - registro.tentativas - 1;
    await db.query(
      'UPDATE desafios_mfa SET tentativas = tentativas + 1, usado_em = CASE WHEN $2 THEN NOW() END WHERE id = $1',
      [registro.id, restantes <= 0]
    );
    return {
      usuarioId: registro.usuario_id,
      status: restantes > 0 ? 401 : 410,
      erro: restantes > 0
        ? `Código incorreto. ${restantes === 1 ? 'Resta 1 tentativa' : `Restam ${restantes} tentativas`}.`
        : 'Código incorreto. Por segurança, entre de novo para receber outro código.',
    };
  });
}

// Envia um código novo para o mesmo desafio (o anterior deixa de valer)
async function reenviarCodigo(pool, desafio) {
  const codigo = gerarCodigo();
  const registro = await emTransacao(pool, async (db) => {
    const atual = await buscarDesafio(db, desafio);
    if (!atual) throw new ErroHttp(410, ENCERRADO);
    if (atual.envios >= MAX_ENVIOS) {
      throw new ErroHttp(429, 'Limite de reenvios atingido. Entre de novo para receber outro código.');
    }
    const espera = Math.ceil(SEGUNDOS_REENVIO - (Date.now() - new Date(atual.enviado_em).getTime()) / 1000);
    if (espera > 0) throw new ErroHttp(429, `Aguarde ${espera} segundos para pedir outro código.`);

    await db.query(
      `UPDATE desafios_mfa
          SET codigo_hash = $1, envios = envios + 1, enviado_em = NOW(), expira_em = NOW() + make_interval(mins => $2)
        WHERE id = $3`,
      [hashCodigo(atual.desafio_hash, codigo), MINUTOS_VALIDADE, atual.id]
    );
    return atual;
  });
  await enviarCodigo(registro, codigo);

  return { minutos: MINUTOS_VALIDADE, reenviarEm: SEGUNDOS_REENVIO, reenvios: MAX_ENVIOS - registro.envios - 1 };
}

// Encerra os códigos pendentes de um usuário (senha trocada, conta desativada, e-mail alterado...)
const encerrarDesafios = (db, usuarioId) =>
  db.query('UPDATE desafios_mfa SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL', [usuarioId]);

// Hard delete: desafios vencidos há mais de 7 dias não têm valor de auditoria
// (os logins, certos e errados, ficam na tabela "auditoria").
const limparDesafiosAntigos = (pool) =>
  pool.query("DELETE FROM desafios_mfa WHERE expira_em < NOW() - INTERVAL '7 days'").catch(() => {});

module.exports = { exigeMfa, criarDesafio, conferirCodigo, reenviarCodigo, encerrarDesafios, limparDesafiosAntigos };
