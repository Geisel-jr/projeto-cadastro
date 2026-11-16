import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import empresa from './cadastros/empresa';
import pessoa from './cadastros/pessoa';
import { paraEnvio, paraFormulario, validarFormulario } from './cadastros/campos';
import { mascaraCNPJ, mascaraCPF, validarCNPJ, validarCPF } from './utils/formatadores';

// JWT de teste: só o campo "exp" importa para o front (quem valida a assinatura é a API)
const tokenFalso = () => {
  const corpo = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }));
  return `cabecalho.${corpo}.assinatura`;
};
const usuarioTeste = {
  id: 1, nome: 'Ana Souza', email: 'ana@empresa.com', papel: 'operador',
  temSenha: true, temGoogle: false, deveTrocarSenha: false,
};
const resposta = (status, corpo) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(corpo) });

// Respostas falsas da API. "loginResponde" define o que o POST /auth/login devolve.
let loginResponde;
beforeEach(() => {
  window.history.pushState({}, '', '/');
  loginResponde = () => resposta(200, { tokenAcesso: tokenFalso(), usuario: usuarioTeste });
  global.fetch = vi.fn((url, opcoes) => {
    if (url.includes('/auth/renovar')) return resposta(401, { error: 'Sessão encerrada.' });
    if (url.includes('/auth/config')) return resposta(200, { googleClientId: null });
    if (url.includes('/auth/login')) return loginResponde();
    if (url.includes('/resumo')) return resposta(200, { empresas: 0, empresasExcluidas: 0, pessoas: 0, pessoasExcluidas: 0, acoesDia: 0 });
    if (url.includes('/auditoria')) return resposta(200, { itens: [], temMais: false });
    if (url.includes('/documentos/vencimentos')) {
      return resposta(200, {
        dias: 30, vencidos: 1, aVencer: 0,
        itens: [{ id: 9, empresaId: 3, tipo: 'Alvará de Funcionamento', descricao: null, validade: '2026-01-10', diasRestantes: -5, empresaNome: 'Padaria Sol' }],
      });
    }
    if (url.includes('/opcoes')) return resposta(200, []);
    if (url.includes('/auth/esqueci')) return resposta(202, { mensagem: 'ok' });
    if (url.includes('/auth/redefinir/verificar')) {
      return JSON.parse(opcoes?.body || '{}').token === 'valido'
        ? resposta(200, { email: 'an***@empresa.com' })
        : resposta(400, { error: 'Este link é inválido ou expirou.' });
    }
    if (url.includes('/auth/redefinir')) return resposta(200, { mensagem: 'Senha alterada.' });
    if (url.includes('/auth/mfa')) {
      const { codigo } = JSON.parse(opcoes?.body || '{}');
      if (codigo === '123456') return resposta(200, { tokenAcesso: tokenFalso(), usuario: { ...usuarioTeste, papel: 'admin' } });
      if (codigo === '999999') return resposta(410, { error: 'Este código expirou. Entre de novo para receber outro.' });
      return resposta(401, { error: 'Código incorreto. Restam 4 tentativas.' });
    }
    return resposta(200, { itens: [], total: 0, pagina: 1, paginas: 1, limite: 20 });
  });
});

const preencherLogin = async () => {
  fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'ana@empresa.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
};

test('sem sessão, mostra a tela de login e entra no sistema', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  await preencherLogin();

  expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument();
  expect(screen.getByTitle('Ana Souza')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Usuários' })).not.toBeInTheDocument(); // operador não vê
});

test('painel mostra os documentos vencidos com link para a empresa', async () => {
  render(<App />);
  await preencherLogin();
  const item = await screen.findByText('Alvará de Funcionamento');
  expect(screen.getByText('Vencido há 5 dias')).toBeInTheDocument();
  expect(item.closest('a')).toHaveAttribute('href', '/empresas/3');
});

test('link direto abre a página pedida depois do login', async () => {
  window.history.pushState({}, '', '/pessoas');
  render(<App />);
  await preencherLogin();
  expect(await screen.findByRole('heading', { name: 'Pessoas' })).toBeInTheDocument();
  expect(document.title).toBe('Pessoas · CadastroHub');
});

test('endereço inexistente mostra "Página não encontrada"', async () => {
  window.history.pushState({}, '', '/qualquer-coisa');
  render(<App />);
  await preencherLogin();
  expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
});

test('lista pede a página e a busca da URL ao servidor e mostra a paginação', async () => {
  window.history.pushState({}, '', '/empresas?q=p%C3%A3o&pagina=2');
  const empresaFalsa = (id) => ({ id, nome: `Empresa ${id}`, cnpj: '11222333000181', email: 'a@b.com', telefone: '11988887777' });
  const fetchPadrao = global.fetch;
  global.fetch = vi.fn((url, opcoes) => (url.includes('/api/empresas?')
    ? resposta(200, { itens: [empresaFalsa(21), empresaFalsa(22)], total: 57, pagina: 2, paginas: 3, limite: 20 })
    : fetchPadrao(url, opcoes)));

  render(<App />);
  await preencherLogin();
  expect(await screen.findByText('Empresa 21')).toBeInTheDocument();

  const chamada = global.fetch.mock.calls.map(([url]) => url).find((url) => url.includes('/api/empresas?'));
  expect(chamada).toContain('q=p%C3%A3o');
  expect(chamada).toContain('pagina=2');
  expect(screen.getByText('21–40')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');
});

test('"Esqueci minha senha" envia o pedido e mostra a confirmação', async () => {
  render(<App />);
  fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'ana@empresa.com' } });
  fireEvent.click(screen.getByRole('link', { name: 'Esqueci minha senha' }));

  // o e-mail digitado no login já vem preenchido
  expect(await screen.findByRole('heading', { name: 'Esqueci minha senha' })).toBeInTheDocument();
  expect(screen.getByLabelText('E-mail')).toHaveValue('ana@empresa.com');
  fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

  expect(await screen.findByRole('heading', { name: 'Confira seu e-mail' })).toBeInTheDocument();
  const pedido = global.fetch.mock.calls.find(([url]) => url.includes('/auth/esqueci'));
  expect(JSON.parse(pedido[1].body)).toEqual({ email: 'ana@empresa.com' });
});

test('link do e-mail válido permite criar a nova senha e tira o código da barra de endereço', async () => {
  window.history.pushState({}, '', '/redefinir-senha?token=valido');
  render(<App />);
  expect(await screen.findByText('an***@empresa.com')).toBeInTheDocument();
  expect(window.location.search).toBe('');

  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'NovaSenha2026' } });
  fireEvent.change(screen.getByLabelText('Confirme a nova senha'), { target: { value: 'NovaSenha2026' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
  expect(await screen.findByRole('heading', { name: 'Senha alterada' })).toBeInTheDocument();
});

test('link do e-mail expirado mostra como pedir um novo', async () => {
  window.history.pushState({}, '', '/redefinir-senha?token=vencido');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Link inválido ou expirado' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Pedir novo link' })).toHaveAttribute('href', '/esqueci-senha');
});

test('login recusado mostra a mensagem da API', async () => {
  loginResponde = () => resposta(401, { error: 'E-mail ou senha incorretos.' });
  render(<App />);
  await preencherLogin();
  expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
});

test('senha provisória exige a troca antes de mostrar o sistema', async () => {
  loginResponde = () => resposta(200, { tokenAcesso: tokenFalso(), usuario: { ...usuarioTeste, deveTrocarSenha: true } });
  render(<App />);
  await preencherLogin();
  expect(await screen.findByText('Crie sua senha')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Painel' })).not.toBeInTheDocument();
});

test('sem conta de demonstração, a tela de login não mostra dados de acesso', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  expect(screen.queryByText('Conta de demonstração')).not.toBeInTheDocument();
});

test('conta de demonstração aparece na tela de login, sem preencher o formulário', async () => {
  const fetchPadrao = global.fetch;
  global.fetch = vi.fn((url, opcoes) => (url.includes('/auth/config')
    ? resposta(200, { googleClientId: null, demo: { email: 'demo@cadastrohub.local', senha: 'Demo@2026' } })
    : fetchPadrao(url, opcoes)));

  render(<App />);
  expect(await screen.findByText('Conta de demonstração')).toBeInTheDocument();
  expect(screen.getByText('demo@cadastrohub.local')).toBeInTheDocument();
  expect(screen.getByText('Demo@2026')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copiar senha' })).toBeInTheDocument();
  // a pessoa ainda precisa colar os dados
  expect(screen.getByLabelText('E-mail')).toHaveValue('');
  expect(screen.getByLabelText('Senha')).toHaveValue('');
});

test('lista de pessoas mostra o CPF mascarado e exporta a planilha com a busca atual', async () => {
  window.history.pushState({}, '', '/pessoas?q=ana');
  const pessoaFalsa = { id: 4, nome: 'Ana Souza', cpf: '***.456.789-**', email: 'ana@empresa.com', telefone: '11988887777', dataNascimento: '1990-01-01' };
  const fetchPadrao = global.fetch;
  global.fetch = vi.fn((url, opcoes) => {
    if (url.includes('/api/pessoas/exportar')) {
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: () => 'attachment; filename="pessoas-2026-11-14.csv"' },
        blob: () => Promise.resolve(new Blob(['Nome;CPF'])),
      });
    }
    if (url.includes('/api/pessoas?')) return resposta(200, { itens: [pessoaFalsa], total: 1, pagina: 1, paginas: 1, limite: 20 });
    return fetchPadrao(url, opcoes);
  });
  URL.createObjectURL = vi.fn(() => 'blob:planilha');
  URL.revokeObjectURL = vi.fn();
  const clicarLink = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  render(<App />);
  await preencherLogin();
  expect(await screen.findByText('***.456.789-**')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
  expect(await screen.findByText('Planilha gerada')).toBeInTheDocument();
  const pedido = global.fetch.mock.calls.map(([url]) => url).find((url) => url.includes('/exportar'));
  expect(pedido).toContain('q=ana');
  expect(clicarLink).toHaveBeenCalled();
  clicarLink.mockRestore();
});

test('administrador manda o aviso de vencimentos por e-mail pelo painel', async () => {
  loginResponde = () => resposta(200, { tokenAcesso: tokenFalso(), usuario: { ...usuarioTeste, papel: 'admin' } });
  const fetchPadrao = global.fetch;
  global.fetch = vi.fn((url, opcoes) => (url.includes('/vencimentos/aviso')
    ? resposta(200, { documentos: 1, enviados: 2 })
    : fetchPadrao(url, opcoes)));

  render(<App />);
  await preencherLogin();
  fireEvent.click(await screen.findByRole('button', { name: 'Enviar agora' }));
  expect(await screen.findByText('E-mail enviado para 2 administradores.')).toBeInTheDocument();
});

test('operador não vê o botão de mandar o aviso por e-mail', async () => {
  render(<App />);
  await preencherLogin();
  expect(await screen.findByText('Alvará de Funcionamento')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enviar agora' })).not.toBeInTheDocument();
});

const desafioFalso = { desafio: 'abc', email: 'an***@empresa.com', minutos: 10, reenviarEm: 30, reenvios: 2 };

test('administrador confirma o login com o código enviado por e-mail', async () => {
  loginResponde = () => resposta(200, { mfa: desafioFalso });
  render(<App />);
  await preencherLogin();

  expect(await screen.findByRole('heading', { name: 'Confirme que é você' })).toBeInTheDocument();
  expect(screen.getByText('an***@empresa.com')).toBeInTheDocument();
  expect(screen.getByText(/peça outro código em 30s/)).toBeInTheDocument();

  // código errado: mostra o erro e continua na mesma etapa
  fireEvent.change(screen.getByLabelText('Código de acesso'), { target: { value: '000000' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Código incorreto. Restam 4 tentativas.');

  // código colado com espaço: ao completar os 6 números, confirma sozinho
  fireEvent.change(screen.getByLabelText('Código de acesso'), { target: { value: '123 456' } });
  expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument();
  const pedido = global.fetch.mock.calls.filter(([url]) => url.includes('/auth/mfa')).pop();
  expect(JSON.parse(pedido[1].body)).toEqual({ desafio: 'abc', codigo: '123456' });
});

test('código expirado volta para a tela de senha com o aviso', async () => {
  loginResponde = () => resposta(200, { mfa: desafioFalso });
  render(<App />);
  await preencherLogin();
  fireEvent.change(await screen.findByLabelText('Código de acesso'), { target: { value: '999999' } });

  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Este código expirou. Entre de novo para receber outro.');
});

test('aplica máscaras e valida documentos', () => {
  expect(mascaraCPF('12345678909')).toBe('123.456.789-09');
  expect(mascaraCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  expect(validarCPF('123.456.789-09')).toBe(true);
  expect(validarCPF('111.111.111-11')).toBe(false);
  expect(validarCNPJ('11.222.333/0001-81')).toBe(true);
  expect(validarCNPJ('11.222.333/0001-82')).toBe(false);
});

test('valida campos obrigatórios do formulário de empresa', () => {
  const erros = validarFormulario(empresa, {});
  expect(Object.keys(erros).sort()).toEqual(['cep', 'cnpj', 'email', 'nome', 'telefone']);
});

test('profissão "Outros" usa o texto digitado ao enviar e ao carregar', () => {
  const dados = { ...paraFormulario(pessoa, {}), profissao: 'Outros', profissaoOutra: 'Designer', cpf: '123.456.789-09' };
  const corpo = paraEnvio(pessoa, dados);
  expect(corpo.profissao).toBe('Designer');
  expect(corpo.cpf).toBe('12345678909');
  expect(corpo).not.toHaveProperty('profissaoOutra');

  const carregado = paraFormulario(pessoa, { profissao: 'Designer' });
  expect(carregado.profissao).toBe('Outros');
  expect(carregado.profissaoOutra).toBe('Designer');
});
