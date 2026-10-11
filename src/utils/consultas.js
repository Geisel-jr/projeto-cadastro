// Consultas a serviços públicos para preencher formulários automaticamente.
// Retornam os dados sem máscara; o formulário aplica a formatação de cada campo.

export async function buscarCEP(cep) {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const dados = await response.json();
  if (dados.erro) throw new Error('CEP não encontrado.');

  return {
    logradouro: dados.logradouro,
    bairro: dados.bairro,
    cidade: dados.localidade,
    estado: dados.uf,
  };
}

const PORTES_RECEITA = { 1: 'ME', 3: 'EPP' };

// Dados públicos da Receita Federal, via BrasilAPI
export async function buscarCNPJ(cnpj) {
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (response.status === 404) throw new Error('CNPJ não encontrado na Receita Federal.');
  if (!response.ok) throw new Error('Não foi possível consultar o CNPJ agora.');
  const d = await response.json();

  return {
    nome: d.razao_social,
    nomeFantasia: d.nome_fantasia,
    dataAbertura: d.data_inicio_atividade,
    porte: d.opcao_pelo_mei ? 'MEI' : PORTES_RECEITA[Number(d.codigo_porte)],
    ramoAtividade: d.cnae_fiscal_descricao,
    email: d.email?.toLowerCase(),
    telefone: d.ddd_telefone_1,
    cep: d.cep,
    logradouro: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' '),
    numero: d.numero,
    complemento: d.complemento,
    bairro: d.bairro,
    cidade: d.municipio,
    estado: d.uf,
  };
}
