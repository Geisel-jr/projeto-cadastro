import { listarEmpresas } from './api';
import CabecalhoPagina from './components/CabecalhoPagina';
import Icone from './components/Icone';
import TabelaCadastros from './components/TabelaCadastros';
import { iniciais, mascaraCEP, mascaraCNPJ, mascaraTelefone } from './utils/formatadores';

const COLUNAS = [
  {
    titulo: 'Empresa',
    render: (e) => (
      <div className="celula-nome">
        <span className="avatar azul">{iniciais(e.nome)}</span>
        <div>
          <strong>{e.nome}</strong>
          <small>{e.email}</small>
        </div>
      </div>
    ),
  },
  { titulo: 'CNPJ', render: (e) => <span className="mono">{mascaraCNPJ(e.cnpj)}</span> },
  { titulo: 'Telefone', render: (e) => mascaraTelefone(e.telefone) },
  {
    titulo: 'Endereço',
    render: (e) => (
      <div className="celula-endereco">
        <span>{e.endereco || '—'}</span>
        <small>{mascaraCEP(e.cep)}</small>
      </div>
    ),
  },
  {
    titulo: 'Cidade / UF',
    render: (e) => (e.cidade ? <>{e.cidade} <span className="badge-uf">{e.estado}</span></> : '—'),
  },
];

const CAMPOS_BUSCA = ['nome', 'cnpj', 'email', 'cidade', 'estado'];

export default function ListaEmpresas({ onNavegar }) {
  return (
    <>
      <CabecalhoPagina titulo="Empresas" subtitulo="Todas as empresas cadastradas no sistema.">
        <button className="btn btn-primary d-flex align-items-center gap-1" onClick={() => onNavegar('form-empresa')}>
          <Icone nome="mais" /> Nova empresa
        </button>
      </CabecalhoPagina>

      <TabelaCadastros
        buscar={listarEmpresas}
        colunas={COLUNAS}
        camposBusca={CAMPOS_BUSCA}
        textoVazio="Nenhuma empresa cadastrada ainda."
        textoNovo="Cadastrar primeira empresa"
        onNovo={() => onNavegar('form-empresa')}
      />
    </>
  );
}
