import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Abas com um indicador que desliza até a aba ativa.
// "contadores" mostra um número em vermelho na aba (ex: quantidade de erros).
export default function Abas({ abas, ativa, onTrocar, contadores = {} }) {
  const lista = useRef(null);
  const botoes = useRef({});
  const [indicador, setIndicador] = useState(null);

  const medir = useCallback(() => {
    const botao = botoes.current[ativa];
    if (!botao) return;
    const novo = { x: botao.offsetLeft, largura: botao.offsetWidth };
    setIndicador((atual) => (atual && atual.x === novo.x && atual.largura === novo.largura ? atual : novo));
  }, [ativa]);

  // Mede de novo quando a aba ativa ou os contadores mudam
  const assinatura = abas.map((a) => `${a.id}:${contadores[a.id] || 0}`).join('|');
  useLayoutEffect(medir, [medir, assinatura]);

  // ...e quando o tamanho muda (fonte carregada, janela redimensionada)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !lista.current) return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(lista.current);
    return () => observador.disconnect();
  }, [medir]);

  return (
    <div className="abas" role="tablist" ref={lista}>
      {abas.map((aba) => (
        <button
          key={aba.id}
          ref={(el) => { botoes.current[aba.id] = el; }}
          type="button"
          role="tab"
          aria-selected={ativa === aba.id}
          className={`aba ${ativa === aba.id ? 'ativa' : ''}`}
          onClick={() => onTrocar(aba.id)}
        >
          {aba.titulo}
          {contadores[aba.id] > 0 && <span className="aba-erro">{contadores[aba.id]}</span>}
        </button>
      ))}
      {indicador && (
        <span
          className="aba-indicador"
          style={{ transform: `translateX(${indicador.x}px)`, width: indicador.largura }}
        />
      )}
    </div>
  );
}
