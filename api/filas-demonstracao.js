// Demonstração dos dois jeitos de tirar uma mensagem da fila no RabbitMQ.
//
//   docker compose exec worker node filas-demonstracao.js
//
// 1) Confirmação automática (noAck: true): a mensagem sai da fila no momento em que é entregue.
//    Se o programa cair antes de terminar o trabalho, a mensagem se perde.
// 2) Confirmação manual (noAck: false): a mensagem fica "reservada" até o programa chamar ack().
//    Se ele cair antes, o RabbitMQ devolve a mensagem para a fila.
//
// Usa uma fila própria (demonstracao.ack), apagada no final. Não mexe na fila do worker.
require('dotenv').config({ quiet: true });
const amqplib = require('amqplib');
const { RABBITMQ_URL } = require('./fila');

const FILA = 'demonstracao.ack';
const pausa = () => new Promise((resolve) => setTimeout(resolve, 300));

async function contar(conexao) {
  const canal = await conexao.createChannel();
  const { messageCount } = await canal.checkQueue(FILA);
  await canal.close();
  return messageCount;
}

async function main() {
  const conexao = await amqplib.connect(RABBITMQ_URL);
  const preparo = await conexao.createChannel();
  await preparo.assertQueue(FILA, { durable: false });
  await preparo.purgeQueue(FILA);

  console.log('\n1) Confirmação automática (noAck: true)');
  preparo.sendToQueue(FILA, Buffer.from('pedido A'));
  await pausa();
  console.log(`   mensagens na fila: ${await contar(conexao)}`);
  let canal = await conexao.createChannel();
  const a = await canal.get(FILA, { noAck: true });
  console.log(`   li "${a.content}" e o programa "caiu" antes de terminar o trabalho...`);
  await canal.close(); // simula a queda
  await pausa();
  console.log(`   mensagens na fila: ${await contar(conexao)}  → "pedido A" se perdeu`);

  console.log('\n2) Confirmação manual (noAck: false)');
  preparo.sendToQueue(FILA, Buffer.from('pedido B'));
  await pausa();
  canal = await conexao.createChannel();
  const b = await canal.get(FILA, { noAck: false });
  console.log(`   li "${b.content}" e o programa "caiu" antes do ack()...`);
  await canal.close(); // simula a queda: sem ack, o RabbitMQ devolve a mensagem
  await pausa();
  console.log(`   mensagens na fila: ${await contar(conexao)}  → "pedido B" voltou para a fila`);

  canal = await conexao.createChannel();
  const b2 = await canal.get(FILA, { noAck: false });
  console.log(`   li de novo "${b2.content}" (reentregue: ${b2.fields.redelivered}), terminei o trabalho e chamei ack()`);
  canal.ack(b2);
  await canal.close();
  await pausa();
  console.log(`   mensagens na fila: ${await contar(conexao)}  → agora sim saiu da fila\n`);

  await preparo.deleteQueue(FILA);
  await conexao.close();
}

main().catch((erro) => {
  console.error('Erro na demonstração:', erro.message);
  process.exit(1);
});
