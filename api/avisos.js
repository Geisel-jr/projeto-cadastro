const { buscarVencimentos } = require('./documentos');
const { enviarAvisoVencimentos } = require('./email');
const { ErroHttp } = require('./util');

// Aviso por e-mail, uma vez por semana, dos documentos vencidos ou que vencem nos próximos
// 30 dias. Vai para os administradores ativos. Configuração no .env:
//   AVISO_VENCIMENTOS=false   desliga o envio automático
//   AVISO_VENCIMENTOS_DIA=1   dia da semana (0 = domingo, 1 = segunda ... 6 = sábado)
//   AVISO_VENCIMENTOS_HORA=8  a partir de que hora, no fuso de FUSO_HORARIO
const LIGADO = process.env.AVISO_VENCIMENTOS !== 'false';
const DIA = Number(process.env.AVISO_VENCIMENTOS_DIA ?? 1);
const HORA = Number(process.env.AVISO_VENCIMENTOS_HORA ?? 8);
const FUSO = process.env.FUSO_HORARIO || 'America/Sao_Paulo';
const DIAS = 30;

// A conta de demonstração fica de fora: o e-mail dela não existe
async function administradores(pool) {
  const { rows } = await pool.query("SELECT nome, email FROM usuarios WHERE papel = 'admin' AND ativo AND NOT demo");
  return rows;
}

// Envia o aviso agora. Sem documentos para avisar, não manda nada.
async function enviarAviso(pool) {
  const { itens } = await buscarVencimentos(pool, DIAS);
  const destinatarios = itens.length ? await administradores(pool) : [];
  try {
    for (const admin of destinatarios) await enviarAvisoVencimentos(admin, itens, DIAS);
  } catch (erro) {
    console.error('Erro ao enviar o aviso de vencimentos:', erro.message);
    throw new ErroHttp(503, 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.');
  }
  return { documentos: itens.length, enviados: destinatarios.length };
}

// Data, dia da semana e hora de agora no fuso configurado (o container roda em UTC)
function agora() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  const semana = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { data: `${partes.year}-${partes.month}-${partes.day}`, diaSemana: semana[partes.weekday], hora: Number(partes.hour) };
}

// Confere a cada 30 minutos se chegou o dia e a hora. A data do último envio fica no banco
// (tabela configuracoes), então reiniciar a API não manda o aviso duas vezes no mesmo dia.
function agendarAvisoSemanal(pool) {
  if (!LIGADO) return;
  const conferir = async () => {
    const { data, diaSemana, hora } = agora();
    if (diaSemana !== DIA || hora < HORA) return;
    // Marca o dia antes de enviar; se já estava marcado, outro envio já aconteceu hoje
    const { rowCount } = await pool.query(
      `INSERT INTO configuracoes (chave, valor) VALUES ('aviso_vencimentos', $1)
       ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor WHERE configuracoes.valor <> EXCLUDED.valor`,
      [data]
    );
    if (!rowCount) return;
    const { documentos, enviados } = await enviarAviso(pool);
    console.log(`📅 Aviso semanal de vencimentos: ${documentos} documento(s), ${enviados} e-mail(s) enviado(s)`);
  };
  const executar = () => conferir().catch((erro) => console.error('Erro no aviso de vencimentos:', erro.message));
  executar();
  setInterval(executar, 30 * 60 * 1000).unref();
}

module.exports = { enviarAviso, agendarAvisoSemanal };
