import { API_URL, definirToken, encerrarSessaoLocal, garantirToken, renovar } from './sessao';

export { API_URL };

// Requisição autenticada: envia o token de acesso e, se a API disser que ele expirou,
// renova uma vez e repete a chamada.
async function requisicao(caminho, { metodo = 'GET', corpo, tentouRenovar = false } = {}) {
  const token = await garantirToken();
  const response = await fetch(`${API_URL}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  if (response.status === 401 && !tentouRenovar) {
    try {
      await renovar();
    } catch {
      encerrarSessaoLocal('expirada');
      throw new Error('Sua sessão expirou. Entre novamente.');
    }
    return requisicao(caminho, { metodo, corpo, tentouRenovar: true });
  }

  if (response.status === 204) return null;
  const dados = await response.json().catch(() => null);

  if (!response.ok) {
    const erro = new Error(dados?.error || `Erro ${response.status}`);
    erro.status = response.status;
    erro.campos = dados?.erros; // erros por campo, ex: { cnpj: 'CNPJ inválido.' }
    throw erro;
  }
  return dados;
}

export const api = {
  // filtros: { status, q, pagina, limite, ordem, direcao } — valores vazios não vão na URL
  listar: (entidade, filtros = {}) => {
    const busca = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v != null));
    return requisicao(`/${entidade}?${busca}`);
  },
  // id e nome de todos os ativos (para campos de seleção)
  opcoes: (entidade) => requisicao(`/${entidade}/opcoes`),
  obter: (entidade, id) => requisicao(`/${entidade}/${id}`),
  historico: (entidade, id) => requisicao(`/${entidade}/${id}/historico`),
  criar: (entidade, dados) => requisicao(`/${entidade}`, { metodo: 'POST', corpo: dados }),
  atualizar: (entidade, id, dados) => requisicao(`/${entidade}/${id}`, { metodo: 'PUT', corpo: dados }),
  excluir: (entidade, id, motivo) => requisicao(`/${entidade}/${id}`, { metodo: 'DELETE', corpo: { motivo } }),
  restaurar: (entidade, id) => requisicao(`/${entidade}/${id}/restaurar`, { metodo: 'POST' }),
  auditoria: (filtros) => requisicao(`/auditoria?${new URLSearchParams(filtros)}`),
  resumo: () => requisicao('/resumo'),
};

// ========== CONTA E USUÁRIOS ==========

export const conta = {
  // Público: diz se o login com Google está configurado
  configuracao: () => fetch(`${API_URL}/auth/config`).then((r) => r.json()),
  trocarSenha: async (senhaAtual, novaSenha) => {
    const dados = await requisicao('/auth/trocar-senha', { metodo: 'POST', corpo: { senhaAtual, novaSenha } });
    definirToken(dados.tokenAcesso); // token novo, já sem a marca de senha provisória
    return dados.usuario;
  },
};

export const usuarios = {
  listar: () => requisicao('/usuarios'),
  criar: (dados) => requisicao('/usuarios', { metodo: 'POST', corpo: dados }),
  atualizar: (id, dados) => requisicao(`/usuarios/${id}`, { metodo: 'PUT', corpo: dados }),
  redefinirSenha: (id, senha) => requisicao(`/usuarios/${id}/redefinir-senha`, { metodo: 'POST', corpo: { senha } }),
};

// Mensagem amigável para mostrar ao usuário
export const mensagemErro = (erro) =>
  erro instanceof TypeError ? 'Não foi possível conectar ao servidor.' : erro.message;

// ========== DOCUMENTOS ==========

export const documentos = {
  tipos: () => requisicao('/documentos/tipos'),
  vencimentos: (dias = 30) => requisicao(`/documentos/vencimentos?dias=${dias}`),
  listar: (empresaId, status = 'ativos') => requisicao(`/empresas/${empresaId}/documentos?status=${status}`),
  remover: (empresaId, id, motivo) =>
    requisicao(`/empresas/${empresaId}/documentos/${id}`, { metodo: 'DELETE', corpo: { motivo } }),
  restaurar: (empresaId, id) => requisicao(`/empresas/${empresaId}/documentos/${id}/restaurar`, { metodo: 'POST' }),

  // O arquivo também exige login, então não dá para usar um link simples (o navegador
  // não envia o token). Baixamos com o token e abrimos/salvamos a partir da memória.
  abrir: async (empresaId, doc, { baixar = false } = {}) => {
    // A aba é aberta já no clique; se esperar o download, o navegador a bloqueia como pop-up
    const janela = baixar ? null : window.open('', '_blank');
    let response;
    try {
      const token = await garantirToken();
      response = await fetch(`${API_URL}/empresas/${empresaId}/documentos/${doc.id}/arquivo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (erro) {
      janela?.close();
      throw erro;
    }
    if (!response.ok) {
      janela?.close();
      throw new Error(response.status === 404 ? 'Arquivo não encontrado.' : 'Não foi possível abrir o arquivo.');
    }

    const url = URL.createObjectURL(await response.blob());
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (janela) {
      janela.location.href = url;
      return;
    }
    // Download, ou a aba foi bloqueada: usa um link temporário
    const link = Object.assign(document.createElement('a'), { href: url, rel: 'noopener' });
    if (baixar) link.download = doc.nomeArquivo;
    else link.target = '_blank';
    link.click();
  },

  // Envia o arquivo informando o progresso (0 a 1). Usa XMLHttpRequest porque o fetch
  // não informa o progresso do envio.
  enviar: async (empresaId, { arquivo, tipo, descricao, validade }, aoProgredir) => {
    const token = await garantirToken();
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('tipo', tipo);
      if (descricao) form.append('descricao', descricao);
      if (validade) form.append('validade', validade);
      form.append('arquivo', arquivo);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/empresas/${empresaId}/documentos`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

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
    });
  },
};
