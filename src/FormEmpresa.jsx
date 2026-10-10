import { useState } from 'react';
import { criarEmpresa } from './api';
import CabecalhoPagina from './components/CabecalhoPagina';
import Campo from './components/Campo';
import Icone from './components/Icone';
import {
  apenasDigitos,
  mascaraCEP,
  mascaraCNPJ,
  mascaraTelefone,
  validarCNPJ,
  validarTelefone,
} from './utils/formatadores';

const ESTADO_INICIAL = {
  nome: '',
  cnpj: '',
  email: '',
  telefone: '',
  cep: '',
  endereco: '',
  cidade: '',
  estado: '',
};

const MASCARAS = { cnpj: mascaraCNPJ, telefone: mascaraTelefone, cep: mascaraCEP };

export default function FormEmpresa({ onNavegar, notificar }) {
  const [dados, setDados] = useState(ESTADO_INICIAL);
  const [erros, setErros] = useState({});
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const mascara = MASCARAS[name];
    setDados((prev) => ({ ...prev, [name]: mascara ? mascara(value) : value }));
    setErros((prev) => ({ ...prev, [name]: undefined }));

    // Busca o endereço automaticamente quando o CEP estiver completo
    if (name === 'cep' && apenasDigitos(value).length === 8) {
      buscarCEP(apenasDigitos(value));
    }
  };

  const buscarCEP = async (cep) => {
    setBuscandoCEP(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setErros((prev) => ({ ...prev, cep: 'CEP não encontrado. Verifique e tente novamente.' }));
        return;
      }

      setDados((prev) => ({
        ...prev,
        endereco: data.logradouro || prev.endereco,
        cidade: data.localidade,
        estado: data.uf,
      }));
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      setErros((prev) => ({ ...prev, cep: 'Não foi possível consultar o CEP agora.' }));
    } finally {
      setBuscandoCEP(false);
    }
  };

  const validar = () => {
    const novosErros = {};
    if (dados.nome.trim().length < 2) novosErros.nome = 'Informe o nome da empresa.';
    if (!validarCNPJ(dados.cnpj)) novosErros.cnpj = 'CNPJ inválido.';
    if (!/^\S+@\S+\.\S+$/.test(dados.email)) novosErros.email = 'Informe um e-mail válido.';
    if (!validarTelefone(dados.telefone)) novosErros.telefone = 'Telefone deve ter DDD + número.';
    if (apenasDigitos(dados.cep).length !== 8) novosErros.cep = 'CEP deve ter 8 dígitos.';
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validar()) return;

    setEnviando(true);
    try {
      // Documentos são enviados só com números; a máscara é aplicada na exibição
      await criarEmpresa({
        ...dados,
        nome: dados.nome.trim(),
        cnpj: apenasDigitos(dados.cnpj),
        telefone: apenasDigitos(dados.telefone),
        cep: apenasDigitos(dados.cep),
        estado: dados.estado.toUpperCase(),
      });
      notificar('sucesso', 'Empresa cadastrada!', `${dados.nome} foi adicionada com sucesso.`);
      setDados(ESTADO_INICIAL);
    } catch (error) {
      console.error(error);
      notificar('erro', 'Erro ao cadastrar empresa', error.message === 'Failed to fetch'
        ? 'Não foi possível conectar ao servidor.'
        : error.message);
    } finally {
      setEnviando(false);
    }
  };

  const classeInput = (campo) => `form-control ${erros[campo] ? 'is-invalid' : ''}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Nova empresa"
        subtitulo="Preencha os dados abaixo para cadastrar uma nova empresa."
        onVoltar={() => onNavegar('lista-empresa')}
      />

      <form onSubmit={handleSubmit} noValidate className="painel form-painel">
        <section className="form-secao">
          <div className="form-secao-info">
            <span className="stat-icone azul pequeno"><Icone nome="empresa" /></span>
            <div>
              <h2>Dados da empresa</h2>
              <p>Identificação e contato principal.</p>
            </div>
          </div>

          <div className="row g-3">
            <Campo label="Razão social / Nome" obrigatorio erro={erros.nome} className="col-12">
              <input name="nome" value={dados.nome} onChange={handleChange}
                className={classeInput('nome')} placeholder="Ex: Empresa XYZ Ltda." />
            </Campo>

            <Campo label="CNPJ" obrigatorio erro={erros.cnpj} className="col-md-6">
              <input name="cnpj" value={dados.cnpj} onChange={handleChange} inputMode="numeric"
                className={classeInput('cnpj')} placeholder="00.000.000/0000-00" />
            </Campo>

            <Campo label="Telefone" obrigatorio erro={erros.telefone} className="col-md-6">
              <input name="telefone" type="tel" value={dados.telefone} onChange={handleChange}
                className={classeInput('telefone')} placeholder="(00) 00000-0000" />
            </Campo>

            <Campo label="E-mail" obrigatorio erro={erros.email} className="col-12">
              <input name="email" type="email" value={dados.email} onChange={handleChange}
                className={classeInput('email')} placeholder="contato@empresa.com.br" />
            </Campo>
          </div>
        </section>

        <section className="form-secao">
          <div className="form-secao-info">
            <span className="stat-icone azul pequeno"><Icone nome="mapa" /></span>
            <div>
              <h2>Endereço</h2>
              <p>Digite o CEP e preenchemos o resto para você.</p>
            </div>
          </div>

          <div className="row g-3">
            <Campo
              label="CEP"
              obrigatorio
              erro={erros.cep}
              ajuda={buscandoCEP ? 'Buscando endereço...' : null}
              className="col-md-4"
            >
              <div className="position-relative">
                <input name="cep" value={dados.cep} onChange={handleChange} inputMode="numeric"
                  className={classeInput('cep')} placeholder="00000-000" />
                {buscandoCEP && <span className="spinner-border spinner-border-sm input-spinner" />}
              </div>
            </Campo>

            <Campo label="Endereço" className="col-md-8">
              <input name="endereco" value={dados.endereco} onChange={handleChange}
                className="form-control" placeholder="Rua, número, bairro" />
            </Campo>

            <Campo label="Cidade" className="col-md-8">
              <input name="cidade" value={dados.cidade} onChange={handleChange}
                className="form-control" placeholder="Cidade" />
            </Campo>

            <Campo label="UF" className="col-md-4">
              <input name="estado" value={dados.estado} onChange={handleChange} maxLength={2}
                className="form-control text-uppercase" placeholder="UF" />
            </Campo>
          </div>
        </section>

        <div className="form-acoes">
          <button type="button" className="btn btn-outline-secondary" onClick={() => { setDados(ESTADO_INICIAL); setErros({}); }}>
            Limpar
          </button>
          <button type="submit" className="btn btn-primary px-4" disabled={enviando}>
            {enviando && <span className="spinner-border spinner-border-sm me-2" />}
            {enviando ? 'Salvando...' : 'Cadastrar empresa'}
          </button>
        </div>
      </form>
    </>
  );
}
