// Testes das peças de segurança: hash de senha e tokens JWT.
// Rodar com: npm test (dentro da pasta api)
process.env.JWT_SECRET = 'segredo-de-teste-com-tamanho-suficiente-para-hs256';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { gerarHash, conferirSenha, conferirSenhaFicticia, validarForcaSenha } = require('../senhas');
const { gerarTokenAcesso, verificarTokenAcesso, gerarTokenRenovacao, hashToken } = require('../tokens');

const usuario = { id: 7, nome: 'Ana', papel: 'admin', deve_trocar_senha: false };

test('hash de senha confere a senha certa e recusa a errada', async () => {
  const hash = await gerarHash('Senha123');
  assert.match(hash, /^scrypt\$131072\$8\$1\$/);
  assert.equal(await conferirSenha('Senha123', hash), true);
  assert.equal(await conferirSenha('senha123', hash), false);
});

test('a mesma senha gera hashes diferentes (sal aleatório)', async () => {
  assert.notEqual(await gerarHash('Senha123'), await gerarHash('Senha123'));
});

test('hash mal formado nunca é aceito', async () => {
  assert.equal(await conferirSenha('qualquer', 'texto-invalido'), false);
  assert.equal(await conferirSenhaFicticia('qualquer'), false);
});

test('regra de força da senha', () => {
  assert.ok(validarForcaSenha('curta1'));
  assert.ok(validarForcaSenha('somenteletras'));
  assert.ok(validarForcaSenha('12345678'));
  assert.equal(validarForcaSenha('Senha123'), null);
});

test('token de acesso válido traz os dados do usuário', () => {
  const dados = verificarTokenAcesso(gerarTokenAcesso(usuario, 42));
  assert.equal(dados.sub, '7');
  assert.equal(dados.nome, 'Ana');
  assert.equal(dados.papel, 'admin');
  assert.equal(dados.sid, '42');
  assert.equal(dados.trocarSenha, undefined);
});

test('senha provisória fica marcada no token', () => {
  const dados = verificarTokenAcesso(gerarTokenAcesso({ ...usuario, deve_trocar_senha: true }, 1));
  assert.equal(dados.trocarSenha, true);
});

test('token adulterado é recusado', () => {
  const token = gerarTokenAcesso(usuario, 1);
  const [cabecalho, , assinatura] = token.split('.');
  const corpoFalso = Buffer.from(JSON.stringify({ sub: '1', papel: 'admin' })).toString('base64url');
  assert.throws(() => verificarTokenAcesso(`${cabecalho}.${corpoFalso}.${assinatura}`));
});

test('token assinado com outro segredo é recusado', () => {
  const falso = jwt.sign({ nome: 'X' }, 'outro-segredo', { issuer: 'cadastrohub-api', audience: 'cadastrohub-web' });
  assert.throws(() => verificarTokenAcesso(falso));
});

test('token sem assinatura ("alg: none") é recusado', () => {
  const semAssinatura = jwt.sign({ sub: '1' }, null, { algorithm: 'none', issuer: 'cadastrohub-api', audience: 'cadastrohub-web' });
  assert.throws(() => verificarTokenAcesso(semAssinatura));
});

test('token expirado é recusado', () => {
  const vencido = jwt.sign(
    { nome: 'Ana', exp: Math.floor(Date.now() / 1000) - 10 },
    process.env.JWT_SECRET,
    { issuer: 'cadastrohub-api', audience: 'cadastrohub-web' }
  );
  assert.throws(() => verificarTokenAcesso(vencido), /expired/);
});

test('refresh token é aleatório e só o hash é guardado', () => {
  const a = gerarTokenRenovacao();
  const b = gerarTokenRenovacao();
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashToken(a.token));
  assert.equal(a.hash.length, 64);
  assert.ok(a.expiraEm > new Date());
});
