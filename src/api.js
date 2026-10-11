import { obterOperador } from './operador';

// URL base da API. Pode ser trocada no build com a variável REACT_APP_API_URL.
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

async function requisicao(caminho, { metodo = 'GET', corpo } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const operador = obterOperador();
  // encodeURIComponent porque cabeçalhos HTTP não aceitam acentos
  if (operador) headers['X-Usuario'] = encodeURIComponent(operador);

  const response = await fetch(`${API_URL}${caminho}`, {
    method: metodo,
    headers,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const dados = await response.json().catch(() => null);

  if (!response.ok) {
    const erro = new Error(dados?.error || `Erro ${response.status}`);
    erro.campos = dados?.erros; // erros por campo, ex: { cnpj: 'CNPJ inválido.' }
    throw erro;
  }
  return dados;
}

export const api = {
  listar: (entidade, status = 'ativos') => requisicao(`/${entidade}?status=${status}`),
  obter: (entidade, id) => requisicao(`/${entidade}/${id}`),
  historico: (entidade, id) => requisicao(`/${entidade}/${id}/historico`),
  criar: (entidade, dados) => requisicao(`/${entidade}`, { metodo: 'POST', corpo: dados }),
  atualizar: (entidade, id, dados) => requisicao(`/${entidade}/${id}`, { metodo: 'PUT', corpo: dados }),
  excluir: (entidade, id, motivo) => requisicao(`/${entidade}/${id}`, { metodo: 'DELETE', corpo: { motivo } }),
  restaurar: (entidade, id) => requisicao(`/${entidade}/${id}/restaurar`, { metodo: 'POST' }),
  auditoria: (filtros) => requisicao(`/auditoria?${new URLSearchParams(filtros)}`),
  resumo: () => requisicao('/resumo'),
};

// Mensagem amigável para mostrar ao usuário
export const mensagemErro = (erro) =>
  erro instanceof TypeError ? 'Não foi possível conectar ao servidor.' : erro.message;

// ========== DOCUMENTOS ==========

export const documentos = {
  tipos: () => requisicao('/documentos/tipos'),
  listar: (empresaId, status = 'ativos') => requisicao(`/empresas/${empresaId}/documentos?status=${status}`),
  remover: (empresaId, id, motivo) =>
    requisicao(`/empresas/${empresaId}/documentos/${id}`, { metodo: 'DELETE', corpo: { motivo } }),
  restaurar: (empresaId, id) => requisicao(`/empresas/${empresaId}/documentos/${id}/restaurar`, { metodo: 'POST' }),
  url: (empresaId, id, download = false) =>
    `${API_URL}/empresas/${empresaId}/documentos/${id}/arquivo${download ? '?download=1' : ''}`,

  // Envia o arquivo informando o progresso (0 a 1). Usa XMLHttpRequest porque o fetch
  // não informa o progresso do envio.
  enviar: (empresaId, { arquivo, tipo, descricao, validade }, aoProgredir) =>
    new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('tipo', tipo);
      if (descricao) form.append('descricao', descricao);
      if (validade) form.append('validade', validade);
      form.append('arquivo', arquivo);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/empresas/${empresaId}/documentos`);
      const operador = obterOperador();
      if (operador) xhr.setRequestHeader('X-Usuario', encodeURIComponent(operador));

      xhr.upload.onprogress = (e) => e.lengthComputable && aoProgredir?.(e.loaded / e.total);
      xhr.onerror = () => reject(new TypeError('Falha de rede'));
      xhr.onload = () => {
        let dados = null;
        try { dados = JSON.parse(xhr.responseText); } catch { /* resposta sem JSON */ }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(dados);
        const erro = new Error(dados?.error || `Erro ${xhr.status}`);
        erro.campos = dados?.erros;
        reject(erro);
      };
      xhr.send(form);
    }),
};
