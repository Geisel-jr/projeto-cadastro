const nodemailer = require('nodemailer');

// Envio de e-mails por SMTP. No Docker, o padrão é o Mailpit (http://localhost:8025),
// que recebe tudo e mostra numa página, sem entregar a ninguém. Para enviar de verdade
// (ex: Gmail), configure SMTP_HOST/SMTP_PORT/SMTP_SECURE/SMTP_USER/SMTP_PASS no .env.

// Configuração SMTP lida do ambiente (usada pela API e pelo testar-email.js)
function configuracaoSmtp() {
  const host = process.env.SMTP_HOST;
  const usuario = process.env.SMTP_USER || '';
  // O Google mostra a senha de app em grupos de 4 letras ("abcd efgh ..."); os espaços não fazem parte dela
  const senha = /gmail\.com$/i.test(host || '') ? (process.env.SMTP_PASS || '').replace(/\s+/g, '') : process.env.SMTP_PASS;
  return {
    host,
    transporte: host && {
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true na porta 465; false na 587 (STARTTLS)
      auth: usuario ? { user: usuario, pass: senha } : undefined,
    },
    // O Gmail troca qualquer remetente pela conta que fez o login; por isso o padrão é a própria conta
    remetente: process.env.SMTP_FROM || (usuario ? `CadastroHub <${usuario}>` : 'CadastroHub <nao-responda@cadastrohub.local>'),
  };
}

const smtp = configuracaoSmtp();
const REMETENTE = smtp.remetente;
// Endereço público do sistema, usado nos links. Vem da configuração e NUNCA do cabeçalho
// "Host" da requisição: senão um atacante poderia fazer o link do e-mail apontar para o site dele.
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

const transportador = smtp.transporte ? nodemailer.createTransport(smtp.transporte) : null;

if (!transportador) {
  console.warn('⚠️  SMTP_HOST não definido: e-mails serão apenas mostrados no log da API.');
}

const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Moldura HTML simples (tabelas e estilos inline, que é o que os clientes de e-mail entendem)
function html({ titulo, paragrafos, lista, botao, codigo, rodape }) {
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 16px;line-height:1.55">${escapar(p)}</p>`).join('')
    + (lista ? `<ul style="margin:0 0 16px;padding-left:20px;line-height:1.55">${lista.map((i) => `<li style="margin-bottom:6px">${escapar(i)}</li>`).join('')}</ul>` : '');
  const destaque = codigo
    ? `<p style="margin:8px 0 24px;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px">${escapar(codigo)}</p>`
    : '';
  const acao = botao
    ? `<p style="margin:24px 0"><a href="${escapar(botao.link)}" style="display:inline-block;background:#2952cc;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapar(botao.texto)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#52525b">Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all;color:#2952cc">${escapar(botao.link)}</span></p>`
    : '';
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f6f7;font-family:Segoe UI,Arial,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e6e9;border-radius:12px">
      <tr><td style="padding:28px 28px 8px;font-size:15px"><strong>Cadastro</strong>Hub</td></tr>
      <tr><td style="padding:8px 28px 12px">
        <h1 style="margin:0 0 16px;font-size:20px">${escapar(titulo)}</h1>
        ${corpo}${destaque}${acao}
        <p style="margin:24px 0 0;font-size:13px;color:#8a8a93">${escapar(rodape)}</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function enviar({ para, assunto, texto, conteudoHtml }) {
  if (!transportador) {
    console.log(`📧 [e-mail não enviado: SMTP não configurado] Para: ${para} | Assunto: ${assunto}\n${texto}`);
    return;
  }
  await transportador.sendMail({ from: REMETENTE, to: para, subject: assunto, text: texto, html: conteudoHtml });
}

function enviarLinkRecuperacao(usuario, token, minutos) {
  const link = `${APP_URL}/redefinir-senha?token=${encodeURIComponent(token)}`;
  const paragrafos = [
    `Olá, ${usuario.nome}.`,
    'Recebemos um pedido para redefinir a senha da sua conta no CadastroHub.',
    `O link abaixo vale por ${minutos} minutos e só pode ser usado uma vez.`,
  ];
  const rodape = 'Se você não pediu a troca de senha, ignore este e-mail: sua senha atual continua valendo.';
  return enviar({
    para: usuario.email,
    assunto: 'Redefinição de senha',
    texto: `${paragrafos.join('\n\n')}\n\nRedefinir senha: ${link}\n\n${rodape}`,
    conteudoHtml: html({ titulo: 'Redefinir sua senha', paragrafos, botao: { texto: 'Criar nova senha', link }, rodape }),
  });
}

function avisarSenhaAlterada(usuario) {
  const paragrafos = [
    `Olá, ${usuario.nome}.`,
    'A senha da sua conta no CadastroHub acabou de ser alterada, e as sessões abertas foram encerradas.',
  ];
  const rodape = 'Se não foi você, procure um administrador do sistema imediatamente.';
  return enviar({
    para: usuario.email,
    assunto: 'Sua senha foi alterada',
    texto: `${paragrafos.join('\n\n')}\n\n${rodape}`,
    conteudoHtml: html({ titulo: 'Sua senha foi alterada', paragrafos, rodape }),
  });
}

// Código da verificação em duas etapas. Fica fora do assunto para não aparecer em
// notificações na tela bloqueada do celular.
function enviarCodigoAcesso(usuario, codigo, minutos) {
  const paragrafos = [
    `Olá, ${usuario.nome}.`,
    `Use o código abaixo para concluir a entrada no CadastroHub. Ele vale por ${minutos} minutos.`,
  ];
  const rodape = 'Se não foi você que tentou entrar, troque sua senha agora: alguém pode conhecê-la.';
  return enviar({
    para: usuario.email,
    assunto: 'Seu código de acesso',
    texto: `${paragrafos.join('\n\n')}\n\nCódigo: ${codigo}\n\n${rodape}`,
    conteudoHtml: html({ titulo: 'Código de acesso', paragrafos, codigo, rodape }),
  });
}

// Resumo semanal dos documentos vencidos ou perto de vencer (ver avisos.js)
function enviarAvisoVencimentos(usuario, itens, dias) {
  const vencidos = itens.filter((i) => i.diasRestantes < 0).length;
  const aVencer = itens.length - vencidos;
  const prazo = (d) => {
    if (d < 0) return `venceu há ${-d} ${-d === 1 ? 'dia' : 'dias'}`;
    if (d === 0) return 'vence hoje';
    return `vence em ${d} ${d === 1 ? 'dia' : 'dias'}`;
  };
  const lista = itens.map((i) =>
    `${i.empresaNome}: ${i.tipo === 'Outros' && i.descricao ? i.descricao : i.tipo}, ${prazo(i.diasRestantes)} (${i.validade.split('-').reverse().join('/')})`);
  const resumo = [vencidos && `${vencidos} ${vencidos === 1 ? 'vencido' : 'vencidos'}`, aVencer && `${aVencer} a vencer`]
    .filter(Boolean).join(' e ');
  const paragrafos = [
    `Olá, ${usuario.nome}.`,
    `Estes documentos das empresas estão vencidos ou vencem nos próximos ${dias} dias:`,
  ];
  const rodape = 'Você recebe este e-mail toda semana por ser administrador do CadastroHub.';
  return enviar({
    para: usuario.email,
    assunto: `Documentos para renovar: ${resumo}`,
    texto: `${paragrafos.join('\n\n')}\n\n${lista.map((l) => `- ${l}`).join('\n')}\n\nAbrir o painel: ${APP_URL}\n\n${rodape}`,
    conteudoHtml: html({ titulo: 'Documentos para renovar', paragrafos, lista, botao: { texto: 'Abrir o painel', link: APP_URL }, rodape }),
  });
}

module.exports = { enviarLinkRecuperacao, avisarSenhaAlterada, enviarCodigoAcesso, enviarAvisoVencimentos, configuracaoSmtp };
