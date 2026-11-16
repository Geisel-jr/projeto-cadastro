// Liga a API: carrega o .env, atualiza o banco e começa a aceitar requisições.
require('dotenv').config({ quiet: true });

const { app, pool } = require('./app');
const { migrar } = require('./db');
const { prepararStorage } = require('./storage');
const { criarAdministradorInicial, limparSessoesAntigas } = require('./auth');
const { limparPedidosAntigos } = require('./recuperacao');
const { limparDesafiosAntigos } = require('./mfa');
const { popularDadosExemplo } = require('./seeds');
const { prepararSegredo } = require('./tokens');
const { agendarAvisoSemanal } = require('./avisos');

// ========== INICIAR SERVIDOR ==========

const PORT = process.env.PORT || 5000;

migrar()
  .then(async () => {
    await prepararSegredo(pool);
    const primeiraSubida = await criarAdministradorInicial(pool); // true só com o banco ainda sem usuários
    await prepararStorage();
    // Dados de exemplo só na primeira subida: um banco que já tem dados nunca recebe o seed
    if (primeiraSubida && process.env.DADOS_EXEMPLO !== 'false') {
      await popularDadosExemplo(pool).catch((erro) => console.error('❌ Dados de exemplo não gravados:', erro.message));
    }
  })
  .then(() => {
    const limpar = () => {
      limparSessoesAntigas(pool);
      limparPedidosAntigos(pool);
      limparDesafiosAntigos(pool);
    };
    limpar();
    setInterval(limpar, 6 * 60 * 60 * 1000).unref();
    agendarAvisoSemanal(pool); // e-mail semanal de documentos vencendo
    app.listen(PORT, () => {
      console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch((erro) => {
    console.error('❌ Erro ao preparar o banco de dados:', erro.message);
    process.exit(1);
  });
