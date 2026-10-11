import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icone from './Icone';

const DURACAO_SAIDA = 150; // igual à animação "sair-modal" do CSS
const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Janela modal desenhada direto no <body> (portal), para nunca ficar atrás de
// outros elementos da página. Sem "onFechar", ela não pode ser fechada.
// "rodape" pode ser uma função que recebe "fechar" (fecha com animação).
export default function Modal({ titulo, children, rodape, onFechar }) {
  const [saindo, setSaindo] = useState(false);
  const caixa = useRef(null);

  const fechar = useCallback(() => {
    if (onFechar) setSaindo(true);
  }, [onFechar]);

  // Espera a animação de saída terminar antes de fechar de fato.
  // (Temporizador em vez de "animationend", que não dispara em abas em segundo plano.)
  useEffect(() => {
    if (!saindo) return undefined;
    const espera = setTimeout(onFechar, DURACAO_SAIDA);
    return () => clearTimeout(espera);
  }, [saindo, onFechar]);

  // Trava a rolagem da página e devolve o foco ao fechar
  useEffect(() => {
    const focoAnterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowAnterior;
      focoAnterior?.focus?.();
    };
  }, []);

  // Esc fecha; Tab circula só entre os elementos da janela
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === 'Escape') fechar();
      if (e.key !== 'Tab' || !caixa.current) return;
      const itens = [...caixa.current.querySelectorAll(FOCAVEIS)];
      if (itens.length === 0) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [fechar]);

  return createPortal(
    <div
      className={`modal-fundo ${saindo ? 'saindo' : ''}`}
      onMouseDown={(e) => e.target === e.currentTarget && fechar()}
    >
      <div className="modal-caixa" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" ref={caixa}>
        <div className="modal-topo">
          <h2 id="modal-titulo">{titulo}</h2>
          {onFechar && (
            <button className="btn-icone" onClick={fechar} aria-label="Fechar">
              <Icone nome="fechar" />
            </button>
          )}
        </div>
        <div className="modal-corpo">{children}</div>
        {rodape && <div className="modal-rodape">{typeof rodape === 'function' ? rodape(fechar) : rodape}</div>}
      </div>
    </div>,
    document.body
  );
}
