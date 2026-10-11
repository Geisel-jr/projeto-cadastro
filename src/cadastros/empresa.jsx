import { buscarCNPJ } from '../utils/consultas';
import { iniciais, mascaraCNPJ, mascaraTelefone } from '../utils/formatadores';
import { camposEndereco } from './endereco';

const empresa = {
  entidade: 'empresas',
  singular: 'empresa',
  plural: 'Empresas',
  novo: 'Nova empresa',
  documentos: true, // mostra o painel de documentos (anexos no MinIO) no formulário
  nomeExibicao: (r) => r?.nomeFantasia || r?.nome || '—',

  abas: [
    {
      id: 'identificacao',
      titulo: 'Identificação',
      campos: [
        {
          nome: 'cnpj',
          label: 'CNPJ',
          tipo: 'cnpj',
          obrigatorio: true,
          col: 4,
          completar: { tamanho: 14, buscar: buscarCNPJ, apenasVazios: true },
        },
        { nome: 'nome', max: 150, label: 'Razão social', obrigatorio: true, col: 8 },
        { nome: 'nomeFantasia', max: 150, label: 'Nome fantasia', col: 6 },
        { nome: 'ramoAtividade', max: 150, label: 'Ramo de atividade', col: 6 },
        { nome: 'inscricaoEstadual', max: 20, label: 'Inscrição estadual', col: 3, placeholder: 'Número ou ISENTO' },
        { nome: 'inscricaoMunicipal', max: 20, label: 'Inscrição municipal', col: 3 },
        { nome: 'dataAbertura', label: 'Data de abertura', tipo: 'data', col: 3 },
        { nome: 'porte', label: 'Porte', tipo: 'select', opcoes: ['MEI', 'ME', 'EPP', 'Médio', 'Grande'], col: 3 },
      ],
    },
    {
      id: 'contato',
      titulo: 'Contato e endereço',
      campos: [
        { nome: 'email', max: 150, label: 'E-mail', tipo: 'email', obrigatorio: true, col: 6 },
        { nome: 'site', max: 200, label: 'Site', col: 6 },
        { nome: 'telefone', label: 'Telefone', tipo: 'telefone', obrigatorio: true, col: 3 },
        { nome: 'celular', label: 'Celular / WhatsApp', tipo: 'telefone', col: 3 },
        ...camposEndereco({ cepObrigatorio: true }),
      ],
    },
    {
      id: 'observacoes',
      titulo: 'Observações',
      campos: [{ nome: 'observacoes', max: 2000, label: 'Observações internas', tipo: 'textarea', col: 12 }],
    },
  ],

  busca: ['nome', 'nomeFantasia', 'cnpj', 'email', 'cidade'],

  colunas: [
    {
      titulo: 'Empresa',
      render: (e) => (
        <div className="celula-nome">
          <span className="avatar azul">{iniciais(e.nomeFantasia || e.nome)}</span>
          <div>
            <strong>{e.nomeFantasia || e.nome}</strong>
            {e.nomeFantasia && <small>{e.nome}</small>}
          </div>
        </div>
      ),
    },
    { titulo: 'CNPJ', render: (e) => <span className="mono">{mascaraCNPJ(e.cnpj)}</span> },
    {
      titulo: 'Contato',
      render: (e) => (
        <div className="celula-dupla">
          <span>{mascaraTelefone(e.telefone)}</span>
          <small>{e.email}</small>
        </div>
      ),
    },
    {
      titulo: 'Documentos',
      render: (e) => (
        <div className="celula-dupla">
          <span>{e.totalDocumentos ?? 0} anexo(s)</span>
          {e.faltaCartaoCnpj && <small className="texto-alerta">Falta o cartão CNPJ</small>}
        </div>
      ),
    },
    {
      titulo: 'Cidade',
      render: (e) => (e.cidade ? <>{e.cidade} <span className="badge-uf">{e.estado}</span></> : '—'),
    },
  ],
};

export default empresa;
