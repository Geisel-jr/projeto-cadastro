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
  global.fetch = jest.fn((url) => {
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
    return resposta(200, []);
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
