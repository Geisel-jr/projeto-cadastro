import {
  apenasDigitos,
  formatarData,
  hojeISO,
  mascaraCEP,
  mascaraCNPJ,
  mascaraCPF,
  mascaraTelefone,
  validarCNPJ,
  validarCPF,
  validarTelefone,
} from '../utils/formatadores';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// Comportamento de cada tipo de campo: máscara, validação, formatação e atributos do input.
// "digitos: true" faz o valor ser enviado à API só com números.
const TIPOS = {
  texto: {},
  textarea: {},
  select: {},
  uf: { opcoes: UFS },
  email: {
    input: 'email',
    placeholder: 'nome@email.com',
    validar: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'E-mail inválido.'),
  },
  cpf: {
    mascara: mascaraCPF,
    digitos: true,
    inputMode: 'numeric',
    placeholder: '000.000.000-00',
    validar: (v) => (validarCPF(v) ? null : 'CPF inválido.'),
  },
  cnpj: {
    mascara: mascaraCNPJ,
    digitos: true,
    inputMode: 'numeric',
    placeholder: '00.000.000/0000-00',
    validar: (v) => (validarCNPJ(v) ? null : 'CNPJ inválido.'),
  },
  telefone: {
    mascara: mascaraTelefone,
    digitos: true,
    input: 'tel',
    placeholder: '(00) 00000-0000',
    validar: (v) => (validarTelefone(v) ? null : 'Telefone deve ter DDD + número.'),
  },
  cep: {
    mascara: mascaraCEP,
    digitos: true,
    inputMode: 'numeric',
    placeholder: '00000-000',
    validar: (v) => (apenasDigitos(v).length === 8 ? null : 'CEP deve ter 8 dígitos.'),
  },
  data: {
    input: 'date',
    formatar: formatarData,
    validar: (v) => (v > hojeISO() ? 'A data não pode ser no futuro.' : null),
  },
};

export const tipoDe = (campo) => TIPOS[campo.tipo || 'texto'];
