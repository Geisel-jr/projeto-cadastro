import { Link } from 'react-router';
import { formatarData } from '../utils/formatadores';
import Icone from './Icone';

const nomeDocumento = (doc) => (doc.tipo === 'Outros' ? doc.descricao : doc.tipo);

function prazo(dias) {
  if (dias < 0) return { texto: `Vencido há ${-dias} dia${dias === -1 ? '' : 's'}`, classe: 'perigo' };
  if (dias === 0) return { texto: 'Vence hoje', classe: 'perigo' };
  return { texto: `Vence em ${dias} dia${dias === 1 ? '' : 's'}`, classe: 'alerta' };
}

// Quadro do Painel com os documentos vencidos ou que vencem em breve (certidões, alvarás...)
export default function Vencimentos({ dados }) {
  return (
    <section className="painel vencimentos" aria-labelledby="titulo-vencimentos">
      <div className="painel-header">
        <h2 id="titulo-vencimentos">Documentos a vencer</h2>
        {dados && (dados.vencidos > 0 || dados.aVencer > 0) && (
          <span className="vencimentos-totais">
            {dados.vencidos > 0 && <span className="selo perigo">{dados.vencidos} vencido{dados.vencidos > 1 ? 's' : ''}</span>}
            {dados.aVencer > 0 && <span className="selo alerta">{dados.aVencer} a vencer</span>}
          </span>
        )}
      </div>

      {!dados ? (
        <div className="painel-corpo"><span className="esq" /><span className="esq curto" /></div>
      ) : dados.itens.length === 0 ? (
        <div className="vencimentos-vazio">
          <span className="estado-icone sucesso"><Icone nome="check" tamanho={20} /></span>
          <p>Nenhum documento vence nos próximos {dados.dias} dias.</p>
        </div>
      ) : (
        <ul className="lista-vencimentos">
          {dados.itens.map((doc) => {
            const { texto, classe } = prazo(doc.diasRestantes);
            return (
              <li key={doc.id}>
                <Link to={`/empresas/${doc.empresaId}`} className="vencimento">
                  <span className="vencimento-info">
                    <strong className="truncar">{nomeDocumento(doc)}</strong>
                    <small className="truncar">{doc.empresaNome}</small>
                  </span>
                  <span className="vencimento-prazo">
                    <span className={`selo ${classe}`}>{texto}</span>
                    <small>{formatarData(doc.validade)}</small>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
