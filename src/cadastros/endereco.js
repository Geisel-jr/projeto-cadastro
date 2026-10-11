import { buscarCEP } from '../utils/consultas';

// Campos de endereço usados por empresa e pessoa.
// Ao completar o CEP, logradouro, bairro, cidade e UF são preenchidos automaticamente.
export const camposEndereco = ({ cepObrigatorio = false } = {}) => [
  {
    nome: 'cep',
    label: 'CEP',
    tipo: 'cep',
    obrigatorio: cepObrigatorio,
    col: 3,
    completar: { tamanho: 8, buscar: buscarCEP },
  },
  { nome: 'logradouro', max: 200, label: 'Logradouro', col: 7, placeholder: 'Rua, avenida...' },
  { nome: 'numero', max: 10, label: 'Número', col: 2 },
  { nome: 'complemento', max: 100, label: 'Complemento', col: 4, placeholder: 'Sala, apto...' },
  { nome: 'bairro', max: 100, label: 'Bairro', col: 3 },
  { nome: 'cidade', max: 100, label: 'Cidade', col: 3 },
  { nome: 'estado', label: 'UF', tipo: 'uf', col: 2 },
];
