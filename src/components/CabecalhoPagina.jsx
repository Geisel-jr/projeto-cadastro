import Icone from './Icone';

export default function CabecalhoPagina({ titulo, subtitulo, onVoltar, children }) {
  return (
    <div className="page-header">
      <div>
        {onVoltar && (
          <button className="link-voltar" onClick={onVoltar}>
            <Icone nome="voltar" tamanho={16} /> Voltar
          </button>
        )}
        <h1 className="page-title">{titulo}</h1>
        {subtitulo && <p className="page-subtitle">{subtitulo}</p>}
      </div>
      {children && <div className="d-flex gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
