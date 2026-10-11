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
      titulo={atual ? 'Trocar operador' : 'Quem está usando o sistema?'}
      onFechar={onFechar}
      rodape={<button className="btn btn-primario" type="submit" form="form-operador">Confirmar</button>}
    >
      <p>Seu nome fica registrado em cada alteração.</p>
      <form id="form-operador" onSubmit={salvar}>
        <Campo id="nome-operador" label="Seu nome" obrigatorio erro={erro}>
          <input
            id="nome-operador"
            className={`entrada ${erro ? 'invalida' : ''}`}
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
