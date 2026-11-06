import Icone from './Icone';

// Requisitos de senha (os mesmos que a API exige), mostrados enquanto a pessoa digita
export const REQUISITOS_SENHA = [
  { texto: 'Pelo menos 8 caracteres', ok: (s) => s.length >= 8 },
  { texto: 'Letras e números', ok: (s) => /\p{L}/u.test(s) && /\d/.test(s) },
];

export const senhaAtendeRequisitos = (senha) => REQUISITOS_SENHA.every((r) => r.ok(senha));

export default function RequisitosSenha({ senha }) {
  return (
    <ul className="requisitos" aria-label="Requisitos da senha">
      {REQUISITOS_SENHA.map((r) => (
        <li key={r.texto} className={r.ok(senha) ? 'ok' : ''}>
          <Icone nome="check" tamanho={13} /> {r.texto}
        </li>
      ))}
    </ul>
  );
}
