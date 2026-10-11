import { useEffect, useState } from 'react';
import { api, mensagemErro } from '../api';
import Historico from '../components/Historico';
import Icone from '../components/Icone';

export default function Painel({ onNavegar }) {
  const [resumo, setResumo] = useState(null);
  const [atividades, setAtividades] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    Promise.all([api.resumo(), api.auditoria({ limite: 8 })])
      .then(([r, a]) => {
        setResumo(r);
        setAtividades(a.itens);
      })
      .catch((e) => setErro(mensagemErro(e)));
  }, []);

  const cards = [
    {
      titulo: 'Empresas ativas',
      valor: resumo?.empresas,
      detalhe: resumo && `${resumo.empresasExcluidas} excluída(s)`,
      icone: 'empresa',
      rota: { pagina: 'lista', entidade: 'empresas' },
    },
    {
      titulo: 'Pessoas ativas',
      valor: resumo?.pessoas,
      detalhe: resumo && `${resumo.pessoasExcluidas} excluída(s)`,
      icone: 'pessoa',
      rota: { pagina: 'lista', entidade: 'pessoas' },
    },
    {
      titulo: 'Ações nas últimas 24h',
      valor: resumo?.acoesDia,
      icone: 'escudo',
      rota: { pagina: 'auditoria' },
    },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Painel</h1>
      </div>

      {erro && (
        <div className="aviso aviso-erro">
          <Icone nome="alerta" />
          <span className="aviso-texto">{erro}</span>
        </div>
      )}

      <div className="cards">
        {cards.map((card) => (
          <button className="card-stat" key={card.titulo} onClick={() => onNavegar(card.rota)}>
            <span className="stat-icone"><Icone nome={card.icone} tamanho={18} /></span>
            <span>
              <span className="stat-label">{card.titulo}</span>
              <span className="stat-valor">{card.valor ?? '—'}</span>
              {card.detalhe && <span className="stat-detalhe">{card.detalhe}</span>}
            </span>
          </button>
        ))}
      </div>

      <div className="painel">
        <div className="painel-header">
          <h2>Atividade recente</h2>
          <button className="btn-texto" onClick={() => onNavegar({ pagina: 'auditoria' })}>Ver tudo</button>
        </div>
        <div className="painel-corpo">
          {atividades ? (
            <Historico itens={atividades} mostrarRegistro onAbrir={(entidade, id) => onNavegar({ pagina: 'form', entidade, id })} />
          ) : !erro && (
            <div className="carregando"><span className="spinner" /></div>
          )}
        </div>
      </div>
    </>
  );
}
