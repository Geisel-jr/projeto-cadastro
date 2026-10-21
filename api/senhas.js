const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

// Parâmetros recomendados pela OWASP para scrypt (N=2^17, r=8, p=1).
// Ficam gravados junto do hash, então dá para aumentá-los no futuro sem quebrar senhas antigas.
const PADRAO = { N: 2 ** 17, r: 8, p: 1 };
const TAMANHO_CHAVE = 32;
const MEMORIA_MAXIMA = 256 * 1024 * 1024; // scrypt com N=2^17 usa ~128 MB

const derivar = (senha, sal, { N, r, p }, tamanho) =>
  scrypt(senha.normalize('NFKC'), sal, tamanho, { N, r, p, maxmem: MEMORIA_MAXIMA });

// Formato: scrypt$N$r$p$sal(base64)$chave(base64)
async function gerarHash(senha) {
  const sal = crypto.randomBytes(16);
  const chave = await derivar(senha, sal, PADRAO, TAMANHO_CHAVE);
  return ['scrypt', PADRAO.N, PADRAO.r, PADRAO.p, sal.toString('base64'), chave.toString('base64')].join('$');
}

async function conferirSenha(senha, hash) {
  const partes = String(hash || '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, N, r, p, sal, chave] = partes;
  const esperado = Buffer.from(chave, 'base64');
  const obtido = await derivar(senha, Buffer.from(sal, 'base64'), { N: Number(N), r: Number(r), p: Number(p) }, esperado.length);
  return crypto.timingSafeEqual(obtido, esperado); // comparação em tempo constante
}

// Quando o e-mail não existe, faz o mesmo trabalho de uma conferência real.
// Assim o tempo de resposta não revela quais e-mails estão cadastrados.
let hashFicticio;
async function conferirSenhaFicticia(senha) {
  hashFicticio ??= await gerarHash(crypto.randomBytes(16).toString('hex'));
  await conferirSenha(senha, hashFicticio);
  return false;
}

// Regra mínima de senha: 8 a 128 caracteres, com letras e números
function validarForcaSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8) return 'Use pelo menos 8 caracteres.';
  if (senha.length > 128) return 'Use no máximo 128 caracteres.';
  if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) return 'Use letras e números.';
  return null;
}

module.exports = { gerarHash, conferirSenha, conferirSenhaFicticia, validarForcaSenha };
