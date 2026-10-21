// Sessão do usuário no navegador.
//
// - O token de acesso (JWT, 15 min) fica SÓ na memória desta aba: some ao recarregar e
//   nunca vai para o localStorage, onde um script malicioso (XSS) conseguiria lê-lo.
// - O refresh token fica num cookie httpOnly que o JavaScript não enxerga; a API o usa
//   em /api/auth/renovar para entregar um novo token de acesso.

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

let tokenAcesso = null;
let renovacaoEmAndamento = null;
const ouvintes = new Set();

// Avisa o App quando a sessão termina (ex: refresh token expirou ou foi revogado)
export const aoEncerrarSessao = (funcao) => {
  ouvintes.add(funcao);
  return () => ouvintes.delete(funcao);
};

export const obterToken = () => tokenAcesso;
export const definirToken = (token) => { tokenAcesso = token; };

export function encerrarSessaoLocal(motivo) {
  tokenAcesso = null;
  ouvintes.forEach((funcao) => funcao(motivo));
}

// Segundos até o token expirar (lido do próprio JWT, sem validar: quem valida é a API)
function segundosRestantes(token) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return exp - Date.now() / 1000;
  } catch {
    return 0;
  }
}

async function chamarAuth(caminho, corpo) {
  const response = await fetch(`${API_URL}/auth/${caminho}`, {
    method: 'POST',
    credentials: 'include', // envia/recebe o cookie do refresh token
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CadastroHub' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await response.json().catch(() => null);
  if (!response.ok) {
    const erro = new Error(dados?.error || `Erro ${response.status}`);
    erro.status = response.status;
    erro.campos = dados?.erros;
    throw erro;
  }
  return dados;
}

// Renova o token. Chamadas simultâneas reaproveitam a mesma renovação (uma só ida à API).
export function renovar() {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = chamarAuth('renovar')
      .catch(async (erro) => {
        // Outra aba pode ter acabado de renovar o mesmo cookie: tenta uma vez mais
        if (erro.status !== 401) throw erro;
        await new Promise((r) => setTimeout(r, 400));
        return chamarAuth('renovar');
      })
      .then((dados) => {
        tokenAcesso = dados.tokenAcesso;
        return dados;
      })
      .finally(() => { renovacaoEmAndamento = null; });
  }
  return renovacaoEmAndamento;
}

// Garante um token válido por pelo menos 30 segundos antes de uma requisição
export async function garantirToken() {
  if (tokenAcesso && segundosRestantes(tokenAcesso) > 30) return tokenAcesso;
  try {
    return (await renovar()).tokenAcesso;
  } catch (erro) {
    if (erro.status === 401) encerrarSessaoLocal('expirada');
    throw erro;
  }
}

export const entrar = async (email, senha) => {
  const dados = await chamarAuth('login', { email, senha });
  tokenAcesso = dados.tokenAcesso;
  return dados.usuario;
};

export const entrarComGoogle = async (credencial) => {
  const dados = await chamarAuth('google', { credencial });
  tokenAcesso = dados.tokenAcesso;
  return dados.usuario;
};

// Ao abrir o sistema: se ainda houver cookie válido, recupera a sessão sem pedir login.
// (Sem a segunda tentativa de renovar(): aqui não há outra aba disputando o mesmo cookie.)
export async function restaurarSessao() {
  const dados = await chamarAuth('renovar');
  tokenAcesso = dados.tokenAcesso;
  return dados.usuario;
}

export async function sair() {
  try {
    await chamarAuth('sair');
  } finally {
    tokenAcesso = null;
  }
}
