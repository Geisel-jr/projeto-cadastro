const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Segredo usado para assinar os JWT. Em produção deve vir do ambiente (JWT_SECRET).
// Sem ele, prepararSegredo() gera um na primeira subida e guarda no banco.
let SEGREDO = process.env.JWT_SECRET || null;

// Roda antes do servidor aceitar requisições. Com o segredo no banco, as sessões continuam
// valendo quando a API reinicia (com um segredo temporário, todo mundo seria deslogado).
// O backup do banco passa a conter o segredo; por isso, em produção, defina JWT_SECRET.
async function prepararSegredo(pool) {
  if (SEGREDO) return;
  const { rows } = await pool.query(
    `INSERT INTO configuracoes (chave, valor) VALUES ('jwt_secret', $1)
     ON CONFLICT (chave) DO UPDATE SET chave = EXCLUDED.chave
     RETURNING valor`,
    [crypto.randomBytes(48).toString('base64url')]
  );
  SEGREDO = rows[0].valor;
  console.log('🔑 JWT_SECRET não definido: usando o segredo gerado na primeira subida e guardado no banco.');
}

const OPCOES = { issuer: 'cadastrohub-api', audience: 'cadastrohub-web' };
const DURACAO_ACESSO = '15m';
const DIAS_RENOVACAO = 7;

// Token de acesso (JWT): curto, guardado só na memória do navegador.
// "sid" liga o token à sessão; "trocarSenha" bloqueia o uso até a senha ser trocada.
function gerarTokenAcesso(usuario, sessaoId) {
  return jwt.sign(
    {
      nome: usuario.nome,
      papel: usuario.papel,
      sid: String(sessaoId),
      ...(usuario.deve_trocar_senha && { trocarSenha: true }),
    },
    SEGREDO,
    { ...OPCOES, subject: String(usuario.id), expiresIn: DURACAO_ACESSO, algorithm: 'HS256' }
  );
}

// Aceita só HS256 (impede ataques com "alg: none" ou troca de algoritmo)
function verificarTokenAcesso(token) {
  return jwt.verify(token, SEGREDO, { ...OPCOES, algorithms: ['HS256'] });
}

// Refresh token: valor aleatório opaco (não é JWT). O banco guarda só o hash dele.
function gerarTokenRenovacao() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token), expiraEm: new Date(Date.now() + DIAS_RENOVACAO * 86400000) };
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// HMAC com o segredo do servidor. Para valores curtos (ex: código de 6 dígitos), um hash
// simples seria quebrado testando todas as combinações; sem o segredo, isso não é possível.
const assinar = (valor) => crypto.createHmac('sha256', SEGREDO).update(valor).digest('hex');

module.exports = {
  prepararSegredo, gerarTokenAcesso, verificarTokenAcesso, gerarTokenRenovacao, hashToken, assinar, DIAS_RENOVACAO,
};
