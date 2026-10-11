// Guarda o nome de quem está usando o sistema. Ele é enviado em toda alteração
// e fica registrado na auditoria. Quando o sistema tiver login, é só trocar
// esta origem pelo usuário autenticado.

const CHAVE = 'cadastrohub:operador';
let emMemoria = '';

export function obterOperador() {
  try {
    return localStorage.getItem(CHAVE) || emMemoria;
  } catch {
    return emMemoria;
  }
}

export function definirOperador(nome) {
  emMemoria = nome;
  try {
    localStorage.setItem(CHAVE, nome);
  } catch {
    // sem localStorage (aba anônima, por exemplo): fica só em memória
  }
}
