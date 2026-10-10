// URL base da API. Pode ser trocada no build com a variável REACT_APP_API_URL.
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

async function requisicao(caminho, opcoes = {}) {
  const response = await fetch(`${API_URL}${caminho}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
  });

  const corpo = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(corpo?.error || `Erro ${response.status}`);
  }
  return corpo;
}

export const listarEmpresas = () => requisicao('/empresas');
export const criarEmpresa = (dados) =>
  requisicao('/empresas', { method: 'POST', body: JSON.stringify(dados) });

export const listarPessoas = () => requisicao('/pessoas');
export const criarPessoa = (dados) =>
  requisicao('/pessoas', { method: 'POST', body: JSON.stringify(dados) });
