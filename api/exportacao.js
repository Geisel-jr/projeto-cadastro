// Exportação das listas em CSV, no formato que o Excel em português abre direto:
// separador ";", UTF-8 com BOM (para os acentos) e quebra de linha CRLF.

const FUSO = process.env.FUSO_HORARIO || 'America/Sao_Paulo';

const FORMATOS = {
  cpf: (v) => v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'),
  cnpj: (v) => v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'),
  cep: (v) => v.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
  telefone: (v) => v.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3'),
  data: (v) => v.split('-').reverse().join('/'), // colunas DATE chegam como "AAAA-MM-DD"
  dataHora: (v) => new Date(v).toLocaleString('pt-BR', { timeZone: FUSO }),
};

function celula(valor) {
  if (valor === null || valor === undefined) return '';
  let texto = String(valor);
  // Um texto começando com = + - @ vira fórmula no Excel; o apóstrofo faz ele ser lido como texto
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function gerarCsv(colunas, registros) {
  const linhas = [
    colunas.map((c) => celula(c.titulo)).join(';'),
    ...registros.map((registro) => colunas.map(({ campo, formato }) => {
      const valor = registro[campo];
      return celula(valor === null || valor === undefined || valor === '' || !formato ? valor : FORMATOS[formato](valor));
    }).join(';')),
  ];
  return `﻿${linhas.join('\r\n')}\r\n`;
}

const ENDERECO = [
  { campo: 'cep', titulo: 'CEP', formato: 'cep' },
  { campo: 'logradouro', titulo: 'Logradouro' },
  { campo: 'numero', titulo: 'Número' },
  { campo: 'complemento', titulo: 'Complemento' },
  { campo: 'bairro', titulo: 'Bairro' },
  { campo: 'cidade', titulo: 'Cidade' },
  { campo: 'estado', titulo: 'UF' },
];

const REGISTRO = [
  { campo: 'observacoes', titulo: 'Observações' },
  { campo: 'criadoEm', titulo: 'Cadastrado em', formato: 'dataHora' },
  { campo: 'criadoPor', titulo: 'Cadastrado por' },
];

const COLUNAS_EMPRESA = [
  { campo: 'nome', titulo: 'Razão social' },
  { campo: 'nomeFantasia', titulo: 'Nome fantasia' },
  { campo: 'cnpj', titulo: 'CNPJ', formato: 'cnpj' },
  { campo: 'inscricaoEstadual', titulo: 'Inscrição estadual' },
  { campo: 'inscricaoMunicipal', titulo: 'Inscrição municipal' },
  { campo: 'dataAbertura', titulo: 'Data de abertura', formato: 'data' },
  { campo: 'porte', titulo: 'Porte' },
  { campo: 'ramoAtividade', titulo: 'Ramo de atividade' },
  { campo: 'email', titulo: 'E-mail' },
  { campo: 'telefone', titulo: 'Telefone', formato: 'telefone' },
  { campo: 'celular', titulo: 'Celular', formato: 'telefone' },
  { campo: 'site', titulo: 'Site' },
  ...ENDERECO,
  { campo: 'totalDocumentos', titulo: 'Documentos' },
  ...REGISTRO,
];

const COLUNAS_PESSOA = [
  { campo: 'nome', titulo: 'Nome' },
  { campo: 'nomeSocial', titulo: 'Nome social' },
  { campo: 'cpf', titulo: 'CPF', formato: 'cpf' },
  { campo: 'rg', titulo: 'RG' },
  { campo: 'orgaoEmissor', titulo: 'Órgão emissor' },
  { campo: 'dataNascimento', titulo: 'Data de nascimento', formato: 'data' },
  { campo: 'sexo', titulo: 'Sexo' },
  { campo: 'estadoCivil', titulo: 'Estado civil' },
  { campo: 'email', titulo: 'E-mail' },
  { campo: 'telefone', titulo: 'Telefone', formato: 'telefone' },
  { campo: 'celular', titulo: 'Celular', formato: 'telefone' },
  { campo: 'profissao', titulo: 'Profissão' },
  { campo: 'empresaNome', titulo: 'Empresa' },
  { campo: 'cargo', titulo: 'Cargo' },
  ...ENDERECO,
  ...REGISTRO,
];

// Colunas extras quando a exportação é da lista de excluídos
const COLUNAS_EXCLUSAO = [
  { campo: 'excluidoEm', titulo: 'Excluído em', formato: 'dataHora' },
  { campo: 'excluidoPor', titulo: 'Excluído por' },
  { campo: 'motivoExclusao', titulo: 'Motivo da exclusão' },
];

// "12345678909" -> "***.456.789-**": a lista mostra o bastante para conferir, sem expor o CPF inteiro
const mascararCpf = (cpf) => (cpf ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : cpf);
const mascararRg = (rg) => (rg ? `${'*'.repeat(Math.max(rg.length - 2, 0))}${rg.slice(-2)}` : rg);

module.exports = { gerarCsv, mascararCpf, mascararRg, FORMATOS, COLUNAS_EMPRESA, COLUNAS_PESSOA, COLUNAS_EXCLUSAO };
