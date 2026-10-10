import Icone from './Icone';

// Lista de "toasts" que aparecem no canto da tela (substitui o alert()).
export default function Notificacoes({ itens, onFechar }) {
  return (
    <div className="toast-area" role="status" aria-live="polite">
      {itens.map((n) => (
        <div key={n.id} className={`toast-item toast-${n.tipo}`}>
          <span className="toast-icone">
            <Icone nome={n.tipo === 'sucesso' ? 'check' : 'alerta'} />
          </span>
          <div className="flex-grow-1">
            <strong className="d-block">{n.titulo}</strong>
            {n.mensagem && <small>{n.mensagem}</small>}
          </div>
          <button className="btn-icone" onClick={() => onFechar(n.id)} aria-label="Fechar">
            <Icone nome="fechar" tamanho={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
