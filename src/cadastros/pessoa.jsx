import { api } from '../api';
import { calcularIdade, formatarData, iniciais, mascaraCPF, mascaraTelefone } from '../utils/formatadores';
import { camposEndereco } from './endereco';

const PROFISSOES = [
  'QA', 'FullStack', 'Front-end', 'Back-end', 'DBA', 'DevOps',
  'Analista de Dados', 'Analista de Sistemas', 'Gerente de Projetos', 'Outros',
];

const pessoa = {
  entidade: 'pessoas',
  singular: 'pessoa',
  plural: 'Pessoas',
  novo: 'Nova pessoa',
  icone: 'pessoa',
  cor: 'verde',
  nomeExibicao: (r) => r?.nomeSocial || r?.nome || '—',

  abas: [
    {
      id: 'pessoais',
      titulo: 'Dados pessoais',
      campos: [
        {
          nome: 'nome',
          max: 150,
          label: 'Nome completo',
          obrigatorio: true,
          col: 8,
          validar: (v) => (v.split(/\s+/).length < 2 ? 'Informe nome e sobrenome.' : null),
        },
        { nome: 'nomeSocial', max: 150, label: 'Nome social', col: 4 },
        { nome: 'cpf', label: 'CPF', tipo: 'cpf', obrigatorio: true, col: 4 },
        { nome: 'rg', max: 20, label: 'RG', col: 4 },
        { nome: 'orgaoEmissor', max: 20, label: 'Órgão emissor', col: 4, placeholder: 'Ex: SSP/MG' },
        { nome: 'dataNascimento', label: 'Data de nascimento', tipo: 'data', obrigatorio: true, col: 4 },
        { nome: 'sexo', label: 'Sexo', tipo: 'select', opcoes: ['Feminino', 'Masculino', 'Outro', 'Prefiro não informar'], col: 4 },
        { nome: 'estadoCivil', label: 'Estado civil', tipo: 'select', opcoes: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'], col: 4 },
      ],
    },
    {
      id: 'contato',
      titulo: 'Contato e endereço',
      campos: [
        { nome: 'email', max: 150, label: 'E-mail', tipo: 'email', obrigatorio: true, col: 6 },
        { nome: 'telefone', label: 'Telefone', tipo: 'telefone', obrigatorio: true, col: 3 },
        { nome: 'celular', label: 'Celular / WhatsApp', tipo: 'telefone', col: 3 },
        { secao: 'Endereço' },
        ...camposEndereco(),
      ],
    },
    {
      id: 'profissional',
      titulo: 'Profissional',
      campos: [
        { nome: 'profissao', label: 'Profissão', tipo: 'select', opcoes: PROFISSOES, obrigatorio: true, col: 4 },
        {
          nome: 'profissaoOutra', max: 100,
          label: 'Qual profissão?',
          obrigatorio: true,
          col: 4,
          somenteFormulario: true,
          visivel: (d) => d.profissao === 'Outros',
        },
        {
          nome: 'empresaId',
          label: 'Empresa vinculada',
          tipo: 'select',
          col: 4,
          carregarOpcoes: async () =>
            (await api.listar('empresas')).map((e) => ({ valor: String(e.id), label: e.nomeFantasia || e.nome })),
          exibir: (valor, registro) => (valor ? registro?.empresaNome || `#${valor}` : '—'),
        },
        { nome: 'cargo', max: 100, label: 'Cargo', col: 4 },
      ],
    },
    {
      id: 'observacoes',
      titulo: 'Observações',
      campos: [{ nome: 'observacoes', max: 2000, label: 'Observações internas', tipo: 'textarea', col: 12 }],
    },
  ],

  // Profissão fora da lista aparece como "Outros" + texto livre
  aoCarregar: (dados) => {
    if (dados.profissao && !PROFISSOES.includes(dados.profissao)) {
      return { ...dados, profissaoOutra: dados.profissao, profissao: 'Outros' };
    }
    return dados;
  },
  antesDeEnviar: (corpo, dados) => ({
    ...corpo,
    profissao: dados.profissao === 'Outros' ? dados.profissaoOutra.trim() : dados.profissao,
  }),

  busca: ['nome', 'nomeSocial', 'cpf', 'email', 'profissao', 'empresaNome'],

  colunas: [
    {
      titulo: 'Pessoa',
      render: (p) => (
        <div className="celula-nome">
          <span className="avatar verde">{iniciais(p.nome)}</span>
          <div>
            <strong>{p.nomeSocial || p.nome}</strong>
            <small>{p.email}</small>
          </div>
        </div>
      ),
    },
    { titulo: 'CPF', render: (p) => <span className="mono">{mascaraCPF(p.cpf)}</span> },
    { titulo: 'Telefone', render: (p) => mascaraTelefone(p.celular || p.telefone) },
    {
      titulo: 'Nascimento',
      render: (p) => (
        <div className="celula-dupla">
          <span>{formatarData(p.dataNascimento)}</span>
          {p.dataNascimento && <small>{calcularIdade(p.dataNascimento)} anos</small>}
        </div>
      ),
    },
    {
      titulo: 'Profissão',
      render: (p) => (
        <div className="celula-dupla">
          <span><span className="badge-profissao">{p.profissao}</span></span>
          {p.empresaNome && <small>{p.cargo ? `${p.cargo} · ` : ''}{p.empresaNome}</small>}
        </div>
      ),
    },
  ],
};

export default pessoa;
