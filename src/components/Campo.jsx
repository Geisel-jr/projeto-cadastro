// Campo de formulário com label, mensagem de erro e texto de ajuda.
export default function Campo({ label, obrigatorio, erro, ajuda, children, className = '' }) {
  return (
    <div className={`campo ${className}`}>
      <label className="form-label">
        {label} {obrigatorio && <span className="text-danger">*</span>}
      </label>
      {children}
      {erro ? (
        <div className="campo-erro">{erro}</div>
      ) : (
        ajuda && <div className="campo-ajuda">{ajuda}</div>
      )}
    </div>
  );
}
