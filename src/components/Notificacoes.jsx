import Icone from './Icone';

// Avisos no canto da tela (substituem o alert()).
export default function Notificacoes({ itens, onFechar }) {
  return (
    <div className="toast-area" role="status" aria-live="polite">
      {itens.map((n) => (
        <div key={n.id} className={`toast-item toast-${n.tipo} ${n.saindo ? 'saindo' : ''}`}>
          <span className="toast-icone">
            <Icone nome={n.tipo === 'sucesso' ? 'check' : 'alerta'} />
          </span>
          <div className="toast-texto">
            <strong>{n.titulo}</strong>
            {n.mensagem && <small>{n.mensagem}</small>}
          </div>
          <button className="btn-acao" onClick={() => onFechar(n.id)} aria-label="Fechar">
            <Icone nome="fechar" tamanho={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
