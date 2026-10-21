const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Segredo usado para assinar os JWT. Em produção deve vir do ambiente (JWT_SECRET).
const SEGREDO = process.env.JWT_SECRET || crypto.randomBytes(48).toString('base64');
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET não definido: usando um segredo temporário (sessões caem ao reiniciar a API).');
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

module.exports = { gerarTokenAcesso, verificarTokenAcesso, gerarTokenRenovacao, hashToken, DIAS_RENOVACAO };
