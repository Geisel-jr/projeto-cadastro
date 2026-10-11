// Validações feitas no servidor. O front também valida, mas a API não pode
// confiar nisso: qualquer pessoa pode chamar a API diretamente.
//
// Cada cadastro é descrito por uma lista de regras { campo, tipo, obrigatorio, ... }.
// Só os campos listados aqui são aceitos e gravados no banco.

const apenasDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');
const hoje = () => new Date().toISOString().slice(0, 10);

function validarCPF(cpf) {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calcularDigito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
}

function validarCNPJ(cnpj) {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calcularDigito = (tamanho) => {
    const pesos = tamanho === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, peso, i) => acc + Number(cnpj[i]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calcularDigito(12) === Number(cnpj[12]) && calcularDigito(13) === Number(cnpj[13]);
}

// Como cada tipo de campo é limpo antes de validar (vazio vira null)
const NORMALIZAR = {
  texto: (v) => String(v ?? '').trim() || null,
  email: (v) => String(v ?? '').trim().toLowerCase() || null,
  digitos: (v) => apenasDigitos(v) || null,
  uf: (v) => String(v ?? '').trim().toUpperCase() || null,
  inteiro: (v) => (v === null || v === undefined || v === '' ? null : Number(v)),
};

// Como cada tipo é validado (retorna a mensagem de erro, ou null se estiver ok)
const VALIDAR = {
  email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'E-mail inválido.'),
  cpf: (v) => (validarCPF(v) ? null : 'CPF inválido.'),
  cnpj: (v) => (validarCNPJ(v) ? null : 'CNPJ inválido.'),
  cep: (v) => (v.length === 8 ? null : 'CEP deve ter 8 dígitos.'),
  telefone: (v) => ([10, 11].includes(v.length) ? null : 'Telefone deve ter DDD + número.'),
  uf: (v) => (/^[A-Z]{2}$/.test(v) ? null : 'UF inválida.'),
  inteiro: (v) => (Number.isInteger(v) && v > 0 ? null : 'Valor inválido.'),
  data: (v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) return 'Data inválida.';
    return v > hoje() ? 'A data não pode ser no futuro.' : null;
  },
};

const TIPO_NORMALIZACAO = {
  email: 'email', cpf: 'digitos', cnpj: 'digitos', cep: 'digitos', telefone: 'digitos', uf: 'uf', inteiro: 'inteiro',
};

// Valida o corpo da requisição de acordo com as regras. Retorna { dados, erros }.
function validar(regras, corpo = {}) {
  const dados = {};
  const erros = {};

  for (const regra of regras) {
    const valor = NORMALIZAR[TIPO_NORMALIZACAO[regra.tipo] || 'texto'](corpo[regra.campo]);
    dados[regra.campo] = valor;

    if (valor === null) {
      if (regra.obrigatorio) erros[regra.campo] = 'Campo obrigatório.';
      continue;
    }

    let erro = VALIDAR[regra.tipo]?.(valor) || null;
    if (!erro && regra.max && String(valor).length > regra.max) erro = `Máximo de ${regra.max} caracteres.`;
    if (!erro && regra.opcoes && !regra.opcoes.includes(valor)) erro = 'Opção inválida.';
    if (!erro && regra.validar) erro = regra.validar(valor);
    if (erro) erros[regra.campo] = erro;
  }

  return { dados, erros };
}

const ENDERECO = [
  { campo: 'logradouro', max: 200 },
  { campo: 'numero', max: 10 },
  { campo: 'complemento', max: 100 },
  { campo: 'bairro', max: 100 },
  { campo: 'cidade', max: 100 },
  { campo: 'estado', tipo: 'uf' },
];

const REGRAS_EMPRESA = [
  { campo: 'nome', obrigatorio: true, max: 150 },
  { campo: 'nomeFantasia', max: 150 },
  { campo: 'cnpj', tipo: 'cnpj', obrigatorio: true },
  { campo: 'inscricaoEstadual', max: 20 },
  { campo: 'inscricaoMunicipal', max: 20 },
  { campo: 'dataAbertura', tipo: 'data' },
  { campo: 'porte', opcoes: ['MEI', 'ME', 'EPP', 'Médio', 'Grande'] },
  { campo: 'ramoAtividade', max: 150 },
  { campo: 'email', tipo: 'email', obrigatorio: true, max: 150 },
  { campo: 'telefone', tipo: 'telefone', obrigatorio: true },
  { campo: 'celular', tipo: 'telefone' },
  { campo: 'site', max: 200 },
  { campo: 'cep', tipo: 'cep', obrigatorio: true },
  ...ENDERECO,
  { campo: 'observacoes', max: 2000 },
];

const REGRAS_PESSOA = [
  {
    campo: 'nome',
    obrigatorio: true,
    max: 150,
    validar: (v) => (v.split(/\s+/).length < 2 ? 'Informe nome e sobrenome.' : null),
  },
  { campo: 'nomeSocial', max: 150 },
  { campo: 'cpf', tipo: 'cpf', obrigatorio: true },
  { campo: 'rg', max: 20 },
  { campo: 'orgaoEmissor', max: 20 },
  { campo: 'dataNascimento', tipo: 'data', obrigatorio: true },
  { campo: 'sexo', opcoes: ['Feminino', 'Masculino', 'Outro', 'Prefiro não informar'] },
  { campo: 'estadoCivil', opcoes: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'] },
  { campo: 'email', tipo: 'email', obrigatorio: true, max: 150 },
  { campo: 'telefone', tipo: 'telefone', obrigatorio: true },
  { campo: 'celular', tipo: 'telefone' },
  { campo: 'cep', tipo: 'cep' },
  ...ENDERECO,
  { campo: 'profissao', obrigatorio: true, max: 100 },
  { campo: 'empresaId', tipo: 'inteiro' },
  { campo: 'cargo', max: 100 },
  { campo: 'observacoes', max: 2000 },
];

module.exports = { validar, REGRAS_EMPRESA, REGRAS_PESSOA };
