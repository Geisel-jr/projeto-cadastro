import { useState } from 'react';
import Campo from './Campo';
import Modal from './Modal';

// Pede o nome de quem está usando o sistema (registrado em toda alteração)
export default function ModalOperador({ atual, onSalvar, onFechar }) {
  const [nome, setNome] = useState(atual || '');
  const [erro, setErro] = useState(null);

  const salvar = (e) => {
    e.preventDefault();
    if (nome.trim().length < 2) {
      setErro('Informe seu nome.');
      return;
    }
    onSalvar(nome.trim());
  };

  return (
    <Modal
      titulo={atual ? 'Trocar operador' : 'Identificação do operador'}
      onFechar={onFechar}
      rodape={<button className="btn btn-primary" type="submit" form="form-operador">Confirmar</button>}
    >
      <form id="form-operador" onSubmit={salvar}>
        <p className="texto-suave small">
          Todas as inclusões, alterações e exclusões ficam registradas na auditoria com o nome do operador.
        </p>
        <Campo id="nome-operador" label="Seu nome" obrigatorio erro={erro}>
          <input
            id="nome-operador"
            className={`form-control ${erro ? 'is-invalid' : ''}`}
            value={nome}
            onChange={(e) => { setNome(e.target.value); setErro(null); }}
            maxLength={100}
            autoFocus
          />
        </Campo>
      </form>
    </Modal>
  );
}
