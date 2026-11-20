const amqplib = require('amqplib');
const { ErroHttp } = require('./util');

// Fila de mensagens no RabbitMQ. A API publica os pedidos e o worker (worker.js) consome.
// Os conceitos (fila, ack, dead-letter) estão explicados em docs/filas.md.
//
// RABBITMQ_URL vazio desliga a fila: os pedidos são recusados (usado nos testes de integração,
// para eles nunca mandarem mensagem para o RabbitMQ de desenvolvimento).
const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://cadastrohub:cadastrohub123@localhost:5672';

// Pedidos de "mande por e-mail os dados da empresa deste CNPJ"
const FILA_EMAIL_EMPRESA = 'empresas.email';
// Para onde vão as mensagens que deram erro duas vezes (dead-letter), para alguém olhar depois
const FILA_ERROS = 'empresas.email.erros';

// Cria as filas, se ainda não existirem. A API e o worker chamam a mesma função,
// então tanto faz quem sobe primeiro.
async function prepararFilas(canal) {
  await canal.assertQueue(FILA_ERROS, { durable: true });
  await canal.assertQueue(FILA_EMAIL_EMPRESA, {
    durable: true, // a fila continua existindo se o RabbitMQ reiniciar
    arguments: {
      // Mensagem rejeitada sem voltar para a fila (nack com requeue = false) vai para a fila de erros
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': FILA_ERROS,
    },
  });
}

let canalPublicacao = null; // Promise do canal, reaproveitada entre pedidos

// Canal de confirmação: depois de publicar, o RabbitMQ avisa que gravou a mensagem.
// Se a conexão cair, o canal é descartado e o próximo pedido conecta de novo.
function obterCanal() {
  if (!canalPublicacao) {
    canalPublicacao = (async () => {
      const conexao = await amqplib.connect(RABBITMQ_URL);
      const descartar = () => { canalPublicacao = null; };
      conexao.on('error', descartar);
      conexao.on('close', descartar);
      const canal = await conexao.createConfirmChannel();
      canal.on('error', descartar);
      canal.on('close', descartar);
      await prepararFilas(canal);
      return canal;
    })();
    canalPublicacao.catch(() => { canalPublicacao = null; });
  }
  return canalPublicacao;
}

// Coloca na fila o pedido de mandar os dados da empresa por e-mail.
// A mensagem é persistente: se o RabbitMQ reiniciar antes do worker ler, ela continua lá.
async function publicarEmailEmpresa(cnpj, solicitadoPor) {
  if (!RABBITMQ_URL) throw new ErroHttp(503, 'A fila de mensagens está desligada.');
  const pedido = { cnpj, solicitadoPor: solicitadoPor || null, solicitadoEm: new Date().toISOString() };
  try {
    const canal = await obterCanal();
    canal.sendToQueue(FILA_EMAIL_EMPRESA, Buffer.from(JSON.stringify(pedido)), {
      persistent: true,
      contentType: 'application/json',
    });
    await canal.waitForConfirms();
  } catch (erro) {
    console.error('Erro ao publicar na fila:', erro.message);
    throw new ErroHttp(503, 'A fila de mensagens está fora do ar. Tente de novo em instantes.');
  }
  return pedido;
}

module.exports = { RABBITMQ_URL, FILA_EMAIL_EMPRESA, FILA_ERROS, prepararFilas, publicarEmailEmpresa };
