import Icone from './Icone';

// Páginas a mostrar: sempre a primeira, a última e as vizinhas da atual ("…" no meio)
function paginasVisiveis(atual, total) {
  const conjunto = new Set([1, total, atual - 1, atual, atual + 1]);
  const lista = [...conjunto].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const resultado = [];
  lista.forEach((p, i) => {
    if (i > 0 && p - lista[i - 1] > 1) resultado.push(`…${p}`);
    resultado.push(p);
  });
  return resultado;
}

// Rodapé da tabela: "21–40 de 57" e navegação entre páginas
export default function Paginacao({ pagina, paginas, total, porPagina, onMudar }) {
  const inicio = (pagina - 1) * porPagina + 1;
  const fim = Math.min(pagina * porPagina, total);

  return (
    <nav className="paginacao" aria-label="Paginação">
      <span className="paginacao-resumo">
        <strong>{inicio}–{fim}</strong> de {total}
      </span>
      {paginas > 1 && (
        <div className="paginacao-botoes">
          <button className="btn-icone" onClick={() => onMudar(pagina - 1)} disabled={pagina === 1} aria-label="Página anterior">
            <Icone nome="voltar" tamanho={16} />
          </button>
          {paginasVisiveis(pagina, paginas).map((p) =>
            typeof p === 'string' ? (
              <span key={p} className="paginacao-reticencias" aria-hidden="true">…</span>
            ) : (
              <button
                key={p}
                className={`paginacao-numero ${p === pagina ? 'atual' : ''}`}
                onClick={() => onMudar(p)}
                aria-current={p === pagina ? 'page' : undefined}
                aria-label={`Página ${p}`}
              >
                {p}
              </button>
            )
          )}
          <button className="btn-icone" onClick={() => onMudar(pagina + 1)} disabled={pagina === paginas} aria-label="Próxima página">
            <Icone nome="voltar" tamanho={16} className="girar-180" />
          </button>
        </div>
      )}
    </nav>
  );
}
