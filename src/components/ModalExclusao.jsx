import { useState } from 'react';
import { mensagemErro } from '../api';
import Campo from './Campo';
import Modal from './Modal';

const AVISO_PADRAO = 'O registro sai das listagens, mas continua guardado e pode ser restaurado em "Excluídos". '
  + 'A ação fica registrada na auditoria.';

// Confirmação de exclusão. O motivo é obrigatório e fica registrado na auditoria.
export default function ModalExclusao({
  titulo = 'Excluir registro',
  descricao,
  aviso = AVISO_PADRAO,
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
      rodape={
        <>
          <button className="btn btn-outline-secondary" onClick={onFechar} disabled={enviando}>Cancelar</button>
          <button className="btn btn-danger" type="submit" form="form-exclusao" disabled={enviando}>
            {enviando ? 'Aguarde...' : botao}
          </button>
        </>
      }
    >
      <form id="form-exclusao" onSubmit={confirmar}>
        <p className="mb-2">{descricao}</p>
        <p className="texto-suave small mb-3">{aviso}</p>
        <Campo id="motivo-exclusao" label="Motivo" obrigatorio erro={erro}>
          <textarea
            id="motivo-exclusao"
            className={`form-control ${erro ? 'is-invalid' : ''}`}
            rows={3}
            value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setErro(null); }}
            autoFocus
          />
        </Campo>
      </form>
    </Modal>
  );
}
