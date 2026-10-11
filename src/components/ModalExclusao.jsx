import { useState } from 'react';
import { mensagemErro } from '../api';
import Campo from './Campo';
import Modal from './Modal';

// Confirmação de exclusão. O motivo é obrigatório e fica registrado na auditoria.
export default function ModalExclusao({
  titulo = 'Excluir registro',
  descricao,
  aviso = 'Poderá ser restaurado depois.',
  botao = 'Excluir',
  onConfirmar,
  onFechar,
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async (e) => {
    e.preventDefault();
    if (motivo.trim().length < 3) {
      setErro('Informe o motivo (mínimo 3 caracteres).');
      return;
    }
    setEnviando(true);
    try {
      await onConfirmar(motivo.trim());
    } catch (err) {
      setErro(err.campos?.motivo || mensagemErro(err));
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={titulo}
      onFechar={enviando ? undefined : onFechar}
      rodape={(fechar) => (
        <>
          <button className="btn btn-secundario" onClick={fechar} disabled={enviando}>Cancelar</button>
          <button className="btn btn-perigo" type="submit" form="form-exclusao" disabled={enviando}>
            {enviando && <span className="spinner" />}
            {enviando ? 'Aguarde...' : botao}
          </button>
        </>
      )}
    >
      <p>{descricao} {aviso}</p>
      <form id="form-exclusao" onSubmit={confirmar}>
        <Campo id="motivo-exclusao" label="Motivo" obrigatorio erro={erro}>
          <textarea
            id="motivo-exclusao"
            className={`entrada ${erro ? 'invalida' : ''}`}
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setErro(null); }}
            autoFocus
          />
        </Campo>
      </form>
    </Modal>
  );
}
