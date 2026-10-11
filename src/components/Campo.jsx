// Campo de formulário com label, mensagem de erro e texto de ajuda.
// "col" e "colCelular" definem quantas das 12 colunas da grade o campo ocupa.
export default function Campo({ id, label, obrigatorio, erro, ajuda, col, colCelular, children }) {
  const estilo = col ? { '--col': col, '--col-m': colCelular || 12 } : undefined;
  return (
    <div className="campo" style={estilo}>
      <label className="campo-label" htmlFor={id}>
        {label} {obrigatorio && <span className="obrigatorio">*</span>}
      </label>
      {children}
      {erro ? <div className="campo-erro">{erro}</div> : ajuda && <div className="campo-ajuda">{ajuda}</div>}
    </div>
  );
}
