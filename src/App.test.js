import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import empresa from './cadastros/empresa';
import pessoa from './cadastros/pessoa';
import { paraEnvio, paraFormulario, validarFormulario } from './cadastros/campos';
import { mascaraCNPJ, mascaraCPF, validarCNPJ, validarCPF } from './utils/formatadores';

// Respostas falsas da API para os testes
beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn((url) => {
    const corpo = url.includes('/resumo')
      ? { empresas: 0, empresasExcluidas: 0, pessoas: 0, pessoasExcluidas: 0, acoesDia: 0 }
      : url.includes('/auditoria') ? { itens: [], temMais: false } : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(corpo) });
  });
});

test('pede a identificação do operador no primeiro acesso', async () => {
  render(<App />);
  expect(screen.getByText('Identificação do operador')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/seu nome/i), { target: { value: 'Ana Souza' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

  expect(screen.queryByText('Identificação do operador')).not.toBeInTheDocument();
  expect(screen.getByTitle('Trocar operador')).toHaveTextContent('Ana Souza');
  expect(await screen.findByText('Nenhuma ação registrada.')).toBeInTheDocument();
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
