import { render, screen } from '@testing-library/react';
import App from './App';
import { mascaraCNPJ, mascaraCPF, validarCNPJ, validarCPF } from './utils/formatadores';

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
});

test('renderiza o menu principal', async () => {
  render(<App />);
  expect(screen.getByRole('button', { name: 'Empresas' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pessoas' })).toBeInTheDocument();
  expect(await screen.findAllByText(/nenhum cadastro ainda/i)).toHaveLength(2);
});

test('aplica máscaras de documentos', () => {
  expect(mascaraCPF('12345678909')).toBe('123.456.789-09');
  expect(mascaraCNPJ('11222333000181')).toBe('11.222.333/0001-81');
});

test('valida CPF e CNPJ', () => {
  expect(validarCPF('123.456.789-09')).toBe(true);
  expect(validarCPF('111.111.111-11')).toBe(false);
  expect(validarCNPJ('11.222.333/0001-81')).toBe(true);
  expect(validarCNPJ('11.222.333/0001-82')).toBe(false);
});
