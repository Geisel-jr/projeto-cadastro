// Testes de integração: sobem a API de verdade e conversam com ela por HTTP, usando um
// banco PostgreSQL de teste (cadastros_teste), apagado e criado de novo a cada execução.
//
//   Rodar: npm run test:integracao   (dentro da pasta api; veja docs/operacao.md)
//   Conexão: TESTE_DB_HOST, TESTE_DB_PORT, TESTE_DB_USER e TESTE_DB_PASSWORD
//            (padrão: localhost, 5432, postgres, postgres)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Client } = require('pg');

const BANCO = 'cadastros_teste';
const conexao = {
  host: process.env.TESTE_DB_HOST || 'localhost',
  port: Number(process.env.TESTE_DB_PORT) || 5432,
  user: process.env.TESTE_DB_USER || 'postgres',
  password: process.env.TESTE_DB_PASSWORD || 'postgres',
};

// A API lê a configuração ao carregar: precisa estar pronta antes do require('../app')
Object.assign(process.env, {
  DATABASE_HOST: conexao.host,
  DATABASE_PORT: String(conexao.port),
  DATABASE_USER: conexao.user,
  DATABASE_PASSWORD: conexao.password,
  DATABASE_NAME: BANCO,
  JWT_SECRET: 'segredo-dos-testes-de-integracao-com-tamanho-suficiente',
  SMTP_HOST: '', // sem SMTP, a API só escreve os e-mails no log (capturados abaixo)
  RABBITMQ_URL: '', // fila desligada: os testes nunca mandam mensagem para o RabbitMQ de desenvolvimento
  MFA_ADMIN: 'true',
});

const SENHA = 'SenhaTeste1';
const EMPRESA = { nome: 'Padaria São João Ltda', cnpj: '11.222.333/0001-81', email: 'contato@padaria.com', telefone: '(11) 3333-4444', cep: '01001-000' };
const PESSOA = { nome: 'João Ninguém', cpf: '529.982.247-25', email: 'joao@email.com', telefone: '(11) 98888-7777', dataNascimento: '1990-05-10', profissao: 'QA' };

let servidor;
let base;
let pool;
const emails = []; // e-mails que a API teria enviado
const tokens = {};
const ids = {};

before(async () => {
  // Banco zerado a cada execução
  const admin = new Client({ ...conexao, database: 'postgres' });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${BANCO} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${BANCO}`);
  await admin.end();

  const logOriginal = console.log;
  console.log = (...partes) => {
    const texto = partes.join(' ');
    if (texto.includes('📧')) emails.push(texto);
    else logOriginal(...partes);
  };
  console.warn = () => {}; // aviso de SMTP não configurado (esperado aqui)

  const { migrar } = require('../db');
  ({ pool } = require('../db'));
  const { app } = require('../app');
  const { gerarHash } = require('../senhas');
  await migrar();
  const hash = await gerarHash(SENHA);
  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, papel, criado_por) VALUES
       ('Admin Teste', 'admin@teste.local', $1, 'admin', 'teste'),
       ('Operador Teste', 'operador@teste.local', $1, 'operador', 'teste')`,
    [hash]
  );

  servidor = app.listen(0);
  await once(servidor, 'listening');
  base = `http://localhost:${servidor.address().port}/api`;
});

after(async () => {
  servidor?.close();
  await pool?.end();
});

async function chamar(metodo, caminho, { token, corpo } = {}) {
  const resposta = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  let dados = texto;
  try { dados = JSON.parse(texto); } catch { /* CSV ou corpo vazio */ }
  return { status: resposta.status, dados, headers: resposta.headers };
}

const ultimoCodigo = () => emails.at(-1)?.match(/Código: (\d{6})/)?.[1];

async function entrar(email) {
  const login = await chamar('POST', '/auth/login', { corpo: { email, senha: SENHA } });
  assert.equal(login.status, 200);
  if (!login.dados.mfa) return login.dados.tokenAcesso;
  const mfa = await chamar('POST', '/auth/mfa', { corpo: { desafio: login.dados.mfa.desafio, codigo: ultimoCodigo() } });
  assert.equal(mfa.status, 200);
  return mfa.dados.tokenAcesso;
}

test('senha errada é recusada com a mesma mensagem, exista o e-mail ou não', async () => {
  const existe = await chamar('POST', '/auth/login', { corpo: { email: 'operador@teste.local', senha: 'Errada123' } });
  const naoExiste = await chamar('POST', '/auth/login', { corpo: { email: 'ninguem@teste.local', senha: 'Errada123' } });
  assert.equal(existe.status, 401);
  assert.equal(naoExiste.status, 401);
  assert.equal(existe.dados.error, naoExiste.dados.error);
});

test('administrador só entra com o código enviado por e-mail, e o código vale uma vez', async () => {
  const login = await chamar('POST', '/auth/login', { corpo: { email: 'admin@teste.local', senha: SENHA } });
  assert.equal(login.status, 200);
  assert.equal(login.dados.tokenAcesso, undefined, 'a senha sozinha não pode entregar a sessão');
  const { desafio } = login.dados.mfa;
  const codigo = ultimoCodigo();
  assert.match(codigo, /^\d{6}$/);

  const errado = await chamar('POST', '/auth/mfa', { corpo: { desafio, codigo: codigo === '000000' ? '111111' : '000000' } });
  assert.equal(errado.status, 401);
  const certo = await chamar('POST', '/auth/mfa', { corpo: { desafio, codigo } });
  assert.equal(certo.status, 200);
  assert.ok(certo.dados.tokenAcesso);
  const deNovo = await chamar('POST', '/auth/mfa', { corpo: { desafio, codigo } });
  assert.equal(deNovo.status, 410);

  tokens.admin = certo.dados.tokenAcesso;
  tokens.operador = await entrar('operador@teste.local');
});

test('rotas exigem login, e a gestão de usuários é só para administradores', async () => {
  assert.equal((await chamar('GET', '/empresas')).status, 401);
  assert.equal((await chamar('GET', '/usuarios', { token: tokens.operador })).status, 403);
  assert.equal((await chamar('GET', '/usuarios', { token: tokens.admin })).status, 200);
});

test('empresa: validação, CNPJ duplicado, edição, exclusão com motivo e restauração', async () => {
  const token = tokens.operador;
  const invalida = await chamar('POST', '/empresas', { token, corpo: { ...EMPRESA, cnpj: '11.222.333/0001-00' } });
  assert.equal(invalida.status, 400);
  assert.ok(invalida.dados.erros.cnpj);

  const criada = await chamar('POST', '/empresas', { token, corpo: EMPRESA });
  assert.equal(criada.status, 201);
  ids.empresa = criada.dados.id;
  assert.equal((await chamar('POST', '/empresas', { token, corpo: EMPRESA })).status, 409);

  const editada = await chamar('PUT', `/empresas/${ids.empresa}`, { token, corpo: { ...EMPRESA, nomeFantasia: 'Padaria do João' } });
  assert.equal(editada.status, 200);

  assert.equal((await chamar('DELETE', `/empresas/${ids.empresa}`, { token, corpo: {} })).status, 400);
  assert.equal((await chamar('DELETE', `/empresas/${ids.empresa}`, { token, corpo: { motivo: 'Teste de exclusão' } })).status, 200);
  assert.equal((await chamar('GET', '/empresas', { token })).dados.total, 0);
  assert.equal((await chamar('GET', '/empresas?status=excluidos', { token })).dados.total, 1);

  assert.equal((await chamar('POST', `/empresas/${ids.empresa}/restaurar`, { token })).status, 200);
  const historico = await chamar('GET', `/empresas/${ids.empresa}/historico`, { token });
  assert.deepEqual(historico.dados.map((h) => h.acao).reverse(), ['CRIAR', 'EDITAR', 'EXCLUIR', 'RESTAURAR']);
  assert.ok(historico.dados.every((h) => h.usuario === 'Operador Teste'));
});

test('a auditoria não pode ser alterada nem apagada, nem direto no banco', async () => {
  await assert.rejects(pool.query("UPDATE auditoria SET usuario = 'outra pessoa'"));
  await assert.rejects(pool.query('DELETE FROM auditoria'));
});

test('pessoa: CPF mascarado na lista, completo ao abrir, e a abertura fica na auditoria', async () => {
  const token = tokens.operador;
  const criada = await chamar('POST', '/pessoas', { token, corpo: { ...PESSOA, empresaId: ids.empresa } });
  assert.equal(criada.status, 201);
  ids.pessoa = criada.dados.id;

  const lista = await chamar('GET', '/pessoas', { token });
  assert.equal(lista.dados.itens[0].cpf, '***.982.247-**');

  const detalhe = await chamar('GET', `/pessoas/${ids.pessoa}`, { token });
  assert.equal(detalhe.dados.cpf, '52998224725');
  await chamar('GET', `/pessoas/${ids.pessoa}`, { token }); // abrir de novo logo em seguida não duplica o registro

  const historico = await chamar('GET', `/pessoas/${ids.pessoa}/historico`, { token });
  assert.equal(historico.dados.filter((h) => h.acao === 'VISUALIZAR').length, 1);
  // Na linha do tempo geral as aberturas só aparecem quando filtradas
  const geral = await chamar('GET', '/auditoria', { token });
  assert.ok(!geral.dados.itens.some((h) => h.acao === 'VISUALIZAR'));
  const filtrada = await chamar('GET', '/auditoria?acao=VISUALIZAR', { token });
  assert.equal(filtrada.dados.itens.length, 1);
});

test('busca ignora acentos e aceita CPF com ou sem pontuação', async () => {
  const token = tokens.operador;
  assert.equal((await chamar('GET', '/pessoas?q=joao', { token })).dados.total, 1);
  assert.equal((await chamar('GET', `/pessoas?q=${encodeURIComponent('529.982')}`, { token })).dados.total, 1);
  assert.equal((await chamar('GET', '/pessoas?q=inexistente', { token })).dados.total, 0);
});

test('pessoa não pode ser ligada a uma empresa excluída', async () => {
  const token = tokens.operador;
  const outra = await chamar('POST', '/empresas', { token, corpo: { ...EMPRESA, nome: 'Outra Empresa', cnpj: '11.444.777/0001-61' } });
  await chamar('DELETE', `/empresas/${outra.dados.id}`, { token, corpo: { motivo: 'Encerrada' } });
  const pessoa = await chamar('POST', '/pessoas', { token, corpo: { ...PESSOA, cpf: '111.444.777-35', empresaId: outra.dados.id } });
  assert.equal(pessoa.status, 400);
  assert.ok(pessoa.dados.erros.empresaId);
});

test('exportação gera uma planilha que o Excel abre e fica registrada na auditoria', async () => {
  const resposta = await chamar('GET', '/pessoas/exportar', { token: tokens.operador });
  assert.equal(resposta.status, 200);
  assert.match(resposta.headers.get('content-type'), /text\/csv/);
  assert.match(resposta.headers.get('content-disposition'), /pessoas-\d{4}-\d{2}-\d{2}\.csv/);
  const [cabecalho, linha] = resposta.dados.replace(/^﻿/, '').split('\r\n');
  assert.ok(cabecalho.startsWith('Nome;Nome social;CPF;'));
  assert.ok(linha.includes('529.982.247-25'), 'a planilha leva o CPF completo');

  const auditoria = await chamar('GET', '/auditoria?acao=EXPORTAR', { token: tokens.operador });
  assert.equal(auditoria.dados.itens.length, 1);
  assert.equal(auditoria.dados.itens[0].dadosNovos.total, 1);
});

test('aviso de vencimentos: só administrador manda, e só quando há documentos para avisar', async () => {
  assert.equal((await chamar('POST', '/documentos/vencimentos/aviso', { token: tokens.operador })).status, 403);
  const semDocumentos = await chamar('POST', '/documentos/vencimentos/aviso', { token: tokens.admin });
  assert.deepEqual(semDocumentos.dados, { documentos: 0, enviados: 0 });

  // Documento vencido há 3 dias (só o registro no banco; o arquivo não importa aqui)
  await pool.query(
    `INSERT INTO documentos (empresa_id, tipo, validade, nome_arquivo, objeto, content_type, tamanho, criado_por)
     VALUES ($1, 'Alvará de Funcionamento', CURRENT_DATE - 3, 'alvara.pdf', 'teste/alvara.pdf', 'application/pdf', 10, 'teste')`,
    [ids.empresa]
  );
  const antes = emails.length;
  const comDocumento = await chamar('POST', '/documentos/vencimentos/aviso', { token: tokens.admin });
  assert.deepEqual(comDocumento.dados, { documentos: 1, enviados: 1 });
  const email = emails.slice(antes).join('\n');
  assert.match(email, /Para: admin@teste\.local/);
  assert.match(email, /Padaria do João: Alvará de Funcionamento, venceu há 3 dias/);
});

test('fila: sem RabbitMQ, o pedido é recusado com 503 e o cadastro da empresa continua funcionando', async () => {
  const pedido = await chamar('POST', '/empresas/enviar-dados', { token: tokens.operador, corpo: { cnpj: EMPRESA.cnpj } });
  assert.equal(pedido.status, 503);
  assert.equal((await chamar('POST', '/empresas/enviar-dados', { token: tokens.operador, corpo: {} })).status, 400);
});

test('worker: CNPJ encontrado manda os dados para o e-mail da empresa', async () => {
  const { processarPedido } = require('../worker');
  const antes = emails.length;
  const resultado = await processarPedido(pool, { cnpj: EMPRESA.cnpj, solicitadoPor: 'Operador Teste' });
  assert.deepEqual(resultado.para, ['contato@padaria.com']);
  const email = emails.slice(antes).join('\n');
  assert.match(email, /Para: contato@padaria\.com \| Assunto: Dados cadastrais de Padaria do João/);
  assert.match(email, /CNPJ: 11\.222\.333\/0001-81/);
});

test('worker: CNPJ não encontrado ou de empresa excluída avisa os administradores', async () => {
  const { processarPedido } = require('../worker');
  const antes = emails.length;
  const naoExiste = await processarPedido(pool, { cnpj: '99.999.999/0001-99', solicitadoPor: 'Operador Teste' });
  assert.deepEqual(naoExiste.para, ['admin@teste.local']);
  const excluida = await processarPedido(pool, { cnpj: '11.444.777/0001-61' }); // excluída num teste acima
  assert.match(excluida.resultado, /excluída/);
  const enviados = emails.slice(antes).join('\n');
  assert.match(enviados, /Para: admin@teste\.local \| Assunto: CNPJ não encontrado: 99\.999\.999\/0001-99/);
  assert.match(enviados, /Pedido feito por: Operador Teste/);
});
