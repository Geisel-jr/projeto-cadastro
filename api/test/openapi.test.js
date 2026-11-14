// Confere se a documentação da API (Swagger) acompanha o código.
// Rodar com: npm test (dentro da pasta api)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const especificacao = require('../openapi');
const { REGRAS_EMPRESA, REGRAS_PESSOA } = require('../validacoes');

test('a documentação descreve todos os campos de empresa e pessoa', () => {
  const { Empresa, Pessoa } = especificacao.components.schemas;
  assert.deepEqual(Object.keys(Empresa.properties), REGRAS_EMPRESA.map((r) => r.campo));
  assert.deepEqual(Object.keys(Pessoa.properties), REGRAS_PESSOA.map((r) => r.campo));
  assert.ok(Empresa.required.includes('cnpj'));
  assert.ok(Pessoa.required.includes('cpf'));
});

test('toda referência da documentação aponta para algo que existe', () => {
  const texto = JSON.stringify(especificacao);
  for (const [, tipo, nome] of texto.matchAll(/"#\/components\/(schemas|responses)\/([^"]+)"/g)) {
    assert.ok(especificacao.components[tipo][nome], `referência quebrada: ${tipo}/${nome}`);
  }
});

test('rotas de login são públicas e o resto exige token', () => {
  assert.deepEqual(especificacao.paths['/auth/login'].post.security, []);
  assert.equal(especificacao.paths['/empresas'].get.security, undefined); // usa o padrão (bearer)
  assert.deepEqual(especificacao.security, [{ bearer: [] }]);
});
