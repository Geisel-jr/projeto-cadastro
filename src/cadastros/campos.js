// Funções genéricas que trabalham com a configuração de qualquer cadastro.
import { apenasDigitos } from '../utils/formatadores';
import { tipoDe } from './tipos';

// Lista todos os campos do cadastro, cada um sabendo em qual aba está
// (itens { secao } são só títulos visuais e ficam de fora)
export const camposDe = (config) =>
  config.abas.flatMap((aba) =>
    aba.campos.filter((campo) => campo.nome).map((campo) => ({ ...campo, aba: aba.id }))
  );

const visivel = (campo, dados) => !campo.visivel || campo.visivel(dados);

// Retorna { campo: 'mensagem de erro' } para cada campo inválido
export function validarFormulario(config, dados) {
  const erros = {};
  for (const campo of camposDe(config)) {
    if (!visivel(campo, dados)) continue;
    const valor = String(dados[campo.nome] ?? '').trim();

    if (!valor) {
      if (campo.obrigatorio) erros[campo.nome] = 'Campo obrigatório.';
      continue;
    }
    const erro = tipoDe(campo).validar?.(valor)
      || (campo.max && valor.length > campo.max ? `Máximo de ${campo.max} caracteres.` : null)
      || campo.validar?.(valor, dados);
    if (erro) erros[campo.nome] = erro;
  }
  return erros;
}

// Aplica a máscara do campo (se houver) a um valor vindo da API ou de uma consulta
export const formatarEntrada = (campo, valor) => {
  if (valor === null || valor === undefined) return '';
  const { mascara } = tipoDe(campo);
  return mascara ? mascara(valor) : String(valor);
};

// Valor vindo de uma consulta externa, respeitando o tamanho máximo do campo
export const formatarConsulta = (campo, valor) => {
  const texto = formatarEntrada(campo, valor);
  return campo.max ? texto.slice(0, campo.max).trim() : texto;
};

export function formularioVazio(config) {
  return Object.fromEntries(camposDe(config).map((campo) => [campo.nome, '']));
}

// Registro da API -> valores do formulário
export function paraFormulario(config, registro) {
  const dados = Object.fromEntries(
    camposDe(config).map((campo) => [campo.nome, formatarEntrada(campo, registro[campo.nome])])
  );
  return config.aoCarregar ? config.aoCarregar(dados, registro) : dados;
}

// Valores do formulário -> corpo enviado para a API
export function paraEnvio(config, dados) {
  const corpo = {};
  for (const campo of camposDe(config)) {
    if (campo.somenteFormulario) continue;
    let valor = String(dados[campo.nome] ?? '').trim();
    if (tipoDe(campo).digitos) valor = apenasDigitos(valor);
    corpo[campo.nome] = valor === '' ? null : valor;
  }
  return config.antesDeEnviar ? config.antesDeEnviar(corpo, dados) : corpo;
}

// Valor legível para exibir no histórico
export function formatarValor(campo, valor, registro) {
  if (campo.exibir) return campo.exibir(valor, registro);
  if (valor === null || valor === undefined || valor === '') return '—';
  const { mascara, formatar } = tipoDe(campo);
  if (mascara) return mascara(valor);
  if (formatar) return formatar(valor);
  return String(valor);
}
