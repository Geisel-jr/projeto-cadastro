// Envia um e-mail de teste usando a mesma configuração SMTP da API (variáveis SMTP_* do .env).
// Serve para conferir se o Gmail (ou outro servidor) está configurado certo.
//
//   No Docker:  docker compose exec api node testar-email.js seu-email@exemplo.com
//   Sem Docker: cd api && node testar-email.js seu-email@exemplo.com
require('dotenv').config({ quiet: true });
const nodemailer = require('nodemailer');
const { configuracaoSmtp } = require('./email');

const destino = process.argv[2];
if (!destino) {
  console.error('Uso: node testar-email.js destino@exemplo.com');
  process.exit(1);
}

const { host, transporte, remetente } = configuracaoSmtp();
if (!host) {
  console.error('SMTP_HOST não está definido. Configure as variáveis SMTP_* no .env.');
  process.exit(1);
}

(async () => {
  const transportador = nodemailer.createTransport(transporte);
  try {
    await transportador.verify(); // confere conexão e login antes de enviar
    console.log(`✔ Conectado a ${host}:${transporte.port} como ${transporte.auth?.user || '(sem login)'}`);

    const info = await transportador.sendMail({
      from: remetente,
      to: destino,
      subject: 'Teste de e-mail do CadastroHub',
      text: 'Se você recebeu esta mensagem, o envio de e-mails do CadastroHub está funcionando.',
    });
    console.log(`✔ E-mail enviado para ${destino} (id ${info.messageId})`);
  } catch (erro) {
    console.error(`✘ Falhou: ${erro.message}`);
    if (erro.code === 'EAUTH') {
      console.error('  Confira SMTP_USER e a senha de app (16 letras) e se a verificação em duas etapas está ativa.');
    }
    process.exit(1);
  }
})();
