import { listarPessoas } from './api';
import CabecalhoPagina from './components/CabecalhoPagina';
import Icone from './components/Icone';
import TabelaCadastros from './components/TabelaCadastros';
import { calcularIdade, formatarData, iniciais, mascaraCPF, mascaraTelefone } from './utils/formatadores';

const COLUNAS = [
  {
    titulo: 'Pessoa',
    render: (p) => (
      <div className="celula-nome">
        <span className="avatar verde">{iniciais(p.nome)}</span>
        <div>
          <strong>{p.nome}</strong>
          <small>{p.email}</small>
        </div>
      </div>
    ),
  },
  { titulo: 'CPF', render: (p) => <span className="mono">{mascaraCPF(p.cpf)}</span> },
  { titulo: 'Telefone', render: (p) => mascaraTelefone(p.telefone) },
  {
    titulo: 'Nascimento',
    render: (p) => (
      <div className="celula-endereco">
        <span>{formatarData(p.data_nascimento)}</span>
        {p.data_nascimento && <small>{calcularIdade(p.data_nascimento)} anos</small>}
      </div>
    ),
  },
  { titulo: 'Profissão', render: (p) => <span className="badge-profissao">{p.profissao}</span> },
];

const CAMPOS_BUSCA = ['nome', 'cpf', 'email', 'profissao'];

export default function ListaPessoas({ onNavegar }) {
  return (
    <>
      <CabecalhoPagina titulo="Pessoas" subtitulo="Todas as pessoas cadastradas no sistema.">
        <button className="btn btn-success d-flex align-items-center gap-1" onClick={() => onNavegar('form-pessoa')}>
          <Icone nome="mais" /> Nova pessoa
        </button>
      </CabecalhoPagina>

      <TabelaCadastros
        buscar={listarPessoas}
        colunas={COLUNAS}
        camposBusca={CAMPOS_BUSCA}
        textoVazio="Nenhuma pessoa cadastrada ainda."
        textoNovo="Cadastrar primeira pessoa"
        onNovo={() => onNavegar('form-pessoa')}
      />
    </>
  );
}
