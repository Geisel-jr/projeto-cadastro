// Worker: fica lendo a fila "empresas.email" e, para cada pedido (um CNPJ), manda um e-mail.
//   - CNPJ de empresa cadastrada: a ficha com os dados vai para o e-mail da empresa
//   - CNPJ não encontrado (ou de empresa excluída): um aviso vai para os administradores
// Roda num container separado da API (serviço "worker" do docker-compose).
// Os conceitos de fila usados aqui estão em docs/filas.md.
require('dotenv').config({ quiet: true });

const amqplib = require('amqplib');
const { pool } = require('./db');
const { RABBITMQ_URL, FILA_EMAIL_EMPRESA, prepararFilas } = require('./fila');
const { enviarDadosEmpresa, avisarCnpjNaoEncontrado } = require('./email');
const { linhaParaObjeto } = require('./util');

// Processa um pedido. Fica separado da leitura da fila para os testes chamarem direto.
async function processarPedido(db, pedido) {
  const cnpj = String(pedido?.cnpj ?? '').replace(/\D/g, '');

  // Com CNPJ repetido, a empresa ativa vem primeiro (excluídas podem ter o mesmo CNPJ)
  const { rows } = cnpj.length === 14
    ? await db.query('SELECT * FROM empresas WHERE cnpj = $1 ORDER BY excluido_em DESC NULLS FIRST LIMIT 1', [cnpj])
    : { rows: [] };
  const empresa = rows[0] && linhaParaObjeto(rows[0]);

  if (empresa && !empresa.excluidoEm) {
    await enviarDadosEmpresa(empresa);
    return { resultado: 'dados enviados para a empresa', para: [empresa.email] };
  }

  const motivo = empresa ? 'a empresa com esse CNPJ está excluída' : 'nenhuma empresa está cadastrada com esse CNPJ';
  const { rows: admins } = await db.query("SELECT nome, email FROM usuarios WHERE papel = 'admin' AND ativo ORDER BY id");
  for (const admin of admins) await avisarCnpjNaoEncontrado(admin, pedido?.cnpj, motivo, pedido?.solicitadoPor);
  return { resultado: `aviso para os administradores (${motivo})`, para: admins.map((a) => a.email) };
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// O RabbitMQ pode demorar alguns segundos para aceitar conexões depois de subir
async function conectar() {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await amqplib.connect(RABBITMQ_URL);
    } catch (erro) {
      if (tentativa === 30) throw erro;
      console.log(`⏳ RabbitMQ ainda não respondeu (${erro.message}); tentando de novo em 2 s`);
      await esperar(2000);
    }
  }
}

async function iniciar() {
  const conexao = await conectar();
  conexao.on('error', (erro) => console.error('Erro na conexão com o RabbitMQ:', erro.message));
  // Sem conexão não há o que fazer: o worker sai e o Docker sobe ele de novo (restart: unless-stopped)
  conexao.on('close', () => {
    console.error('Conexão com o RabbitMQ encerrada; saindo para o Docker reiniciar o worker.');
    process.exit(1);
  });

  const canal = await conexao.createChannel();
  await prepararFilas(canal);
  // Uma mensagem por vez: a próxima só é entregue depois do ack desta
  await canal.prefetch(1);

  // noAck: false = confirmação manual. A mensagem só sai da fila quando o worker chama ack(),
  // depois de mandar o e-mail. Se o worker cair no meio, o RabbitMQ entrega de novo.
  await canal.consume(FILA_EMAIL_EMPRESA, async (mensagem) => {
    if (!mensagem) return; // o RabbitMQ cancelou este consumidor

    let pedido;
    try {
      pedido = JSON.parse(mensagem.content.toString());
    } catch {
      console.error('✘ Mensagem que não é JSON; vai para a fila de erros.');
      canal.nack(mensagem, false, false); // false, false = não devolve para a fila (vai para a dead-letter)
      return;
    }

    try {
      const { resultado, para } = await processarPedido(pool, pedido);
      canal.ack(mensagem); // só agora a mensagem sai da fila
      console.log(`📨 CNPJ ${pedido.cnpj}: ${resultado} → ${para.join(', ') || 'ninguém'}`);
    } catch (erro) {
      // Erro passageiro (ex: SMTP fora do ar): tenta mais uma vez. Na segunda falha,
      // a mensagem vai para a fila de erros em vez de travar a fila para sempre.
      const segundaVez = mensagem.fields.redelivered;
      console.error(`✘ CNPJ ${pedido.cnpj}: ${erro.message}${segundaVez ? ' (vai para a fila de erros)' : ' (nova tentativa em 5 s)'}`);
      if (!segundaVez) await esperar(5000);
      canal.nack(mensagem, false, !segundaVez);
    }
  }, { noAck: false });

  console.log(`👂 Worker ouvindo a fila "${FILA_EMAIL_EMPRESA}"`);
}

if (require.main === module) {
  iniciar().catch((erro) => {
    console.error('❌ Worker não conseguiu iniciar:', erro.message);
    process.exit(1);
  });
}

module.exports = { processarPedido };
