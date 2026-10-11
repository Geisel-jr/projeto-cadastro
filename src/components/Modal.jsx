import { useEffect } from 'react';
import Icone from './Icone';

// Janela modal. Sem "onFechar", ela não pode ser fechada (nem por Esc nem clicando fora).
export default function Modal({ titulo, children, rodape, onFechar }) {
  useEffect(() => {
    if (!onFechar) return undefined;
    const aoTeclar = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar?.()}>
      <div className="modal-caixa" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <div className="modal-topo">
          <h2 id="modal-titulo">{titulo}</h2>
          {onFechar && (
            <button className="btn-icone" onClick={onFechar} aria-label="Fechar">
              <Icone nome="fechar" />
            </button>
          )}
        </div>
        <div className="modal-corpo">{children}</div>
        {rodape && <div className="modal-rodape">{rodape}</div>}
      </div>
    </div>
  );
}
