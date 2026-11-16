import { useEffect, useState } from 'react';
import { api, documentos, mensagemErro } from '../api';
import Historico, { EsqueletoHistorico } from '../components/Historico';
import Icone from '../components/Icone';
import Vencimentos from '../components/Vencimentos';
import { useTituloPagina } from '../rotas';

// "sábado, 11 de outubro" -> "Sábado, 11 de outubro"
const hoje = () => {
  const texto = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export default function Painel({ usuario, onNavegar, notificar }) {
  useTituloPagina('Painel');
  const [resumo, setResumo] = useState(null);
  const [atividades, setAtividades] = useState(null);
  const [vencimentos, setVencimentos] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviandoAviso, setEnviandoAviso] = useState(false);

  const enviarAviso = async () => {
    setEnviandoAviso(true);
    try {
      const { enviados } = await documentos.enviarAviso();
      if (enviados === 0) {
        // Acontece quando o único administrador é a conta de demonstração (que não tem e-mail real)
        notificar('erro', 'Nenhum e-mail enviado', 'Não há administrador com e-mail cadastrado para receber o aviso.');
      } else {
        notificar('sucesso', 'Aviso enviado', `E-mail enviado para ${enviados} ${enviados === 1 ? 'administrador' : 'administradores'}.`);
      }
    } catch (e) {
      notificar('erro', 'Aviso não enviado', mensagemErro(e));
    } finally {
      setEnviandoAviso(false);
    }
  };

  useEffect(() => {
    Promise.all([api.resumo(), api.auditoria({ limite: 8 }), documentos.vencimentos(30)])
      .then(([r, a, v]) => {
        setResumo(r);
        setAtividades(a.itens);
        setVencimentos(v);
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
      detalhe: 'Ver auditoria completa',
      icone: 'escudo',
      rota: { pagina: 'auditoria' },
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <span className="page-sobretitulo">{hoje()}</span>
          <h1 className="page-title">Painel</h1>
        </div>
      </div>

      {erro && (
        <div className="aviso aviso-erro">
          <Icone nome="alerta" />
          <span className="aviso-texto">{erro}</span>
        </div>
      )}

      <div className="painel resumo">
        {cards.map((card) => (
          <button className="resumo-item" key={card.titulo} onClick={() => onNavegar(card.rota)}>
            <span className="resumo-rotulo">
              <Icone nome={card.icone} tamanho={15} />
              {card.titulo}
              <Icone nome="seta" tamanho={14} className="resumo-seta" />
            </span>
            {resumo || erro ? (
              <span className="stat-valor">{card.valor ?? '—'}</span>
            ) : (
              <span className="esq stat-esqueleto" aria-label="Carregando" />
            )}
            <span className="stat-detalhe">{card.detalhe || '\u00a0'}</span>
          </button>
        ))}
      </div>

      <div className="painel-colunas">
        {!erro && (
          <Vencimentos
            dados={vencimentos}
            onEnviarAviso={usuario?.papel === 'admin' ? enviarAviso : undefined}
            enviandoAviso={enviandoAviso}
          />
        )}

        <div className="painel atividade">
          <div className="painel-header">
            <h2>Atividade recente</h2>
            <button className="btn-texto" onClick={() => onNavegar({ pagina: 'auditoria' })}>Ver tudo</button>
          </div>
          <div className="painel-corpo">
            {atividades ? (
              <Historico itens={atividades} mostrarRegistro onAbrir={(entidade, id) => onNavegar({ pagina: 'form', entidade, id })} />
            ) : !erro && <EsqueletoHistorico />}
          </div>
        </div>
      </div>
    </>
  );
}
