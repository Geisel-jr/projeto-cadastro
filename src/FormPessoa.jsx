import { useState } from 'react';
import { criarPessoa } from './api';
import CabecalhoPagina from './components/CabecalhoPagina';
import Campo from './components/Campo';
import Icone from './components/Icone';
import {
  apenasDigitos,
  mascaraCPF,
  mascaraTelefone,
  validarCPF,
  validarTelefone,
} from './utils/formatadores';

const ESTADO_INICIAL = {
  nome: '',
  cpf: '',
  email: '',
  telefone: '',
  dataNascimento: '',
  profissao: '',
  profissaoCustomizada: '',
};

const PROFISSOES = ['QA', 'FullStack', 'DBA', 'Outros'];
const MASCARAS = { cpf: mascaraCPF, telefone: mascaraTelefone };
const HOJE = new Date().toISOString().slice(0, 10);

export default function FormPessoa({ onNavegar, notificar }) {
  const [dados, setDados] = useState(ESTADO_INICIAL);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const mascara = MASCARAS[name];
    setDados((prev) => ({ ...prev, [name]: mascara ? mascara(value) : value }));
    setErros((prev) => ({ ...prev, [name]: undefined }));
  };

  const validar = () => {
    const novosErros = {};
    if (dados.nome.trim().split(/\s+/).length < 2) novosErros.nome = 'Informe nome e sobrenome.';
    if (!validarCPF(dados.cpf)) novosErros.cpf = 'CPF inválido.';
    if (!/^\S+@\S+\.\S+$/.test(dados.email)) novosErros.email = 'Informe um e-mail válido.';
    if (!validarTelefone(dados.telefone)) novosErros.telefone = 'Telefone deve ter DDD + número.';
    if (!dados.dataNascimento) novosErros.dataNascimento = 'Informe a data de nascimento.';
    else if (dados.dataNascimento > HOJE) novosErros.dataNascimento = 'A data não pode ser no futuro.';
    if (!dados.profissao) novosErros.profissao = 'Selecione uma profissão.';
    if (dados.profissao === 'Outros' && !dados.profissaoCustomizada.trim()) {
      novosErros.profissaoCustomizada = 'Informe a profissão.';
    }
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validar()) return;

    // Se profissão for "Outros", usa o valor digitado
    const profissaoFinal = dados.profissao === 'Outros'
      ? dados.profissaoCustomizada.trim()
      : dados.profissao;

    setEnviando(true);
    try {
      await criarPessoa({
        nome: dados.nome.trim(),
        cpf: apenasDigitos(dados.cpf),
        email: dados.email,
        telefone: apenasDigitos(dados.telefone),
        dataNascimento: dados.dataNascimento,
        profissao: profissaoFinal,
      });
      notificar('sucesso', 'Pessoa cadastrada!', `${dados.nome} foi adicionada com sucesso.`);
      setDados(ESTADO_INICIAL);
    } catch (error) {
      console.error(error);
      notificar('erro', 'Erro ao cadastrar pessoa', error.message === 'Failed to fetch'
        ? 'Não foi possível conectar ao servidor.'
        : error.message);
    } finally {
      setEnviando(false);
    }
  };

  const classeInput = (campo, base = 'form-control') => `${base} ${erros[campo] ? 'is-invalid' : ''}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Nova pessoa"
        subtitulo="Preencha os dados abaixo para cadastrar uma nova pessoa."
        onVoltar={() => onNavegar('lista-pessoa')}
      />

      <form onSubmit={handleSubmit} noValidate className="painel form-painel">
        <section className="form-secao">
          <div className="form-secao-info">
            <span className="stat-icone verde pequeno"><Icone nome="pessoa" /></span>
            <div>
              <h2>Dados pessoais</h2>
              <p>Informações de identificação.</p>
            </div>
          </div>

          <div className="row g-3">
            <Campo label="Nome completo" obrigatorio erro={erros.nome} className="col-12">
              <input name="nome" value={dados.nome} onChange={handleChange}
                className={classeInput('nome')} placeholder="Ex: Maria da Silva" />
            </Campo>

            <Campo label="CPF" obrigatorio erro={erros.cpf} className="col-md-6">
              <input name="cpf" value={dados.cpf} onChange={handleChange} inputMode="numeric"
                className={classeInput('cpf')} placeholder="000.000.000-00" />
            </Campo>

            <Campo label="Data de nascimento" obrigatorio erro={erros.dataNascimento} className="col-md-6">
              <input name="dataNascimento" type="date" value={dados.dataNascimento} max={HOJE}
                onChange={handleChange} className={classeInput('dataNascimento')} />
            </Campo>
          </div>
        </section>

        <section className="form-secao">
          <div className="form-secao-info">
            <span className="stat-icone verde pequeno"><Icone nome="email" /></span>
            <div>
              <h2>Contato e profissão</h2>
              <p>Como podemos falar com essa pessoa.</p>
            </div>
          </div>

          <div className="row g-3">
            <Campo label="E-mail" obrigatorio erro={erros.email} className="col-md-7">
              <input name="email" type="email" value={dados.email} onChange={handleChange}
                className={classeInput('email')} placeholder="nome@email.com" />
            </Campo>

            <Campo label="Telefone" obrigatorio erro={erros.telefone} className="col-md-5">
              <input name="telefone" type="tel" value={dados.telefone} onChange={handleChange}
                className={classeInput('telefone')} placeholder="(00) 00000-0000" />
            </Campo>

            <Campo label="Profissão" obrigatorio erro={erros.profissao} className="col-12">
              <div className="chips">
                {PROFISSOES.map((p) => (
                  <label key={p} className={`chip ${dados.profissao === p ? 'ativo' : ''}`}>
                    <input type="radio" name="profissao" value={p}
                      checked={dados.profissao === p} onChange={handleChange} />
                    {p}
                  </label>
                ))}
              </div>
            </Campo>

            {dados.profissao === 'Outros' && (
              <Campo label="Qual é a profissão?" obrigatorio erro={erros.profissaoCustomizada} className="col-12">
                <input name="profissaoCustomizada" value={dados.profissaoCustomizada} onChange={handleChange}
                  className={classeInput('profissaoCustomizada')} placeholder="Digite a profissão" autoFocus />
              </Campo>
            )}
          </div>
        </section>

        <div className="form-acoes">
          <button type="button" className="btn btn-outline-secondary" onClick={() => { setDados(ESTADO_INICIAL); setErros({}); }}>
            Limpar
          </button>
          <button type="submit" className="btn btn-success px-4" disabled={enviando}>
            {enviando && <span className="spinner-border spinner-border-sm me-2" />}
            {enviando ? 'Salvando...' : 'Cadastrar pessoa'}
          </button>
        </div>
      </form>
    </>
  );
}
