// Validações feitas no servidor. O front também valida, mas a API não pode
// confiar nisso: qualquer pessoa pode chamar a API diretamente.

const apenasDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');
const texto = (valor) => String(valor ?? '').trim();
const emailValido = (email) => /^\S+@\S+\.\S+$/.test(email);

function validarCPF(valor) {
  const cpf = apenasDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calcularDigito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
}

function validarCNPJ(valor) {
  const cnpj = apenasDigitos(valor);
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

// Recebe o corpo da requisição e devolve { dados, erros }.
// "dados" já vem limpo (sem máscara, sem espaços sobrando).
function validarEmpresa(body = {}) {
  const dados = {
    nome: texto(body.nome),
    cnpj: apenasDigitos(body.cnpj),
    email: texto(body.email).toLowerCase(),
    telefone: apenasDigitos(body.telefone),
    cep: apenasDigitos(body.cep),
    endereco: texto(body.endereco) || null,
    cidade: texto(body.cidade) || null,
    estado: texto(body.estado).toUpperCase() || null,
  };

  const erros = [];
  if (dados.nome.length < 2 || dados.nome.length > 150) erros.push('Nome da empresa inválido.');
  if (!validarCNPJ(dados.cnpj)) erros.push('CNPJ inválido.');
  if (!emailValido(dados.email)) erros.push('E-mail inválido.');
  if (![10, 11].includes(dados.telefone.length)) erros.push('Telefone deve ter DDD + número.');
  if (dados.cep.length !== 8) erros.push('CEP deve ter 8 dígitos.');
  if (dados.estado && !/^[A-Z]{2}$/.test(dados.estado)) erros.push('UF deve ter 2 letras.');

  return { dados, erros };
}

function validarPessoa(body = {}) {
  const dados = {
    nome: texto(body.nome),
    cpf: apenasDigitos(body.cpf),
    email: texto(body.email).toLowerCase(),
    telefone: apenasDigitos(body.telefone),
    dataNascimento: texto(body.dataNascimento),
    profissao: texto(body.profissao),
  };

  const erros = [];
  if (dados.nome.split(/\s+/).length < 2 || dados.nome.length > 150) erros.push('Informe nome e sobrenome.');
  if (!validarCPF(dados.cpf)) erros.push('CPF inválido.');
  if (!emailValido(dados.email)) erros.push('E-mail inválido.');
  if (![10, 11].includes(dados.telefone.length)) erros.push('Telefone deve ter DDD + número.');

  const hoje = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.dataNascimento) || isNaN(Date.parse(dados.dataNascimento))) {
    erros.push('Data de nascimento inválida.');
  } else if (dados.dataNascimento > hoje) {
    erros.push('Data de nascimento não pode ser no futuro.');
  }

  if (!dados.profissao || dados.profissao.length > 100) erros.push('Profissão inválida.');

  return { dados, erros };
}

module.exports = { validarEmpresa, validarPessoa };
