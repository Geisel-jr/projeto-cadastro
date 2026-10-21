import { useState } from 'react';
import Icone from './Icone';

// Campo de senha com botão de mostrar/ocultar e aviso de Caps Lock ligado
export default function CampoSenha({ id, valor, onChange, invalido, autoComplete, autoFocus, disabled }) {
  const [visivel, setVisivel] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const verificarCaps = (e) => setCapsLock(Boolean(e.getModifierState?.('CapsLock')));

  return (
    <>
      <div className="campo-senha">
        <input
          id={id}
          type={visivel ? 'text' : 'password'}
          className={`entrada ${invalido ? 'invalida' : ''}`}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={verificarCaps}
          onKeyDown={verificarCaps}
          onBlur={() => setCapsLock(false)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          maxLength={128}
          aria-invalid={Boolean(invalido)}
        />
        <button
          type="button"
          className="btn-acao"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
          title={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          disabled={disabled}
        >
          <Icone nome={visivel ? 'olho-fechado' : 'olho'} tamanho={16} />
        </button>
      </div>
      {capsLock && <div className="campo-ajuda aviso-caps" role="status">Caps Lock está ativado</div>}
    </>
  );
}
